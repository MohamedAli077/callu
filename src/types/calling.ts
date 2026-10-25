export type CallState =
  | 'idle'           // Home / Line Manager
  | 'chamber'        // Device check & media setup
  | 'dialing'        // Outgoing call (waiting for partner to accept or join)
  | 'incoming'       // Partner is calling you!
  | 'connected'      // Direct 1-on-1 call active
  | 'ended';         // Call finished, summary shown

export interface PeerInfo {
  id: string;
  displayName: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSharingScreen?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  file?: {
    name: string;
    size: number;
    type: string;
    url: string;
  };
}

export interface CallStats {
  rttMs: number;
  jitterMs: number;
  packetsLost: number;
  audioBitrateKbps: number;
  videoBitrateKbps: number;
  videoResolution: string;
  fps: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CallLog {
  id: string;
  lineId: string;
  partnerName: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  callType: 'audio' | 'video';
  rating?: number;
  notes?: string;
}

export interface MediaDeviceOptions {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
}
