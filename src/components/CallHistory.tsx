import React from 'react';
import { History, Phone, Clock, Star, Trash2, RotateCcw, FileText, Lock } from 'lucide-react';
import { CallLog } from '../types/calling';

interface CallHistoryProps {
  logs: CallLog[];
  onRedial: (lineId: string, partnerName: string) => void;
  onClearHistory: () => void;
}

export const CallHistory: React.FC<CallHistoryProps> = ({ logs, onRedial, onClearHistory }) => {
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            <span>1-on-1 Call History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Private log of your previous direct peer calling sessions.
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-400 hover:text-red-400 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-500 mx-auto flex items-center justify-center mb-4">
            <Phone className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Previous Calls</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            When you complete 1-on-1 calls with your partner, your call logs, duration, and private notes will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 text-slate-950 font-bold flex items-center justify-center shrink-0">
                  <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-white text-base">
                    {log.partnerName.substring(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{log.partnerName}</h3>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 rounded px-2 py-0.5">
                      LINE: {log.lineId}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {formatDuration(log.durationSeconds)}
                    </span>
                    <span>·</span>
                    <span>{formatDate(log.startTime)}</span>
                  </div>

                  {log.notes && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 mt-2 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{log.notes}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {log.rating && (
                  <div className="flex items-center text-amber-400 text-xs gap-0.5 mr-2">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span className="font-bold">{log.rating}.0</span>
                  </div>
                )}

                <button
                  onClick={() => onRedial(log.lineId, log.partnerName)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Redial</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
