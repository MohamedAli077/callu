import React from 'react';
import { Phone, ShieldCheck, History, SlidersHorizontal, Users } from 'lucide-react';
import { CallState } from '../types/calling';

interface HeaderProps {
  currentTab: 'line' | 'chamber' | 'history';
  onSelectTab: (tab: 'line' | 'chamber' | 'history') => void;
  callState: CallState;
  activeLineId?: string;
  onQuickLine: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  callState,
  activeLineId,
  onQuickLine,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Phone className="w-5 h-5" />
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('line');
            }}
            className="text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            DuoCall
          </a>
        </div>

        {/* Zone 2: Navigation Links (Single-line whitespace-nowrap) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => onSelectTab('line')}
            className={`flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'line' ? 'text-cyan-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1-on-1 Call Line</span>
          </button>

          <button
            onClick={() => onSelectTab('chamber')}
            className={`flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'chamber' ? 'text-cyan-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Device Test Chamber</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'history' ? 'text-cyan-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Call History</span>
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {activeLineId && callState !== 'idle' && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border border-slate-800 rounded-lg px-3 py-1.5 bg-slate-950/60 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>LINE: {activeLineId}</span>
            </div>
          )}

          <button
            onClick={onQuickLine}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-95 transition-all rounded-lg shadow-sm shadow-cyan-400/20 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Phone className="w-3.5 h-3.5 fill-slate-950" />
            <span>New Direct Call</span>
          </button>
        </div>
      </div>
    </header>
  );
};
