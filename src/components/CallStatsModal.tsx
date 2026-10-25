import React from 'react';
import { X, Activity, Wifi, ShieldCheck, Gauge, Cpu } from 'lucide-react';
import { CallStats } from '../types/calling';

interface CallStatsModalProps {
  stats: CallStats | null;
  onClose: () => void;
}

export const CallStatsModal: React.FC<CallStatsModalProps> = ({ stats, onClose }) => {
  if (!stats) return null;

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return <span className="text-emerald-400 font-semibold">● Excellent (HD Direct)</span>;
      case 'good':
        return <span className="text-cyan-400 font-semibold">● Good Quality</span>;
      case 'fair':
        return <span className="text-amber-400 font-semibold">● Fair</span>;
      default:
        return <span className="text-red-400 font-semibold">● Poor Connection</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>WebRTC Direct Diagnostics</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quality Status Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-400 block">Connection Quality</span>
            {getQualityBadge(stats.connectionQuality)}
          </div>
          <Wifi className="w-6 h-6 text-cyan-400" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Latency / RTT</span>
            <span className="text-base font-bold text-cyan-400">{stats.rttMs} ms</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Jitter</span>
            <span className="text-base font-bold text-slate-200">{stats.jitterMs} ms</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Audio Bitrate</span>
            <span className="text-base font-bold text-slate-200">{stats.audioBitrateKbps} kbps</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Video Bitrate</span>
            <span className="text-base font-bold text-slate-200">{stats.videoBitrateKbps} kbps</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Resolution</span>
            <span className="text-base font-bold text-slate-200">{stats.videoResolution}</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-slate-500 block mb-1">Frame Rate</span>
            <span className="text-base font-bold text-slate-200">{stats.fps} FPS</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Peer-to-Peer Direct DTLS/SRTP Encryption</span>
        </div>
      </div>
    </div>
  );
};
