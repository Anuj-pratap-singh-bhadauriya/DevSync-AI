require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); 
const https = require('https'); 
const { Server } = require('socket.io'); 

// --- DATABASE INTEGRATIONS ---
const { PrismaClient } = require('@prisma/client'); 
const mongoose = require('mongoose'); 

// --- MODELS & MIDDLEWARE ---
const Chat = require('./models/Chat');
const ActivityLog = require('./models/ActivityLog');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const fetchuser = require('./middleware/fetchuser');
const { sendOTP } = require('./emailService');

const app = express();
const server = http.createServer(app); 

// ---> NAYA CHANGE: Allowed Origins Setup <---
const allowedOrigins = [
    "http://localhost:5173", 
    "http://localhost:5000", 
    "https://devsync-ai-kappa.vercel.app"
];

// ---> NAYA CHANGE: Socket.io CORS Update <---
const io = new Server(server, { 
    cors: { 
        origin: allowedOrigins, 
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    } 
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// ---------------------------------------------------------
// OTP STORE (In-Memory with 5-minute expiry)
// ---------------------------------------------------------
const otpStore = new Map(); // key: email, value: { otp, name, password, expiresAt }

// Track connected users per room for video calls
const roomUsers = new Map(); // roomId → Set of { socketId, email }

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const cleanupExpiredOTPs = () => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
};
// Auto-cleanup every 2 minutes
setInterval(cleanupExpiredOTPs, 2 * 60 * 1000);

const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN });

// ---> NEW CHANGE: Express CORS Update <---
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

// ---------------------------------------------------------
// CORE DATABASE CONNECTION (MONGODB)
// ---------------------------------------------------------
const connectMongoDB = async () => {
    try {
        if (!process.env.MONGO_URI) return console.warn("⚠️ MongoDB Initialization Skipped.");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected: Chat and logging engine initialized.");
    } catch (err) { console.error("❌ MongoDB Connection Failure:", err.message); }
};
connectMongoDB();

// ---------------------------------------------------------
// REAL-TIME COLLABORATION HUB (SOCKET.IO)
// ---------------------------------------------------------
io.on('connection', (socket) => {
    socket.on('join-room', (roomId, userEmail) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.userEmail = userEmail || 'Anonymous';

        // Track user in room
        if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
        roomUsers.get(roomId).add({ socketId: socket.id, email: socket.userEmail });

        // Broadcast updated user list
        io.to(roomId).emit('room-users-update', Array.from(roomUsers.get(roomId)));
        socket.to(roomId).emit('user-joined', { message: `A new collaborator has entered the workspace.` });
    });

    socket.on('code-change', (data) => {
        socket.to(data.roomId).emit('receive-code', { fileName: data.fileName, newContent: data.code });
    });

    socket.on('file-structure-change', (data) => {
        socket.to(data.roomId).emit('receive-file-structure', { files: data.files, activeFileName: data.activeFileName });
    });

    socket.on('send-team-message', async (data) => {
        try {
            if (mongoose.connection.readyState === 1) {
                const newChat = new Chat({ roomId: data.roomId, senderEmail: data.senderEmail, message: data.message });
                await newChat.save();
            }
            socket.to(data.roomId).emit('receive-team-message', { senderEmail: data.senderEmail, message: data.message, timestamp: new Date() });
        } catch (error) {}
    });

    socket.on('log-activity', async (data) => {
        try {
            if (mongoose.connection.readyState === 1) {
                const newLog = new ActivityLog({ roomId: data.roomId, userEmail: data.userEmail, action: data.action });
                await newLog.save();
            }
            socket.to(data.roomId).emit('receive-activity-log', data);
        } catch (error) {}
    });

    socket.on('start-interview', ({ roomId, durationMinutes }) => {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        io.to(roomId).emit('interview-started', { endTime });
    });

    socket.on('end-interview', ({ roomId }) => { io.to(roomId).emit('interview-ended'); });

    // --- WebRTC Video Call Signaling ---
    socket.on('join-call', ({ roomId }) => {
        socket.to(roomId).emit('call-user-joined', { socketId: socket.id, email: socket.userEmail });
    });

    socket.on('leave-call', ({ roomId }) => {
        socket.to(roomId).emit('call-user-left', { socketId: socket.id, email: socket.userEmail });
    });

    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
        io.to(targetSocketId).emit('webrtc-offer', { senderSocketId: socket.id, offer });
    });

    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
        io.to(targetSocketId).emit('webrtc-answer', { senderSocketId: socket.id, answer });
    });

    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
        io.to(targetSocketId).emit('webrtc-ice-candidate', { senderSocketId: socket.id, candidate });
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId && roomUsers.has(roomId)) {
            const users = roomUsers.get(roomId);
            for (const user of users) {
                if (user.socketId === socket.id) {
                    users.delete(user);
                    break;
                }
            }
            if (users.size === 0) {
                roomUsers.delete(roomId);
            } else {
                io.to(roomId).emit('room-users-update', Array.from(users));
            }
            // Notify others that this user left the call (if they were in one)
            socket.to(roomId).emit('call-user-left', { socketId: socket.id, email: socket.userEmail });
        }
    });
});

