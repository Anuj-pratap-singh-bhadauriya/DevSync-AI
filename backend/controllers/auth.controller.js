const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../emailService');
const { generateOTP } = require('../utils/helpers');
const { otpStore, resetOtpStore } = require('../store/memoryStore');

const JWT_SECRET = process.env.JWT_SECRET;

exports.sendOtp = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        if (await prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ error: "This email is already registered. Please login instead." });
        }

        const otp = generateOTP();
        const OTP_EXPIRY_MS = 5 * 60 * 1000;
        const hashedPassword = await bcrypt.hash(password, 10);

        otpStore.set(email, {
            otp,
            name,
            password: hashedPassword,
            expiresAt: Date.now() + OTP_EXPIRY_MS
        });

        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            otpStore.delete(email);
            return res.status(400).json({ error: emailResult.message });
        }

        console.log(`OTP sent to ${email}`);
        res.json({ message: "OTP sent successfully! Check your email." });

    } catch (error) {
        console.error("Send OTP Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required." });
        }

        const storedData = otpStore.get(email);

        if (!storedData) {
            return res.status(400).json({ error: "No OTP found. Please request a new one." });
        }

        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please try again." });
        }

        await prisma.user.create({
            data: {
                name: storedData.name,
                email: email,
                password: storedData.password
            }
        });

        otpStore.delete(email);

        console.log(`Account created for ${email} (OTP verified)`);
        res.status(201).json({ message: "Email verified & account created successfully!" });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials." });
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "Account with this email does not exist." });

        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        resetOtpStore.set(email, { otp, expiresAt });

        const emailResult = await sendOTP(email, otp);
        if (!emailResult.success) {
            resetOtpStore.delete(email);
            return res.status(400).json({ error: emailResult.message });
        }

        console.log(`Password reset OTP sent to ${email}`);
        res.status(200).json({ message: "Verification code sent to your email." });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const storedData = resetOtpStore.get(email);
        if (!storedData) {
            return res.status(400).json({ error: "OTP expired or not requested. Please try again." });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please check the code and try again." });
        }

        if (Date.now() > storedData.expiresAt) {
            resetOtpStore.delete(email);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        resetOtpStore.delete(email);

        console.log(`Password reset successfully for ${email}`);
        res.status(200).json({ message: "Password updated successfully! You can now log in." });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
};

exports.getUser = async (req, res) => {
    try { res.json(await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, name: true, email: true } })); }
    catch (error) { res.status(500).json({ error: "Server error." }); }
};
