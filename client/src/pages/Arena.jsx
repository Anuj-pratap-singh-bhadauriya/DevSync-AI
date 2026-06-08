import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

const Arena = () => {
    const navigate = useNavigate();
    const { token } = useSelector((state) => state.auth);
    
    const [platformProblems, setPlatformProblems] = useState([]);
    const [isLoadingAPI, setIsLoadingAPI] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedProblem, setExpandedProblem] = useState(null);
    const [fetchingDetails, setFetchingDetails] = useState({}); // NAYA: Tracks loading state for individual problems

    // Failsafe Database (In case Live API goes down)
    const backupProblems = [
        {
            id: "prob-1",
            title: "1. Search in Rotated Sorted Array II",
            difficulty: "Medium",
            badgeColor: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
            category: "Binary Search",
            acceptance: "43.2%",
            isBackup: true,
            htmlContent: "<p>There is an integer array <code>nums</code> sorted in non-decreasing order (not necessarily with distinct values). Before being passed to your function, <code>nums</code> is rotated at an unknown pivot index.</p><p>Given the rotated array and a target, return true if target is in nums, otherwise false.</p><br/><strong>Example 1:</strong><pre><strong>Input:</strong> nums = [2,5,6,0,0,1,2], target = 0\n<strong>Output:</strong> true</pre><ul><li><code>1 <= nums.length <= 5000</code></li><li><code>-10<sup>4</sup> <= nums[i] <= 10<sup>4</sup></code></li></ul>"
        },
        {
            id: "prob-2",
            title: "2. Two Sum",
            difficulty: "Easy",
            badgeColor: "text-green-400 border-green-500/30 bg-green-500/10",
            category: "Hash Maps",
            acceptance: "51.4%",
            isBackup: true,
            htmlContent: "<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to target.</p><p>You may assume that each input would have exactly one solution, and you may not use the same element twice.</p><br/><strong>Example 1:</strong><pre><strong>Input:</strong> nums = [2,7,11,15], target = 9\n<strong>Output:</strong> [0,1]</pre><ul><li><code>2 <= nums.length <= 10<sup>4</sup></code></li></ul>"
        }
    ];

    // STEP 1: Fetch Top 30 Problems List
    useEffect(() => {
        const fetchLiveLeetCodeData = async () => {
            try {
                const res = await axios.get("https://alfa-leetcode-api.onrender.com/problems?limit=100", { timeout: 6000 });
                
                const liveData = res.data.problemsetQuestionList.map((p) => {
                    const diff = p.difficulty;
                    const bColor = diff === 'Easy' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 
                                   diff === 'Medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 
                                   'text-red-400 border-red-500/30 bg-red-500/10';
                    
                    return {
                        id: p.questionFrontendId,
                        slug: p.titleSlug, 
                        title: `${p.questionFrontendId}. ${p.title}`,
                        difficulty: p.difficulty,
                        badgeColor: bColor,
                        category: p.topicTags?.[0]?.name || "Algorithms",
                        acceptance: p.acRate.toFixed(1) + "%",
                        isBackup: false,
                        fetched: false, // Ensures we only fetch details once
                        htmlContent: ""
                    };
                });
                setPlatformProblems(liveData);
            } catch (error) {
                console.warn("Live API Offline. Deploying Failsafe Backup.");
                setPlatformProblems(backupProblems);
            } finally {
                setIsLoadingAPI(false);
            }
        };

        fetchLiveLeetCodeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // STEP 2: NAYA LAZY-LOAD ENGINE (Fetches Exact Constraints & Examples on click)
    const toggleExpand = async (prob) => {
        if (expandedProblem === prob.id) {
            setExpandedProblem(null);
            return;
        }
        setExpandedProblem(prob.id);

        if (prob.isBackup || prob.fetched) return; // Ignore if it's already loaded or a backup

        setFetchingDetails(prev => ({ ...prev, [prob.id]: true }));
        try {
            const res = await axios.get(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${prob.slug}`);
            const exactLeetCodeHTML = res.data.question || "<p>Error loading detailed statement.</p>";
            
            setPlatformProblems(prev => prev.map(p => {
                if (p.id === prob.id) return { ...p, fetched: true, htmlContent: exactLeetCodeHTML };
                return p;
            }));
        } catch (err) {
            setPlatformProblems(prev => prev.map(p => {
                if (p.id === prob.id) return { ...p, fetched: true, htmlContent: "<p class='text-red-400 font-bold'>[NETWORK ERROR] Failed to pull exact problem details from LeetCode servers.</p>" };
                return p;
            }));
        } finally {
            setFetchingDetails(prev => ({ ...prev, [prob.id]: false }));
        }
    };

    const handleInitializeChallenge = async (prob) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const cleanTitle = prob.title.split('.').slice(1).join('.').trim();
            const boilerplate = JSON.stringify([{ 
                name: "main.cpp", 
                language: "cpp", 
                content: `// Solving Challenge: ${cleanTitle}\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your optimal logic here...\n    \n    return 0;\n}` 
            }]);
            const res = await axios.post("http://localhost:5000/api/projects", { 
                title: `Solution: ${cleanTitle}`, 
                description: boilerplate 
            }, { headers: { "auth-token": token } });
            
            navigate(`/workspace/${res.data.id}`);
        } catch(err) { 
            alert("Initialization failed."); 
        } finally { 
            setActionLoading(false); 
        }
    };

    if (isLoadingAPI) {
        return (
            <div className="min-h-screen w-screen bg-[#0f172a] flex flex-col items-center justify-center font-mono text-center px-4">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                <div className="text-purple-400 font-bold tracking-widest text-sm animate-pulse mb-2">CONNECTING TO LEETCODE SERVERS</div>
                <div className="text-gray-500 text-xs">Fetching dynamic problem sets...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-screen bg-[#0f172a] text-white p-8 font-sans overflow-x-hidden">
            
            {/* NAYA: Global CSS injected to beautifully format LeetCode's raw HTML response */}
            <style>{`
                .leetcode-html-content p { margin-bottom: 1em; color: #cbd5e1; line-height: 1.6; }
                .leetcode-html-content pre { background: rgba(0,0,0,0.5); padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; margin-bottom: 1.5em; border: 1px solid #334155; white-space: pre-wrap; color: #d8b4fe; }
                .leetcode-html-content code { background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #e2e8f0; }
                .leetcode-html-content strong { color: #f8fafc; font-weight: 700; }
                .leetcode-html-content ul { list-style-type: disc; padding-left: 20px; margin-bottom: 1.5em; color: #94a3b8; }
                .leetcode-html-content li { margin-bottom: 0.5em; }
                .leetcode-html-content sup { vertical-align: super; font-size: smaller; }
            `}</style>

            <header className="max-w-4xl mx-auto flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Coding Arena</h1>
                        {!platformProblems[0]?.isBackup && (
                            <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full font-mono animate-pulse">API Connected</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">Select a challenge to automatically provision a secure sandbox.</p>
                </div>
                <button onClick={() => navigate("/")} className="px-4 py-2 border border-blue-900/50 hover:bg-blue-950/30 text-blue-400 text-xs font-bold font-mono rounded-lg transition-all shadow-sm">
                    ← Back to Dashboard
                </button>
            </header>

            <main className="max-w-4xl mx-auto">
                <div className="flex flex-col gap-4">
                    {platformProblems.map((prob) => (
                        <div key={prob.id} className="border border-gray-800 bg-[#1e293b] rounded-xl overflow-hidden shadow-lg transition-all hover:border-purple-500/50">
                            <div 
                                onClick={() => toggleExpand(prob)}
                                className="p-5 flex items-center justify-between cursor-pointer select-none"
                            >
                                <div className="flex flex-col gap-2 pr-4 truncate">
                                    <span className="text-lg font-bold text-gray-100 truncate">{prob.title}</span>
                                    <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                                        <span className="text-purple-400 font-medium bg-purple-500/10 px-2 py-0.5 rounded">{prob.category}</span>
                                        <span>•</span>
                                        <span>Acceptance: {prob.acceptance}</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 border rounded-full shrink-0 ${prob.badgeColor}`}>{prob.difficulty}</span>
                            </div>

                            {/* PROBLEM EXPANDED VIEW */}
                            {expandedProblem === prob.id && (
                                <div className="px-6 pb-6 pt-4 border-t border-gray-800 bg-[#0f172a]/80 text-sm flex flex-col animate-fadeIn">
                                    
                                    {fetchingDetails[prob.id] ? (
                                        <div className="flex items-center gap-3 text-purple-400 py-4 font-mono text-xs font-bold animate-pulse">
                                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                            Extracting accurate constraints and edge cases from LeetCode...
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-4">
                                                <h4 className="text-[11px] font-bold uppercase text-gray-500 tracking-widest mb-4 font-mono border-b border-gray-800 pb-2">Problem Statement & Constraints</h4>
                                                
                                                {/* NAYA: Actual HTML rendering logic perfectly synced with dark mode */}
                                                <div 
                                                    className="leetcode-html-content text-[13px]" 
                                                    dangerouslySetInnerHTML={{ __html: prob.htmlContent }} 
                                                />
                                            </div>
                                            
                                            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                                                <button 
                                                    onClick={() => handleInitializeChallenge(prob)}
                                                    disabled={actionLoading}
                                                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm font-mono rounded-lg shadow-md transition-colors"
                                                >
                                                    {actionLoading ? "Deploying Sandbox..." : "🚀 Solve Challenge"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Arena;