// ---------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------
app.get('/api/ping', (req, res) => res.json({ status: "Secure", timestamp: new Date() }));

// --- STEP 1: Send OTP to email ---
app.post('/api/send-otp', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Validate email format (basic format check — actual delivery is verified by SMTP)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        // Check if email already registered
        if (await prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ error: "This email is already registered. Please login instead." });
        }

        // Generate OTP and store temporarily
        const otp = generateOTP();
        const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

        otpStore.set(email, {
            otp,
            name,
            password,
            expiresAt: Date.now() + OTP_EXPIRY_MS
        });

        // Send OTP via email
        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            otpStore.delete(email);
            return res.status(400).json({ error: emailResult.message });
        }

        console.log(`📧 OTP sent to ${email}`);
        res.json({ message: "OTP sent successfully! Check your email." });

    } catch (error) {
        console.error("Send OTP Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

// --- STEP 2: Verify OTP and create account ---
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required." });
        }

        const storedData = otpStore.get(email);

        // Check if OTP exists
        if (!storedData) {
            return res.status(400).json({ error: "No OTP found. Please request a new one." });
        }

        // Check if OTP expired
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        // Verify OTP
        if (storedData.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please try again." });
        }

        // OTP verified! Create the user account
        const hashedPassword = await bcrypt.hash(storedData.password, 10);
        await prisma.user.create({
            data: {
                name: storedData.name,
                email: email,
                password: hashedPassword
            }
        });

        // Cleanup OTP from store
        otpStore.delete(email);

        console.log(`✅ Account created for ${email} (OTP verified)`);
        res.status(201).json({ message: "Email verified & account created successfully!" });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials." });
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.post('/api/getuser', fetchuser, async (req, res) => {
    try { res.json(await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, email: true } })); } 
    catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.post('/api/projects', fetchuser, async (req, res) => {
    try {
        const newProject = await prisma.project.create({ data: { title: req.body.title, description: req.body.description, ownerId: req.user.userId } });
        await prisma.workspaceMember.create({ data: { workspaceId: newProject.id, userId: req.user.userId, role: 'OWNER' } });
        res.status(201).json(newProject);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects', fetchuser, async (req, res) => {
    try { res.json(await prisma.project.findMany({ where: { OR: [{ ownerId: req.user.userId }, { members: { some: { userId: req.user.userId } } }] } })); } 
    catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects/:id', fetchuser, async (req, res) => {
    try {
        const workspace = await prisma.project.findUnique({ where: { id: req.params.id }, include: { members: true } });
        if (!workspace) return res.status(404).json({ error: "Not found." });
        res.json(workspace);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.put('/api/projects/:id', fetchuser, async (req, res) => {
    try { res.json(await prisma.project.update({ where: { id: req.params.id }, data: { title: req.body.title, description: req.body.description } })); } 
    catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.delete('/api/projects/:id', fetchuser, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!project) return res.status(404).json({ error: "Workspace not found." });
        if (project.ownerId !== req.user.userId) return res.status(401).json({ error: "Unauthorized. Only the owner can terminate this workspace." });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: req.params.id } });
        await prisma.project.delete({ where: { id: req.params.id } });
        res.json({ message: "Workspace terminated successfully." });
    } catch (error) { res.status(500).json({ error: "Failed to terminate workspace." }); }
});

app.post('/api/projects/:id/invite', fetchuser, async (req, res) => {
    try {
        const targetUser = await prisma.user.findUnique({ where: { email: req.body.targetEmail } });
        if (!targetUser) return res.status(404).json({ error: "User not found. They must have a DevSync account first." });
        if (targetUser.id === req.user.userId) return res.status(400).json({ error: "You cannot invite yourself." });

        // Check if already a member
        const existingMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.id, userId: targetUser.id } }
        });
        if (existingMember) return res.status(400).json({ error: "User is already a member of this workspace." });

        // Check if invitation already pending
        const existingInvite = await prisma.invitation.findUnique({
            where: { workspaceId_receiverId: { workspaceId: req.params.id, receiverId: targetUser.id } }
        });
        if (existingInvite && existingInvite.status === 'PENDING') return res.status(400).json({ error: "Invitation already sent to this user." });

        // Delete old rejected invitation if exists, then create new
        if (existingInvite) await prisma.invitation.delete({ where: { id: existingInvite.id } });

        const invitation = await prisma.invitation.create({
            data: {
                workspaceId: req.params.id,
                senderId: req.user.userId,
                receiverId: targetUser.id
            },
            include: { workspace: { select: { title: true } }, sender: { select: { name: true, email: true } } }
        });

        // Real-time notification via Socket.IO
        const roomUsers = io.sockets.sockets;
        for (const [, s] of roomUsers) {
            if (s.userEmail === targetUser.email) {
                s.emit('new-invitation', invitation);
            }
        }

        res.status(201).json({ message: "Invitation sent! Waiting for them to accept." });
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: "Server error." });
    }
});

