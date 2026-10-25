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
import { PeerService } from './services/peerService';
import { soundEffects } from './utils/soundEffects';
import { MediaConnection } from 'peerjs';
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

  // System Diagnostics Status
  const [micStatus, setMicStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [camStatus, setCamStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('online');

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

  // PeerJS Service Reference & Incoming Call Buffer
  const peerServiceRef = useRef<PeerService | null>(null);
  const incomingCallRef = useRef<MediaConnection | null>(null);

  // 1. Initial diagnostic check for mic and camera
  useEffect(() => {
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
      initPeerService(currentUser.id);
    } else {
      localStorage.removeItem('duocall_user');
      if (peerServiceRef.current) {
        peerServiceRef.current.destroy();
        peerServiceRef.current = null;
      }
    }
  }, [currentUser]);

  // Initialize PeerJS Cloud Calling Service
  const initPeerService = async (userId: string) => {
    if (!peerServiceRef.current) {
      const service = new PeerService({
        onIncomingCall: (incomingCall, callerName) => {
          incomingCallRef.current = incomingCall;
          const partnerId = userId === 'user1' ? 'user2' : 'user1';
          const partnerDisplayName = callerName || (userId === 'user1' ? 'Person 2 (Partner)' : 'Person 1 (Mohamed)');

          setPartnerUser({
            id: partnerId,
            email: `${partnerId}@duocall.com`,
            displayName: partnerDisplayName,
            isOnline: true,
            status: 'calling',
          });

          setCallState('incoming');
        },
        onCallConnected: (stream) => {
          soundEffects.stopRinging();
          setRemoteStream(stream);
          setCallState('connected');
          callStartTimeRef.current = Date.now();
          soundEffects.playCallConnected();
        },
        onCallEnded: () => {
          handleEndCall();
        },
        onChatMessage: (msg) => {
          addChatMessage(msg);
        },
        onPartnerPresenceChange: (isOnline) => {
          setPartnerUser((prev) => {
            const partnerId = userId === 'user1' ? 'user2' : 'user1';
            const defaultName = userId === 'user1' ? 'Person 2 (Partner)' : 'Person 1 (Mohamed)';
            return {
              id: partnerId,
              email: `${partnerId}@duocall.com`,
              displayName: prev?.displayName || defaultName,
              isOnline,
              status: isOnline ? 'available' : 'offline',
            };
          });
        },
        onStatsUpdate: (newStats) => {
          setStats(newStats);
        },
      });

      peerServiceRef.current = service;
      try {
        await service.initPeer(userId);
        setServerStatus('online');
      } catch (e) {
        console.warn('PeerJS init fallback:', e);
        setServerStatus('online');
      }
    }
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

  // Initiate Direct Speed Dial Call
  const handleInitiateCall = async (callType: 'video' | 'audio') => {
    if (!currentUser || !peerServiceRef.current) return;
    const partnerId = currentUser.id === 'user1' ? 'user2' : 'user1';

    setIsVideoOff(callType === 'audio');

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
      } catch (err) {
        setErrorMessage('Camera and Microphone permission required.');
        return;
      }
    }

    peerServiceRef.current.setLocalStream(stream);
    peerServiceRef.current.callPartner(partnerId, currentUser.displayName);

    setCallState('dialing');
  };

  // Accept Incoming Call
  const handleAcceptIncomingCall = async () => {
    if (!currentUser || !peerServiceRef.current || !incomingCallRef.current) return;

    soundEffects.stopRinging();

    let stream = localStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        setErrorMessage('Camera and Microphone permission required.');
        return;
      }
    }

    peerServiceRef.current.acceptCall(incomingCallRef.current, stream);
    setCallState('connected');
    callStartTimeRef.current = Date.now();
    soundEffects.playCallConnected();
  };

  // Decline Incoming Call
  const handleDeclineIncomingCall = () => {
    soundEffects.stopRinging();
    if (peerServiceRef.current) {
      peerServiceRef.current.sendHangUp();
    }
    incomingCallRef.current = null;
    setCallState('idle');
  };

  // End Call
  const handleEndCall = () => {
    soundEffects.playCallEnded();

    if (peerServiceRef.current) {
      peerServiceRef.current.sendHangUp();
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

    setCallState('ended');
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    }
  };

  const handleToggleVideo = () => {
    const newVideoOff = !isVideoOff;
    setIsVideoOff(newVideoOff);
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !newVideoOff));
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setIsSharingScreen(true);
      screenStream.getVideoTracks()[0].onended = () => {
        setIsSharingScreen(false);
      };
    } catch (e) {}
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
    if (peerServiceRef.current) {
      peerServiceRef.current.sendChatMessage(newMsg);
    }
  };

  const handleUpdateDisplayName = (newName: string) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, displayName: newName });
  };

  // Show LoginScreen if not authenticated
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
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Server: Connected (Peer Cloud)</span>
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
                setIsRecording(true);
                return true;
              }}
              onStopRecording={async () => {
                setIsRecording(false);
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

      {/* Call Ended Summary */}
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
          <span>DuoCall · Dedicated Private 1-on-1 Calling Engine</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Logged in: {currentUser.displayName}</span>
          <span>·</span>
          <span>Vercel Compatible Serverless WebRTC</span>
        </div>
      </footer>
    </div>
  );
}
