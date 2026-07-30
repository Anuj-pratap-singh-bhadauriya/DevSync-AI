const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const checkMembership = require('../middleware/checkMembership');
const chatController = require('../controllers/chat.controller');

router.get('/projects/:id/chats', fetchuser, checkMembership, chatController.getChats);
router.get('/projects/:id/logs', fetchuser, checkMembership, chatController.getLogs);

module.exports = router;
