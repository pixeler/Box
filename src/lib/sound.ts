/**
 * Synthesizes a crisp, rewarding "ding / chime" bell using Web Audio API.
 * Works instantly across all browsers without external audio files.
 */
let audioCtx: AudioContext | null = null;

export function playTaskDoneSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Dual-harmonic chime: High-pitch crystal bell (E6: 1318.5Hz -> B6: 1975.5Hz)
    const notes = [
      { freq: 1318.51, time: 0, duration: 0.35, peak: 0.24 },
      { freq: 1975.53, time: 0.06, duration: 0.55, peak: 0.3 },
    ];

    notes.forEach(({ freq, time, duration, peak }) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Fast attack, smooth exponential bell decay
      gainNode.gain.setValueAtTime(0.001, now + time);
      gainNode.gain.exponentialRampToValueAtTime(peak, now + time + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration + 0.02);
    });
  } catch (err) {
    console.warn('Audio playback not supported or blocked:', err);
  }
}
