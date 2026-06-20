/**
 * Sends a 6-digit OTP to the given email address using Brevo HTTP API.
 * This completely avoids Render's strict outbound SMTP (Port 465/587) blocking.
 */
const sendOTP = async (email, otp) => {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const SENDER_EMAIL = process.env.EMAIL_USER || "anuj26bhadauriya@gmail.com";

    const payload = {
        sender: {
            name: "DevSync AI",
            email: SENDER_EMAIL
        },
        to: [
            { email: email }
        ],
        subject: "Your DevSync AI Verification Code",
        textContent: `Your DevSync AI verification code is: ${otp}\n\nThis code expires in 5 minutes.\nIf you didn't request this code, please ignore this email.\n\n- DevSync AI Team`,
        htmlContent: `
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
        `
    };

    // Retry logic — try up to 3 times
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": BREVO_API_KEY,
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ OTP sent successfully to ${email} via Brevo HTTP API (attempt ${attempt})`);
                return { success: true };
            } else {
                throw new Error(data.message || "Unknown Brevo API error");
            }

        } catch (error) {
            console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed for ${email} (Brevo API):`, error.message);

            if (attempt === MAX_RETRIES) {
                return { success: false, message: "Email server failed to send OTP. Please try again." };
            }

            // Wait 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

module.exports = { sendOTP };
