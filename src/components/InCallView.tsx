import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MessageSquare,
  PhoneOff,
  Activity,
  Disc,
  Maximize2,
  Minimize2,
  Volume2,
  ShieldCheck,
  User,
  Sparkles,
  Download,
} from 'lucide-react';
import { CallStats, ChatMessage, PeerInfo } from '../types/calling';
import { soundEffects } from '../utils/soundEffects';

interface InCallViewProps {
  lineId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  partnerInfo: PeerInfo | null;
  currentUserName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSharingScreen: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onHangUp: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, file?: any) => void;
  stats: CallStats | null;
  onStartRecording: () => boolean;
  onStopRecording: () => Promise<Blob | null>;
  isRecording: boolean;
  onOpenChat: () => void;
  onOpenStats: () => void;
  unreadCount: number;
}

export const InCallView: React.FC<InCallViewProps> = ({
  lineId,
  localStream,
  remoteStream,
  partnerInfo,
  currentUserName,
  isMuted,
  isVideoOff,
  isSharingScreen,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onHangUp,
  messages,
  stats,
  onStartRecording,
  onStopRecording,
  isRecording,
  onOpenChat,
  onOpenStats,
  unreadCount,
}) => {
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MM:SS or HH:MM:SS
  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const partnerName = partnerInfo?.displayName || 'Call Partner';
  const isRemoteVideoOff = partnerInfo?.isVideoOff;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Floating Glass Info Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-4 pointer-events-none">
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2 pointer-events-auto shadow-xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">1-ON-1 DIRECT CALL</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono font-semibold text-cyan-400">{formatDuration(duration)}</span>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono text-slate-400">LINE: {lineId}</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {isRecording && (
            <div className="flex items-center gap-2 bg-red-950/80 backdrop-blur-md border border-red-800 text-red-400 text-xs font-mono font-bold px-3 py-1.5 rounded-xl animate-pulse">
              <Disc className="w-4 h-4 fill-red-500" />
              <span>RECORDING</span>
            </div>
          )}

          {stats && (
            <button
              onClick={onOpenStats}
              className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-cyan-400 text-xs font-mono px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xl"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>{stats.rttMs}ms</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl transition-all shadow-xl"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
        {/* Remote Video Stream or Avatar fallback */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${isRemoteVideoOff ? 'hidden' : 'block'}`}
        />

        {/* Audio-only or Video-Off Placeholder */}
        {isRemoteVideoOff && (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-6">
              {/* Sound Wave Pulse Circles */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
              <div className="absolute -inset-4 rounded-full bg-indigo-500/10 animate-pulse" />
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 p-1 shadow-2xl relative z-10 flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-4xl font-extrabold">
                  {partnerName.substring(0, 2).toUpperCase()}
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">{partnerName}</h2>
            <p className="text-xs font-medium text-cyan-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>HD Audio Stream Connected</span>
            </p>
          </div>
        )}

        {/* Floating Local Camera Picture-in-Picture Thumbnail */}
        <div className="absolute bottom-24 right-6 w-36 sm:w-48 aspect-video bg-slate-900/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl z-20 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${
              isVideoOff ? 'hidden' : 'block'
            }`}
          />

          {isVideoOff && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 text-xs">
              <User className="w-6 h-6 mb-1 text-slate-600" />
              <span>You (Cam Off)</span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-sm text-[10px] font-medium text-slate-300 px-2 py-0.5 rounded border border-slate-800">
            You {isMuted && ' (Muted)'}
          </div>
        </div>
      </div>

      {/* Floating Control Bar Dock (Glassmorphism) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-2.5 flex items-center gap-2 sm:gap-3 shadow-2xl shadow-slate-950">
          {/* Mic Mute */}
          <button
            onClick={() => {
              soundEffects.playToggleSound(!isMuted);
              onToggleMute();
            }}
            className={`p-3.5 rounded-xl font-medium transition-all ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/10'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={() => {
              soundEffects.playToggleSound(!isVideoOff);
              onToggleVideo();
            }}
            className={`p-3.5 rounded-xl font-medium transition-all ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/10'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`p-3.5 rounded-xl font-medium transition-all ${
              isSharingScreen
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
            }`}
            title="Share Screen"
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Record Call */}
          <button
            onClick={async () => {
              if (isRecording) {
                const blob = await onStopRecording();
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `duocall-recording-${lineId}-${Date.now()}.webm`;
                  a.click();
                }
              } else {
                onStartRecording();
              }
            }}
            className={`p-3.5 rounded-xl font-medium transition-all ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
            }`}
            title={isRecording ? 'Stop & Save Recording' : 'Start Recording Call'}
          >
            <Disc className="w-5 h-5" />
          </button>

          {/* In-Call Chat Drawer Toggle */}
          <button
            onClick={onOpenChat}
            className="relative p-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl transition-all"
            title="Open Chat Drawer"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-cyan-400 text-slate-950 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Prominent Red Hang Up Button */}
          <button
            onClick={() => {
              soundEffects.playCallEnded();
              onHangUp();
            }}
            className="p-3.5 px-6 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center gap-2"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline text-xs uppercase tracking-wider">End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
