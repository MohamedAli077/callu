import React, { useState } from 'react';
import { X, Copy, Check, QrCode, ShieldCheck } from 'lucide-react';
import { generateQRCodeSVG } from '../utils/qrCode';

interface QRCodeModalProps {
  lineId: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ lineId, onClose }) => {
  const [copied, setCopied] = useState(false);
  const callUrl = `${window.location.origin}?line=${lineId}`;
  const qrSvg = generateQRCodeSVG(callUrl, 220);

  const handleCopy = () => {
    navigator.clipboard.writeText(callUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Direct Call QR Link</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Render SVG QR Code */}
        <div
          className="flex justify-center my-2"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div>
          <span className="text-xs text-slate-400 block mb-1">Direct Line 6-Digit Code</span>
          <span className="text-2xl font-extrabold font-mono text-cyan-400 tracking-wider">
            {lineId}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Direct Link Copied!' : 'Copy Direct Link'}</span>
        </button>

        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Scan with camera to join this 1-on-1 line</span>
        </p>
      </div>
    </div>
  );
};
