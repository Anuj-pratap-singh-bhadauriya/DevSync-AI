require('dotenv').config();

// --- Global Error Handlers (prevent silent crashes in production) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
});
const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

// --- DATABASE INTEGRATIONS ---
const prisma = require('./lib/prisma');
const mongoose = require('mongoose'); 

// --- MODELS & MIDDLEWARE ---
const Chat = require('./models/Chat');
const ActivityLog = require('./models/ActivityLog');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const fetchuser = require('./middleware/fetchuser');
const { sendOTP } = require('./emailService');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const checkMembership = require('./middleware/checkMembership');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app); 

// ---> NAYA CHANGE: Allowed Origins Setup <---
const allowedOrigins = [
    "http://localhost:5173", 
    "http://localhost:5000", 
    "https://devsync-ai-kappa.vercel.app",
    /\.vercel\.app$/
];

// ---> NAYA CHANGE: Socket.io CORS Update <---
const io = new Server(server, { 
    cors: { 
        origin: allowedOrigins, 
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    } 
});


const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('🔥 FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
    process.exit(1);
}

// ---------------------------------------------------------
// OTP STORE (In-Memory with 5-minute expiry)
// ---------------------------------------------------------
const otpStore = new Map(); // key: email, value: { otp, name, password, expiresAt }
const resetOtpStore = new Map(); // key: email, value: { otp, expiresAt }

// Track connected users per room for video calls
const roomUsers = new Map(); // roomId → Map<socketId, { socketId, email, name }>

// Track active workspace state for persistence
const activeWorkspaces = new Map(); // roomId -> { files, activeFileName, interviewEndTime, videoParticipants }

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const cleanupExpiredOTPs = () => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
    for (const [email, data] of resetOtpStore.entries()) {
        if (now > data.expiresAt) resetOtpStore.delete(email);
    }
};
// Auto-cleanup every 2 minutes
setInterval(cleanupExpiredOTPs, 2 * 60 * 1000);

// Cleanup abandoned activeWorkspaces entries every 30 minutes
setInterval(() => {
    for (const [roomId] of activeWorkspaces.entries()) {
        // If no sockets are tracked in roomUsers for this room, it's abandoned
        if (!roomUsers.has(roomId) || roomUsers.get(roomId).size === 0) {
            activeWorkspaces.delete(roomId);
            roomUsers.delete(roomId);
            console.log(`🧹 Cleaned up abandoned workspace: ${roomId}`);
        }
    }
}, 30 * 60 * 1000);

const client = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN });

// ---> NEW CHANGE: Express CORS Update <---
app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
    message: { error: "Too many requests from this IP, please try again later." }
});
app.use('/api', globalLimiter);

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many attempts. Please try again after 15 minutes." }
});

const leetcodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 requests per 15 minutes per IP to avoid LeetCode banning our server
    message: { error: "Too many problem requests. Please slow down." }
});

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
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: Token missing"));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; 
        next();
    } catch (error) {
        next(new Error("Authentication error: Invalid token"));
    }
});

