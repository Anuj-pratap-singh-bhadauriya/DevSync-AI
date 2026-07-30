const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ActivityLog = require('../models/ActivityLog');

exports.getChats = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]);
        res.json(await Chat.find({ roomId: req.params.id }).sort('timestamp').limit(50));
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.getLogs = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]);
        res.json(await ActivityLog.find({ roomId: req.params.id }).sort('-timestamp').limit(50));
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};
