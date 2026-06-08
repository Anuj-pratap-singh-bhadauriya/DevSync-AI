const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    roomId: { 
        type: String, 
        required: true,
        index: true 
    },
    userEmail: { 
        type: String, 
        required: true 
    },
    action: { 
        type: String, 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);