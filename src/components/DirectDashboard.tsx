import React, { useState } from 'react';
import { PhoneCall, Video, Mic, Volume2, ShieldCheck, User, Settings, Sparkles, Check, Edit3 } from 'lucide-react';

interface DirectDashboardProps {
  currentUser: { id: string; email: string; displayName: string };
  partner: { id: string; email: string; displayName: string; isOnline: boolean; status: string } | null;
  onInitiateCall: (callType: 'video' | 'audio') => void;
  onOpenChamber: () => void;
  onUpdateDisplayName: (newName: string) => void;
  onLogout: () => void;
}

export const DirectDashboard: React.FC<DirectDashboardProps> = ({
  currentUser,
  partner,
  onInitiateCall,
  onOpenChamber,
  onUpdateDisplayName,
  onLogout,
}) => {
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(currentUser.displayName);

  const partnerName = partner?.displayName || (currentUser.id === 'user1' ? 'Person 2 (Partner)' : 'Person 1 (Mohamed)');
  const isPartnerOnline = partner?.isOnline;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim()) return;
    onUpdateDisplayName(editedName.trim());
    setIsEditingName(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Top Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-md shrink-0">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-white font-bold text-lg">
              {currentUser.displayName.substring(0, 2).toUpperCase()}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button type="submit" className="p-1 bg-cyan-400 text-slate-950 rounded-lg text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <>
                  <h2 className="text-base font-bold text-white">{currentUser.displayName}</h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-slate-500 hover:text-cyan-400 transition-colors p-0.5"
                    title="Edit Display Name"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 border border-slate-800 hover:border-red-900 rounded-xl bg-slate-950/60 shrink-0"
        >
          Sign Out
        </button>
      </div>

      {/* Partner Status & Speed Dial Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Glow halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Partner Profile Avatar */}
        <div className="relative inline-block">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 p-1 shadow-2xl shadow-cyan-500/20 mx-auto flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-3xl font-extrabold">
              {partnerName.substring(0, 2).toUpperCase()}
            </div>
          </div>

          <span
            className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center ${
              isPartnerOnline ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5">{partnerName}</h1>
          <div className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full border bg-slate-950">
            <span
              className={`w-2 h-2 rounded-full ${
                isPartnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className={isPartnerOnline ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {isPartnerOnline ? 'Online & Available' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Call Mode Selector (Video vs Pure Audio) */}
        <div className="inline-flex p-1 bg-slate-950 rounded-2xl border border-slate-800 mx-auto">
          <button
            onClick={() => setCallType('video')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              callType === 'video'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>HD Video Call</span>
          </button>

          <button
            onClick={() => setCallType('audio')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              callType === 'audio'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Pure Audio Call</span>
          </button>
        </div>

        {/* Big Single Speed Dial Button */}
        <div>
          <button
            onClick={() => onInitiateCall(callType)}
            className="w-full sm:w-80 py-4 px-8 bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 active:scale-95 text-slate-950 font-extrabold text-lg rounded-2xl shadow-xl shadow-cyan-500/20 transition-all mx-auto flex items-center justify-center gap-3"
          >
            <PhoneCall className="w-6 h-6 fill-slate-950" />
            <span>CALL {partnerName.toUpperCase()}</span>
          </button>
          {!isPartnerOnline && (
            <p className="text-[11px] text-slate-500 mt-2">
              Partner is offline right now, but your call will ring their device when they open DuoCall.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/80">
          <button
            onClick={onOpenChamber}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4"
          >
            Test Camera, Microphone & Speaker first
          </button>
        </div>
      </div>

      {/* Feature Guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-200">Strictly 2 Accounts</p>
            <p className="text-slate-400">Private 1-on-1 line between Person 1 and Person 2.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-200">Instant Speed Dial</p>
            <p className="text-slate-400">One tap rings your partner's device with ringer sound.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
