import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios for API requests

const Signup = () => {

  const [credentials, setCredentials] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Hook used for page navigation
  const navigate = useNavigate();

  // Handle input field changes
  const onChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  // Handle form submission and API request
  const handleSubmit = async (e) => {

    // Prevent page reload on form submit
    e.preventDefault();

    try {

      // Send signup request to backend API
      const response = await axios.post(
        import.meta.env.VITE_BACKEND_URL + "/api/signup",
        {
          name: credentials.name,
          email: credentials.email,
          password: credentials.password
        }
      );

      console.log("Success:", response.data);

      alert("Account Created Successfully! 🎉");

      // Redirect user to login page after successful signup
      navigate("/login");

    } catch (error) {

      console.error("Signup Failed:", error.response.data);

      // Show backend error message
      alert(
        error.response.data.error ||
        "Something went wrong!"
      );
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 px-4">

      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-8">

        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-white mb-2">
            Join DevSync AI 🚀
          </h1>

          <p className="text-gray-400">
            Create an account to start collaborating.
          </p>

        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div>

            <label className="block text-sm font-medium text-gray-300 mb-1">
              Full Name
            </label>

            <input
              type="text"
              name="name"
              value={credentials.name}
              onChange={onChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="John Doe"
              required
            />

          </div>

          <div>

            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>

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

            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>

            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={onChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="••••••••"
              minLength={5}
              required
            />

          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Sign Up
          </button>

        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">

          Already have an account?{' '}

          <Link
            to="/login"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Log in here
          </Link>

        </p>

      </div>

    </div>
  );
};

export default Signup;