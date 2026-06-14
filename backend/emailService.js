const nodemailer = require('nodemailer');

// --- Gmail SMTP Transporter ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  // Gmail App Password (NOT your regular password)
    }
});

/**
 * Sends a 6-digit OTP to the given email address.
 * @param {string} email - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 * @returns {Promise<boolean>} - true if email sent successfully, false otherwise
 */
const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: `"DevSync AI 🚀" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Your DevSync AI Verification Code',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                        DevSync AI
                    </h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
                        Email Verification
                    </p>
                </div>

                <!-- Body -->
                <div style="padding: 32px 24px;">
                    <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                        Hey there! 👋<br/>
                        Use the verification code below to complete your signup on <strong style="color: #60a5fa;">DevSync AI</strong>.
                    </p>

                    <!-- OTP Box -->
                    <div style="background: rgba(59, 130, 246, 0.1); border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
                        <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">
                            Your Verification Code
                        </p>
                        <h2 style="color: #60a5fa; font-size: 36px; font-weight: 800; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                            ${otp}
                        </h2>
                    </div>

                    <!-- Warning -->
                    <div style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 0 0 24px;">
                        <p style="color: #fbbf24; font-size: 13px; margin: 0;">
                            ⏱️ This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
                        </p>
                    </div>

                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid #334155; padding: 20px 24px; text-align: center;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} DevSync AI · Secure Collaboration Platform
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent successfully to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send OTP to ${email}:`, error.message);
        return false;
    }
};

module.exports = { sendOTP };
