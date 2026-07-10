import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { logout } from '../redux/authSlice'; // Ensure this path is correct for your setup
import { useDispatch } from 'react-redux';
import { useToast } from '../components/Toast';

const Home = () => {
    const dropdownRef = useRef(null);

    // Dynamic user state from Redux (safe to use outside effects without loops)
    const dynamicUser = useSelector(state => state.auth.user);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowInvitesDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const { token, user } = useSelector((state) => state.auth);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    const [projects, setProjects] = useState([]);
    const [newWorkspaceTitle, setNewWorkspaceTitle] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [networkStatus, setNetworkStatus] = useState("Checking..."); 
    const [localUser, setLocalUser] = useState(user);
    const { addToast } = useToast();
    const [pendingInvites, setPendingInvites] = useState([]);
    const [showInvitesDropdown, setShowInvitesDropdown] = useState(false);

    // Initial Data Sync, Profile Fallback & Network Ping
    useEffect(() => {
        if (!token) {
            navigate('/');
            return;
        }

        const fetchUserProfile = async () => {
            if (!user?.email) {
                try {
                    const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/getuser", {}, { headers: { "auth-token": token } });
                    setLocalUser(res.data);
                } catch (err) { console.error("Identity fetch failed"); }
            }
        };

        const fetchProjects = async () => {
            try {
                const response = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects", { headers: { "auth-token": token } });
                const sortedProjects = response.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setProjects(sortedProjects);
            } catch (error) {
                console.error("Failed to synchronize workspace directory");
            } finally {
                setIsLoading(false);
            }
        };

        const checkNetworkHealth = async () => {
            try {
                await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/ping");
                setNetworkStatus("Connection Secure");
            } catch (error) {
                setNetworkStatus("Server Offline");
            }
        };

        const fetchPendingInvites = async () => {
            try {
                const response = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/invitations", { headers: { "auth-token": token } });
                setPendingInvites(response.data);
            } catch (error) { console.error("Failed to fetch invitations"); }
        };

        fetchUserProfile();
        fetchProjects();
        checkNetworkHealth();
        fetchPendingInvites();
        
        const pingInterval = setInterval(checkNetworkHealth, 30000);
        return () => clearInterval(pingInterval);
    }, [token, navigate, user?.id, user?.email]);

    const handleInitializeWorkspace = async (e) => {
        e.preventDefault();
        if(!newWorkspaceTitle.trim()) return;
        
        try {
            const response = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/projects", {
                title: newWorkspaceTitle,
                description: JSON.stringify([{ name: "index.js", language: "javascript", content: "// Initialize DevSync environment...\n\nfunction executeCoreEngine() {\n  console.log('Engine Active!');\n}\n\nexecuteCoreEngine();" }])
            }, { headers: { "auth-token": token } });
            
            navigate(`/workspace/${response.data.id}`);
        } catch (error) { addToast("System Error: Failed to provision workspace.", "error"); }
    };

    const handleDeleteWorkspace = async (e, projectId) => {
        e.stopPropagation(); 
        
        if (!window.confirm("CRITICAL ACTION: Are you sure you want to permanently delete this workspace and all its data?")) {
            return;
        }

        try {
           await axios.delete(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + projectId, { headers: { "auth-token": token } });
            setProjects(projects.filter(p => p.id !== projectId));
        } catch (error) {
            addToast(error.response?.data?.error || "System Error: Failed to terminate workspace.", "error");
        }
    };

    const handleAcceptInvite = async (inviteId) => {
        try {
            await axios.post(import.meta.env.VITE_BACKEND_URL + `/api/invitations/${inviteId}/accept`, {}, { headers: { "auth-token": token } });
            setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
            addToast("Workspace invitation accepted!", "success");
            
            const response = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects", { headers: { "auth-token": token } });
            setProjects(response.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (error) {
            addToast("Failed to accept invitation", "error");
        }
    };

    const handleRejectInvite = async (inviteId) => {
        try {
            await axios.post(import.meta.env.VITE_BACKEND_URL + `/api/invitations/${inviteId}/reject`, {}, { headers: { "auth-token": token } });
            setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
            addToast("Invitation rejected.", "info");
        } catch (error) {
            addToast("Failed to reject invitation", "error");
        }
    };

    const handleTerminateSession = () => {
        dispatch(logout());
        navigate('/login'); 
    };

    return (
        <div className="min-h-screen bg-[#ffffff] text-[#000000] p-8 font-sans">
            <div className="max-w-[1440px] w-full mx-auto space-y-8 px-2 sm:px-6 lg:px-8">
                
                {/* --- HEADER --- */}
                <div className="flex justify-between items-center bg-[#18181b] p-6 rounded-xl border border-[#27272a] shadow-lg">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Welcome, {localUser?.name?.split(' ')[0] || dynamicUser?.name?.split(' ')[0] || 'Developer'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">Manage your active environments and remote configurations.</p>
                    </div>
                    <div className="flex gap-3 relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setShowInvitesDropdown(!showInvitesDropdown)} 
                            className="relative p-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors flex items-center justify-center"
                        >
                            🔔
                            {pendingInvites.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1e293b]">
                                    {pendingInvites.length}
                                </span>
                            )}
                        </button>

                        {showInvitesDropdown && (
                            <div className="absolute right-0 top-[110%] w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-gray-700 bg-gray-900/50">
                                    <h3 className="font-bold text-sm text-gray-200">Pending Invitations</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {pendingInvites.length === 0 ? (
                                        <p className="p-4 text-sm text-gray-500 text-center">No pending invitations.</p>
                                    ) : (
                                        pendingInvites.map(inv => (
                                            <div key={inv.id} className="p-3 border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                                <p className="text-sm font-semibold text-blue-400 truncate">{inv.workspace?.title || 'Unknown Workspace'}</p>
                                                <p className="text-xs text-gray-400 mt-1 truncate">from: {inv.sender?.email || 'Unknown User'}</p>
                                                <div className="flex gap-2 mt-3">
                                                    <button onClick={() => handleAcceptInvite(inv.id)} className="flex-1 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-500 rounded text-white transition-colors">Accept</button>
                                                    <button onClick={() => handleRejectInvite(inv.id)} className="flex-1 py-1.5 text-xs font-bold bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors">Reject</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <button onClick={handleTerminateSession} className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm">
                            Terminate Session
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* --- ACTION MODULE --- */}
                    <div className="bg-[#18181b] p-6 rounded-xl border border-[#27272a] border-t-4 border-t-blue-500 shadow-lg relative overflow-hidden flex flex-col justify-between h-[180px] transition-transform hover:-translate-y-1">
                        <div className="flex-1">
                            <h2 className="text-lg font-bold mb-4 text-white">Deploy New Workspace</h2>
                        </div>
                        <form onSubmit={handleInitializeWorkspace} className="flex gap-3 mt-auto">
                            <input 
                                type="text" 
                                placeholder="Workspace title (e.g., App Core)"
                                value={newWorkspaceTitle}
                                onChange={(e) => setNewWorkspaceTitle(e.target.value)}
                                className="flex-1 bg-[#09090b] border border-[#3f3f46] text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 text-white transition-colors"
                            />
                            <button type="submit" className="px-6 py-3 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-md">
                                Initialize
                            </button>
                        </form>
                    </div>

                    {/* --- NAYA: ARENA PORTAL MODULE --- */}
                    <div className="bg-[#18181b] p-6 rounded-xl border border-[#27272a] border-t-4 border-t-purple-500 shadow-lg relative overflow-hidden flex flex-col justify-between h-[180px] transition-transform hover:-translate-y-1">
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-lg font-bold text-white">Coding Arena</h2>
                                <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-mono">Practice</span>
                            </div>
                            <p className="text-sm text-gray-400">Solve algorithmic challenges in a secure automated sandbox environment.</p>
                        </div>
                        <button 
                            onClick={() => navigate("/arena")} 
                            className="w-full py-3 font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-md mt-auto"
                        >
                            Enter Problem Arena →
                        </button>
                    </div>
                </div>

                {/* --- TELEMETRY ROW --- */}
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-[#18181b] p-6 rounded-xl border border-[#27272a] border-t-2 border-t-emerald-500 shadow-sm transition-transform hover:-translate-y-1 flex flex-col justify-center h-[120px]">
                        <p className="text-sm text-gray-400 font-medium mb-1">Deployed Environments</p>
                        <p className="text-2xl font-bold text-emerald-400">{isLoading ? "..." : projects.length} Active</p>
                    </div>
                    <div className="bg-[#18181b] p-6 rounded-xl border border-[#27272a] border-t-2 border-t-amber-500 shadow-sm transition-transform hover:-translate-y-1 flex flex-col justify-center h-[120px] overflow-hidden">
                        <p className="text-sm text-gray-400 font-medium mb-1">Registered Identity</p>
                        <p className="text-sm font-mono mt-1 truncate text-amber-300" title={dynamicUser?.email}>
                            {dynamicUser?.email || "Fetching Identity..."}
                        </p>
                    </div>
                    <div className="bg-[#18181b] p-6 rounded-xl border border-[#27272a] border-t-2 border-t-pink-500 shadow-sm transition-transform hover:-translate-y-1 flex flex-col justify-center h-[120px]">
                        <p className="text-sm text-gray-400 font-medium mb-2">Network Infrastructure</p>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                {networkStatus === "Connection Secure" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${networkStatus === 'Connection Secure' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                            <span className={`text-xs font-mono uppercase tracking-wider ${networkStatus === 'Connection Secure' ? 'text-green-400' : 'text-red-400'}`}>
                                {networkStatus}
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- DIRECTORY --- */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-black">
                        <span>Workspace Directory</span>
                        {isLoading && <span className="text-xs text-blue-500 animate-pulse font-mono font-medium ml-2">(Syncing with database...)</span>}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {projects.length === 0 && !isLoading ? (
                            <div className="col-span-full text-center py-12 border border-dashed border-gray-300 rounded-xl text-gray-500 bg-gray-50">
                                <p className="text-lg mb-1 font-semibold text-gray-700">No active workspaces found.</p>
                                <p className="text-sm">Initialize a new environment above to get started.</p>
                            </div>
                        ) : (
                            projects.map(project => {
                                const isOwner = project.ownerId === (localUser?.id || dynamicUser?.id || dynamicUser?._id || dynamicUser?.userId || user?.id || user?.userId);
                                
                                return (
                                    <div 
                                        key={project.id} 
                                        onClick={() => navigate(`/workspace/${project.id}`)} 
                                        className="bg-[#18181b] p-5 rounded-xl border border-[#3f3f46] hover:border-blue-500 cursor-pointer transition-all group relative overflow-hidden shadow-md hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] flex flex-col justify-between h-[140px]"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-gray-100 text-lg group-hover:text-blue-400 transition-colors truncate pr-2">
                                                    {project.title}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    {isOwner && (
                                                        <button 
                                                            onClick={(e) => handleDeleteWorkspace(e, project.id)}
                                                            className="text-gray-600 hover:text-red-500 transition-colors px-1"
                                                            title="Delete Workspace"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                    <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border shrink-0 ${isOwner ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-purple-900/30 text-purple-400 border-purple-800'}`}>
                                                        {isOwner ? 'Owner' : 'Invited'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-mono text-gray-500">UID: {project.id.split('-')[0]}...</p>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800/50">
                                            <span className="text-[10px] font-medium text-gray-500">
                                                Updated: {new Date(project.updatedAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs font-bold text-gray-400 group-hover:text-blue-400 transition-colors flex items-center gap-1">
                                                Enter Chamber <span className="text-lg leading-none transform translate-y-[-1px] group-hover:translate-x-1 transition-transform">→</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Home;