// --- Get pending invitations for logged-in user ---
app.get('/api/invitations', fetchuser, async (req, res) => {
    try {
        const invitations = await prisma.invitation.findMany({
            where: { receiverId: req.user.userId, status: 'PENDING' },
            include: {
                workspace: { select: { id: true, title: true } },
                sender: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invitations);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- Accept an invitation ---
app.post('/api/invitations/:id/accept', fetchuser, async (req, res) => {
    try {
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });
        if (invitation.status !== 'PENDING') return res.status(400).json({ error: "Invitation already processed." });

        // Add as workspace member
        await prisma.workspaceMember.create({
            data: { workspaceId: invitation.workspaceId, userId: req.user.userId, role: 'COLLABORATOR' }
        });

        // Update invitation status
        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' } });

        res.json({ message: "Invitation accepted! Workspace added to your dashboard." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- Reject an invitation ---
app.post('/api/invitations/:id/reject', fetchuser, async (req, res) => {
    try {
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });

        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
        res.json({ message: "Invitation rejected." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects/:id/chats', fetchuser, async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]); 
        res.json(await Chat.find({ roomId: req.params.id }).sort('timestamp').limit(50));
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects/:id/logs', fetchuser, async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]); 
        res.json(await ActivityLog.find({ roomId: req.params.id }).sort('-timestamp').limit(50));
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.post('/api/audit', fetchuser, async (req, res) => {
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: "system", content: "Analyze code, identify bugs, return plain text log." }, { role: "user", content: req.body.codeBuffer }],
            model: "gpt-4o-mini", temperature: 0.1, max_tokens: 150
        });
        res.json({ auditLog: response.choices[0].message.content });
    } catch (error) { res.json({ auditLog: `> [SYSTEM ERROR] AI failure.` }); }
});

// --- UPDATED CO PILOT CHAT WITH MEMORY ARCHITECTURE ---
app.post('/api/chat', fetchuser, async (req, res) => {
    try {
        // NAYA: Receiving full historical sequence array from frontend
        const { promptMessage, history } = req.body;
        
        let apiMessages = [
            { 
                role: "system", 
                content: "You are an advanced AI Copilot inside a professional collaborative IDE. Reply as plain text console output. Always keep track of previous code requests and maintain thread history context seamlessly." 
            }
        ];

        // Inject sequence array into model thread pipeline if exists
        if (history && Array.isArray(history)) {
            apiMessages = [...apiMessages, ...history];
        } else {
            apiMessages.push({ role: "user", content: promptMessage });
        }

        const response = await client.chat.completions.create({
            messages: apiMessages,
            model: "gpt-4o-mini", temperature: 0.5, max_tokens: 300
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) { res.json({ reply: `⚡ [SYSTEM EXCEPTION] AI failure.` }); }
});

// --- COMPILER ENGINE ---
app.post('/api/execute', fetchuser, async (req, res) => {
    try {
        const { language, codeBuffer, customInput } = req.body;
        
        let userContent = `Language: ${language}\nCode:\n${codeBuffer}`;
        if (customInput && customInput.trim() !== "") {
            userContent += `\n\nStandard Input (stdin):\n${customInput}`;
        }
        
        const response = await client.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a strict code compiler and batch execution terminal. The user will provide code and optionally standard input (stdin).\n\nCRITICAL RULES:\n1. If there are syntax errors, output ONLY the standard raw compiler error message.\n2. If the code is correct, simulate its execution.\n3. Use the provided Standard Input for any input requests (like cin, scanf, input(), Scanner).\n4. FATAL RULE: If the code requires input (e.g. cin) to proceed, but the Standard Input provided is EMPTY or has INSUFFICIENT values, YOU MUST NOT hallucinate or guess values. You MUST immediately stop execution and output EXACTLY: '[Runtime Error] EOFError: Program required user input but Standard Input (stdin) was empty or exhausted.'\n5. Output ONLY the exact execution stdout. Do NOT provide explanations, do NOT fix the code, and do NOT wrap the output in markdown backticks. Behave exactly like a raw linux terminal." 
                }, 
                { 
                    role: "user", 
                    content: userContent 
                }
            ],
            model: "gpt-4o-mini", 
            temperature: 0.0, 
            max_tokens: 500
        });
        
        let finalOutput = response.choices[0].message.content;
        
        if (finalOutput.startsWith('```')) {
    finalOutput = finalOutput.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
}

        res.json({ output: finalOutput.trim() || "Execution complete. No output." });
    } catch (error) { 
        res.status(500).json({ error: "Virtual Execution Engine Failed." }); 
    }
});

server.listen(PORT, () => console.log(`🚀 DevSync Enterprise Engine is active on port ${PORT}`));