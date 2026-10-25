import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, Sparkles, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface DeviceSetupChamberProps {
  onProceedToCall: (stream: MediaStream, displayName: string) => void;
  defaultDisplayName: string;
}

export const DeviceSetupChamber: React.FC<DeviceSetupChamberProps> = ({
  onProceedToCall,
  defaultDisplayName,
}) => {
  const [displayName, setDisplayName] = useState(defaultDisplayName || 'Caller');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [] });

  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Request media devices & setup preview
  const initMedia = async (audioDeviceId?: string, videoDeviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      setPermissionError(null);
      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : { width: 1280, height: 720 },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Enumerate devices for dropdowns
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioIns = allDevices.filter((d) => d.kind === 'audioinput');
      const videoIns = allDevices.filter((d) => d.kind === 'videoinput');

      setDevices({ audioInputs: audioIns, videoInputs: videoIns });

      if (!selectedAudioInput && audioIns.length > 0) {
        setSelectedAudioInput(audioIns[0].deviceId);
      }
      if (!selectedVideoInput && videoIns.length > 0) {
        setSelectedVideoInput(videoIns[0].deviceId);
      }

      // Setup Web Audio VU meter for microphone check
      setupAudioMeter(newStream);
    } catch (err: any) {
      console.error('Media permission or device error:', err);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Microphone or Camera access was denied in your browser settings.'
          : 'Could not access media devices. Please check camera and mic connection.'
      );
    }
  };

  const setupAudioMeter = (mediaStream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Audio meter setup warning:', e);
    }
  };

  useEffect(() => {
    initMedia();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = isMicMuted));
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = isVideoDisabled));
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  const handleTestSpeaker = () => {
    setIsPlayingTestSound(true);
    soundEffects.playTestSound();
    setTimeout(() => setIsPlayingTestSound(false), 800);
  };

  const handleProceed = () => {
    if (stream) {
      onProceedToCall(stream, displayName);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Device Test Chamber
        </h1>
        <p className="text-sm text-slate-400">
          Verify your camera quality, test your microphone audio levels, and check speaker volume before dialing.
        </p>
      </div>

      {permissionError && (
        <div className="mb-6 p-4 bg-red-950/60 border border-red-800 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{permissionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Camera Preview Box */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-4">
          <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                isVideoDisabled ? 'hidden' : 'block'
              }`}
            />

            {isVideoDisabled && (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium text-slate-400">Camera Off</span>
              </div>
            )}

            {/* In-Preview Overlay Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="bg-slate-950/80 backdrop-blur-md text-xs font-mono text-cyan-400 px-2.5 py-1 rounded-md border border-slate-800">
                PREVIEW 720p HD
              </span>
            </div>

            {/* Mic Level Indicator Bar */}
            <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-lg p-2 flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-300 shrink-0">
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mic Level:</span>
              </div>
              <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-75"
                  style={{ width: `${isMicMuted ? 0 : audioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Toggle Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition-all ${
                isMicMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
              }`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-cyan-400" />}
              <span>{isMicMuted ? 'Mic Muted' : 'Mic Active'}</span>
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3 rounded-xl border font-semibold text-xs flex items-center gap-2 transition-all ${
                isVideoDisabled
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
              }`}
            >
              {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-cyan-400" />}
              <span>{isVideoDisabled ? 'Camera Off' : 'Camera On'}</span>
            </button>

            <button
              onClick={handleTestSpeaker}
              className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingTestSound ? 'text-emerald-400 animate-bounce' : 'text-slate-400'}`} />
              <span>{isPlayingTestSound ? 'Testing Audio...' : 'Test Speaker'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Device Selectors & Display Name */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Chamber Configuration</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Microphone Device</label>
              <select
                value={selectedAudioInput}
                onChange={(e) => {
                  setSelectedAudioInput(e.target.value);
                  initMedia(e.target.value, selectedVideoInput);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {devices.audioInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Camera Device</label>
              <select
                value={selectedVideoInput}
                onChange={(e) => {
                  setSelectedVideoInput(e.target.value);
                  initMedia(selectedAudioInput, e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {devices.videoInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleProceed}
            disabled={!stream}
            className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Enter Call Line</span>
          </button>
        </div>
      </div>
    </div>
  );
};
