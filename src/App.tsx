import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { LineManager } from './components/LineManager';
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
import { soundEffects } from './utils/soundEffects';
import { AlertCircle, PhoneCall, ShieldCheck, User } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'line' | 'chamber' | 'history'>('line');
  const [callState, setCallState] = useState<CallState>('idle');

  const [activeLineId, setActiveLineId] = useState<string>('');
  const [invitedLineId, setInvitedLineId] = useState<string | null>(null);

  const [myDisplayName, setMyDisplayName] = useState<string>(
    () => localStorage.getItem('duocall_name') || 'User ' + Math.floor(100 + Math.random() * 900)
  );

  const [partnerInfo, setPartnerInfo] = useState<PeerInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

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

  // Modals & Banners
  const [qrLineId, setQrLineId] = useState<string | null>(null);
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

  // Signaling References
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const myPeerIdRef = useRef<string>('');
  const activeRoomIdRef = useRef<string>('');

  // 1. Detect direct link invitation parameter (`?line=123456` or `?code=123456`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lineParam = params.get('line') || params.get('code');
    if (lineParam) {
      setActiveLineId(lineParam);
      setInvitedLineId(lineParam);
    }
  }, []);

  // Save history & name
  useEffect(() => {
    try {
      localStorage.setItem('duocall_history', JSON.stringify(callHistory));
    } catch (e) {}
  }, [callHistory]);

  useEffect(() => {
    if (myDisplayName) {
      localStorage.setItem('duocall_name', myDisplayName);
    }
  }, [myDisplayName]);

  // Connect WebSocket & HTTP Polling Fallback
  const connectSignaling = (roomId: string, displayName: string) => {
    activeRoomIdRef.current = roomId;

    // A. Connect WebSockets
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join-room', roomId, displayName }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleSignalingMessage(msg);
        } catch (e) {}
      };

      wsRef.current = ws;
    } else if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join-room', roomId, displayName }));
    }

    // B. HTTP Fallback Join
    fetch('/api/signaling/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, displayName, peerId: myPeerIdRef.current }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.type === 'room-full') {
          soundEffects.stopRinging();
          setCallState('idle');
          setErrorMessage(data.message);
          return;
        }

        if (data.peerId && !myPeerIdRef.current) {
          myPeerIdRef.current = data.peerId;
        }

        if (data.otherPeer) {
          setPartnerInfo({ id: data.otherPeer.id, displayName: data.otherPeer.displayName });
        }
      })
      .catch((e) => console.warn('HTTP Join error:', e));

    // C. HTTP Polling Backup Safety Net
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      if (!activeRoomIdRef.current || !myPeerIdRef.current) return;
      try {
        const res = await fetch(
          `/api/signaling/poll?roomId=${activeRoomIdRef.current}&peerId=${myPeerIdRef.current}`
        );
        const data = await res.json();
        if (data.signals && data.signals.length > 0) {
          data.signals.forEach((sig: any) => handleSignalingMessage(sig));
        }
      } catch (e) {}
    }, 1200);
  };

  const sendSignaling = (signal: any) => {
    const roomId = activeRoomIdRef.current;
    if (!roomId) return;

    // Send via WS
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signal));
    }

    // Send via HTTP POST
    fetch('/api/signaling/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, senderId: myPeerIdRef.current, signal }),
    }).catch((e) => {});
  };

  // WebRTC Signal Processing
  const handleSignalingMessage = async (msg: any) => {
    // Ignore signals originating from myself
    if (msg.senderId && msg.senderId === myPeerIdRef.current) return;

    switch (msg.type) {
      case 'room-joined': {
        myPeerIdRef.current = msg.peerId;
        if (msg.otherPeer) {
          setPartnerInfo({ id: msg.otherPeer.id, displayName: msg.otherPeer.displayName });
        }
        break;
      }

      case 'room-full': {
        soundEffects.stopRinging();
        setCallState('idle');
        setErrorMessage(msg.message || 'This direct call line is full (maximum 2 participants allowed).');
        setTimeout(() => setErrorMessage(null), 5000);
        break;
      }

      case 'peer-joined': {
        setPartnerInfo({ id: msg.peerId, displayName: msg.displayName });

        // Trigger offer if I am in dialing state or host
        if (webrtcRef.current) {
          try {
            const offer = await webrtcRef.current.createOffer();
            sendSignaling({ type: 'offer', offer });
          } catch (e) {
            console.error('Error creating offer on peer-joined:', e);
          }
        }
        break;
      }

      case 'peer-left': {
        if (callState === 'connected' || callState === 'dialing') {
          handleEndCall();
        }
        break;
      }

      case 'offer': {
        const service = initWebRTCService();

        // Ensure local stream is attached if available
        if (localStream) {
          service.setLocalStream(localStream);
        }

        const answer = await service.handleOffer(msg.offer);
        sendSignaling({ type: 'answer', answer });

        setPartnerInfo({
          id: msg.senderId,
          displayName: msg.senderName || 'Partner',
        });

        if (callState !== 'connected') {
          setCallState('connected');
          callStartTimeRef.current = Date.now();
          soundEffects.playCallConnected();
        }
        break;
      }

      case 'answer': {
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

      case 'call-accept': {
        if (webrtcRef.current && callState === 'dialing') {
          const offer = await webrtcRef.current.createOffer();
          sendSignaling({ type: 'offer', offer });
        }
        break;
      }

      case 'call-decline': {
        soundEffects.stopRinging();
        soundEffects.playCallEnded();
        setCallState('idle');
        setErrorMessage('Call partner declined the direct call.');
        setTimeout(() => setErrorMessage(null), 4000);
        break;
      }

      case 'call-hangup': {
        handleEndCall();
        break;
      }

      case 'media-state': {
        setPartnerInfo((prev) => (prev ? { ...prev, ...msg.state } : null));
        break;
      }

      case 'chat-message': {
        addChatMessage(msg.message);
        break;
      }

      default:
        break;
    }
  };

  // WebRTC Instance Setup
  const initWebRTCService = (): WebRTCService => {
    if (webrtcRef.current) return webrtcRef.current;

    const instance = new WebRTCService({
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
      onRemoteStreamEnded: () => {
        setRemoteStream(null);
      },
      onChatMessage: (msg) => {
        addChatMessage(msg);
      },
      onPeerMediaStateChange: (state) => {
        setPartnerInfo((prev) => (prev ? { ...prev, ...state } : null));
      },
      onStatsUpdate: (newStats) => {
        setStats(newStats);
      },
      onSignalToSend: (signal) => {
        sendSignaling(signal);
      },
      onConnectionStateChange: (state) => {
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

  // Main Call Handler: Starts dialing or connecting to line
  const handleStartCall = async (lineId: string, name: string, isHost: boolean) => {
    setActiveLineId(lineId);
    setMyDisplayName(name);

    // 1. Get User Media Stream (mic + camera)
    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Failed to get camera/mic permissions:', err);
        setErrorMessage('Camera & Microphone access is required for 1-on-1 calling.');
        return;
      }
    }

    // 2. Initialize WebRTC Service
    const service = initWebRTCService();
    service.setLocalStream(stream);

    // 3. Connect Dual Signaling
    connectSignaling(lineId, name);

    if (isHost) {
      setCallState('dialing');
      sendSignaling({ type: 'call-ring' });
    } else {
      setCallState('dialing');
      sendSignaling({ type: 'call-accept' });

      // Create offer if partner is already waiting
      try {
        const offer = await service.createOffer();
        sendSignaling({ type: 'offer', offer });
      } catch (e) {}
    }
  };

  const handleEndCall = () => {
    soundEffects.playCallEnded();
    sendSignaling({ type: 'call-hangup' });

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const durationSeconds = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    const newLog: CallLog = {
      id: Math.random().toString(36).substring(2, 9),
      lineId: activeLineId,
      partnerName: partnerInfo?.displayName || 'Partner',
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
    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: myPeerIdRef.current || 'me',
      senderName: myDisplayName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      file,
    };

    addChatMessage(newMsg);
    if (webrtcRef.current) {
      webrtcRef.current.sendChatMessage(newMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (callState === 'connected') {
            if (confirm('Leave active 1-on-1 call?')) {
              handleEndCall();
              setCurrentTab(tab);
            }
          } else {
            setCurrentTab(tab);
          }
        }}
        callState={callState}
        activeLineId={activeLineId}
        onQuickLine={() => {
          const newCode = Math.floor(100000 + Math.random() * 900000).toString();
          setActiveLineId(newCode);
          setInvitedLineId(null);
          setCurrentTab('line');
        }}
      />

      {/* Global Toast Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-3 text-xs font-semibold flex items-center justify-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Direct Invitation Link Banner */}
      {invitedLineId && callState === 'idle' && (
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border-b border-cyan-800/80 p-4 text-center flex flex-col sm:flex-row items-center justify-center gap-3 shadow-lg">
          <PhoneCall className="w-5 h-5 text-cyan-400 animate-bounce" />
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            You were invited to join Direct 1-on-1 Call Line:{' '}
            <strong className="text-cyan-400 font-mono tracking-wider">{invitedLineId}</strong>
          </span>
          <button
            onClick={() => handleStartCall(invitedLineId, myDisplayName, false)}
            className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
          >
            Connect to Line Now
          </button>
        </div>
      )}

      {/* Outgoing Dialing Overlay */}
      {callState === 'dialing' && (
        <CallingScreen
          mode="dialing"
          lineId={activeLineId}
          partnerName={partnerInfo?.displayName || 'Waiting for Partner...'}
          onCancelCall={() => {
            soundEffects.stopRinging();
            setCallState('idle');
          }}
          onDeclineCall={() => {
            soundEffects.stopRinging();
            setCallState('idle');
          }}
        />
      )}

      {/* Incoming Call Overlay */}
      {callState === 'incoming' && (
        <CallingScreen
          mode="incoming"
          lineId={activeLineId}
          partnerName={partnerInfo?.displayName || 'Incoming Partner'}
          onAcceptCall={() => handleStartCall(activeLineId, myDisplayName, false)}
          onDeclineCall={() => {
            soundEffects.stopRinging();
            setCallState('idle');
          }}
          onCancelCall={() => {
            soundEffects.stopRinging();
            setCallState('idle');
          }}
        />
      )}

      {/* Active Connected Call Screen */}
      {callState === 'connected' && (
        <div className="flex-1 relative flex overflow-hidden">
          <div className="flex-1">
            <InCallView
              lineId={activeLineId}
              localStream={localStream}
              remoteStream={remoteStream}
              partnerInfo={partnerInfo}
              currentUserName={myDisplayName}
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
              currentUserId={myPeerIdRef.current}
            />
          )}
        </div>
      )}

      {/* Call Ended Summary */}
      {callState === 'ended' && lastCallLog && (
        <CallEndedSummary
          callLog={lastCallLog}
          onRedial={() => {
            handleStartCall(lastCallLog.lineId, myDisplayName, true);
          }}
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
            <LineManager
              onStartCall={(lineId, name, isHost) => {
                handleStartCall(lineId, name, isHost);
              }}
              onOpenChamber={() => setCurrentTab('chamber')}
              onShowQR={(lineId) => setQrLineId(lineId)}
              defaultDisplayName={myDisplayName}
            />
          )}

          {currentTab === 'chamber' && (
            <DeviceSetupChamber
              onProceedToCall={(stream, name) => {
                setLocalStream(stream);
                setMyDisplayName(name);
                setCurrentTab('line');
              }}
              defaultDisplayName={myDisplayName}
            />
          )}

          {currentTab === 'history' && (
            <CallHistory
              logs={callHistory}
              onRedial={(lineId, partnerName) => {
                handleStartCall(lineId, myDisplayName, true);
              }}
              onClearHistory={() => setCallHistory([])}
            />
          )}
        </main>
      )}

      {/* Modals */}
      {isStatsOpen && (
        <CallStatsModal stats={stats} onClose={() => setIsStatsOpen(false)} />
      )}

      {qrLineId && (
        <QRCodeModal lineId={qrLineId} onClose={() => setQrLineId(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>DuoCall · Dedicated Private 1-on-1 Calling Engine</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Max 2 Participants per Line</span>
          <span>·</span>
          <span>WebRTC HD P2P + HTTP Polling Backup</span>
        </div>
      </footer>
    </div>
  );
}
