import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './VideoCall.css';

const FALLBACK_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const VideoCall = ({ socket, roomId, userEmail, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState({}); // { socketId: { email, stream, peerConnection } }
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState('');

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection
  const iceCandidateQueue = useRef({}); // socketId -> RTCIceCandidate[]
  const panelRef = useRef(null);
  const iceConfigRef = useRef(FALLBACK_ICE);

  // Fetch TURN credentials securely from backend
  const fetchTurnCredentials = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return FALLBACK_ICE;
    try {
      const res = await axios.get(import.meta.env.VITE_BACKEND_URL + '/api/turn-credentials', { headers: { 'auth-token': token }, timeout: 10000 });
      return res.data;
    } catch {
      return FALLBACK_ICE;
    }
  };

  // Drag state
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 350 });
  const [size, setSize] = useState({ w: 360, h: 300 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isResizing = useRef(false);
  const resizeDir = useRef(null);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });

  // Start local media
  const startLocalStream = useCallback(async (isMounted) => {
    try {
      // 1. Fetch TURN credentials BEFORE starting the connection
      iceConfigRef.current = await fetchTurnCredentials();
      if (!isMounted.current) return null;

      // 2. Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      
      if (!isMounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallActive(true);
      setError('');

      // 3. Notify others you joined the call (using correct TURN servers)
      socket.emit('join-call', { roomId });

      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera/Mic permission denied. Please allow access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera or microphone found on this device.');
      } else {
        setError('Failed to access camera/mic. Please try again.');
      }
      console.error('getUserMedia error:', err);
      return null;
    }
  }, [socket, roomId]);

  // Create peer connection for a remote user
  const createPeerConnection = useCallback((targetSocketId, targetEmail, isInitiator) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      peerConnectionsRef.current[targetSocketId].close();
    }

    const pc = new RTCPeerConnection(iceConfigRef.current);
    peerConnectionsRef.current[targetSocketId] = pc;

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => ({
        ...prev,
        [targetSocketId]: { ...prev[targetSocketId], email: targetEmail, stream: remoteStream },
      }));
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(targetSocketId);
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc-offer', {
            targetSocketId,
            offer: pc.localDescription,
          });
        })
        .catch((err) => console.error('Offer creation error:', err));
    }

    return pc;
  }, [socket]);

  const removePeer = useCallback((socketId) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close();
      delete peerConnectionsRef.current[socketId];
    }
    if (iceCandidateQueue.current[socketId]) {
      delete iceCandidateQueue.current[socketId];
    }
    setPeers((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  }, []);

  const flushIceCandidates = async (socketId, pc) => {
    if (iceCandidateQueue.current[socketId]) {
      for (const candidate of iceCandidateQueue.current[socketId]) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Queued ICE candidate error:', err);
        }
      }
      iceCandidateQueue.current[socketId] = [];
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Someone joined the call — create offer to them
    const handleCallUserJoined = ({ socketId, email }) => {
      createPeerConnection(socketId, email, true);
      setPeers((prev) => ({
        ...prev,
        [socketId]: { email, stream: null },
      }));
    };

    // Received an offer — create answer
    const handleOffer = async ({ senderSocketId, offer, senderEmail }) => {
      const pc = createPeerConnection(senderSocketId, senderEmail, false);
      setPeers((prev) => ({
        ...prev,
        [senderSocketId]: { email: senderEmail, stream: null },
      }));
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceCandidates(senderSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetSocketId: senderSocketId,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error('Answer creation error:', err);
      }
    };

    // Received an answer
    const handleAnswer = async ({ senderSocketId, answer }) => {
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIceCandidates(senderSocketId, pc);
        } catch (err) {
          console.error('Set remote description error:', err);
        }
      }
    };

    // Received ICE candidate
    const handleIceCandidate = async ({ senderSocketId, candidate }) => {
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('ICE candidate error:', err);
          }
        } else {
          if (!iceCandidateQueue.current[senderSocketId]) {
            iceCandidateQueue.current[senderSocketId] = [];
          }
          iceCandidateQueue.current[senderSocketId].push(candidate);
        }
      }
    };

    // Someone left the call
    const handleCallUserLeft = ({ socketId }) => {
      removePeer(socketId);
    };

    socket.on('call-user-joined', handleCallUserJoined);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('call-user-left', handleCallUserLeft);

    return () => {
      socket.off('call-user-joined', handleCallUserJoined);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('call-user-left', handleCallUserLeft);
    };
  }, [socket, createPeerConnection, removePeer]);

  // Initialize call on mount
  useEffect(() => {
    const isMounted = { current: true };
    startLocalStream(isMounted);

    return () => {
      isMounted.current = false;
      // Cleanup on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      iceCandidateQueue.current = {};
      if (socket) socket.emit('leave-call', { roomId });
    };
  }, [socket, roomId, startLocalStream]);

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Restore video stream when camera comes back on
  useEffect(() => {
    if (localVideoRef.current) {
      if (isScreenSharing && screenStreamRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
      } else if (localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [isCameraOff, isScreenSharing]);

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack);
      });
    }
    setIsScreenSharing(false);
  };

  // Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // When user stops sharing from browser UI
        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  };

  // End Call
  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    if (socket) socket.emit('leave-call', { roomId });
    onClose();
  };

  const handleMouseMove = useCallback((e) => {
    if (isResizing.current) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const dir = resizeDir.current;
      let newW = resizeStart.current.w;
      let newH = resizeStart.current.h;
      let newX = resizeStart.current.px;
      let newY = resizeStart.current.py;
      if (dir.includes('r')) newW = Math.max(280, resizeStart.current.w + dx);
      if (dir.includes('b')) newH = Math.max(200, resizeStart.current.h + dy);
      if (dir.includes('l')) { newW = Math.max(280, resizeStart.current.w - dx); newX = resizeStart.current.px + (resizeStart.current.w - newW); }
      if (dir.includes('t')) { newH = Math.max(200, resizeStart.current.h - dy); newY = resizeStart.current.py + (resizeStart.current.h - newH); }
      setSize({ w: newW, h: newH });
      setPosition({ x: newX, y: newY });
      return;
    }
    if (!isDragging.current) return;
    const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
    resizeDir.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startResize = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeDir.current = dir;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, px: position.x, py: position.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Cleanup drag/resize listeners if component unmounts mid-drag
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const peerCount = Object.keys(peers).length;
  const gridClass = peerCount === 0 ? 'grid-1' : peerCount === 1 ? 'grid-2' : peerCount <= 3 ? 'grid-3' : 'grid-4';
  const userInitial = (userEmail || 'U').charAt(0).toUpperCase();

  // Minimized state
  if (isMinimized) {
    return (
      <div className="vc-minimized" onClick={() => setIsMinimized(false)} title="Expand Video Call">
        📹
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`vc-panel ${isFullscreen ? 'vc-fullscreen' : ''}`}
      style={isFullscreen ? {} : {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
      }}
    >
      {/* Resize Handles */}
      {!isFullscreen && (
        <>
          <div className="vc-resize-handle vc-resize-t" onMouseDown={startResize('t')} />
          <div className="vc-resize-handle vc-resize-b" onMouseDown={startResize('b')} />
          <div className="vc-resize-handle vc-resize-l" onMouseDown={startResize('l')} />
          <div className="vc-resize-handle vc-resize-r" onMouseDown={startResize('r')} />
          <div className="vc-resize-handle vc-resize-tl" onMouseDown={startResize('tl')} />
          <div className="vc-resize-handle vc-resize-tr" onMouseDown={startResize('tr')} />
          <div className="vc-resize-handle vc-resize-bl" onMouseDown={startResize('bl')} />
          <div className="vc-resize-handle vc-resize-br" onMouseDown={startResize('br')} />
        </>
      )}
      {/* Header (Drag Handle) */}
      <div className="vc-header" onMouseDown={handleMouseDown}>
        <div className="vc-header-left">
          <span className="vc-header-title">📹 Video Call</span>
          <span className="vc-header-badge">{peerCount + 1} in call</span>
        </div>
        <div className="vc-header-actions">
          <button className="vc-header-btn" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? '⛶' : '⛶'}
          </button>
          <button className="vc-header-btn" onClick={() => { setIsMinimized(true); setIsFullscreen(false); }} title="Minimize">
            ─
          </button>
          <button className="vc-header-btn close" onClick={endCall} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid #334155' }}>
          <p style={{ color: '#ef4444', fontSize: '11px', margin: 0 }}>❌ {error}</p>
        </div>
      )}

      {/* Video Grid */}
      <div className={`vc-video-grid ${isScreenSharing ? 'grid-screen-share' : gridClass}`}>
        {/* Self Video */}
        <div className={`vc-video-tile ${isScreenSharing ? 'vc-screen-share-main' : ''}`}>
          {!isCameraOff || isScreenSharing ? (
            <video ref={localVideoRef} autoPlay muted playsInline />
          ) : (
            <div className="vc-avatar">
              <div className="vc-avatar-letter">{userInitial}</div>
            </div>
          )}
          <span className="vc-video-label">{isScreenSharing ? 'Your Screen' : 'You'}</span>
          {isMuted && <span className="vc-video-muted-icon">🔇</span>}
        </div>

        {/* Remote Peers */}
        {Object.entries(peers).map(([socketId, peer]) => (
          <div key={socketId} className={`vc-video-tile ${isScreenSharing ? 'vc-screen-share-mini' : ''}`}>
            {peer.stream ? (
              <VideoTile stream={peer.stream} />
            ) : (
              <div className="vc-avatar">
                <div className="vc-avatar-letter">
                  {(peer.email || '?').charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <span className="vc-video-label">
              {peer.email ? peer.email.split('@')[0] : 'Connecting...'}
            </span>
          </div>
        ))}

        {/* Waiting state when alone */}
        {peerCount === 0 && callActive && !error && (
          <div className="vc-waiting">
            <div className="vc-waiting-dots">
              <span></span><span></span><span></span>
            </div>
            <p className="vc-waiting-text">Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="vc-controls">
        <div className="vc-ctrl-wrapper">
          <button className={`vc-ctrl-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🎤'}
          </button>
          <span className="vc-ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>
        <div className="vc-ctrl-wrapper">
          <button className={`vc-ctrl-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
            {isCameraOff ? '📷' : '📹'}
          </button>
          <span className="vc-ctrl-label">{isCameraOff ? 'Camera On' : 'Camera'}</span>
        </div>
        <div className="vc-ctrl-wrapper">
          <button className={`vc-ctrl-btn screen-share ${isScreenSharing ? 'sharing' : ''}`} onClick={toggleScreenShare} title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}>
            🖥️
          </button>
          <span className="vc-ctrl-label">{isScreenSharing ? 'Stop Share' : 'Screen Share'}</span>
        </div>
        <div className="vc-ctrl-wrapper">
          <button className="vc-ctrl-btn end-call" onClick={endCall} title="End Call">
            📞
          </button>
          <span className="vc-ctrl-label">End</span>
        </div>
      </div>
    </div>
  );
};

// Helper component for remote video streams
const VideoTile = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline />;
};

export default VideoCall;
