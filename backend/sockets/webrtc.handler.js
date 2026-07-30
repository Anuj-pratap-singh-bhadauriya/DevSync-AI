const { activeWorkspaces } = require('../store/memoryStore');

module.exports = (io, socket) => {
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
};
