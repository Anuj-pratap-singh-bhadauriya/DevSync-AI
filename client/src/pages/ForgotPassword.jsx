import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/forgot-password", { email });
      setMessage({ text: res.data.message || "OTP sent! Check your email inbox.", type: "success" });
      setStep(2);
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.error || "Failed to send OTP. Please try again.", 
        type: "error" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/reset-password", {
        email,
        otp,
        newPassword
      });
      setMessage({ text: res.data.message || "Password updated successfully! Redirecting...", type: "success" });
      setTimeout(() => navigate("/login"), 2000);
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.error || "Failed to reset password. Please try again.", 
        type: "error" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-gray-400">
            {step === 1 ? "Enter your email to receive an OTP." : "Enter the OTP and your new password."}
          </p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 text-sm font-medium border ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
            {message.type === 'error' ? '❌ ' : '✅ '}
            {message.text}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "Sending OTP..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">6-Digit OTP</label>
              <input
                type="text"
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="000000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="••••••••"
                required
                minLength="6"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "Resetting Password..." : "Set New Password"}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setMessage({text:"", type:""}); setOtp(""); }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors mt-2"
            >
              Change Email
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-gray-400 text-sm">
          Remembered your password?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
