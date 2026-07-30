const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper to find and emit to a specific user's sockets by email
const emitToUserByEmail = (io, email, event, data) => {
    const allSockets = io.sockets.sockets;
    for (const [, s] of allSockets) {
        if (s.userEmail === email) {
            s.emit(event, data);
        }
    }
};

module.exports = { generateOTP, emitToUserByEmail };
