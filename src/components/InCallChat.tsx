import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Paperclip, FileText, User } from 'lucide-react';
import { ChatMessage } from '../types/calling';

interface InCallChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, file?: { name: string; size: number; type: string; url: string }) => void;
  onClose: () => void;
  currentUserId: string;
}

export const InCallChat: React.FC<InCallChatProps> = ({
  messages,
  onSendMessage,
  onClose,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onSendMessage(`Shared file: ${file.name}`, {
        name: file.name,
        size: file.size,
        type: file.type,
        url: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-80 sm:w-96 h-full bg-slate-900 border-l border-slate-800 flex flex-col justify-between shadow-2xl z-30">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-bold text-white">Direct 1-on-1 In-Call Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-4">
            Send instant messages or files to your call partner directly during this call session.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-2 text-[11px] text-slate-500 font-mono">
                  {msg.text}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-0.5 px-1 font-mono">
                  {isMe ? 'You' : msg.senderName} · {msg.timestamp}
                </span>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    isMe
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>

                  {msg.file && (
                    <a
                      href={msg.file.url}
                      download={msg.file.name}
                      className={`mt-2 flex items-center gap-2 p-2 rounded-lg border text-xs underline font-mono ${
                        isMe ? 'bg-cyan-600/30 border-cyan-400 text-slate-950' : 'bg-slate-900 border-slate-700 text-cyan-400'
                      }`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate max-w-[150px]">{msg.file.name}</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-cyan-400 p-2 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Share File"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-2 rounded-xl disabled:opacity-40 transition-all shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
