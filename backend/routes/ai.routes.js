const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const aiController = require('../controllers/ai.controller');

router.post('/audit', fetchuser, aiController.audit);
router.post('/chat', fetchuser, aiController.chat);
router.post('/execute', fetchuser, aiController.execute);

module.exports = router;
