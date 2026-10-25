import React, { useEffect } from 'react';
import { Phone, PhoneOff, PhoneCall, ShieldCheck, User } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface CallingScreenProps {
  mode: 'dialing' | 'incoming';
  lineId: string;
  partnerName: string;
  onAcceptCall?: () => void;
  onDeclineCall: () => void;
  onCancelCall: () => void;
}

export const CallingScreen: React.FC<CallingScreenProps> = ({
  mode,
  lineId,
  partnerName,
  onAcceptCall,
  onDeclineCall,
  onCancelCall,
}) => {
  useEffect(() => {
    if (mode === 'dialing') {
      soundEffects.playOutgoingRing();
    } else {
      soundEffects.playIncomingRingtone();
    }

    return () => {
      soundEffects.stopRinging();
    };
  }, [mode]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Ambient Ringing Waves Background Animation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-64 h-64 rounded-full bg-cyan-500/20 animate-ping" />
          <div className="w-96 h-96 rounded-full bg-indigo-500/10 animate-pulse" />
        </div>

        {/* 1-on-1 Direct Line Badge */}
        <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 bg-slate-950/80 border border-slate-800 rounded-full px-3 py-1 mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>DIRECT LINE CODE: {lineId}</span>
        </div>

        {/* User Avatar with Pulse Effect */}
        <div className="relative mb-6 inline-block">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 p-1 shadow-xl shadow-cyan-500/20 mx-auto flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-3xl font-bold">
              {partnerName.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900" />
        </div>

        {/* Name and Calling Status */}
        <h2 className="text-2xl font-bold text-white mb-2">{partnerName}</h2>
        <p className="text-sm font-medium text-cyan-400 animate-pulse mb-8">
          {mode === 'dialing' ? 'Dialing partner on direct line...' : 'Incoming 1-on-1 Call...'}
        </p>

        {/* Action Buttons */}
        {mode === 'dialing' ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onCancelCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all"
              title="Cancel Dialing"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-slate-400 font-medium">Cancel Call</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onDeclineCall}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all"
                title="Decline Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-slate-400 font-medium">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onAcceptCall}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all animate-bounce"
                title="Accept Call"
              >
                <PhoneCall className="w-7 h-7 fill-slate-950" />
              </button>
              <span className="text-xs text-emerald-400 font-medium">Accept Call</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
