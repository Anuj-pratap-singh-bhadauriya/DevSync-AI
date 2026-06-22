import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux'; // 1. Naya Import
import { loginSuccess } from '../redux/authSlice'; // 2. Naya Import

const Login = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch(); // 3. Hook initialized here

  const onChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ text: "", type: "" });
    
    try {
      const response = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/login", {
        email: credentials.email,
        password: credentials.password
      });

      // Dispatching token to Redux Store with the correct payload key
      dispatch(loginSuccess({ token: response.data.token }));

      setMessage({ text: "Authentication successful! Redirecting...", type: "success" });
      setTimeout(() => navigate("/dashboard"), 1000);

    } catch (error) {
      console.error("Login Error:", error.response?.data);
      setMessage({ 
        text: error.response?.data?.error || "Invalid credentials. Please try again.", 
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
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Log in to your DevSync AI account.</p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 text-sm font-medium border ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
            {message.type === 'error' ? '❌ ' : '✅ '}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={credentials.email}
              onChange={onChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={onChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="••••••••"
              required
            />
            <div className="text-right mt-2">
              <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Log In
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;