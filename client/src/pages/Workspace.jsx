import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { io } from 'socket.io-client';

const Workspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { token, user } = useSelector((state) => state.auth);
  const [currentUser, setCurrentUser] = useState(user);

  const [workspaceData, setWorkspaceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save State");
  
  const [theme, setTheme] = useState("dark");
  const [showInviteModal, setShowInviteModal] = useState(false);
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

  useEffect(() => { copilotEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [copilotLogs]);
  useEffect(() => { executionEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [executionLogs]);
  useEffect(() => { teamChatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [teamChats]);

  const recordActivity = (actionDescription) => {
      const effectiveUser = currentUser || user;
      const displayName = effectiveUser?.name || effectiveUser?.email?.split('@')[0] || "Anonymous Developer";
      const payload = { roomId: id, userEmail: displayName, action: actionDescription, timestamp: new Date() };
      
      if (socketRef.current) socketRef.current.emit('log-activity', payload);
      setActivityLogs(prev => [payload, ...prev]); 
  };

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
                alert("⏳ Interview time is strictly up! Code execution has been halted.");
            } else {
                setRemainingTime(Math.floor(distance / 1000));
            }
        }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [isInterviewMode, interviewEndTime]);

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
        if (res.data.description && res.data.description.startsWith("[")) {
          setFiles(JSON.parse(res.data.description));
          setActiveFileName(JSON.parse(res.data.description)[0]?.name || "index.js");
        }
      } catch (err) { navigate("/dashboard"); } finally { setIsLoading(false); }
    };

    const fetchHistoricalData = async () => {
        try {
            const chatRes = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/chats", { headers: { "auth-token": token } });
            setTeamChats(chatRes.data);
            const logRes = await axios.get(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/logs", { headers: { "auth-token": token } });
            setActivityLogs(logRes.data);
        } catch (err) {}
    };

    if (token) { 
        fetchUserProfile(); 
        fetchWorkspaceDetails(); 
        fetchHistoricalData(); 
    }

    socketRef.current = io(import.meta.env.VITE_BACKEND_URL + "");

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', id);
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

    return () => { socketRef.current.disconnect(); };
  }, [id, token, navigate, user]);

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

    const newContent = updatedLanguageContents[newLang] || getLanguageTemplate(newLang);

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
    if (files.some(f => f.name.toLowerCase() === newFileNameInput.toLowerCase())) return alert("File conflicts with existing architecture.");
    
    const newFiles = [...files, { name: newFileNameInput, language: newFileLanguage, content: getLanguageTemplate(newFileLanguage) }];
    setFiles(newFiles);
    setActiveFileName(newFileNameInput);
    
    if (socketRef.current) socketRef.current.emit('file-structure-change', { roomId: id, files: newFiles, activeFileName: newFileNameInput });
    recordActivity(`Provisioned nwe source file: ${newFileNameInput}`);
    setNewFileNameInput("");
  };

  const handleDeleteFile = (fileNameToDelete, e) => {
    e.stopPropagation(); 
    if (files.length <= 1) return alert("System requires at least one active buffer.");
    
    const updatedFiles = files.filter(f => f.name !== fileNameToDelete);
    const nextActive = activeFileName === fileNameToDelete ? updatedFiles[0].name : activeFileName;
    
    setFiles(updatedFiles);
    setActiveFileName(nextActive);
    
    if (socketRef.current) socketRef.current.emit('file-structure-change', { roomId: id, files: updatedFiles, activeFileName: nextActive });
    recordActivity(`Destroyed source file: ${fileNameToDelete}`);
  };

  const handlePersistConfiguration = async () => {
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
        setTimeout(() => setSaveStatus("Save State"), 2500);
    } 
    catch (err) { 
        setSaveStatus("Error!");
        setTimeout(() => setSaveStatus("Save State"), 2500);
    } 
    finally { setIsSynchronizing(false); }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault(); 
            handlePersistConfiguration();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); 

  const handleRunCode = async () => {
    if (!activeFile.content.trim()) return;
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
    if (!activeFile.content.trim()) return;
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
      const res = await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/chat", { promptMessage: query, history: chatHistory, codeBuffer: activeFile.content }, { headers: { "auth-token": token } });
      setCopilotLogs(prev => [...prev, `> [AI]: ${res.data.reply}`]);
    } catch (err) {} finally { setIsChatting(false); }
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
      const durationMinutes = 45; 
      socketRef.current.emit('start-interview', { roomId: id, durationMinutes });
      recordActivity("Provisioned a 45-minute synchronized interview session.");
  };

  const handleEndInterview = () => {
      if(window.confirm("Terminate the technical interview early?")) {
          socketRef.current.emit('end-interview', { roomId: id });
          recordActivity("Manually terminated the technical interview.");
      }
  };

  const handleInviteCollaborator = async (e) => {
    e.preventDefault();
    if(!inviteEmail.trim()) return;
    try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + "/api/projects/" + id + "/invite", { targetEmail: inviteEmail }, { headers: { "auth-token": token } });
        setShowInviteModal(false); setInviteEmail("");
        recordActivity(`Dispatched workspace invitation to ${inviteEmail}`);
        alert("✅ Invitation processed securely! Tell your friend to log in.");
    } catch (err) { 
        alert("❌ Error: Authorization failed. Make sure the user has created an account on DevSync first!"); 
    }
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
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      <header className={`px-6 py-3 flex justify-between items-center shadow-md border-b shrink-0 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono px-3 py-1 rounded-full border flex items-center gap-2 ${isInterviewMode ? 'bg-red-900/50 text-red-400 border-red-800' : (theme === 'dark' ? 'bg-blue-900/50 text-blue-400 border-blue-800' : 'bg-blue-100 text-blue-700 border-blue-200')}`}>
              {isInterviewMode && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
              {isInterviewMode ? `LIVE INTERVIEW: ${formatTime(remainingTime)}` : "Active Chamber"}
            </span>
            <span className={`font-mono text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>UID: {id.split('-')[0]}...</span>
          </div>
          <h1 className="text-xl font-bold mt-1 tracking-tight">{workspaceData ? workspaceData.title : "Unidentified Workspace"}</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInviteModal(true)} className={`px-4 py-2 rounded-lg font-medium text-sm border shadow-sm ${theme === 'dark' ? 'bg-purple-900/50 text-purple-300 border-purple-800' : 'bg-purple-100 text-purple-700 border-purple-300'}`}>👥 Invite</button>
          
          {!isInterviewMode ? (
              <button onClick={handleStartInterview} className={`px-4 py-2 rounded-lg font-bold text-sm border shadow-sm ${theme === 'dark' ? 'bg-red-900/50 text-red-300 border-red-800' : 'bg-red-100 text-red-700 border-red-300'}`}>🎤 Start 45m Interview</button>
          ) : (
              <button onClick={handleEndInterview} className={`px-4 py-2 rounded-lg font-bold text-sm border shadow-sm bg-gray-800 text-white border-gray-600 hover:bg-gray-700`}>⏹ End Interview</button>
          )}

          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={`p-2 rounded-full border shadow-sm w-9 h-9 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-yellow-400' : 'bg-gray-100 border-gray-300 text-gray-700'}`}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={handleRunCode} disabled={isRunning || (isInterviewMode && remainingTime === 0)} className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm ${(isRunning || (isInterviewMode && remainingTime === 0)) ? "bg-green-900 text-green-300 border-green-800 cursor-not-allowed" : "bg-green-600 text-white border-green-500 hover:bg-green-500"}`}>▶ Run Code</button>
          <button onClick={handlePersistConfiguration} disabled={isSynchronizing} className={`px-4 py-2 rounded-lg font-medium text-sm border shadow-sm transition-colors ${saveStatus.includes("Saved") ? "bg-green-600 border-green-500 text-white" : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"}`}>{saveStatus}</button>
          <button onClick={() => navigate("/dashboard")} className={`px-4 py-2 rounded-lg font-medium text-sm border shadow-sm ${theme === 'dark' ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-300'}`}>Dashboard</button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-2 relative bg-transparent">
        <PanelGroup direction="horizontal" className="w-full h-full flex">
          
          <Panel defaultSize={20} minSize={15} className={`rounded-xl border flex flex-col shadow-sm h-full ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-300'}`}>
            <div className="p-4 flex flex-col h-full overflow-hidden">
              <h3 className="text-xs font-bold font-mono text-gray-400 mb-4 tracking-widest uppercase">File Directory</h3>
              <form onSubmit={handleCreateFile} className="mb-4 flex flex-col gap-2 shrink-0">
                <input type="text" placeholder="filename.js" value={newFileNameInput} onChange={(e) => setNewFileNameInput(e.target.value)} className={`text-xs px-2 py-1.5 border rounded focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-950 border-gray-700' : 'bg-gray-50'}`} />
                <div className="flex gap-2">
                  <select value={newFileLanguage} onChange={(e) => setNewFileLanguage(e.target.value)} className={`text-[11px] font-medium border rounded px-1 py-1 flex-1 outline-none cursor-pointer ${theme === 'dark' ? 'bg-gray-950 border-gray-700' : 'bg-white'}`}>
                    {languageOptions}
                  </select>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1 rounded">+</button>
                </div>
              </form>
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
                {files.map((f) => (
                    <div key={f.name} onClick={() => setActiveFileName(f.name)} className={`group px-3 py-2 rounded-lg flex justify-between items-center cursor-pointer border transition-colors ${f.name === activeFileName ? 'bg-blue-900/30 border-blue-800 text-blue-400 font-medium' : 'border-transparent text-gray-400 hover:bg-gray-800'}`}>
                      <div className="flex items-center gap-2 overflow-hidden"><span className="text-xs font-mono truncate">{f.name}</span></div>
                      <button onClick={(e) => handleDeleteFile(f.name, e)} className="text-gray-500 hover:text-red-500 text-xs font-bold opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                ))}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 mx-1 cursor-col-resize hover:bg-blue-500/20 rounded transition-colors" />

          <Panel defaultSize={50} minSize={35} className="h-full">
            <PanelGroup direction="vertical" className="w-full h-full flex flex-col">
              <Panel defaultSize={70} minSize={30} className={`rounded-xl border flex flex-col shadow-inner overflow-hidden ${theme === 'dark' ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-300'}`}>
                
                <div className={`px-4 py-2 flex justify-between items-center border-b shrink-0 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                      <span className={`font-mono text-sm px-3 py-1 rounded border ${theme === 'dark' ? 'text-blue-400 bg-blue-900/30 border-blue-800' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>📄 {activeFile.name}</span>
                      
                      <select 
                          value={activeFile.language} 
                          onChange={handleActiveFileLanguageChange}
                          className={`text-xs font-medium border rounded px-2 py-1 outline-none cursor-pointer shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-700 focus:border-blue-500'}`}
                      >
                          {languageOptions}
                      </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                    <span className={`text-[10px] uppercase font-mono tracking-wider ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>Connection Secure</span>
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
              <PanelResizeHandle className="h-1.5 my-1 cursor-row-resize hover:bg-blue-500/20 rounded transition-colors" />
              
              <Panel defaultSize={30} minSize={15} className={`rounded-xl border flex flex-col shadow-inner overflow-hidden ${theme === 'dark' ? 'bg-[#0d1117] border-gray-700' : 'bg-gray-100'}`}>
                <div className={`px-4 py-1.5 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-200'}`}>
                  <span className="text-[11px] font-bold font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Execution Terminal
                  </span>
                </div>
                
                <div className="flex-1 flex overflow-hidden min-h-0">
                    <div className={`w-[30%] flex flex-col border-r ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        <div className={`px-3 py-1 text-[9px] font-bold tracking-widest uppercase border-b text-center ${theme === 'dark' ? 'text-gray-500 border-gray-800 bg-gray-900/50' : 'text-gray-500 border-gray-200 bg-gray-200/50'}`}>
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

          <PanelResizeHandle className="w-1.5 mx-1 cursor-col-resize hover:bg-blue-500/20 rounded transition-colors" />

          <Panel defaultSize={30} minSize={25} className={`rounded-xl border flex flex-col shadow-sm h-full overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
            
            <div className={`flex items-center border-b shrink-0 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
                <button onClick={() => setActivePanelTab('copilot')} className={`flex-1 py-3 text-[11px] uppercase tracking-wider font-bold relative transition-colors ${activePanelTab === 'copilot' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Copilot {activePanelTab === 'copilot' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>}</button>
                <button onClick={() => setActivePanelTab('chat')} className={`flex-1 py-3 text-[11px] uppercase tracking-wider font-bold relative transition-colors ${activePanelTab === 'chat' ? 'text-green-500' : 'text-gray-500 hover:text-gray-300'}`}>Team Chat {activePanelTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"></div>}</button>
                <button onClick={() => setActivePanelTab('audit')} className={`flex-1 py-3 text-[11px] uppercase tracking-wider font-bold relative transition-colors ${activePanelTab === 'audit' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}>Audit Trail {activePanelTab === 'audit' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500"></div>}</button>
            </div>

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
            <div className={`p-6 rounded-xl border shadow-2xl w-96 ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300'}`}>
                <h2 className="text-lg font-bold mb-2">Provision Access</h2>
                <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Authorize a new developer identity to access this secure environment. <b>(Note: User must have an account on DevSync first)</b></p>
                <form onSubmit={handleInviteCollaborator} className="flex flex-col gap-3">
                    <input type="email" required placeholder="registered-dev@devsync.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={`text-sm px-3 py-2 border rounded focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-950 border-gray-700 text-white' : 'bg-gray-50'}`} />
                    <div className="flex justify-end gap-2 mt-2">
                        <button type="button" onClick={() => setShowInviteModal(false)} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300'}`}>Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors">Dispatch Invite</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;