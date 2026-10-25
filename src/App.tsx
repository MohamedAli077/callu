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
import { AlertCircle, Lock, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'line' | 'chamber' | 'history'>('line');
  const [callState, setCallState] = useState<CallState>('idle');

  const [activeLineId, setActiveLineId] = useState<string>('');
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

  // Call History & Post-Call Log
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

  // WebSockets & WebRTC References
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const myPeerIdRef = useRef<string>('');

  // 1. Check URL query parameters for direct line invitation (`?line=123456`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lineParam = params.get('line') || params.get('code');
    if (lineParam) {
      setActiveLineId(lineParam);
      setCurrentTab('line');
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('duocall_history', JSON.stringify(callHistory));
    } catch (e) {
      // ignore
    }
  }, [callHistory]);

  // Save display name to localStorage
  useEffect(() => {
    if (myDisplayName) {
      localStorage.setItem('duocall_name', myDisplayName);
    }
  }, [myDisplayName]);

  // Connect WebSocket Signaling Server
  const connectWebSocket = (): WebSocket => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket signaling connected');
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg);
      } catch (err) {
        console.error('Error handling signaling msg:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket signaling disconnected');
    };

    wsRef.current = ws;
    return ws;
  };

  // WebSockets Message Dispatcher
  const handleSignalingMessage = async (msg: any) => {
    switch (msg.type) {
      case 'room-joined': {
        myPeerIdRef.current = msg.peerId;
        if (msg.otherPeer) {
          setPartnerInfo({
            id: msg.otherPeer.id,
            displayName: msg.otherPeer.displayName,
          });
        }
        break;
      }

      case 'room-full': {
        soundEffects.stopRinging();
        setCallState('idle');
        setErrorMessage(msg.message || 'This 1-on-1 direct line is already full (2 persons max).');
        setTimeout(() => setErrorMessage(null), 5000);
        break;
      }

      case 'peer-joined': {
        setPartnerInfo({
          id: msg.peerId,
          displayName: msg.displayName,
        });

        // Add system message
        addChatMessage({
          id: Math.random().toString(),
          senderId: 'system',
          senderName: 'System',
          text: `${msg.displayName} joined the line.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
        });

        // If I am waiting in dialing mode, trigger WebRTC Offer!
        if (callState === 'dialing' && webrtcRef.current) {
          const offer = await webrtcRef.current.createOffer();
          sendSignaling({ type: 'offer', offer });
        }
        break;
      }

      case 'peer-left': {
        addChatMessage({
          id: Math.random().toString(),
          senderId: 'system',
          senderName: 'System',
          text: `${msg.displayName || 'Partner'} left the call line.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: true,
        });

        if (callState === 'connected' || callState === 'dialing') {
          handleEndCall();
        }
        break;
      }

      case 'offer': {
        if (!webrtcRef.current) initWebRTCService();
        const answer = await webrtcRef.current!.handleOffer(msg.offer);
        sendSignaling({ type: 'answer', answer });

        if (callState !== 'connected') {
          setPartnerInfo({
            id: msg.senderId,
            displayName: msg.senderName || 'Partner',
          });
          setCallState('incoming');
        }
        break;
      }

      case 'answer': {
        if (webrtcRef.current) {
          await webrtcRef.current.handleAnswer(msg.answer);
          setCallState('connected');
          callStartTimeRef.current = Date.now();
          soundEffects.playCallConnected();
        }
        break;
      }

      case 'ice-candidate': {
        if (webrtcRef.current) {
          await webrtcRef.current.handleIceCandidate(msg.candidate);
        }
        break;
      }

      case 'call-ring': {
        if (callState === 'idle' || callState === 'chamber') {
          setPartnerInfo({
            id: msg.senderId,
            displayName: msg.senderName || 'Partner',
          });
          setCallState('incoming');
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
        setErrorMessage('Call partner declined the incoming call.');
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

  const sendSignaling = (payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // WebRTC Service Initialization
  const initWebRTCService = () => {
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
        } else if (state === 'failed' || state === 'disconnected') {
          // Attempt recovery or notify
        }
      },
    });

    webrtcRef.current = instance;
    return instance;
  };

  const addChatMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    if (!isChatOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  // Start Call (Host or Receiver)
  const handleStartCall = async (lineId: string, name: string, isHost: boolean) => {
    setActiveLineId(lineId);
    setMyDisplayName(name);

    // Acquire local stream if not already acquired
    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Failed to get media devices:', err);
        setErrorMessage('Camera or Microphone access required for calling.');
        return;
      }
    }

    const ws = connectWebSocket();
    const service = initWebRTCService();
    service.setLocalStream(stream);

    // Join WS signaling room for this 1-on-1 line
    const joinMsg = () => {
      ws.send(
        JSON.stringify({
          type: 'join-room',
          roomId: lineId,
          displayName: name,
        })
      );
    };

    if (ws.readyState === WebSocket.OPEN) {
      joinMsg();
    } else {
      ws.onopen = () => joinMsg();
    }

    if (isHost) {
      setCallState('dialing');
      sendSignaling({ type: 'call-ring' });
    } else {
      sendSignaling({ type: 'call-accept' });
      setCallState('connected');
      callStartTimeRef.current = Date.now();
      soundEffects.playCallConnected();
    }
  };

  // Accept Incoming Call
  const handleAcceptIncomingCall = async () => {
    soundEffects.stopRinging();
    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Failed to get media stream:', err);
        setErrorMessage('Camera or Microphone access required.');
        return;
      }
    }

    const service = initWebRTCService();
    service.setLocalStream(stream);

    sendSignaling({ type: 'call-accept' });
    setCallState('connected');
    callStartTimeRef.current = Date.now();
    soundEffects.playCallConnected();
  };

  // Decline Incoming Call
  const handleDeclineIncomingCall = () => {
    soundEffects.stopRinging();
    sendSignaling({ type: 'call-decline' });
    setCallState('idle');
  };

  // Cancel Outgoing Dialing
  const handleCancelDialing = () => {
    soundEffects.stopRinging();
    sendSignaling({ type: 'leave-room' });
    setCallState('idle');
  };

  // End Active Call
  const handleEndCall = () => {
    soundEffects.playCallEnded();
    sendSignaling({ type: 'call-hangup' });
    sendSignaling({ type: 'leave-room' });

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

  // In-Call Media Control Toggles
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
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (callState === 'connected') {
            if (confirm('Leave current active 1-on-1 call?')) {
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
          setCurrentTab('line');
        }}
      />

      {/* Global Error Banner Toast */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-3 text-xs font-semibold flex items-center justify-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active 1-on-1 Calling Screen overlays */}
      {callState === 'dialing' && (
        <CallingScreen
          mode="dialing"
          lineId={activeLineId}
          partnerName={partnerInfo?.displayName || 'Calling Partner...'}
          onCancelCall={handleCancelDialing}
          onDeclineCall={handleCancelDialing}
        />
      )}

      {callState === 'incoming' && (
        <CallingScreen
          mode="incoming"
          lineId={activeLineId}
          partnerName={partnerInfo?.displayName || 'Incoming Call Partner'}
          onAcceptCall={handleAcceptIncomingCall}
          onDeclineCall={handleDeclineIncomingCall}
          onCancelCall={handleDeclineIncomingCall}
        />
      )}

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

          {/* Right Side In-Call Chat Drawer */}
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

      {/* Post-Call Summary Screen */}
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

      {/* Main Tab Content when call is idle */}
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

      {/* Network Stats Modal */}
      {isStatsOpen && (
        <CallStatsModal stats={stats} onClose={() => setIsStatsOpen(false)} />
      )}

      {/* QR Code Modal */}
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
          <span>Direct WebRTC P2P</span>
        </div>
      </footer>
    </div>
  );
}
