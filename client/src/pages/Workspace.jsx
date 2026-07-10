import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import DOMPurify from 'dompurify';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { io } from 'socket.io-client';
import { useToast } from '../components/Toast';
import VideoCall from '../components/VideoCall';

const Workspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socketInstance, setSocketInstance] = useState(null);
  
  const { token, user } = useSelector((state) => state.auth);
  const [currentUser, setCurrentUser] = useState(user);
  // Keep currentUser in sync with Redux user (single source of truth)
  useEffect(() => { if (user) setCurrentUser(user); }, [user]);

  const [workspaceData, setWorkspaceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save State");
  
  const [theme, setTheme] = useState("dark");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const [files, setFiles] = useState([{ name: "index.js", language: "javascript", content: "// Initialize enterprise workspace...\n" }]);
  const [activeFileName, setActiveFileName] = useState("index.js");
  const [newFileNameInput, setNewFileNameInput] = useState("");
  const [newFileLanguage, setNewFileLanguage] = useState("javascript");

  const [isInterviewMode, setIsInterviewMode] = useState(false);
  const [interviewEndTime, setInterviewEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);

  const [activePanelTab, setActivePanelTab] = useState("copilot");
  const [teamChats, setTeamChats] = useState([]);
  const [teamChatInput, setTeamChatInput] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);

  const [isAuditing, setIsAuditing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [customInput, setCustomInput] = useState("");
  
  const [copilotLogs, setCopilotLogs] = useState(["> Enterprise AI Pipeline Secure."]);
  const [executionLogs, setExecutionLogs] = useState(["> Virtual Execution Engine standby..."]);
  const [collabInviteRequests, setCollabInviteRequests] = useState([]);

  // Coding Arena states
  const [showArena, setShowArena] = useState(false);
  const [arenaProblems, setArenaProblems] = useState([]);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [arenaSearch, setArenaSearch] = useState('');

  const copilotEndRef = useRef(null);
  const executionEndRef = useRef(null);
  const teamChatEndRef = useRef(null);
  const socketRef = useRef(null);

  const activeFileNameRef = useRef(activeFileName);
  useEffect(() => { activeFileNameRef.current = activeFileName; }, [activeFileName]);

  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  const workspaceDataRef = useRef(workspaceData);
  useEffect(() => { workspaceDataRef.current = workspaceData; }, [workspaceData]);

  const arenaProblemsRef = useRef(arenaProblems);
  useEffect(() => { arenaProblemsRef.current = arenaProblems; }, [arenaProblems]);

  const saveStatusTimerRef = useRef(null);
  // Cleanup save status timer on unmount to prevent state updates on unmounted component
  useEffect(() => { return () => { if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current); }; }, []);

  useEffect(() => { copilotEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [copilotLogs]);
  useEffect(() => { executionEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [executionLogs]);
  useEffect(() => { teamChatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [teamChats]);

  const recordActivity = useCallback((actionDescription) => {
      const effectiveUser = currentUser || user;
      const displayName = effectiveUser?.name || effectiveUser?.email?.split('@')[0] || "Anonymous Developer";
      const payload = { roomId: id, userEmail: displayName, action: actionDescription, timestamp: new Date() };
      
      if (socketRef.current) socketRef.current.emit('log-activity', payload);
      setActivityLogs(prev => [payload, ...prev]); 
  }, [currentUser, user, id]);

  useEffect(() => {
    let timerInterval;
    if (isInterviewMode && interviewEndTime) {
        timerInterval = setInterval(() => {
            const distance = interviewEndTime - Date.now();
            if (distance <= 0) {
                clearInterval(timerInterval);
                setRemainingTime(0); setIsInterviewMode(false); setInterviewEndTime(null);
                setCopilotLogs(prev => [...prev, "> System: Interview session elapsed. Auto-terminating."]);
                recordActivity("System automatically terminated the interview session.");
                addToast("⏳ Interview time is strictly up! Code execution has been halted.", "error");
            } else {
                setRemainingTime(Math.floor(distance / 1000));
            }
        }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [isInterviewMode, interviewEndTime, recordActivity, addToast]);

  const formatTime = (totalSeconds) => {
      if (totalSeconds === null) return "00:00";
      const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
  };

  const getLanguageTemplate = (lang) => {
    switch(lang) {
      case 'cpp': return "#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << \"DevSync C++ Engine Active!\" << endl;\n    return 0;\n}";
      case 'python': return "def execute_engine():\n    print('DevSync Python Engine Active!')\n\nif __name__ == '__main__':\n    execute_engine()";
      case 'java': return "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"DevSync Java Engine Active!\");\n    }\n}";
      case 'html': return "<!DOCTYPE html>\n<html>\n<head>\n  <title>DevSync Document</title>\n</head>\n<body>\n  <h1>Engine Active</h1>\n</body>\n</html>";
      case 'go': return "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"DevSync Go Engine Active!\")\n}";
      case 'rust': return "fn main() {\n    println!(\"DevSync Rust Engine Active!\");\n}";
      case 'csharp': return "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"DevSync C# Engine Active!\");\n    }\n}";
      case 'ruby': return "puts 'DevSync Ruby Engine Active!'";
      case 'php': return "<?php\necho \"DevSync PHP Engine Active!\";\n?>";
      case 'swift': return "print(\"DevSync Swift Engine Active!\")";
      case 'kotlin': return "fun main() {\n    println(\"DevSync Kotlin Engine Active!\")\n}";
      case 'sql': return "-- DevSync SQL Execution\nSELECT 'Engine Active!' AS Status;";
      case 'javascript': default: return "// Initialize workspace parameters...\n\nfunction executeCoreEngine() {\n  console.log('DevSync Core Engine Active!');\n}\n\nexecuteCoreEngine();";
    }
  };

  // Coding Arena — fetch problems
  const fetchArenaProblems = useCallback(async () => {
    if (arenaProblems.length > 0) return;
    setArenaLoading(true);
    try {
      const res = await axios.get(import.meta.env.VITE_BACKEND_URL + '/api/leetcode/problems?limit=100', { headers: { 'auth-token': token }, timeout: 15000 });
      const list = ((res.data.questions) || []).map(p => {
        const diff = p.difficulty;
        const badgeColor = diff === 'Easy' ? 'bg-green-900/60 text-green-400 border-green-700' : diff === 'Medium' ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700' : 'bg-red-900/60 text-red-400 border-red-700';
        return {
          id: p.questionFrontendId,
          slug: p.titleSlug,
          title: `${p.questionFrontendId}. ${p.title}`,
          difficulty: diff,
          badgeColor,
          category: p.topicTags?.[0]?.name || 'Algorithms',
          acceptance: (p.acRate || 0).toFixed(1) + '%',
          fetched: false,
          htmlContent: ''
        };
      });
      setArenaProblems(list.length > 0 ? list : fallbackProblems);
    } catch {
      setArenaProblems(fallbackProblems);
    }
    setArenaLoading(false);
  }, [arenaProblems.length, token]);

  const fallbackProblems = [
    { id: '1', slug: 'two-sum', title: '1. Two Sum', difficulty: 'Easy', badgeColor: 'bg-green-900/60 text-green-400 border-green-700', category: 'Array', acceptance: '51.4%', fetched: false, htmlContent: '' },
    { id: '33', slug: 'search-in-rotated-sorted-array', title: '33. Search in Rotated Sorted Array', difficulty: 'Medium', badgeColor: 'bg-yellow-900/60 text-yellow-400 border-yellow-700', category: 'Binary Search', acceptance: '39.0%', fetched: false, htmlContent: '' }
  ];

  const getArenaBoilerplate = (lang, title, difficulty) => {
    const cleanTitle = title.replace(/^\d+\.\s*/, '');
    const header = `// Problem: ${cleanTitle}\n// Difficulty: ${difficulty}\n\n`;
    switch(lang) {
      case 'python': return header + "def solve():\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    solve()";
      case 'java': return header + "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n        \n    }\n}";
      case 'javascript': return header + "function solve() {\n    // Write your solution here\n    \n}\n\nsolve();";
      case 'csharp': return header + "using System;\n\nclass Program {\n    static void Main() {\n        // Write your solution here\n        \n    }\n}";
      case 'go': return header + "package main\n\nimport \"fmt\"\n\nfunc main() {\n    // Write your solution here\n    \n}";
      case 'cpp': default: return header + "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}";
    }
  };

  // Coding Arena — handle problem click
  const handleArenaProblemClick = async (prob) => {
    setSelectedProblem(prob);
    setActivePanelTab('problem');
    
    let finalProblem = prob;
    if (!prob.fetched) {
      try {
        const res = await axios.get(import.meta.env.VITE_BACKEND_URL + `/api/leetcode/problem/${prob.slug}`, { headers: { 'auth-token': token }, timeout: 15000 });
        finalProblem = { ...prob, htmlContent: res.data.question || '<p>Problem description not available.</p>', fetched: true };
        setSelectedProblem(finalProblem);
        setArenaProblems(prev => prev.map(p => p.slug === prob.slug ? finalProblem : p));
      } catch {
        finalProblem = { ...prob, htmlContent: '<p>Failed to load problem. Please try again.</p>', fetched: true };
        setSelectedProblem(finalProblem);
      }
    }
    // Load boilerplate in editor
    const boilerplate = getArenaBoilerplate('cpp', finalProblem.title, finalProblem.difficulty);
    const arenaFile = { name: `arena_${finalProblem.id}.cpp`, language: 'cpp', content: boilerplate };
    
    const currentFiles = filesRef.current;
    const exists = currentFiles.find(f => f.name === arenaFile.name);
    let newFiles = currentFiles;
    
    if (!exists) {
      newFiles = [...currentFiles, arenaFile];
      setFiles(newFiles);
    }
    
    setActiveFileName(arenaFile.name);
    
    // Broadcast the new file and active file change to peers
    if (socketRef.current) {
      socketRef.current.emit('file-structure-change', { 
        roomId: id, 
        files: newFiles, 
        activeFileName: arenaFile.name 
      });
      // Also broadcast the problem selection so peers see the problem description
      socketRef.current.emit('arena-problem-sync', {
        roomId: id,
        problem: finalProblem
      });
    }
  };

  const restoreArenaProblem = async (fileName, emitSync = true) => {
    if (!fileName.startsWith('arena_')) return;
    const match = fileName.match(/arena_(\d+)\./);
    if (!match) return;
    const probId = match[1];

    let currentArenaProblems = arenaProblemsRef.current;
    
    // If problems list isn't loaded yet, fetch it to find the requested ID
    if (currentArenaProblems.length === 0) {
       try {
         const res = await axios.get(import.meta.env.VITE_BACKEND_URL + '/api/leetcode/problems?limit=100', { headers: { 'auth-token': token }, timeout: 15000 });
         const list = (res.data.questions || []).map(p => {
           const diff = p.difficulty;
           const badgeColor = diff === 'Easy' ? 'bg-green-900/60 text-green-400 border-green-700' : diff === 'Medium' ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700' : 'bg-red-900/60 text-red-400 border-red-700';
           return {
             id: p.questionFrontendId,
             slug: p.titleSlug,
             title: `${p.questionFrontendId}. ${p.title}`,
             difficulty: diff,
             badgeColor,
             category: p.topicTags?.[0]?.name || 'Algorithms',
             acceptance: (p.acRate || 0).toFixed(1) + '%',
             fetched: false,
             htmlContent: ''
           };
         });
         if (list.length > 0) {
           currentArenaProblems = list;
           setArenaProblems(list);
         } else {
           currentArenaProblems = fallbackProblems;
         }
       } catch {
         currentArenaProblems = fallbackProblems;
       }
    }

    const staticProb = currentArenaProblems.find(p => String(p.id) === probId) || fallbackProblems.find(p => String(p.id) === probId);
    if (!staticProb) return;

    let finalProblem = staticProb;
    if (!staticProb.fetched) {
      try {
        const res = await axios.get(import.meta.env.VITE_BACKEND_URL + `/api/leetcode/problem/${staticProb.slug}`, { headers: { 'auth-token': token }, timeout: 15000 });
        finalProblem = { ...staticProb, htmlContent: res.data.question || '<p>Problem description not available.</p>', fetched: true };
        setArenaProblems(prev => prev.map(p => p.slug === staticProb.slug ? finalProblem : p));
      } catch {
        finalProblem = { ...staticProb, htmlContent: '<p>Failed to load problem. Please try again.</p>', fetched: true };
      }
    }

    setSelectedProblem(finalProblem);
    setActivePanelTab('problem');

    if (emitSync && socketRef.current) {
      socketRef.current.emit('arena-problem-sync', {
        roomId: id,
        problem: finalProblem
      });
    }
  };

  const fileClickTimerRef = useRef(null);

  const handleFileClick = (fileName) => {
    setActiveFileName(fileName);
    
    // Debounce socket emit and arena restore to prevent burst on rapid clicking
    if (fileClickTimerRef.current) clearTimeout(fileClickTimerRef.current);
    fileClickTimerRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('file-structure-change', { 
          roomId: id, 
          files: filesRef.current, 
          activeFileName: fileName 
        });
      }
      restoreArenaProblem(fileName, true);
    }, 300);
  };

  const getFileExtension = (lang) => {
    switch(lang) {
      case 'python': return 'main.py';
      case 'cpp': return 'main.cpp';
      case 'java': return 'Main.java';
      case 'html': return 'index.html';
      case 'go': return 'main.go';
      case 'rust': return 'main.rs';
      case 'csharp': return 'main.cs';
      case 'ruby': return 'main.rb';
      case 'php': return 'index.php';
      case 'swift': return 'main.swift';
      case 'kotlin': return 'main.kt';
      case 'sql': return 'query.sql';
      case 'javascript': default: return 'index.js';
    }
  };

  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  useEffect(() => {
    const fetchUserProfile = async () => {
        if (!user?.name) {
            try {
                const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/getuser", {}, { headers: { "auth-token": token } });
                setCurrentUser(res.data);
            } catch (err) {}
        }
    };

    const fetchWorkspaceDetails = async () => {
      try {
        const res = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id, { headers: { "auth-token": token } });
        setWorkspaceData(res.data);
        // Restore saved files from DB as initial state (socket workspace-state-sync will override if peers are online)
        if (res.data.description && res.data.description.startsWith("[")) {
          try {
            const parsedFiles = JSON.parse(res.data.description);
            if (parsedFiles.length > 0) {
              setFiles(prev => {
                // Only restore from DB if we still have the default single file
                if (prev.length === 1 && prev[0].name === "index.js" && prev[0].content === "// Initialize enterprise workspace...\n") {
                  setActiveFileName(parsedFiles[0]?.name || "index.js");
                  return parsedFiles;
                }
                return prev;
              });
            }
          } catch (e) {}
        }
        
        axios.get(import.meta.env.VITE_BACKEND_URL + `/api/projects/${id}/invite-requests`, { headers: { "auth-token": token } })
            .then(reqRes => setCollabInviteRequests(reqRes.data))
            .catch(err => {});
      } catch (err) { navigate("/dashboard"); } finally { setIsLoading(false); }
    };

    const fetchHistoricalData = async () => {
        try {
            const chatRes = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/chats", { headers: { "auth-token": token } });
            setTeamChats(chatRes.data);
            const logRes = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/logs", { headers: { "auth-token": token } });
            setActivityLogs(logRes.data);
        } catch (error) {
            console.error("Failed to fetch historical data", error);
        }
    };

    if (token) { 
        fetchUserProfile(); 
        fetchWorkspaceDetails(); 
        fetchHistoricalData(); 
    }
  }, [id, token, navigate]); // Data fetching effect ends here

  // Socket connection effect
  useEffect(() => {
    if (!token) return;

    const effectiveEmail = currentUser?.email || user?.email;
    const effectiveName = currentUser?.name || user?.name || effectiveEmail?.split('@')[0];
    
    // Wait until we have the user's details before connecting
    if (!effectiveEmail || !effectiveName) return;

    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
        auth: { token: token }
    });
    socketRef.current = newSocket;
    setSocketInstance(newSocket);

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', id, effectiveEmail, effectiveName);
    });

    socketRef.current.on('room-users-update', (users) => {
      setOnlineUsers(users);
    });

    socketRef.current.on('user-joined', (data) => {
      setCopilotLogs(prev => [...prev, `> System Alert: ${data.message}`]);
    });

    socketRef.current.on('receive-code', ({ fileName, newContent }) => {
      setFiles(prevFiles => prevFiles.map(f => f.name === fileName ? { ...f, content: newContent } : f));
    });

    socketRef.current.on('receive-file-structure', ({ files: newFiles, activeFileName: newActive }) => {
        setFiles(newFiles);
        setActiveFileName(newActive);
    });

    socketRef.current.on('arena-problem-sync', (problem) => {
        setSelectedProblem(problem);
        setActivePanelTab('problem');
        // Update local arena problems list if needed
        setArenaProblems(prev => {
            if (!prev.find(p => p.slug === problem.slug)) return prev;
            return prev.map(p => p.slug === problem.slug ? problem : p);
        });
    });

    socketRef.current.on('workspace-state-sync', (state) => {
        if (state.files && state.files.length > 0) {
            setFiles(state.files);
            if (state.activeFileName) {
                setActiveFileName(state.activeFileName);
                // Use server-persisted arena problem if available, otherwise fetch
                if (state.arenaProblem) {
                    setSelectedProblem(state.arenaProblem);
                    setActivePanelTab('problem');
                } else {
                    restoreArenaProblem(state.activeFileName, false);
                }
            }
        }
        if (state.interviewEndTime && state.interviewEndTime > Date.now()) {
            setInterviewEndTime(state.interviewEndTime);
            setIsInterviewMode(true);
        }
        if (state.videoParticipants && state.videoParticipants.length > 0) {
            setShowVideoCall(true);
        }
    });

    socketRef.current.on('invite-approval-request', (invitation) => {
        const myId = user?.id || user?.userId || currentUser?.id || currentUser?._id;
        if (invitation.ownerId === myId) {
            setCollabInviteRequests(prev => [invitation, ...prev]);
        }
    });

    socketRef.current.on('kicked-out', (data) => {
        addToast(data.message, "error");
        navigate("/dashboard");
    });

    socketRef.current.on('invite-decision', (data) => {
        if (data.status === 'ALLOWED') {
            addToast(`✅ Your request to invite ${data.target} was allowed by ${data.owner}.`, "success");
        } else {
            addToast(`❌ Your request to invite ${data.target} was denied by ${data.owner}.`, "error");
        }
    });

    socketRef.current.on('invite-response', (data) => {
        if (data.status === 'ACCEPTED') {
            addToast(`🎉 ${data.user} has accepted the invitation to join the workspace!`, "success");
            if (data.newMember) {
                setWorkspaceData(prev => prev ? { ...prev, members: [...prev.members, data.newMember] } : prev);
            }
        } else {
            addToast(`ℹ️ ${data.user} has declined the invitation.`, "info");
        }
    });

    socketRef.current.on('receive-team-message', (newMessage) => {
        setTeamChats(prev => [...prev, newMessage]);
    });

    socketRef.current.on('receive-activity-log', (newLog) => {
        setActivityLogs(prev => [newLog, ...prev]);
    });

    socketRef.current.on('interview-started', ({ endTime }) => {
        setInterviewEndTime(endTime); setIsInterviewMode(true);
        setCopilotLogs(prev => [...prev, `> System: Synchronized Interview Session initiated.`]);
    });

    socketRef.current.on('interview-ended', () => {
        setIsInterviewMode(false); setInterviewEndTime(null); setRemainingTime(null);
        setCopilotLogs(prev => [...prev, `> System: Interview manually terminated by administrator.`]);
    });

    socketRef.current.on('workspace-deleted', () => {
        alert("This workspace has been deleted by the owner.");
        navigate('/dashboard');
    });

    return () => { newSocket.disconnect(); };
  }, [id, token, navigate, user?.id, currentUser?.email, currentUser?.name]);

  const handleEditorChange = (value) => {
    const currentFile = activeFileNameRef.current;
    setFiles(prevFiles => prevFiles.map(f => f.name === currentFile ? { ...f, content: value } : f));
    if (socketRef.current) socketRef.current.emit('code-change', { roomId: id, fileName: currentFile, code: value });
  };

  const handleActiveFileLanguageChange = (e) => {
    const newLang = e.target.value;
    const currentLang = activeFile.language;
    const currentContent = activeFile.content;

    const oldLanguageContents = activeFile.languageContents || {};
    const updatedLanguageContents = {
        ...oldLanguageContents,
        [currentLang]: currentContent 
    };

    let newContent = updatedLanguageContents[newLang];
    if (!newContent) {
        if (activeFile.name.startsWith('arena_')) {
            const match = activeFile.name.match(/arena_(\d+)\./);
            const probId = match ? match[1] : '';
            const prob = arenaProblems.find(p => String(p.id) === probId) || fallbackProblems.find(p => String(p.id) === probId) || selectedProblem;
            if (prob) {
                newContent = getArenaBoilerplate(newLang, prob.title, prob.difficulty);
            } else {
                newContent = getArenaBoilerplate(newLang, `Problem ${probId}`, "Unknown");
            }
        } else {
            newContent = getLanguageTemplate(newLang);
        }
    }

    const dotIndex = activeFile.name.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? activeFile.name.substring(0, dotIndex) : activeFile.name;
    const newExtension = getFileExtension(newLang).split('.')[1];
    let finalFileName = `${baseName}.${newExtension}`;
    
    if (files.some(f => f.name === finalFileName && f.name !== activeFile.name)) {
        finalFileName = `new_${finalFileName}`;
    }

    const newFiles = files.map(f => f.name === activeFileName ? { 
        ...f, 
        name: finalFileName, 
        language: newLang, 
        content: newContent,
        languageContents: updatedLanguageContents 
    } : f);

    setFiles(newFiles);
    setActiveFileName(finalFileName);
    
    if (socketRef.current) socketRef.current.emit('file-structure-change', { roomId: id, files: newFiles, activeFileName: finalFileName });
    recordActivity(`Refactored active syntax to ${newLang.toUpperCase()} and cached content buffer.`);
  };

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (!newFileNameInput.trim()) return;

    // Map language to its extension
    const extMap = {
      javascript: '.js', python: '.py', cpp: '.cpp', java: '.java',
      html: '.html', go: '.go', rust: '.rs', csharp: '.cs',
      ruby: '.rb', php: '.php', swift: '.swift', kotlin: '.kt', sql: '.sql'
    };

    // If user typed a name WITHOUT a dot (no extension), auto-append the right one
    let finalName = newFileNameInput.trim();
    if (!finalName.includes('.')) {
      finalName = finalName + (extMap[newFileLanguage] || '.js');
    }

    if (files.some(f => f.name.toLowerCase() === finalName.toLowerCase())) {
      return addToast(`File "${finalName}" already exists.`, "error");
    }
    
    const newFiles = [...files, { name: finalName, language: newFileLanguage, content: getLanguageTemplate(newFileLanguage) }];
    setFiles(newFiles);
    setActiveFileName(finalName);
    
    if (socketRef.current) socketRef.current.emit('file-structure-change', { roomId: id, files: newFiles, activeFileName: finalName });
    recordActivity(`Provisioned new source file: ${finalName}`);
    setNewFileNameInput("");
  };

  const handleDeleteFile = (fileNameToDelete, e) => {
    e.stopPropagation(); 
    if (files.length <= 1) return addToast("System requires at least one active buffer.", "error");
    
    const updatedFiles = files.filter(f => f.name !== fileNameToDelete);
    const nextActive = activeFileName === fileNameToDelete ? updatedFiles[0].name : activeFileName;
    
    setFiles(updatedFiles);
    setActiveFileName(nextActive);
    
    if (socketRef.current) socketRef.current.emit('file-structure-change', { roomId: id, files: updatedFiles, activeFileName: nextActive });
    recordActivity(`Destroyed source file: ${fileNameToDelete}`);
  };

  const handlePersistConfiguration = useCallback(async () => {
    if (isSynchronizing) return;
    setIsSynchronizing(true);
    setSaveStatus("Saving...");
    try { 
        await axios.put(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id, {
            title: workspaceDataRef.current?.title || "Workspace", 
            description: JSON.stringify(filesRef.current) 
        }, { headers: { "auth-token": token } }); 
        recordActivity("Committed workspace state to remote PostgreSQL database.");
        
        setSaveStatus("Saved! ✅");
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus("Save State"), 2500);
    } 
    catch (err) { 
        setSaveStatus("Error!");
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus("Save State"), 2500);
    } 
    finally { setIsSynchronizing(false); }
  }, [isSynchronizing, id, token, recordActivity]);

  useEffect(() => {
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault(); 
            handlePersistConfiguration();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePersistConfiguration]); 

  const handleRunCode = async () => {
    if (!activeFile?.content?.trim()) return;
    setIsRunning(true);
    setExecutionLogs(prev => [...prev, `\n> Transmitting buffer to Virtual Engine...`]);
    recordActivity(`Triggered virtual execution for ${activeFile.name}`);
    try {
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/execute", { language: activeFile.language, codeBuffer: activeFile.content, customInput: customInput }, { headers: { "auth-token": token } });
      setExecutionLogs(prev => [...prev, `> [EXECUTION OUTPUT]:\n${res.data.output.trim()}`]);
    } catch (err) { setExecutionLogs(prev => [...prev, `> [CRITICAL ERROR] Virtual Execution Terminated.`]); } 
    finally { setIsRunning(false); }
  };

  const handleTriggerAudit = async () => {
    if (!activeFile?.content?.trim()) return;
    setIsAuditing(true);
    setCopilotLogs(prev => [...prev, `> Initiating Deep-Code AI Audit...`]);
    recordActivity("Requested AI Copilot code audit and optimization.");
    try {
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/audit", { codeBuffer: activeFile.content }, { headers: { "auth-token": token } });
      setCopilotLogs(prev => [...prev, `> ${res.data.auditLog}`]);
    } catch (err) { setCopilotLogs(prev => [...prev, `> [NETWORK EXCEPTION] AI Engine unreachable.`]); } 
    finally { setIsAuditing(false); }
  };

  const handleSendCopilotChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const query = chatInput; setChatInput(""); setIsChatting(true);
    setCopilotLogs(prev => [...prev, `> [User]: ${query}`]);
    recordActivity("Consulted AI Copilot regarding code structure.");

    const chatHistory = copilotLogs
      .filter(log => log.startsWith("> [User]:") || log.startsWith("> [AI]:"))
      .map(log => {
          if (log.startsWith("> [User]:")) {
              return { role: "user", content: log.replace("> [User]: ", "") };
          } else {
              return { role: "assistant", content: log.replace("> [AI]: ", "") };
          }
      });
    
    chatHistory.push({ role: "user", content: query });

    try {
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/chat", { promptMessage: query, history: chatHistory, codeBuffer: activeFile?.content || "" }, { headers: { "auth-token": token } });
      setCopilotLogs(prev => [...prev, `> [AI]: ${res.data.reply}`]);
    } catch (err) {
      setCopilotLogs(prev => [...prev, `> [SYSTEM ERROR] AI Copilot failed to respond.`]);
    } finally { setIsChatting(false); }
  };

  const handleSendTeamMessage = (e) => {
      e.preventDefault();
      if(!teamChatInput.trim() || !socketRef.current) return;
      
      const displayName = currentUser?.name || currentUser?.email?.split('@')[0] || "Developer";
      
      const payload = { roomId: id, senderEmail: displayName, message: teamChatInput, timestamp: new Date() };
      socketRef.current.emit('send-team-message', payload);
      setTeamChats(prev => [...prev, payload]);
      setTeamChatInput("");
  };

  const handleStartInterview = () => {
      if(!socketRef.current) return;
      const durationMinutes = 45; 
      socketRef.current.emit('start-interview', { roomId: id, durationMinutes });
      recordActivity("Provisioned a 45-minute synchronized interview session.");
  };

  const handleEndInterview = () => {
      if(!socketRef.current) return;
      if(window.confirm("Terminate the technical interview early?")) {
          socketRef.current.emit('end-interview', { roomId: id });
          recordActivity("Manually terminated the technical interview.");
      }
  };

  const handleRemoveMember = async (memberId) => {
      try {
          await axios.delete(import.meta.env.VITE_BACKEND_URL + `/api/projects/${id}/members/${memberId}`, { headers: { "auth-token": token } });
          setWorkspaceData(prev => ({ ...prev, members: prev.members.filter(m => m.userId !== memberId) }));
          addToast("Member removed successfully.", "success");
      } catch (err) {
          addToast(err.response?.data?.error || "Failed to remove member.", "error");
      }
  };

  const handleInviteCollaborator = async (e) => {
    e.preventDefault();
    if(!inviteEmail.trim()) return;
    try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/invite", { targetEmail: inviteEmail }, { headers: { "auth-token": token } });
        setShowInviteModal(false); setInviteEmail("");
        recordActivity(`Dispatched workspace invitation to ${inviteEmail}`);
        addToast("✅ Invitation sent! Waiting for them to accept.", "success");
    } catch (err) { 
        addToast(err.response?.data?.error || "Error: Failed to send invitation.", "error"); 
    }
  };

  const approveInvite = async (inviteId) => {
      try {
          await axios.post(import.meta.env.VITE_BACKEND_URL + `/api/invites/${inviteId}/approve`, {}, { headers: { "auth-token": token } });
          setCollabInviteRequests(prev => prev.filter(req => req.id !== inviteId));
          addToast("Invite approved and sent!", "success");
      } catch (err) { addToast("Failed to approve invite", "error"); }
  };

  const denyInvite = async (inviteId) => {
      try {
          await axios.post(import.meta.env.VITE_BACKEND_URL + `/api/invites/${inviteId}/deny`, {}, { headers: { "auth-token": token } });
          setCollabInviteRequests(prev => prev.filter(req => req.id !== inviteId));
          addToast("Invite denied.", "info");
      } catch (err) { addToast("Failed to deny invite", "error"); }
  };

  const languageOptions = (
      <>
        <option value="javascript">JavaScript (Node)</option>
        <option value="python">Python 3</option>
        <option value="cpp">C++ (GCC)</option>
        <option value="java">Java (JDK)</option>
        <option value="go">Go (Golang)</option>
        <option value="rust">Rust</option>
        <option value="csharp">C# (.NET)</option>
        <option value="ruby">Ruby</option>
        <option value="php">PHP</option>
        <option value="swift">Swift</option>
        <option value="kotlin">Kotlin</option>
        <option value="sql">SQL</option>
        <option value="html">HTML5</option>
      </>
  );

  if (isLoading) return <div className={`h-screen w-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}`}><div className="text-blue-500 animate-pulse text-lg font-mono tracking-widest">INITIALIZING ENTERPRISE ENVIRONMENT...</div></div>;

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1e1e1e] text-[#cccccc]' : 'bg-[#ffffff] text-[#333333]'}`}>
      
      {collabInviteRequests.map(req => (
        <div key={req.id} className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center text-sm shadow-md z-50">
           <div><span className="font-bold">{req.sender?.name || req.sender?.email}</span> wants to invite <span className="font-bold">{req.receiver?.name || req.receiver?.email}</span> to this workspace.</div>
           <div className="flex gap-2">
              <button onClick={() => approveInvite(req.id)} className="bg-green-500 hover:bg-green-400 px-3 py-1 rounded text-xs font-bold transition-colors">Allow</button>
              <button onClick={() => denyInvite(req.id)} className="bg-red-500 hover:bg-red-400 px-3 py-1 rounded text-xs font-bold transition-colors">Deny</button>
           </div>
        </div>
      ))}

      <header className={`px-3 py-1.5 flex justify-between items-center border-b shrink-0 gap-2 ${theme === 'dark' ? 'bg-[#333333] border-[#252526]' : 'bg-[#f3f3f3] border-[#cccccc]'}`}>
        <div className="flex flex-col min-w-0 shrink">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 border flex items-center gap-1 whitespace-nowrap ${isInterviewMode ? 'bg-[#d16969] text-white border-[#d16969]' : (theme === 'dark' ? 'bg-[#007acc] text-white border-[#007acc]' : 'bg-[#007acc] text-white border-[#007acc]')}`}>
              {isInterviewMode && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
              {isInterviewMode ? `INTERVIEW: ${formatTime(remainingTime)}` : "ACTIVE"}
            </span>
            <span className={`font-mono text-[10px] hidden sm:inline ${theme === 'dark' ? 'text-[#858585]' : 'text-[#858585]'}`}>UID: {id.split('-')[0]}...</span>

            {/* ONLINE USERS INDICATOR */}
            <div className="flex items-center">
                <select className={`text-[10px] py-0.5 px-1 border rounded-sm focus:outline-none cursor-pointer font-medium transition-colors ${theme === 'dark' ? 'bg-[#3c3c3c] text-[#cccccc] border-[#3c3c3c] hover:bg-[#464646]' : 'bg-[#e4e4e4] text-[#333333] border-[#e4e4e4] hover:bg-[#d4d4d4]'}`}>
                    <option value="" disabled selected>{onlineUsers.length} Online</option>
                    {onlineUsers.map((ou, i) => (
                        <option key={ou.socketId || i} disabled>{ou.name || ou.email || "Anonymous"}</option>
                    ))}
                </select>
            </div>
          </div>
          <h1 className="text-sm font-bold mt-0.5 tracking-tight truncate max-w-[180px]">{workspaceData ? workspaceData.title : "Workspace"}</h1>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Arena Toggle */}
          <button onClick={() => { setShowArena(!showArena); if (!showArena) fetchArenaProblems(); }} title="Coding Arena" className={`px-2 py-1 rounded-sm font-medium text-[10px] uppercase tracking-wider flex items-center gap-1 ${showArena ? 'bg-[#007acc] text-white' : (theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]')}`}>
            <span>🏟️</span><span className="hidden lg:inline">Arena</span>
          </button>
          
          {/* Invite */}
          <button onClick={() => setShowInviteModal(true)} title="Invite" className={`px-2 py-1 rounded-sm font-medium text-[10px] uppercase tracking-wider flex items-center gap-1 ${theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]'}`}>
            <span>👥</span><span className="hidden lg:inline">Invite</span>
          </button>
          
          {/* Video Call */}
          <button onClick={() => setShowVideoCall(!showVideoCall)} title={showVideoCall ? 'End Call' : 'Start Call'} className={`px-2 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 ${showVideoCall ? 'bg-[#d16969] text-white hover:bg-[#c15959]' : (theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]')}`}>
            <span>{showVideoCall ? '📞' : '📹'}</span><span className="hidden lg:inline">{showVideoCall ? 'End Call' : 'Start Call'}</span>
          </button>
          
          {/* Interview */}
          {!isInterviewMode ? (
              <button onClick={handleStartInterview} title="Start Interview" className={`px-2 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 ${theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]'}`}>
                <span>🎤</span><span className="hidden xl:inline">Start 45m Interview</span><span className="hidden lg:inline xl:hidden">Interview</span>
              </button>
          ) : (
              <button onClick={handleEndInterview} title="End Interview" className="px-2 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider bg-[#d16969] text-white hover:bg-[#c15959] flex items-center gap-1">
                <span>⏹</span><span className="hidden lg:inline">End Interview</span>
              </button>
          )}

          {/* Theme Toggle */}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle Theme" className={`flex items-center justify-center p-1 rounded-sm w-6 h-6 transition-colors ${theme === 'dark' ? 'hover:bg-[#464646] text-[#cccccc]' : 'hover:bg-[#d4d4d4] text-[#333333]'}`}>
              {theme === "dark" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
              ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
          </button>

          {/* Run Code */}
          <button onClick={handleRunCode} disabled={isRunning || (isInterviewMode && remainingTime === 0)} title="Run Code" className={`px-2 py-1 rounded-sm font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 ${(isRunning || (isInterviewMode && remainingTime === 0)) ? "bg-[#4d4d4d] text-[#888888] cursor-not-allowed" : "bg-[#007acc] text-white hover:bg-[#0062a3]"}`}>
            <span>▶</span><span className="hidden lg:inline">Run Code</span>
          </button>

          {/* Save */}
          <button onClick={handlePersistConfiguration} disabled={isSynchronizing} title="Save" className={`px-2 py-1 rounded-sm font-medium text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 ${saveStatus.includes("Saved") ? "bg-[#007acc] text-white" : (theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]')}`}>
            <span className="hidden lg:inline">{saveStatus}</span><span className="lg:hidden">💾</span>
          </button>

          {/* Dashboard */}
          <button onClick={() => navigate("/dashboard")} title="Dashboard" className={`px-2 py-1 rounded-sm font-medium text-[10px] uppercase tracking-wider flex items-center gap-1 ${theme === 'dark' ? 'bg-[#3c3c3c] hover:bg-[#464646] text-[#cccccc]' : 'bg-[#e4e4e4] hover:bg-[#d4d4d4] text-[#333333]'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="hidden lg:inline">Dashboard</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-0 relative bg-transparent">
        <PanelGroup direction="horizontal" className="w-full h-full flex">
          
          <Panel defaultSize={20} minSize={15} className={`border-r flex flex-col h-full ${theme === 'dark' ? 'bg-[#252526] border-[#2b2b2b]' : 'bg-[#f3f3f3] border-[#cccccc]'}`}>
            <div className="p-0 pt-2 flex flex-col h-full overflow-hidden">
              <h3 className="text-[10px] font-bold text-gray-500 mb-2 pl-4 tracking-widest uppercase">
                {showArena ? 'Coding Arena' : 'Explorer'}
              </h3>
              
              {!showArena ? (
                <>
                  <form onSubmit={handleCreateFile} className="mb-2 px-4 flex flex-col gap-1 shrink-0">
                    <input type="text" placeholder="filename.js" value={newFileNameInput} onChange={(e) => setNewFileNameInput(e.target.value)} className={`text-[11px] px-2 py-1 border rounded-sm focus:outline-none focus:border-[#007acc] ${theme === 'dark' ? 'bg-[#3c3c3c] border-[#3c3c3c] text-white' : 'bg-white border-[#cccccc]'}`} />
                    <div className="flex gap-1">
                      <select value={newFileLanguage} onChange={(e) => setNewFileLanguage(e.target.value)} className={`text-[10px] border rounded-sm px-1 py-0.5 flex-1 outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#3c3c3c] border-[#3c3c3c] text-white' : 'bg-white border-[#cccccc]'}`}>
                        {languageOptions}
                      </select>
                      <button type="submit" className="bg-[#007acc] hover:bg-[#0062a3] text-white text-[10px] px-2 py-0.5 rounded-sm">+</button>
                    </div>
                  </form>
                  <div className="flex-1 overflow-y-auto flex flex-col">
                    {files.map((f) => (
                        <div key={f.name} onClick={() => handleFileClick(f.name)} className={`group px-4 py-1 flex justify-between items-center cursor-pointer transition-colors ${f.name === activeFileName ? (theme === 'dark' ? 'bg-[#37373d] text-white' : 'bg-[#e4e6f1] text-[#333333]') : (theme === 'dark' ? 'text-[#cccccc] hover:bg-[#2a2d2e]' : 'text-[#616161] hover:bg-[#e8e8e8]')}`}>
                          <div className="flex items-center gap-2 overflow-hidden"><span className="text-[11px] font-mono truncate">{f.name}</span></div>
                          <button onClick={(e) => handleDeleteFile(f.name, e)} className="text-gray-500 hover:text-red-500 text-[10px] font-bold opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  <input type="text" placeholder="Search problems..." value={arenaSearch} onChange={(e) => setArenaSearch(e.target.value)} className={`mb-3 text-xs px-2 py-1.5 border rounded focus:outline-none focus:border-orange-500 ${theme === 'dark' ? 'bg-gray-950 border-gray-700 text-white' : 'bg-gray-50 text-gray-900'}`} />
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                    {arenaLoading ? (
                      <div className="text-xs text-gray-500 text-center py-4 animate-pulse">Loading Arena...</div>
                    ) : (
                      arenaProblems.filter(p => p.title.toLowerCase().includes(arenaSearch.toLowerCase())).map((p) => (
                        <div key={p.slug} onClick={() => handleArenaProblemClick(p)} className={`p-2 rounded-lg border cursor-pointer transition-colors ${selectedProblem?.slug === p.slug ? 'bg-orange-900/20 border-orange-500/50' : (theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-200 hover:bg-gray-50')}`}>
                          <h4 className={`text-xs font-bold mb-1 truncate ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{p.title}</h4>
                          <div className="flex gap-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${p.badgeColor}`}>{p.difficulty}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>{p.category}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className={`w-[1px] cursor-col-resize transition-colors ${theme === 'dark' ? 'bg-[#2b2b2b] hover:bg-[#007acc]' : 'bg-[#cccccc] hover:bg-[#007acc]'}`} />

          <Panel defaultSize={50} minSize={35} className="h-full">
            <PanelGroup direction="vertical" className="w-full h-full flex flex-col">
              <Panel defaultSize={70} minSize={30} className={`flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#ffffff]'}`}>
                
                <div className={`flex items-center border-b shrink-0 h-9 overflow-x-auto custom-scrollbar ${theme === 'dark' ? 'bg-[#2d2d2d] border-[#2b2b2b]' : 'bg-[#f3f3f3] border-[#cccccc]'}`}>
                  <div className={`flex items-center h-full px-4 border-r border-t-2 shrink-0 ${theme === 'dark' ? 'bg-[#1e1e1e] border-r-[#2b2b2b] border-t-[#007acc] text-[#cccccc]' : 'bg-[#ffffff] border-r-[#cccccc] border-t-[#007acc] text-[#333333]'}`}>
                      <span className="font-mono text-[11px] mr-3">{activeFile.name}</span>
                      
                      <select 
                          value={activeFile.language} 
                          onChange={handleActiveFileLanguageChange}
                          className={`text-[9px] border-none outline-none cursor-pointer bg-transparent ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                      >
                          {languageOptions}
                      </select>
                  </div>

                  <div className="flex items-center gap-2 ml-auto pr-4 shrink-0">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007acc] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#007acc]"></span></span>
                    <span className={`text-[9px] uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-[#007acc]' : 'text-[#007acc]'}`}>Connected</span>
                  </div>
                </div>

                <div className="flex-1 w-full pt-2 min-h-0 relative">
                  {isInterviewMode && remainingTime === 0 && (
                      <div className="absolute inset-0 bg-red-900/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col text-white">
                          <h2 className="text-2xl font-bold tracking-widest uppercase mb-2">Interview Terminated</h2>
                          <p className="font-mono">Time limit reached. Further modifications are locked.</p>
                      </div>
                  )}
                  <Editor 
                      height="100%" 
                      language={activeFile.language} 
                      theme={theme === 'dark' ? 'vs-dark' : 'light'} 
                      value={activeFile.content} 
                      onChange={handleEditorChange} 
                      options={{ 
                          minimap: { enabled: false }, 
                          fontSize: 14, 
                          wordWrap: "on",
                          renderValidationDecorations: "on",
                          automaticLayout: true
                      }} 
                  />
                </div>
              </Panel>
              <PanelResizeHandle className={`h-[1px] my-0 cursor-row-resize transition-colors ${theme === 'dark' ? 'bg-[#2b2b2b] hover:bg-[#007acc]' : 'bg-[#cccccc] hover:bg-[#007acc]'}`} />
              
              <Panel defaultSize={30} minSize={15} className={`flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#ffffff]'}`}>
                <div className={`px-4 py-1.5 flex justify-between items-center ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#ffffff]'}`}>
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    TERMINAL
                  </span>
                </div>
                
                <div className="flex-1 flex overflow-hidden min-h-0 border-t border-[#2b2b2b]">
                    <div className={`w-[30%] flex flex-col border-r ${theme === 'dark' ? 'border-[#2b2b2b] bg-[#1e1e1e]' : 'border-[#cccccc] bg-[#ffffff]'}`}>
                        <div className={`px-3 py-1 text-[9px] font-bold tracking-widest uppercase border-b text-center ${theme === 'dark' ? 'text-gray-500 border-[#2b2b2b]' : 'text-gray-500 border-[#cccccc]'}`}>
                            Standard Input (stdin)
                        </div>
                        <textarea 
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Values for cin, scanf, input()..."
                            className={`flex-1 p-2 text-xs font-mono resize-none focus:outline-none ${theme === 'dark' ? 'bg-transparent text-gray-300 placeholder-gray-700' : 'bg-transparent text-gray-700 placeholder-gray-400'}`}
                        />
                    </div>

                    <div className={`flex-1 p-3 font-mono text-xs overflow-y-auto whitespace-pre-wrap min-h-0 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {executionLogs.map((log, index) => <p key={index} className={log.includes("error:") || log.includes("Exception") || log.includes("[CRITICAL ERROR]") ? "text-red-500 font-bold" : log.includes("[EXECUTION OUTPUT]") ? "text-green-500 font-bold" : ""}>{log}</p>)}
                        <div ref={executionEndRef} />
                    </div>
                </div>
              </Panel>

            </PanelGroup>
          </Panel>

          <PanelResizeHandle className={`w-[1px] cursor-col-resize transition-colors ${theme === 'dark' ? 'bg-[#2b2b2b] hover:bg-[#007acc]' : 'bg-[#cccccc] hover:bg-[#007acc]'}`} />

          <Panel defaultSize={30} minSize={25} className={`flex flex-col h-full overflow-hidden ${theme === 'dark' ? 'bg-[#252526]' : 'bg-[#f3f3f3]'}`}>
            
            <div className={`flex items-center shrink-0 overflow-x-auto h-9 ${theme === 'dark' ? 'bg-[#2d2d2d]' : 'bg-[#ececec]'}`}>
                <button onClick={() => setActivePanelTab('problem')} className={`px-4 h-full flex items-center text-[10px] uppercase tracking-wider relative transition-colors whitespace-nowrap ${activePanelTab === 'problem' ? (theme === 'dark' ? 'text-white bg-[#252526] border-t-2 border-[#007acc]' : 'text-[#333333] bg-[#f3f3f3] border-t-2 border-[#007acc]') : 'text-[#858585] hover:text-[#cccccc]'}`}>PROBLEM</button>
                <button onClick={() => setActivePanelTab('copilot')} className={`flex-1 h-full flex items-center justify-center text-[10px] uppercase tracking-wider relative transition-colors whitespace-nowrap ${activePanelTab === 'copilot' ? (theme === 'dark' ? 'text-white bg-[#252526] border-t-2 border-[#007acc]' : 'text-[#333333] bg-[#f3f3f3] border-t-2 border-[#007acc]') : 'text-[#858585] hover:text-[#cccccc]'}`}>COPILOT</button>
                <button onClick={() => setActivePanelTab('chat')} className={`flex-1 h-full flex items-center justify-center text-[10px] uppercase tracking-wider relative transition-colors whitespace-nowrap ${activePanelTab === 'chat' ? (theme === 'dark' ? 'text-white bg-[#252526] border-t-2 border-[#007acc]' : 'text-[#333333] bg-[#f3f3f3] border-t-2 border-[#007acc]') : 'text-[#858585] hover:text-[#cccccc]'}`}>CHAT</button>
                <button onClick={() => setActivePanelTab('audit')} className={`flex-1 h-full flex items-center justify-center text-[10px] uppercase tracking-wider relative transition-colors whitespace-nowrap ${activePanelTab === 'audit' ? (theme === 'dark' ? 'text-white bg-[#252526] border-t-2 border-[#007acc]' : 'text-[#333333] bg-[#f3f3f3] border-t-2 border-[#007acc]') : 'text-[#858585] hover:text-[#cccccc]'}`}>AUDIT</button>
            </div>

            {activePanelTab === 'problem' && (
                <div className={`p-4 flex flex-col h-full overflow-y-auto text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                    {selectedProblem ? (
                        <>
                            <h2 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{selectedProblem.title}</h2>
                            <div className="flex gap-2 mb-4">
                                <span className={`text-[10px] px-2 py-1 rounded border font-bold ${selectedProblem.badgeColor}`}>{selectedProblem.difficulty}</span>
                                <span className={`text-[10px] px-2 py-1 rounded border font-bold ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>Acceptance: {selectedProblem.acceptance}</span>
                            </div>
                            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedProblem.htmlContent) }} />
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <span className="text-4xl mb-2">🏟️</span>
                            <p className="text-gray-500 font-medium">Coding Arena Mode Active</p>
                            <p className="text-xs text-gray-400 mt-2">Select a problem from the left sidebar to view details.</p>
                        </div>
                    )}
                </div>
            )}

            {activePanelTab === 'copilot' && (
                <div className="p-4 flex flex-col h-full overflow-hidden">
                    <div className={`flex-1 rounded-lg border p-3 font-mono text-xs overflow-y-auto whitespace-pre-wrap min-h-0 flex flex-col gap-1.5 ${theme === 'dark' ? 'bg-[#0f172a] border-gray-800 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        {copilotLogs.map((log, i) => {
                            let colorClass = "";
                            if (log.includes("[CRITICAL ERROR]")) colorClass = "text-red-500";
                            else if (log.includes("[User]")) colorClass = theme === "dark" ? "text-gray-100 font-bold" : "text-gray-900 font-bold";
                            else if (log.includes("[AI]")) colorClass = theme === "dark" ? "text-blue-400 font-medium" : "text-blue-600 font-medium";
                            return <p key={i} className={colorClass}>{log}</p>
                        })}
                        <div ref={copilotEndRef} />
                    </div>
                    <form onSubmit={handleSendCopilotChat} className="mt-3 flex gap-2 shrink-0">
                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Consult AI Copilot..." className={`flex-1 border text-xs px-3 py-2 rounded focus:outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-gray-950 border-gray-700 text-white' : 'bg-white'}`} disabled={isChatting} />
                        <button type="submit" disabled={isChatting} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold transition-colors">Submit</button>
                    </form>
                    <button onClick={handleTriggerAudit} disabled={isAuditing} className={`mt-2 w-full py-2 rounded-lg text-xs font-bold transition-colors border shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'}`}>Trigger Deep-Code Audit</button>
                </div>
            )}

            {activePanelTab === 'chat' && (
                <div className="p-4 flex flex-col h-full overflow-hidden">
                    <div className={`flex-1 overflow-y-auto flex flex-col gap-3 min-h-0 pr-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                        {teamChats.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-gray-500">No communication logs detected.</div>
                        ) : (
                            teamChats.map((chat, i) => {
                                const isMe = chat.senderEmail === (currentUser?.name || currentUser?.email?.split('@')[0]) || chat.senderEmail === currentUser?.email;
                                return (
                                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] font-mono text-gray-500 mb-0.5">
                                        {chat.senderEmail.includes('@') ? chat.senderEmail.split('@')[0] : chat.senderEmail}
                                    </span>
                                    <div className={`px-3 py-2 rounded-lg text-xs max-w-[90%] break-words shadow-sm ${isMe ? 'bg-green-600 text-white rounded-br-none' : (theme === 'dark' ? 'bg-gray-800 border border-gray-700 rounded-bl-none' : 'bg-white border border-gray-200 rounded-bl-none')}`}>
                                        {chat.message}
                                    </div>
                                </div>
                                );
                            })
                        )}
                        <div ref={teamChatEndRef} />
                    </div>
                    <form onSubmit={handleSendTeamMessage} className="mt-3 flex gap-2 shrink-0">
                        <input type="text" value={teamChatInput} onChange={(e) => setTeamChatInput(e.target.value)} placeholder="Transmit message..." className={`flex-1 border text-xs px-3 py-2 rounded-full focus:outline-none focus:border-green-500 ${theme === 'dark' ? 'bg-gray-950 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} />
                        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white w-9 h-9 rounded-full flex justify-center items-center shadow-sm">➤</button>
                    </form>
                </div>
            )}

            {activePanelTab === 'audit' && (
                <div className="p-4 flex flex-col h-full overflow-hidden bg-gradient-to-b from-transparent to-amber-900/10">
                    <div className="mb-3 flex justify-between items-center shrink-0">
                        <h4 className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-amber-500' : 'text-amber-700'}`}>System Telemetry</h4>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full font-mono">Live Sync</span>
                    </div>
                    
                    <div className={`flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0 relative`}>
                        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-amber-500/20 z-0"></div>

                        {activityLogs.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-amber-500/50 z-10">Awaiting system events...</div>
                        ) : (
                            activityLogs.map((log, i) => (
                                <div key={i} className={`relative z-10 pl-6 py-1 border-b border-dashed ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
                                    <div className="absolute left-[5px] top-[10px] w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-[#0f172a]"></div>
                                    <div className="flex items-baseline justify-between mb-0.5 gap-2">
                                        <span className={`text-[10px] font-bold truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
                                            {log.userEmail.includes('@') ? log.userEmail.split('@')[0] : log.userEmail}
                                        </span>
                                        <span className="text-[9px] font-mono text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className={`text-[11px] leading-tight ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{log.action}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
      
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`p-6 rounded-xl border shadow-2xl w-[450px] ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}>
                <h2 className="text-lg font-bold mb-2">Workspace Access & Members</h2>
                <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Authorize a new developer or manage existing environment access. <b>(Note: User must have an account on DevSync first)</b></p>
                <form onSubmit={handleInviteCollaborator} className="flex flex-col gap-3 mb-6">
                    <div className="flex gap-2">
                        <input type="email" required placeholder="registered-dev@devsync.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={`flex-1 text-sm px-3 py-2 border rounded focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-950 border-gray-700 text-white' : 'bg-gray-50'}`} />
                        <button type="submit" className="px-4 py-2 text-sm font-bold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors">Invite</button>
                    </div>
                </form>

                {workspaceData?.members && workspaceData.members.length > 0 && (
                    <div className="mb-4">
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Current Members</h3>
                        <div className={`max-h-40 overflow-y-auto border rounded divide-y ${theme === 'dark' ? 'border-gray-800 divide-gray-800' : 'border-gray-200 divide-gray-200'}`}>
                            {workspaceData.members.map(m => (
                                <div key={m.id} className={`flex items-center justify-between p-2 text-sm ${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
                                    <div className="flex flex-col truncate pr-2">
                                        <span className="font-bold truncate">{m.user?.name || m.user?.email || "Unknown"}</span>
                                        <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{m.role}</span>
                                    </div>
                                    { m.role !== 'OWNER' && (
                                        (workspaceData.ownerId === (currentUser?.id || currentUser?._id || user?.id || user?.userId)) ? (
                                            <button onClick={() => handleRemoveMember(m.userId)} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors">Remove</button>
                                        ) : (m.userId === (currentUser?.id || currentUser?._id || user?.id || user?.userId)) ? (
                                            <button onClick={() => handleRemoveMember(m.userId)} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors">Leave</button>
                                        ) : null
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-800">
                    <button type="button" onClick={() => setShowInviteModal(false)} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300'}`}>Close</button>
                </div>
            </div>
        </div>
      )}

      {/* Video Call Floating Panel */}
      {showVideoCall && socketInstance && (
        <VideoCall
          socket={socketInstance}
          roomId={id}
          userEmail={currentUser?.email || user?.email || 'anonymous'}
          onClose={() => setShowVideoCall(false)}
        />
      )}
    </div>
  );
};

export default Workspace;