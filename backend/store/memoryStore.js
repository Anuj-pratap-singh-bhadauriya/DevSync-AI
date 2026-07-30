// ---------------------------------------------------------
// IN-MEMORY STATE MANAGEMENT
// Centralized store for all ephemeral runtime data
// ---------------------------------------------------------

const otpStore = new Map();          // email -> { otp, name, password, expiresAt }
const resetOtpStore = new Map();     // email -> { otp, expiresAt }
const roomUsers = new Map();         // roomId -> Map<socketId, { socketId, email, name }>
const activeWorkspaces = new Map();  // roomId -> { files, activeFileName, interviewEndTime, videoParticipants, arenaProblem }

// Auto-cleanup expired OTPs every 2 minutes
const cleanupExpiredOTPs = () => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
    for (const [email, data] of resetOtpStore.entries()) {
        if (now > data.expiresAt) resetOtpStore.delete(email);
    }
};
setInterval(cleanupExpiredOTPs, 2 * 60 * 1000);

// Cleanup abandoned workspace entries every 30 minutes
setInterval(() => {
    for (const [roomId] of activeWorkspaces.entries()) {
        if (!roomUsers.has(roomId) || roomUsers.get(roomId).size === 0) {
            activeWorkspaces.delete(roomId);
            roomUsers.delete(roomId);
            console.log(`Cleaned up abandoned workspace: ${roomId}`);
        }
    }
}, 30 * 60 * 1000);

module.exports = { otpStore, resetOtpStore, roomUsers, activeWorkspaces };
