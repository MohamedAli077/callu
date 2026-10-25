import { CallStats, ChatMessage } from '../types/calling';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteStreamEnded: () => void;
  onChatMessage: (msg: ChatMessage) => void;
  onPeerMediaStateChange: (state: { isMuted?: boolean; isVideoOff?: boolean; isSharingScreen?: boolean }) => void;
  onStatsUpdate: (stats: CallStats) => void;
  onSignalToSend: (signal: any) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private statsInterval: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private lastBytesReceived = 0;
  private lastBytesSent = 0;
  private lastTimestamp = 0;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  // Initialize RTCPeerConnection
  public async initConnection(iceServers?: RTCIceServer[]): Promise<RTCPeerConnection> {
    this.closeConnection();

    const config: RTCConfiguration = {
      iceServers: iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
    };

    this.pc = new RTCPeerConnection(config);
    this.remoteStream = new MediaStream();

    // ICE Candidate handler
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignalToSend({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Connection state change
    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.callbacks.onConnectionStateChange(this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          this.startStatsMonitoring();
        } else if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState)) {
          this.stopStatsMonitoring();
        }
      }
    };

    // Track handler (Incoming remote video/audio)
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (this.remoteStream && !this.remoteStream.getTracks().includes(track)) {
            this.remoteStream.addTrack(track);
          }
        });
        if (this.remoteStream) {
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Data Channel handler for callee
    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    // Add local stream tracks if already available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    return this.pc;
  }

  // Create DataChannel (as caller)
  public createDataChannel(): RTCDataChannel | null {
    if (!this.pc) return null;
    const channel = this.pc.createDataChannel('duocall-data', { ordered: true });
    this.setupDataChannel(channel);
    return channel;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
          this.callbacks.onChatMessage(data.message);
        } else if (data.type === 'media-state') {
          this.callbacks.onPeerMediaStateChange(data.state);
        }
      } catch (e) {
        console.error('Error parsing DataChannel message:', e);
      }
    };
  }

  // Set local media stream
  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    if (this.pc) {
      // Replace or add tracks
      const senders = this.pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          this.pc?.addTrack(track, stream);
        }
      });
    }
  }

  // WebRTC Signaling Handlers
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) await this.initConnection();
    this.createDataChannel();
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc!.setLocalDescription(offer);
    return offer;
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) await this.initConnection();
    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processPendingIceCandidates();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.processPendingIceCandidates();
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  private async processPendingIceCandidates() {
    if (!this.pc) return;
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding buffered candidate:', e);
        }
      }
    }
  }

  // Toggle Mute / Unmute
  public setAudioMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    }
    this.sendMediaStateUpdate({ isMuted: muted });
  }

  // Toggle Video Camera
  public setVideoDisabled(disabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = !disabled));
    }
    this.sendMediaStateUpdate({ isVideoOff: disabled });
  }

  // Screen Sharing
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = this.screenStream.getVideoTracks()[0];

      if (this.pc && videoTrack) {
        const senders = this.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack);
        }
      }

      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.sendMediaStateUpdate({ isSharingScreen: true });
      return this.screenStream;
    } catch (err) {
      console.error('Screen sharing error:', err);
      return null;
    }
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.localStream && this.pc) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const senders = this.pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      }
    }

    this.sendMediaStateUpdate({ isSharingScreen: false });
  }

  // Send Direct Chat Message via DataChannel or Signaling Fallback
  public sendChatMessage(msg: ChatMessage) {
    const payload = JSON.stringify({ type: 'chat', message: msg });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payload);
    } else {
      this.callbacks.onSignalToSend({
        type: 'chat-message',
        message: msg,
      });
    }
  }

  public sendMediaStateUpdate(state: { isMuted?: boolean; isVideoOff?: boolean; isSharingScreen?: boolean }) {
    const payload = JSON.stringify({ type: 'media-state', state });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payload);
    } else {
      this.callbacks.onSignalToSend({
        type: 'media-state',
        state,
      });
    }
  }

  // Local Recording (Records Call Stream)
  public startRecording(): boolean {
    if (!this.remoteStream && !this.localStream) return false;

    try {
      // Merge local and remote audio & video into a combined recording stream
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();

      if (this.localStream && this.localStream.getAudioTracks().length > 0) {
        const localSource = ctx.createMediaStreamSource(this.localStream);
        localSource.connect(dest);
      }
      if (this.remoteStream && this.remoteStream.getAudioTracks().length > 0) {
        const remoteSource = ctx.createMediaStreamSource(this.remoteStream);
        remoteSource.connect(dest);
      }

      const compositeStream = new MediaStream();
      dest.stream.getAudioTracks().forEach((t) => compositeStream.addTrack(t));

      if (this.remoteStream && this.remoteStream.getVideoTracks().length > 0) {
        compositeStream.addTrack(this.remoteStream.getVideoTracks()[0]);
      } else if (this.localStream && this.localStream.getVideoTracks().length > 0) {
        compositeStream.addTrack(this.localStream.getVideoTracks()[0]);
      }

      this.recordedChunks = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? { mimeType: 'video/webm;codecs=vp9,opus' }
        : { mimeType: 'video/webm' };

      this.mediaRecorder = new MediaRecorder(compositeStream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(1000);
      return true;
    } catch (err) {
      console.error('Failed to start media recording:', err);
      return false;
    }
  }

  public stopRecording(): Blob | null {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.recordedChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
    }) as any;
  }

  // Real-time Connection Quality Monitoring
  private startStatsMonitoring() {
    this.stopStatsMonitoring();
    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;

      try {
        const stats = await this.pc.getStats();
        let rttMs = 0;
        let jitterMs = 0;
        let packetsLost = 0;
        let bytesReceived = 0;
        let bytesSent = 0;
        let now = Date.now();
        let videoRes = '720p HD';
        let fps = 30;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rttMs = Math.round((report.currentRoundTripTime || 0) * 1000);
          } else if (report.type === 'inbound-rtp') {
            jitterMs = Math.round((report.jitter || 0) * 1000);
            packetsLost += report.packetsLost || 0;
            bytesReceived += report.bytesReceived || 0;
            if (report.frameWidth && report.frameHeight) {
              videoRes = `${report.frameWidth}x${report.frameHeight}`;
            }
            if (report.framesPerSecond) {
              fps = Math.round(report.framesPerSecond);
            }
          } else if (report.type === 'outbound-rtp') {
            bytesSent += report.bytesSent || 0;
          }
        });

        const timeDiff = (now - (this.lastTimestamp || now)) / 1000;
        let audioBitrate = 0;
        let videoBitrate = 0;

        if (timeDiff > 0) {
          audioBitrate = Math.round((((bytesReceived - this.lastBytesReceived) * 8) / timeDiff) / 1000);
          videoBitrate = Math.round((((bytesSent - this.lastBytesSent) * 8) / timeDiff) / 1000);
        }

        this.lastBytesReceived = bytesReceived;
        this.lastBytesSent = bytesSent;
        this.lastTimestamp = now;

        let connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
        if (rttMs > 250 || packetsLost > 20) {
          connectionQuality = 'poor';
        } else if (rttMs > 120 || packetsLost > 5) {
          connectionQuality = 'fair';
        } else if (rttMs > 60) {
          connectionQuality = 'good';
        }

        this.callbacks.onStatsUpdate({
          rttMs,
          jitterMs,
          packetsLost,
          audioBitrateKbps: Math.max(audioBitrate, 32),
          videoBitrateKbps: Math.max(videoBitrate, 450),
          videoResolution: videoRes,
          fps,
          connectionQuality,
        });
      } catch (err) {
        // ignore
      }
    }, 1500);
  }

  private stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // Cleanup
  public closeConnection() {
    this.stopStatsMonitoring();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.pendingIceCandidates = [];
  }
}
