import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { DirectDashboard } from './components/DirectDashboard';
import { DeviceSetupChamber } from './components/DeviceSetupChamber';
import { CallingScreen } from './components/CallingScreen';
import { InCallView } from './components/InCallView';
import { InCallChat } from './components/InCallChat';
import { CallStatsModal } from './components/CallStatsModal';
import { CallEndedSummary } from './components/CallEndedSummary';
import { CallHistory } from './components/CallHistory';
import { QRCodeModal } from './components/QRCodeModal';
import { CallState, CallStats, ChatMessage, PeerInfo, CallLog } from './types/calling';
import { WebRTCService } from './services/webrtcService';
import { AudioBridge } from './utils/audioBridge';
import { soundEffects } from './utils/soundEffects';
import { AlertCircle, ShieldCheck, Activity, Mic, Video, Radio } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; displayName: string } | null>(() => {
    try {
      const saved = localStorage.getItem('duocall_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [partnerUser, setPartnerUser] = useState<{
    id: string;
    email: string;
    displayName: string;
    isOnline: boolean;
    status: string;
  } | null>(null);

  const [currentTab, setCurrentTab] = useState<'line' | 'chamber' | 'history'>('line');
  const [callState, setCallState] = useState<CallState>('idle');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // System Diagnostics Check
  const [micStatus, setMicStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [camStatus, setCamStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  // Connection Log Steps
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);

  // In-Call Media States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  // Chat & Stats & Recording
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Error Banner
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Call History
  const [callHistory, setCallHistory] = useState<CallLog[]>(() => {
    try {
      const saved = localStorage.getItem('duocall_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [lastCallLog, setLastCallLog] = useState<CallLog | null>(null);
  const callStartTimeRef = useRef<number>(0);

  // Signaling & Audio Bridge References
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const audioBridgeRef = useRef<AudioBridge | null>(null);

  const logStep = (msg: string) => {
    setConnectionLogs((prev) => [
      ...prev.slice(-4),
      `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}: ${msg}`,
    ]);
  };

  // Run initial diagnostic check for mic, camera, and server
  useEffect(() => {
    const checkServer = () => {
      fetch('/api/status')
        .then((res) => {
          if (res.ok) setServerStatus('online');
        })
        .catch(() => {
          // If fetch fails, we still assume online if user is interacting or WS is open
        });
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((s) => {
          setMicStatus('ok');
          setCamStatus('ok');
          setLocalStream(s);
        })
        .catch((e) => {
          if (e.name === 'NotAllowedError') {
            setMicStatus('denied');
            setCamStatus('denied');
          } else {
            navigator.mediaDevices
              .getUserMedia({ audio: true })
              .then((s) => {
                setMicStatus('ok');
                setLocalStream(s);
              })
              .catch(() => setMicStatus('denied'));
          }
        });
    }

    return () => clearInterval(interval);
  }, []);

  // Save history & user
  useEffect(() => {
    try {
      localStorage.setItem('duocall_history', JSON.stringify(callHistory));
    } catch (e) {}
  }, [callHistory]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('duocall_user', JSON.stringify(currentUser));
      connectUserSignaling(currentUser.id);
    } else {
      localStorage.removeItem('duocall_user');
    }
  }, [currentUser]);

  // Fallback Audio Bridge
  useEffect(() => {
    audioBridgeRef.current = new AudioBridge((base64Chunk) => {
      sendSignaling({
        type: 'media-chunk',
        chunk: base64Chunk,
      });
    });
  }, []);

  // Connect Signaling for Logged In User
  const connectUserSignaling = (userId: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setServerStatus('online');
        ws.send(JSON.stringify({ type: 'auth-connect', userId }));
      };

      ws.onmessage = (event) => {
        try {
          setServerStatus('online');
          const msg = JSON.parse(event.data);
          handleSignalingMessage(msg);
        } catch (e) {}
      };

      wsRef.current = ws;
    } else if (wsRef.current.readyState === WebSocket.OPEN) {
      setServerStatus('online');
      wsRef.current.send(JSON.stringify({ type: 'auth-connect', userId }));
    }

    // HTTP Polling Fallback
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      if (!currentUser) return;
      try {
        const res = await fetch(`/api/signaling/poll?userId=${currentUser.id}`);
        if (res.ok) setServerStatus('online');
        const data = await res.json();
        if (data.signals && data.signals.length > 0) {
          data.signals.forEach((sig: any) => handleSignalingMessage(sig));
        }
      } catch (e) {}
    }, 1000);
  };

  const sendSignaling = (signal: any) => {
    if (!currentUser) return;
    const targetUserId = currentUser.id === 'user1' ? 'user2' : 'user1';

    const payload = {
      ...signal,
      senderId: currentUser.id,
      targetUserId,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }

    fetch('/api/signaling/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, signal: payload }),
    }).catch((e) => {});
  };

  // Signal Message Handler
  const handleSignalingMessage = async (msg: any) => {
    switch (msg.type) {
      case 'presence-update': {
        if (msg.users && currentUser) {
          const p = msg.users.find((u: any) => u.id !== currentUser.id);
          if (p) {
            setPartnerUser(p);
          }
        }
        break;
      }

      case 'incoming-call': {
        logStep(`Incoming call from ${msg.caller?.displayName || 'Partner'}`);
        setCallState('incoming');
        break;
      }

      case 'call-accepted': {
        logStep('Partner accepted call! Connecting media...');
        soundEffects.stopRinging();
        if (webrtcRef.current) {
          try {
            const offer = await webrtcRef.current.createOffer();
            sendSignaling({ type: 'offer', offer });
          } catch (e) {}
        }
        break;
      }

      case 'call-declined': {
        soundEffects.stopRinging();
        soundEffects.playCallEnded();
        setCallState('idle');
        setErrorMessage('Partner declined the call.');
        setTimeout(() => setErrorMessage(null), 4000);
        break;
      }

      case 'call-ended': {
        handleEndCall();
        break;
      }

      case 'offer': {
        logStep('Received Stream Offer...');
        const service = initWebRTCService();

        if (localStream) {
          service.setLocalStream(localStream);
        }

        const answer = await service.handleOffer(msg.offer);
        sendSignaling({ type: 'answer', answer });

        if (callState !== 'connected') {
          setCallState('connected');
          callStartTimeRef.current = Date.now();
          soundEffects.playCallConnected();
        }
        break;
      }

      case 'answer': {
        logStep('Call Connected!');
        if (webrtcRef.current) {
          await webrtcRef.current.handleAnswer(msg.answer);
          if (callState !== 'connected') {
            setCallState('connected');
            callStartTimeRef.current = Date.now();
            soundEffects.playCallConnected();
          }
        }
        break;
      }

      case 'ice-candidate': {
        if (webrtcRef.current) {
          await webrtcRef.current.handleIceCandidate(msg.candidate);
        }
        break;
      }

      case 'media-state': {
        break;
      }

      case 'chat-message': {
        addChatMessage(msg.message);
        break;
      }

      case 'media-chunk': {
        if (msg.chunk && audioBridgeRef.current) {
          audioBridgeRef.current.playIncomingAudioChunk(msg.chunk);
        }
        break;
      }

      default:
        break;
    }
  };

  const initWebRTCService = (): WebRTCService => {
    if (webrtcRef.current) return webrtcRef.current;

    const instance = new WebRTCService({
      onRemoteStream: (stream) => {
        logStep('HD Stream active!');
        setRemoteStream(stream);
      },
      onRemoteStreamEnded: () => {
        setRemoteStream(null);
      },
      onChatMessage: (msg) => {
        addChatMessage(msg);
      },
      onPeerMediaStateChange: () => {},
      onStatsUpdate: (newStats) => {
        setStats(newStats);
      },
      onSignalToSend: (signal) => {
        sendSignaling(signal);
      },
      onConnectionStateChange: (state) => {
        logStep(`Status: ${state}`);
        if (state === 'connected') {
          setCallState('connected');
          callStartTimeRef.current = Date.now();
        }
      },
    });

    webrtcRef.current = instance;
    return instance;
  };

  const addChatMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });

    if (!isChatOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  // Direct Call Action: "CALL PARTNER NOW"
  const handleInitiateCall = async (callType: 'video' | 'audio') => {
    if (!currentUser) return;
    const targetUserId = currentUser.id === 'user1' ? 'user2' : 'user1';

    setIsVideoOff(callType === 'audio');
    setConnectionLogs([]);
    logStep('Initializing camera & microphone...');

    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });
        setLocalStream(stream);
        setMicStatus('ok');
        setCamStatus('ok');
      } catch (err: any) {
        setErrorMessage('Camera or Microphone access required for calling.');
        return;
      }
    }

    const service = initWebRTCService();
    service.setLocalStream(stream);

    if (audioBridgeRef.current && stream) {
      audioBridgeRef.current.startCapture(stream);
    }

    setCallState('dialing');

    // Notify Server & Target
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'direct-call-init',
          callerId: currentUser.id,
          targetUserId,
        })
      );
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!currentUser) return;
    soundEffects.stopRinging();

    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        setErrorMessage('Microphone and Camera permission required.');
        return;
      }
    }

    const service = initWebRTCService();
    service.setLocalStream(stream);

    if (audioBridgeRef.current && stream) {
      audioBridgeRef.current.startCapture(stream);
    }

    const targetUserId = currentUser.id === 'user1' ? 'user2' : 'user1';
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'direct-call-accept',
          callerId: targetUserId,
          responderId: currentUser.id,
        })
      );
    }

    setCallState('connected');
    callStartTimeRef.current = Date.now();
    soundEffects.playCallConnected();
  };

  const handleDeclineIncomingCall = () => {
    if (!currentUser) return;
    soundEffects.stopRinging();
    const targetUserId = currentUser.id === 'user1' ? 'user2' : 'user1';

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'direct-call-decline',
          callerId: targetUserId,
          responderId: currentUser.id,
        })
      );
    }

    setCallState('idle');
  };

  const handleEndCall = () => {
    soundEffects.playCallEnded();

    if (currentUser) {
      const partnerId = currentUser.id === 'user1' ? 'user2' : 'user1';
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'direct-call-end',
            userId: currentUser.id,
            partnerId,
          })
        );
      }
    }

    if (audioBridgeRef.current) {
      audioBridgeRef.current.stopCapture();
    }

    const durationSeconds = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    const partnerName = partnerUser?.displayName || (currentUser?.id === 'user1' ? 'Person 2' : 'Person 1');

    const newLog: CallLog = {
      id: Math.random().toString(36).substring(2, 9),
      lineId: '1-on-1 Line',
      partnerName,
      startTime: callStartTimeRef.current || Date.now(),
      endTime: Date.now(),
      durationSeconds: Math.max(durationSeconds, 1),
      callType: isVideoOff ? 'audio' : 'video',
    };

    setLastCallLog(newLog);
    setCallHistory((prev) => [newLog, ...prev]);

    if (webrtcRef.current) {
      webrtcRef.current.closeConnection();
      webrtcRef.current = null;
    }

    setCallState('ended');
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (webrtcRef.current) {
      webrtcRef.current.setAudioMuted(newMuted);
    }
  };

  const handleToggleVideo = () => {
    const newVideoOff = !isVideoOff;
    setIsVideoOff(newVideoOff);
    if (webrtcRef.current) {
      webrtcRef.current.setVideoDisabled(newVideoOff);
    }
  };

  const handleToggleScreenShare = async () => {
    if (webrtcRef.current) {
      if (isSharingScreen) {
        webrtcRef.current.stopScreenShare();
        setIsSharingScreen(false);
      } else {
        const stream = await webrtcRef.current.startScreenShare();
        if (stream) {
          setIsSharingScreen(true);
        }
      }
    }
  };

  const handleSendChatMessage = (text: string, file?: any) => {
    if (!currentUser) return;
    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      file,
    };

    addChatMessage(newMsg);
    if (webrtcRef.current) {
      webrtcRef.current.sendChatMessage(newMsg);
    }
  };

  const handleUpdateDisplayName = async (newName: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, displayName: newName }),
      });
      if (res.ok) {
        setCurrentUser({ ...currentUser, displayName: newName });
      }
    } catch (e) {}
  };

  // 1. If not logged in -> Show LoginScreen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const partnerName = partnerUser?.displayName || (currentUser.id === 'user1' ? 'Person 2 (Partner)' : 'Person 1 (Mohamed)');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (callState === 'connected') {
            if (confirm('Leave active call?')) {
              handleEndCall();
              setCurrentTab(tab);
            }
          } else {
            setCurrentTab(tab);
          }
        }}
        callState={callState}
        activeLineId="1-on-1 Direct Line"
        onQuickLine={() => handleInitiateCall('video')}
      />

      {/* Real-time System Readiness Bar */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-2 text-xs font-mono flex flex-wrap items-center justify-center gap-4 text-slate-400">
        <div className="flex items-center gap-1.5">
          <Mic className={`w-3.5 h-3.5 ${micStatus === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>Microphone: {micStatus === 'ok' ? 'Ready' : 'Check Permission'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Video className={`w-3.5 h-3.5 ${camStatus === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>Camera: {camStatus === 'ok' ? 'Ready' : 'Check Permission'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Radio className={`w-3.5 h-3.5 ${serverStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`} />
          <span>Server: {serverStatus === 'online' ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Global Error Toast */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-3 text-xs font-semibold flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Outgoing Calling Screen */}
      {callState === 'dialing' && (
        <CallingScreen
          mode="dialing"
          lineId="1-on-1 Private Line"
          partnerName={partnerName}
          onCancelCall={handleEndCall}
          onDeclineCall={handleEndCall}
        />
      )}

      {/* Incoming Call Screen */}
      {callState === 'incoming' && (
        <CallingScreen
          mode="incoming"
          lineId="1-on-1 Private Line"
          partnerName={partnerName}
          onAcceptCall={handleAcceptIncomingCall}
          onDeclineCall={handleDeclineIncomingCall}
          onCancelCall={handleDeclineIncomingCall}
        />
      )}

      {/* Active Connected Call Screen */}
      {callState === 'connected' && (
        <div className="flex-1 relative flex overflow-hidden">
          <div className="flex-1">
            <InCallView
              lineId="1-on-1 Private Line"
              localStream={localStream}
              remoteStream={remoteStream}
              partnerInfo={{ id: partnerUser?.id || 'partner', displayName: partnerName }}
              currentUserName={currentUser.displayName}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isSharingScreen={isSharingScreen}
              onToggleMute={handleToggleMute}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
              onHangUp={handleEndCall}
              messages={messages}
              onSendMessage={handleSendChatMessage}
              stats={stats}
              onStartRecording={() => {
                if (webrtcRef.current) {
                  const started = webrtcRef.current.startRecording();
                  setIsRecording(started);
                  return started;
                }
                return false;
              }}
              onStopRecording={async () => {
                if (webrtcRef.current) {
                  const blob = await webrtcRef.current.stopRecording();
                  setIsRecording(false);
                  return blob;
                }
                return null;
              }}
              isRecording={isRecording}
              onOpenChat={() => {
                setIsChatOpen(!isChatOpen);
                setUnreadCount(0);
              }}
              onOpenStats={() => setIsStatsOpen(true)}
              unreadCount={unreadCount}
            />
          </div>

          {isChatOpen && (
            <InCallChat
              messages={messages}
              onSendMessage={handleSendChatMessage}
              onClose={() => setIsChatOpen(false)}
              currentUserId={currentUser.id}
            />
          )}
        </div>
      )}

      {/* Post-Call Summary Screen */}
      {callState === 'ended' && lastCallLog && (
        <CallEndedSummary
          callLog={lastCallLog}
          onRedial={() => handleInitiateCall('video')}
          onClose={() => {
            setCallState('idle');
            setCurrentTab('line');
          }}
          onSaveRatingAndNotes={(rating, notes) => {
            setCallHistory((prev) =>
              prev.map((log) => (log.id === lastCallLog.id ? { ...log, rating, notes } : log))
            );
          }}
        />
      )}

      {/* Main Home Screens */}
      {callState === 'idle' && (
        <main className="flex-1">
          {currentTab === 'line' && (
            <DirectDashboard
              currentUser={currentUser}
              partner={partnerUser}
              onInitiateCall={handleInitiateCall}
              onOpenChamber={() => setCurrentTab('chamber')}
              onUpdateDisplayName={handleUpdateDisplayName}
              onLogout={() => setCurrentUser(null)}
            />
          )}

          {currentTab === 'chamber' && (
            <DeviceSetupChamber
              onProceedToCall={(stream, name) => {
                setLocalStream(stream);
                handleUpdateDisplayName(name);
                setCurrentTab('line');
              }}
              defaultDisplayName={currentUser.displayName}
            />
          )}

          {currentTab === 'history' && (
            <CallHistory
              logs={callHistory}
              onRedial={() => handleInitiateCall('video')}
              onClearHistory={() => setCallHistory([])}
            />
          )}
        </main>
      )}

      {/* Modals */}
      {isStatsOpen && (
        <CallStatsModal stats={stats} onClose={() => setIsStatsOpen(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>DuoCall · Dedicated Private 1-on-1 Speed-Dial Engine</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Logged in: {currentUser.displayName}</span>
          <span>·</span>
          <span>Encrypted WebRTC P2P + Live Audio Bridge</span>
        </div>
      </footer>
    </div>
  );
}
