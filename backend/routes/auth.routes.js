const express = require('express');
const router = express.Router();
const fetchuser = require('../middleware/fetchuser');
const { otpLimiter } = require('../config/rateLimiters');
const authController = require('../controllers/auth.controller');

router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/login', otpLimiter, authController.login);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', otpLimiter, authController.resetPassword);
router.post('/getuser', fetchuser, authController.getUser);

module.exports = router;