io.on('connection', (socket) => {
    socket.on('join-room', async (roomId, userEmail, userName) => {
        try {
            const project = await prisma.project.findUnique({
                where: { id: roomId },
                include: { members: true }
            });
            if (!project) return socket.emit('error', 'Workspace not found');

            const isOwner = project.ownerId === socket.user.userId;
            const isMember = project.members.some(m => m.userId === socket.user.userId);
            
            if (!isOwner && !isMember) {
                return socket.emit('error', 'Access denied to this workspace');
            }

            socket.join(roomId);
            socket.roomId = roomId;
            socket.userEmail = userEmail || 'Anonymous';
            socket.userName = userName || userEmail || 'Anonymous';

            // Track user in room
            if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
            roomUsers.get(roomId).set(socket.id, { socketId: socket.id, email: socket.userEmail, name: socket.userName });

            // Ensure workspace state exists
            if (!activeWorkspaces.has(roomId)) {
                let initialFiles = [];
                try {
                    if (project.description && project.description.startsWith("[")) {
                        initialFiles = JSON.parse(project.description);
                    }
                } catch(e) {}
                if (initialFiles.length === 0) initialFiles = [{ name: "index.js", language: "javascript", content: "// DevSync Initialized" }];
                
                activeWorkspaces.set(roomId, {
                    files: initialFiles,
                    activeFileName: initialFiles[0]?.name || "index.js",
                    interviewEndTime: null,
                    videoParticipants: new Set(),
                    arenaProblem: null
                });
            }

            // Sync state to the newly joined user
            const currentState = activeWorkspaces.get(roomId);
            socket.emit('workspace-state-sync', {
                files: currentState.files,
                activeFileName: currentState.activeFileName,
                interviewEndTime: currentState.interviewEndTime,
                videoParticipants: Array.from(currentState.videoParticipants),
                arenaProblem: currentState.arenaProblem || null
            });

            // Broadcast updated user list
            io.to(roomId).emit('room-users-update', Array.from(roomUsers.get(roomId).values()));
            socket.to(roomId).emit('user-joined', { message: `A new collaborator has entered the workspace.` });
        } catch (error) {
            console.error("Socket join-room error:", error);
        }
    });

    socket.on('code-change', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) {
            const file = state.files.find(f => f.name === data.fileName);
            if (file) file.content = data.code;
        }
        socket.to(data.roomId).emit('receive-code', { fileName: data.fileName, newContent: data.code });
    });

    socket.on('file-structure-change', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) {
            state.files = data.files;
            state.activeFileName = data.activeFileName;
        }
        socket.to(data.roomId).emit('receive-file-structure', { files: data.files, activeFileName: data.activeFileName });
    });

    socket.on('arena-problem-sync', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) state.arenaProblem = data.problem;
        socket.to(data.roomId).emit('arena-problem-sync', data.problem);
    });

    socket.on('send-team-message', async (data) => {
        try {
            if (mongoose.connection.readyState === 1) {
                const newChat = new Chat({ roomId: data.roomId, senderEmail: data.senderEmail, message: data.message });
                await newChat.save();
            }
            socket.to(data.roomId).emit('receive-team-message', { senderEmail: data.senderEmail, message: data.message, timestamp: new Date() });
        } catch (error) { console.error('send-team-message error:', error); }
    });

    socket.on('log-activity', async (data) => {
        try {
            if (mongoose.connection.readyState === 1) {
                const newLog = new ActivityLog({ roomId: data.roomId, userEmail: data.userEmail, action: data.action });
                await newLog.save();
            }
            socket.to(data.roomId).emit('receive-activity-log', data);
        } catch (error) { console.error('log-activity error:', error); }
    });

    socket.on('start-interview', ({ roomId, durationMinutes }) => {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).interviewEndTime = endTime;
        io.to(roomId).emit('interview-started', { endTime });
    });

    socket.on('end-interview', ({ roomId }) => { 
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).interviewEndTime = null;
        io.to(roomId).emit('interview-ended'); 
    });

    // --- WebRTC Video Call Signaling ---
    socket.on('join-call', ({ roomId }) => {
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).videoParticipants.add(socket.id);
        socket.to(roomId).emit('call-user-joined', { socketId: socket.id, email: socket.userEmail });
    });

    socket.on('leave-call', ({ roomId }) => {
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).videoParticipants.delete(socket.id);
        socket.to(roomId).emit('call-user-left', { socketId: socket.id, email: socket.userEmail });
    });

    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
        io.to(targetSocketId).emit('webrtc-offer', { senderSocketId: socket.id, senderEmail: socket.userEmail, offer });
    });

    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
        io.to(targetSocketId).emit('webrtc-answer', { senderSocketId: socket.id, answer });
    });

    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
        io.to(targetSocketId).emit('webrtc-ice-candidate', { senderSocketId: socket.id, candidate });
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', async () => {
        const roomId = socket.roomId;
        if (roomId && roomUsers.has(roomId)) {
            const users = roomUsers.get(roomId);
            users.delete(socket.id);
            if (activeWorkspaces.has(roomId)) {
                activeWorkspaces.get(roomId).videoParticipants.delete(socket.id);
            }
            if (users.size === 0) {
                roomUsers.delete(roomId);
                
                // --- DB Auto-Save when last user disconnects ---
                const state = activeWorkspaces.get(roomId);
                if (state && state.files && state.files.length > 0) {
                    try {
                        await prisma.project.update({
                            where: { id: roomId },
                            data: { description: JSON.stringify(state.files) }
                        });
                        console.log(`💾 Auto-saved workspace ${roomId} to database.`);
                    } catch (e) {
                        console.error(`Failed to auto-save workspace ${roomId}`, e);
                    }
                }
                // Only delete in-memory state if no new users joined during the async save
                if (!roomUsers.has(roomId)) {
                    activeWorkspaces.delete(roomId);
                }
            } else {
                io.to(roomId).emit('room-users-update', Array.from(users.values()));
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
app.post('/api/send-otp', otpLimiter, async (req, res) => {
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
        const hashedPassword = await bcrypt.hash(password, 10);

        otpStore.set(email, {
            otp,
            name,
            password: hashedPassword,
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
app.post('/api/verify-otp', otpLimiter, async (req, res) => {
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

        // OTP verified! Create the user account (password already hashed at registration time)
        await prisma.user.create({
            data: {
                name: storedData.name,
                email: email,
                password: storedData.password
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

app.post('/api/login', otpLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials." });
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// ---------------------------------------------------------
// FORGOT / RESET PASSWORD ROUTES
// ---------------------------------------------------------
app.post('/api/forgot-password', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "Account with this email does not exist." });

        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
        
        resetOtpStore.set(email, { otp, expiresAt });

        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            resetOtpStore.delete(email);
            return res.status(400).json({ error: emailResult.message });
        }

        console.log(`✅ Password reset OTP sent to ${email}`);
        res.status(200).json({ message: "Verification code sent to your email." });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

app.post('/api/reset-password', otpLimiter, async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const storedData = resetOtpStore.get(email);
        if (!storedData) {
            return res.status(400).json({ error: "OTP expired or not requested. Please try again." });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please check the code and try again." });
        }

        if (Date.now() > storedData.expiresAt) {
            resetOtpStore.delete(email);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        // Hash new password and update user
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        // Cleanup
        resetOtpStore.delete(email);

        console.log(`✅ Password reset successfully for ${email}`);
        res.status(200).json({ message: "Password updated successfully! You can now log in." });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

app.post('/api/getuser', fetchuser, async (req, res) => {
    try { res.json(await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, email: true } })); } 
    catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- TURN Credentials (served securely from env) ---
app.get('/api/turn-credentials', fetchuser, (req, res) => {
    res.json({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'turn:global.relay.metered.ca:80', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turn:global.relay.metered.ca:443', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }
        ]
    });
});

// --- LeetCode Proxy Routes ---
app.get('/api/leetcode/problems', fetchuser, leetcodeLimiter, async (req, res) => {
    const limit = req.query.limit || 100;
    const query = `
        query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
            problemsetQuestionList: questionList(categorySlug: $categorySlug limit: $limit skip: $skip filters: $filters) {
                total: totalNum
                questions: data {
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    acRate
                    topicTags { name slug }
                }
            }
        }
    `;
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            body: JSON.stringify({ query, variables: { categorySlug: '', limit: parseInt(limit), skip: 0, filters: {} } })
        });
        const data = await response.json();
        res.json(data?.data?.problemsetQuestionList || { questions: [], total: 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch problems from LeetCode' });
    }
});

app.get('/api/leetcode/problem/:titleSlug', fetchuser, leetcodeLimiter, async (req, res) => {
    const { titleSlug } = req.params;
    if (!/^[a-z0-9-]{1,100}$/.test(titleSlug)) {
        return res.status(400).json({ error: "Invalid problem slug." });
    }
    const query = `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionFrontendId
                title
                content
                difficulty
                topicTags { name }
                stats
                hints
            }
        }
    `;
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://leetcode.com' },
            body: JSON.stringify({ query, variables: { titleSlug } })
        });
        const data = await response.json();
        const q = data?.data?.question;
        if (!q) return res.status(404).json({ error: 'Problem not found' });
        res.json({ question: q.content, title: q.title, difficulty: q.difficulty, topicTags: q.topicTags, hints: q.hints });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch problem from LeetCode' });
    }
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

app.get('/api/projects/:id', fetchuser, checkMembership, async (req, res) => {
    try {
        const workspace = await prisma.project.findUnique({ where: { id: req.params.id }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } });
        if (!workspace) return res.status(404).json({ error: "Not found." });
        res.json(workspace);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.put('/api/projects/:id', fetchuser, checkMembership, async (req, res) => {
    try { res.json(await prisma.project.update({ where: { id: req.params.id }, data: { title: req.body.title, description: req.body.description } })); } 
    catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.delete('/api/projects/:id', fetchuser, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: "Workspace not found." });
        if (project.ownerId !== req.user.userId) return res.status(401).json({ error: "Unauthorized. Only the owner can terminate this workspace." });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: projectId } });
        await prisma.project.delete({ where: { id: projectId } });

        // Clean up in-memory state and kick any connected sockets
        activeWorkspaces.delete(projectId);
        if (roomUsers.has(projectId)) {
            roomUsers.get(projectId).forEach(({ socketId }) => {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.emit('workspace-deleted', { message: "This workspace has been deleted by the owner." });
            });
            roomUsers.delete(projectId);
        }

        res.json({ message: "Workspace terminated successfully." });
    } catch (error) { res.status(500).json({ error: "Failed to terminate workspace." }); }
});

// --- Remove a member ---
app.delete('/api/projects/:id/members/:memberId', fetchuser, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (project.ownerId !== req.user.userId && req.params.memberId !== req.user.userId) {
            return res.status(403).json({ error: "Unauthorized. Only the owner can remove members, or members can remove themselves." });
        }
        
        const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.memberId } }, include: { user: true } });
        if (!member) return res.status(404).json({ error: "Member not found." });
        if (member.role === 'OWNER') return res.status(400).json({ error: "Cannot remove the owner." });

        await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.memberId } } });
        const kickMessage = req.user.userId === req.params.memberId 
            ? "You have left the workspace."
            : "You have been removed from the workspace by the owner.";

        // Kick them out if active
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === member.user.email) {
                s.emit('kicked-out', { message: kickMessage });
            }
        }
        res.json({ message: "Member removed." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.post('/api/projects/:id/invite', fetchuser, checkMembership, async (req, res) => {
    try {
        const targetUser = await prisma.user.findUnique({ where: { email: req.body.targetEmail } });
        if (!targetUser) return res.status(404).json({ error: "User not found. They must have a DevSync account first." });
        if (targetUser.id === req.user.userId) return res.status(400).json({ error: "You cannot invite yourself." });

        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        const isOwner = project.ownerId === req.user.userId;
        const inviteStatus = isOwner ? 'PENDING' : 'REQUESTED_BY_COLLAB';

        // Check if already a member
        const existingMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.id, userId: targetUser.id } }
        });
        if (existingMember) return res.status(400).json({ error: "User is already a member of this workspace." });

        // Check if invitation already pending
        const existingInvite = await prisma.invitation.findUnique({
            where: { workspaceId_receiverId: { workspaceId: req.params.id, receiverId: targetUser.id } }
        });
        if (existingInvite && (existingInvite.status === 'PENDING' || existingInvite.status === 'REQUESTED_BY_COLLAB')) {
            return res.status(400).json({ error: "Invitation or request already pending for this user." });
        }

        // Delete old rejected invitation if exists, then create new
        if (existingInvite) await prisma.invitation.delete({ where: { id: existingInvite.id } });

        const invitation = await prisma.invitation.create({
            data: {
                workspaceId: req.params.id,
                senderId: req.user.userId,
                receiverId: targetUser.id,
                status: inviteStatus
            },
            include: { workspace: { select: { title: true } }, sender: { select: { name: true, email: true } }, receiver: { select: { name: true, email: true } } }
        });

        if (isOwner) {
            const allSockets = io.sockets.sockets;
            for (const [, s] of allSockets) {
                if (s.userEmail === targetUser.email) {
                    s.emit('new-invitation', invitation);
                }
            }
            res.status(201).json({ message: "Invitation sent! Waiting for them to accept." });
        } else {
            io.to(req.params.id).emit('invite-approval-request', { ...invitation, ownerId: project.ownerId });
            res.status(201).json({ message: "Request sent to Owner for approval." });
        }
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: "Server error." });
    }
});

