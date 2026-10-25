import React, { useState } from 'react';
import { PhoneCall, QrCode, Copy, Check, ArrowRight, ShieldCheck, Lock, Sparkles, Users } from 'lucide-react';

interface LineManagerProps {
  onStartCall: (lineId: string, displayName: string, isHost: boolean) => void;
  onOpenChamber: () => void;
  onShowQR: (lineId: string) => void;
  defaultDisplayName: string;
}

export const LineManager: React.FC<LineManagerProps> = ({
  onStartCall,
  onOpenChamber,
  onShowQR,
  defaultDisplayName,
}) => {
  const [displayName, setDisplayName] = useState(defaultDisplayName || 'User ' + Math.floor(100 + Math.random() * 900));
  const [inputLineId, setInputLineId] = useState('');
  const [generatedLineId, setGeneratedLineId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate 6-digit random direct call line code
  const handleGenerateLine = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedLineId(randomCode);
    setInputLineId(randomCode);
  };

  const handleCopyLink = () => {
    const lineToCopy = generatedLineId || inputLineId;
    if (!lineToCopy) return;
    const callUrl = `${window.location.origin}?line=${lineToCopy}`;
    navigator.clipboard.writeText(callUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartHostCall = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLine = generatedLineId || inputLineId || Math.floor(100000 + Math.random() * 900000).toString();
    if (!displayName.trim()) return;
    onStartCall(targetLine, displayName.trim(), true);
  };

  const handleJoinCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLineId.trim() || !displayName.trim()) return;
    onStartCall(inputLineId.trim(), displayName.trim(), false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Intro Hero Section */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 rounded-full px-3 py-1 mb-4">
          <Lock className="w-3.5 h-3.5" />
          <span>Strictly Direct 1-on-1 Calling Engine · No Group Clutter</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight text-balance mb-4">
          Dedicated Calling for Just Two People.
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          No accounts, no third-party platforms, no WhatsApp. Create a direct private line between you and your partner with HD WebRTC audio/video.
        </p>
      </div>

      {/* Main Grid: Create Line or Enter Line */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Card 1: Create New 1-on-1 Line */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <PhoneCall className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 1: HOST</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Create a Private Line</h2>
            <p className="text-sm text-slate-400 mb-6">
              Generates a unique 6-digit line code. Share it with your call partner to connect instantly.
            </p>

            <form onSubmit={handleStartHostCall} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {!generatedLineId ? (
                <button
                  type="button"
                  onClick={handleGenerateLine}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Generate 6-Digit Line Code</span>
                </button>
              ) : (
                <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Your Direct Line Code:</span>
                    <span className="text-2xl font-extrabold font-mono text-cyan-400 tracking-wider">
                      {generatedLineId}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copied ? 'Link Copied!' : 'Copy Direct Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onShowQR(generatedLineId)}
                      className="py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                      title="Show QR Code for Mobile"
                    >
                      <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>QR</span>
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <span>Dial & Wait for Partner</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Join Existing Line */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 2: RECEIVER</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Join Partner's Line</h2>
            <p className="text-sm text-slate-400 mb-6">
              Enter the 6-digit code or link provided by your caller to enter the 1-on-1 line.
            </p>

            <form onSubmit={handleJoinCall} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sam"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter 6-Digit Line Code
                </label>
                <input
                  type="text"
                  value={inputLineId}
                  onChange={(e) => setInputLineId(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))}
                  placeholder="e.g. 842190"
                  maxLength={12}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base font-mono tracking-widest text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!inputLineId.trim()}
                className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <span>Connect to Partner Line</span>
                <PhoneCall className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <button
              onClick={onOpenChamber}
              className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4"
            >
              Test Camera, Mic & Audio Speaker first
            </button>
          </div>
        </div>
      </div>

      {/* Feature Guarantees Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-slate-200">Strict Max 2 Persons</p>
            <p className="text-slate-400">Lines auto-lock when 2 peers are connected.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-slate-200">Direct WebRTC HD</p>
            <p className="text-slate-400">Encrypted peer-to-peer audio & video media.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-slate-200">Zero App Installs</p>
            <p className="text-slate-400">Works directly in modern web browsers.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
