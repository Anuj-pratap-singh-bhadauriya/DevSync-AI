const nodemailer = require('nodemailer');

// --- Gmail SMTP Transporter (Optimized for deployed servers) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER || "anuj26bhadauriya@gmail.com",
        pass: process.env.EMAIL_PASS || "xtufxbrgqvpjvilz"
    }
});

// Verify transporter on startup
transporter.verify()
    .then(() => console.log('✅ Gmail SMTP connection verified successfully'))
    .catch((err) => console.error('❌ Gmail SMTP verification failed:', err.message));

/**
 * Sends a 6-digit OTP to the given email address with retry logic.
 * @param {string} email - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 * @returns {Promise<{success: boolean, message?: string}>}
 */
const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: {
            name: 'DevSync AI',
            address: process.env.EMAIL_USER || "anuj26bhadauriya@gmail.com"
        },
        to: email,
        subject: 'Your DevSync AI Verification Code',
        // Plain text version (important for spam filters)
        text: `Your DevSync AI verification code is: ${otp}\n\nThis code expires in 5 minutes.\nIf you didn't request this code, please ignore this email.\n\n- DevSync AI Team`,
        // Clean HTML version (minimal styling to avoid spam filters)
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333; margin-bottom: 5px;">DevSync AI</h2>
                <p style="color: #666; font-size: 14px; margin-top: 0;">Email Verification</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Hello,<br/>
                    Use the verification code below to complete your signup on DevSync AI.
                </p>

                <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px;">
                        Verification Code
                    </p>
                    <h1 style="color: #333; font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 0; font-family: monospace;">
                        ${otp}
                    </h1>
                </div>

                <p style="color: #888; font-size: 13px;">
                    This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
                </p>

                <p style="color: #aaa; font-size: 12px; margin-top: 30px;">
                    If you didn't request this code, you can safely ignore this email.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #bbb; font-size: 11px; text-align: center;">
                    DevSync AI - Collaborative Development Platform
                </p>
            </div>
        `,
        // Headers to improve deliverability
        headers: {
            'X-Priority': '1',
            'X-Mailer': 'DevSync AI Mailer',
            'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`
        }
    };

    // Retry logic — try up to 3 times
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ OTP sent successfully to ${email} (attempt ${attempt})`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed for ${email}:`, error.message);

            if (attempt === MAX_RETRIES) {
                let errorMessage = "Failed to send OTP. Please try again.";
                if (error.message.includes("550 5.1.1") || error.message.includes("does not exist") || error.message.includes("rejected")) {
                    errorMessage = "This email address does not exist. Please enter a real email.";
                } else if (error.message.includes("Invalid login") || error.message.includes("535")) {
                    errorMessage = "Email server authentication failed. Contact admin.";
                } else if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNREFUSED") || error.message.includes("timeout")) {
                    errorMessage = "Email server timed out. Please try again in a moment.";
                }
                return { success: false, message: errorMessage };
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

module.exports = { sendOTP };
