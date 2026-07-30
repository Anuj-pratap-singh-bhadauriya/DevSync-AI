const { activeWorkspaces } = require('../store/memoryStore');

module.exports = (io, socket) => {
    socket.on('start-interview', ({ roomId, durationMinutes }) => {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).interviewEndTime = endTime;
        io.to(roomId).emit('interview-started', { endTime });
    });

    socket.on('end-interview', ({ roomId }) => {
        if (activeWorkspaces.has(roomId)) activeWorkspaces.get(roomId).interviewEndTime = null;
        io.to(roomId).emit('interview-ended');
    });
};
