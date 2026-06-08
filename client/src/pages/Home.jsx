import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { logout } from '../redux/authSlice'; // Ensure this path is correct for your setup
import { useDispatch } from 'react-redux';

const Home = () => {
    const { token, user } = useSelector((state) => state.auth);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    const [projects, setProjects] = useState([]);
    const [newWorkspaceTitle, setNewWorkspaceTitle] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [networkStatus, setNetworkStatus] = useState("Checking..."); 
    const [dynamicUser, setDynamicUser] = useState(user);

    // Initial Data Sync, Profile Fallback & Network Ping
    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchUserProfile = async () => {
            if (!user?.email) {
                try {
                    const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/getuser", {}, { headers: { "auth-token": token } });
                    setDynamicUser(res.data);
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

        fetchUserProfile();
        fetchProjects();
        checkNetworkHealth();
        
        const pingInterval = setInterval(checkNetworkHealth, 30000);
        return () => clearInterval(pingInterval);
    }, [token, navigate, user]);

    const handleInitializeWorkspace = async (e) => {
        e.preventDefault();
        if(!newWorkspaceTitle.trim()) return;
        
        try {
            const response = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/projects", {
                title: newWorkspaceTitle,
                description: JSON.stringify([{ name: "index.js", language: "javascript", content: "// Initialize DevSync environment...\n\nfunction executeCoreEngine() {\n  console.log('Engine Active!');\n}\n\nexecuteCoreEngine();" }])
            }, { headers: { "auth-token": token } });
            
            navigate(`/workspace/${response.data.id}`);
        } catch (error) { alert("System Error: Failed to provision workspace."); }
    };

    const handleDeleteWorkspace = async (e, projectId) => {
        e.stopPropagation(); 
        
        if (!window.confirm("CRITICAL ACTION: Are you sure you want to permanently delete this workspace and all its data?")) {
            return;
        }

        try {
            await axios.delete(`http://localhost:5000/api/projects/${projectId}`, { headers: { "auth-token": token } });
            setProjects(projects.filter(p => p.id !== projectId));
        } catch (error) {
            alert(error.response?.data?.error || "System Error: Failed to terminate workspace.");
        }
    };

    const handleTerminateSession = () => {
        dispatch(logout());
        navigate('/login'); 
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* --- HEADER --- */}
                <div className="flex justify-between items-center bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-lg">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Welcome, {dynamicUser?.name?.split(' ')[0] || 'Developer'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">Manage your active environments and remote configurations.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleTerminateSession} className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm">
                            Terminate Session
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* --- ACTION MODULE --- */}
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-blue-900/50 shadow-lg relative overflow-hidden flex flex-col justify-center h-full">
                        <div className="absolute top-0 left-0 w-1 bg-blue-500 h-full"></div>
                        <h2 className="text-lg font-bold mb-4 text-white">Deploy New Workspace</h2>
                        <form onSubmit={handleInitializeWorkspace} className="flex gap-3">
                            <input 
                                type="text" 
                                placeholder="Workspace title (e.g., App Core)"
                                value={newWorkspaceTitle}
                                onChange={(e) => setNewWorkspaceTitle(e.target.value)}
                                className="flex-1 bg-[#0f172a] border border-gray-600 text-sm px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 text-white transition-colors"
                            />
                            <button type="submit" className="px-6 py-3 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-md">
                                Initialize
                            </button>
                        </form>
                    </div>

                    {/* --- NAYA: ARENA PORTAL MODULE --- */}
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-purple-900/50 shadow-lg relative overflow-hidden flex flex-col justify-center h-full">
                        <div className="absolute top-0 left-0 w-1 bg-purple-500 h-full"></div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white">Coding Arena</h2>
                            <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-mono">Practice</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Solve algorithmic challenges in a secure automated sandbox environment.</p>
                        <button 
                            onClick={() => navigate("/arena")} 
                            className="w-full py-3 font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-md border border-purple-500"
                        >
                            Enter Problem Arena →
                        </button>
                    </div>
                </div>

                {/* --- TELEMETRY ROW --- */}
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-md">
                        <p className="text-sm text-gray-400 font-medium mb-1">Deployed Environments</p>
                        <p className="text-2xl font-bold text-blue-400">{isLoading ? "..." : projects.length} Active</p>
                    </div>
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-md overflow-hidden">
                        <p className="text-sm text-gray-400 font-medium mb-1">Registered Identity</p>
                        <p className="text-sm font-mono mt-2 truncate text-gray-300" title={dynamicUser?.email}>
                            {dynamicUser?.email || "Fetching Identity..."}
                        </p>
                    </div>
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-md flex flex-col justify-center">
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
                <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-lg min-h-[300px]">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                        <span>Workspace Directory</span>
                        {isLoading && <span className="text-xs text-blue-400 animate-pulse font-mono font-medium ml-2">(Syncing with database...)</span>}
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {projects.length === 0 && !isLoading ? (
                            <div className="col-span-2 text-center py-12 border border-dashed border-gray-600 rounded-xl text-gray-500 bg-[#0f172a]/50">
                                <p className="text-lg mb-1">No active workspaces found.</p>
                                <p className="text-sm">Initialize a new environment above to get started.</p>
                            </div>
                        ) : (
                            projects.map(project => {
                                const isOwner = project.ownerId === dynamicUser?.id;
                                
                                return (
                                    <div 
                                        key={project.id} 
                                        onClick={() => navigate(`/workspace/${project.id}`)} 
                                        className="bg-[#0f172a] p-5 rounded-xl border border-gray-700 hover:border-blue-500 cursor-pointer transition-all group relative overflow-hidden shadow-sm hover:shadow-blue-900/20 flex flex-col justify-between h-[140px]"
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