// --- Get Collab Invite Requests for a project (Owner only) ---
app.get('/api/projects/:id/invite-requests', fetchuser, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (project.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        const requests = await prisma.invitation.findMany({
            where: { workspaceId: req.params.id, status: 'REQUESTED_BY_COLLAB' },
            include: { sender: { select: { name: true, email: true } }, receiver: { select: { name: true, email: true } } }
        });
        res.json(requests);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- Approve Collab Invite Request ---
app.post('/api/invites/:id/approve', fetchuser, async (req, res) => {
    try {
        const invite = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { workspace: { include: { owner: true } }, receiver: true, sender: true } });
        if (!invite || invite.status !== 'REQUESTED_BY_COLLAB') return res.status(404).json({ error: "Request not found" });
        if (invite.workspace.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        const updated = await prisma.invitation.update({
            where: { id: req.params.id },
            data: { status: 'PENDING' },
            include: { workspace: { select: { title: true } }, sender: { select: { name: true, email: true } } }
        });

        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invite.receiver.email) {
                s.emit('new-invitation', updated);
            }
            if (s.userEmail === invite.sender.email) {
                s.emit('invite-decision', { status: 'ALLOWED', target: invite.receiver.name || invite.receiver.email, owner: invite.workspace.owner.name || "Owner" });
            }
        }
        res.json({ message: "Invite approved and sent." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- Deny Collab Invite Request ---
app.post('/api/invites/:id/deny', fetchuser, async (req, res) => {
    try {
        const invite = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { workspace: { include: { owner: true } }, sender: true, receiver: true } });
        if (!invite || invite.status !== 'REQUESTED_BY_COLLAB') return res.status(404).json({ error: "Request not found" });
        if (invite.workspace.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        await prisma.invitation.delete({ where: { id: req.params.id } });
        
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invite.sender.email) {
                s.emit('invite-decision', { status: 'DENIED', target: invite.receiver.name || invite.receiver.email, owner: invite.workspace.owner.name || "Owner" });
            }
        }
        res.json({ message: "Invite request denied." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
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
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { sender: true, workspace: { include: { owner: true } }, receiver: true } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });
        if (invitation.status !== 'PENDING') return res.status(400).json({ error: "Invitation already processed." });

        // Add as workspace member
        await prisma.workspaceMember.create({
            data: { workspaceId: invitation.workspaceId, userId: req.user.userId, role: 'COLLABORATOR' }
        });

        // Update invitation status
        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' } });

        const newMember = {
            id: 'temp-' + Date.now(),
            userId: invitation.receiver.id,
            workspaceId: invitation.workspaceId,
            role: 'COLLABORATOR',
            user: { id: invitation.receiver.id, name: invitation.receiver.name, email: invitation.receiver.email }
        };

        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invitation.sender.email || s.userEmail === invitation.workspace.owner.email) {
                s.emit('invite-response', { status: 'ACCEPTED', user: invitation.receiver.name || invitation.receiver.email, newMember });
            }
        }

        res.json({ message: "Invitation accepted! Workspace added to your dashboard." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

// --- Reject an invitation ---
app.post('/api/invitations/:id/reject', fetchuser, async (req, res) => {
    try {
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { sender: true, workspace: { include: { owner: true } }, receiver: true } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });

        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
        
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invitation.sender.email || s.userEmail === invitation.workspace.owner.email) {
                s.emit('invite-response', { status: 'REJECTED', user: invitation.receiver.name || invitation.receiver.email });
            }
        }
        
        res.json({ message: "Invitation rejected." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects/:id/chats', fetchuser, checkMembership, async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]); 
        res.json(await Chat.find({ roomId: req.params.id }).sort('timestamp').limit(50));
    } catch (error) { res.status(500).json({ error: "Server error." }); }
});

app.get('/api/projects/:id/logs', fetchuser, checkMembership, async (req, res) => {
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
        const { promptMessage, history, codeBuffer } = req.body;
        
        let apiMessages = [
            { 
                role: "system", 
                content: `You are an advanced AI Copilot inside a professional collaborative IDE. Reply as plain text console output. Always keep track of previous code requests and maintain thread history context seamlessly.\n\nHere is the current code in the active file:\n\`\`\`\n${codeBuffer || ""}\n\`\`\`` 
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

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('HTTP server closed.');
        await prisma.$disconnect();
        console.log('Prisma disconnected.');
        await mongoose.disconnect();
        console.log('Mongoose disconnected.');
        process.exit(0);
    });
    // Force exit if server hasn't closed in 10 seconds
    setTimeout(() => { console.error('Forced shutdown.'); process.exit(1); }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));