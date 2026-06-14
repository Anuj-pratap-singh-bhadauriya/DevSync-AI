import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const Signup = () => {
  const [credentials, setCredentials] = useState({ name: "", email: "", password: "" });
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);

  const navigate = useNavigate();
  const otpRefs = useRef([]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (step !== 2) return;
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError("");
  };

  // STEP 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/send-otp", {
        name: credentials.name,
        email: credentials.email,
        password: credentials.password
      });

      setStep(2);
      setCountdown(300);
      setCanResend(false);
      setSuccess("OTP sent! Check your email inbox.");
      
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 300);

    } catch (error) {
      setError(error.response?.data?.error || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/verify-otp", {
        email: credentials.email,
        otp: otpCode
      });

      setSuccess("Email verified & account created! 🎉 Redirecting...");
      setTimeout(() => navigate("/login"), 2000);

    } catch (error) {
      setError(error.response?.data?.error || "Verification failed!");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setLoading(true);
    setError("");
    setOtp(["", "", "", "", "", ""]);

    try {
      await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/send-otp", {
        name: credentials.name,
        email: credentials.email,
        password: credentials.password
      });

      setCountdown(300);
      setCanResend(false);
      setSuccess("New OTP sent! Check your email.");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-8 relative overflow-hidden">

        {/* Decorative gradient blur */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(20px)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-40px', left: '-40px', width: '120px', height: '120px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(20px)', pointerEvents: 'none'
        }} />

        {/* ===== STEP 1: SIGNUP FORM ===== */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Join DevSync AI 🚀</h1>
              <p className="text-gray-400">Create an account to start collaborating.</p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                <input
                  type="text" name="name" value={credentials.name} onChange={onChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="John Doe" required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                <input
                  type="email" name="email" value={credentials.email} onChange={onChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="you@gmail.com" required
                />
                <p style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  📧 A verification OTP will be sent to this email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password" name="password" value={credentials.password} onChange={onChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="••••••••" minLength={5} required
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite', display: 'inline-block'
                    }} />
                    Sending OTP...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Log in here
              </Link>
            </p>
          </div>
        )}

        {/* ===== STEP 2: OTP VERIFICATION ===== */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="text-center mb-6">
              {/* Email icon */}
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '28px'
              }}>
                📩
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
              <p className="text-gray-400 text-sm">
                We sent a 6-digit code to<br />
                <span style={{ color: '#60a5fa', fontWeight: '600' }}>{credentials.email}</span>
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
                color: '#86efac', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>✅</span> {success}
              </div>
            )}

            <form onSubmit={handleVerifyOTP}>
              {/* OTP Input Boxes */}
              <div style={{
                display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px'
              }}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    style={{
                      width: '48px', height: '56px', textAlign: 'center',
                      fontSize: '22px', fontWeight: '700', fontFamily: "'Courier New', monospace",
                      background: digit ? 'rgba(59,130,246,0.15)' : '#374151',
                      border: digit ? '2px solid #3b82f6' : '2px solid #4b5563',
                      borderRadius: '12px', color: '#fff', outline: 'none',
                      transition: 'all 0.2s ease',
                      caretColor: '#3b82f6'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = digit ? '#3b82f6' : '#4b5563';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}
              </div>

              {/* Countdown Timer */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                {countdown > 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                    Code expires in <span style={{ color: countdown < 60 ? '#f87171' : '#60a5fa', fontWeight: '600' }}>
                      {formatTime(countdown)}
                    </span>
                  </p>
                ) : (
                  <p style={{ color: '#f87171', fontSize: '13px' }}>
                    ⏱️ OTP has expired
                  </p>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit" disabled={loading || otp.join('').length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite', display: 'inline-block'
                    }} />
                    Verifying...
                  </>
                ) : (
                  '🔐 Verify & Create Account'
                )}
              </button>

              {/* Resend & Back buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(""); setSuccess(""); setOtp(["","","","","",""]); }}
                  style={{
                    background: 'none', border: 'none', color: '#94a3b8',
                    fontSize: '13px', cursor: 'pointer', padding: '4px 0'
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#e2e8f0'}
                  onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                >
                  ← Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading || (!canResend && countdown > 240)}
                  style={{
                    background: 'none', border: 'none',
                    color: (loading || (!canResend && countdown > 240)) ? '#4b5563' : '#60a5fa',
                    fontSize: '13px', cursor: (loading || (!canResend && countdown > 240)) ? 'not-allowed' : 'pointer',
                    padding: '4px 0'
                  }}
                >
                  Resend Code
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Signup;