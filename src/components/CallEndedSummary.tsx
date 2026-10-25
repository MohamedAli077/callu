import React, { useState } from 'react';
import { Phone, Star, Clock, Calendar, Check, RotateCcw, FileText, ArrowRight } from 'lucide-react';
import { CallLog } from '../types/calling';

interface CallEndedSummaryProps {
  callLog: CallLog;
  onRedial: () => void;
  onClose: () => void;
  onSaveRatingAndNotes: (rating: number, notes: string) => void;
}

export const CallEndedSummary: React.FC<CallEndedSummaryProps> = ({
  callLog,
  onRedial,
  onClose,
  onSaveRatingAndNotes,
}) => {
  const [rating, setRating] = useState<number>(callLog.rating || 5);
  const [notes, setNotes] = useState<string>(callLog.notes || '');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const handleSave = () => {
    onSaveRatingAndNotes(rating, notes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        {/* End Icon */}
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center shadow-inner">
          <Phone className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Direct Call Ended</h2>
          <p className="text-sm text-slate-400">1-on-1 Call session with {callLog.partnerName}</p>
        </div>

        {/* Call Summary Metrics Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 text-left">
            <Clock className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-slate-500 block">Duration</span>
              <span className="text-sm font-bold text-white">{formatDuration(callLog.durationSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left">
            <Calendar className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <span className="text-slate-500 block">Line Code</span>
              <span className="text-sm font-bold text-white">{callLog.lineId}</span>
            </div>
          </div>
        </div>

        {/* Rating Stars */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">Rate Call Quality</label>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 text-amber-400 hover:scale-110 transition-transform"
              >
                <Star className={`w-6 h-6 ${star <= rating ? 'fill-amber-400' : 'text-slate-700'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Optional Call Notes */}
        <div className="text-left space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Private Call Notes (Saved locally)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add key takeaways or notes from this 1-on-1 call..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : null}
            <span>{isSaved ? 'Notes Saved!' : 'Save Notes'}</span>
          </button>

          <button
            onClick={onRedial}
            className="flex-1 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Redial Line</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4 block mx-auto"
        >
          Return to Line Manager
        </button>
      </div>
    </div>
  );
};
