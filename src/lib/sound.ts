/**
 * Synthesizes a tactile, crisp "pencil crossing-out stroke on paper" sound
 * using dynamic friction sweep, graphite rasping resonance, and a subtle tactile paper contact body.
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

    const sampleRate = audioCtx.sampleRate;
    const duration = 0.19; // 190ms confident, swift pencil cross-out stroke
    const buffer = audioCtx.createBuffer(1, Math.round(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    // Synthesize a decisive single pencil line drawn across paper
    // Starts with a firm graphite attack, sweeping friction, and smooth lift-off
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const white = Math.random() * 2 - 1;

      // Swift, energetic pencil stroke envelope (0.005s to 0.175s)
      let env = 0;
      if (t >= 0.005 && t <= 0.175) {
        const p = (t - 0.005) / 0.17;
        // Natural hand speed curve: swift acceleration and smooth deceleration
        env = Math.sin(Math.pow(p, 0.75) * Math.PI);
        // Add tiny micro-friction teeth for paper grain feel
        const microJitter = 0.88 + 0.12 * Math.sin(t * 1400);
        env *= microJitter;
      }

      data[i] = white * env;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    // Dynamic bandpass filter: sweeps from 3100Hz down to 2000Hz to emulate hand motion across paper
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(3100, audioCtx.currentTime);
    bandpass.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.17);
    bandpass.Q.setValueAtTime(1.6, audioCtx.currentTime);

    // High-shelf filter to emphasize crisp graphite bite
    const highShelf = audioCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.setValueAtTime(3400, audioCtx.currentTime);
    highShelf.gain.setValueAtTime(3.2, audioCtx.currentTime);

    // Subtle tactile low-frequency paper body impulse at lead contact
    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(210, audioCtx.currentTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.04);
    bodyGain.gain.setValueAtTime(0.09, audioCtx.currentTime);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(audioCtx.destination);
    bodyOsc.start();
    bodyOsc.stop(audioCtx.currentTime + 0.045);

    const mainGain = audioCtx.createGain();
    mainGain.gain.setValueAtTime(0.24, audioCtx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(highShelf);
    highShelf.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    noiseSource.start();
  } catch (err) {
    console.warn('Task done pencil sound error:', err);
  }
}

/**
 * Synthesizes a tactile, subtle "pencil writing / scribbling on paper" sound
 * using bandpass-filtered noise bursts and friction resonance via Web Audio API.
 */
export function playPencilWriteSound() {
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

    const sampleRate = audioCtx.sampleRate;
    const duration = 0.16; // 160ms brief stroke
    const buffer = audioCtx.createBuffer(1, Math.round(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    // Synthesize two quick graphite scribbles on textured paper
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const white = Math.random() * 2 - 1;

      // Stroke 1 (0.008s - 0.05s) & Stroke 2 (0.065s - 0.145s)
      let env = 0;
      if (t >= 0.008 && t <= 0.05) {
        const p = (t - 0.008) / 0.042;
        env = Math.sin(p * Math.PI) * 0.75;
      } else if (t >= 0.065 && t <= 0.145) {
        const p = (t - 0.065) / 0.08;
        env = Math.sin(p * Math.PI) * 0.95;
      }

      data[i] = white * env;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    // Bandpass filter centered at paper friction resonance (~2500Hz)
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2500, audioCtx.currentTime);
    bandpass.Q.setValueAtTime(1.9, audioCtx.currentTime);

    // High-shelf filter to give subtle paper grain bite
    const highShelf = audioCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.setValueAtTime(3200, audioCtx.currentTime);
    highShelf.gain.setValueAtTime(2.5, audioCtx.currentTime);

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(highShelf);
    highShelf.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseSource.start();
  } catch (err) {
    console.warn('Pencil audio playback error:', err);
  }
}
