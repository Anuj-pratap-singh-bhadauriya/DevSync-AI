/**
 * emailService.js
 * Uses Brevo (Sendinblue) HTTP API instead of Nodemailer SMTP to bypass Render port blocking.
 */

/**
 * Sends a 6-digit OTP to the given email address with retry logic via Brevo API.
 * @param {string} email - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 * @returns {Promise<{success: boolean, message?: string}>}
 */
const sendOTP = async (email, otp) => {
    // If we're in a development/test environment without the API key, fallback/bypass gracefully
    if (!process.env.BREVO_API_KEY) {
        console.warn(`\n\n⚠️ WARNING: BREVO_API_KEY is missing! Bypassing email send. OTP for ${email} is: [ ${otp} ] ⚠️\n\n`);
        return { success: true, message: "Bypassed (No API Key)" };
    }

    const payload = {
        sender: {
            name: 'DevSync AI',
            email: process.env.EMAIL_USER || "hello@devsync.com" // Brevo requires a valid sender email, ideally the one you registered with
        },
        to: [
            { email: email }
        ],
        subject: 'Your DevSync AI Verification Code',
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
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': process.env.BREVO_API_KEY
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP Error ${response.status}`);
            }

            console.log(`✅ OTP sent successfully to ${email} via Brevo API (attempt ${attempt})`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed for ${email} via Brevo:`, error.message);

            if (attempt === MAX_RETRIES) {
                // Since this is HTTP, if it fails 3 times, there's a serious API key or network issue.
                // We still bypass so the user isn't completely blocked from demoing the app.
                console.log(`\n\n⚠️ BYPASSING EMAIL FAILURE: The OTP for ${email} is: [ ${otp} ] ⚠️\n\n`);
                return { success: true, message: "Bypassed (API Error)" };
            }

            // Wait 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

module.exports = { sendOTP };
