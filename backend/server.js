require('dotenv').config();

// --- Global Error Handlers (prevent silent crashes in production) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = require('./app');
const { allowedOrigins } = require('./config/cors');
const registerSocketHandlers = require('./sockets');

// --- Validate Critical Environment Variables ---
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
    process.exit(1);
}

// --- Create HTTP Server & Socket.io ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Share io instance with Express controllers via app.set
app.set('io', io);

// --- Register Socket.io Handlers ---
registerSocketHandlers(io);

// --- MongoDB Connection ---
const connectMongoDB = async () => {
    try {
        if (!process.env.MONGO_URI) return console.warn("MongoDB Initialization Skipped.");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected: Chat and logging engine initialized.");
    } catch (err) { console.error("MongoDB Connection Failure:", err.message); }
};
connectMongoDB();

// --- Start Server ---
server.listen(PORT, () => console.log(`DevSync Enterprise Engine is active on port ${PORT}`));

// --- Graceful Shutdown ---
const prisma = require('./lib/prisma');
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
    setTimeout(() => { console.error('Forced shutdown.'); process.exit(1); }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));