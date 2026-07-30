const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ActivityLog = require('../models/ActivityLog');

module.exports = (io, socket) => {
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
};
