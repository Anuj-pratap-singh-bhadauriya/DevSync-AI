const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const { leetcodeLimiter } = require('../config/rateLimiters');
const leetcodeController = require('../controllers/leetcode.controller');

router.get('/leetcode/problems', fetchuser, leetcodeLimiter, leetcodeController.getProblems);
router.get('/leetcode/problem/:titleSlug', fetchuser, leetcodeLimiter, leetcodeController.getProblemDetail);

module.exports = router;
