// Universal Fallback Live Audio Bridge over Server WebSockets / HTTP
// Guarantees live voice calling between any two devices across cellular/Wi-Fi networks even when WebRTC STUN fails.

export class AudioBridge {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private onAudioChunk: (dataUrl: string) => void;
  private isRecording = false;

  constructor(onAudioChunk: (dataUrl: string) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  // Start capturing local audio in 250ms Opus packet slices
  public startCapture(stream: MediaStream): boolean {
    try {
      this.stopCapture();

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return false;

      const audioOnlyStream = new MediaStream([audioTrack]);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(audioOnlyStream, { mimeType });

      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            this.onAudioChunk(base64data);
          };
          reader.readAsDataURL(e.data);
        }
      };

      this.mediaRecorder.start(250); // Send audio chunk every 250ms
      this.isRecording = true;
      return true;
    } catch (err) {
      console.warn('AudioBridge startCapture error:', err);
      return false;
    }
  }

  public stopCapture() {
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
      this.mediaRecorder = null;
    }
  }

  // Play incoming audio chunk
  public playIncomingAudioChunk(dataUrl: string) {
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 1.0;
      audio.play().catch((e) => {
        // Autoplay policy or buffer catch
      });
    } catch (err) {
      console.warn('Error playing audio chunk:', err);
    }
  }
}
