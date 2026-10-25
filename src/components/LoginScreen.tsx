import React, { useState } from 'react';
import { Lock, Phone, User, KeyRound, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; email: string; displayName: string }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('user1@duocall.com');
  const [password, setPassword] = useState('password123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPresetLogin = async (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('password123');
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: 'password123' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Icon */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-cyan-500/20">
            <Phone className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Private 1-on-1 Calling</h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Dedicated calling app exclusively for two users. Log in on Device 1 as Person 1 and Device 2 as Person 2.
          </p>
        </div>

        {/* Quick Preset Login Selector */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Account for this Device:</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPresetLogin('user1@duocall.com')}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold transition-all text-left flex flex-col gap-0.5 shadow-sm"
            >
              <span className="text-[10px] text-slate-400 font-normal">DEVICE A</span>
              <span>Person 1 (Mohamed)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPresetLogin('user2@duocall.com')}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold transition-all text-left flex flex-col gap-0.5 shadow-sm"
            >
              <span className="text-[10px] text-slate-400 font-normal">DEVICE B</span>
              <span>Person 2 (Partner)</span>
            </button>
          </div>
        </div>

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user1@duocall.com"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password123"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-400/20 transition-all flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Logging in...' : 'Sign In to Direct Line'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Strictly 2 Pre-Set Accounts · Encrypted P2P Media</span>
        </div>
      </div>
    </div>
  );
};
