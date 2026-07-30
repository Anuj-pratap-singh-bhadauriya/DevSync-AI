const jwt = require('jsonwebtoken');
const registerRoomHandlers = require('./room.handler');
const registerChatHandlers = require('./chat.handler');
const registerInterviewHandlers = require('./interview.handler');
const registerWebRTCHandlers = require('./webrtc.handler');

const registerSocketHandlers = (io) => {
    // Socket.io Authentication Middleware
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
        registerRoomHandlers(io, socket);
        registerChatHandlers(io, socket);
        registerInterviewHandlers(io, socket);
        registerWebRTCHandlers(io, socket);
    });
};

module.exports = registerSocketHandlers;
