const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { corsOptions } = require('./config/cors');
const { globalLimiter } = require('./config/rateLimiters');

// --- Route Imports ---
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const invitationRoutes = require('./routes/invitation.routes');
const chatRoutes = require('./routes/chat.routes');
const aiRoutes = require('./routes/ai.routes');
const leetcodeRoutes = require('./routes/leetcode.routes');
const miscRoutes = require('./routes/misc.routes');

const app = express();
app.set('trust proxy', 1);

// --- Core Middleware ---
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', globalLimiter);

// --- Mount Routes ---
app.use('/api', miscRoutes);
app.use('/api', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', invitationRoutes);
app.use('/api', chatRoutes);
app.use('/api', aiRoutes);
app.use('/api', leetcodeRoutes);

module.exports = app;
