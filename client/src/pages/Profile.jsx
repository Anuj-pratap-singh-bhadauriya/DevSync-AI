import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../redux/authSlice';

const Profile = () => {
  // Retrieve authenticated user metadata from global Redux state
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Handler to terminate user session
  const handleSignOut = () => {
    dispatch(logout());
    navigate("/login");
  };

  // Utility to format timestamp into readable date
  const formatCreationDate = (dateString) => {
    if (!dateString) return "Synchronization Pending...";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Profile Navigation Header */}
        <header className="flex justify-between items-center bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
          <div>
            <h1 className="text-3xl font-bold">System Configuration</h1>
            <p className="text-gray-400 mt-1">Manage your identity and authentication parameters.</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg font-medium transition-colors border border-gray-650 shadow-sm"
          >
            Return to Dashboard
          </button>
        </header>

        {/* Identity Information Panel */}
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-700">
            {/* Synthetic Avatar Generator based on User's Initial */}
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl font-bold shadow-inner border-4 border-gray-900">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user ? user.name : "Authenticating..."}</h2>
              <p className="text-gray-400 font-mono text-sm mt-1">Role: Primary Administrator</p>
            </div>
          </div>

          {/* Read-only Data Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-750">
              <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Registered Email</label>
              <div className="text-gray-200 font-medium">{user ? user.email : "Awaiting data..."}</div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-750">
              <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Account Initialization Date</label>
              <div className="text-gray-200 font-medium">{formatCreationDate(user?.createdAt)}</div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-750">
              <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Authentication Status</label>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-400 font-medium text-sm">Secure Token Active</span>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-750">
              <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">Workspace Quota</label>
              <div className="text-gray-200 font-medium">Unlimited (Developer Tier)</div>
            </div>
          </div>

          {/* Destructive / Session Actions */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md border border-red-500"
            >
              Terminate Session Globally
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;