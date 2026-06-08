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
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
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
});

// ---------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------
app.get('/api/ping', (req, res) => res.json({ status: "Secure", timestamp: new Date() }));

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (await prisma.user.findUnique({ where: { email } })) return res.status(400).json({ error: "Email exists." });
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.create({ data: { name, email, password: hashedPassword } });
        res.status(201).json({ message: "Success." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
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
        if (!targetUser) return res.status(404).json({ error: "User not found." });
        res.status(201).json(await prisma.workspaceMember.create({ data: { workspaceId: req.params.id, userId: targetUser.id, role: 'COLLABORATOR' } }));
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