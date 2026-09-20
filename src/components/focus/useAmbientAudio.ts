import { useRef, useState, useCallback, useEffect } from 'react';

export type AmbientSoundType = 'none' | 'rain' | 'waves' | 'brown' | 'breeze';

export interface AmbientSoundOption {
  id: AmbientSoundType;
  label: string;
  icon: string;
  description: string;
}

export const AMBIENT_SOUND_OPTIONS: AmbientSoundOption[] = [
  { id: 'none', label: 'بدون صدا', icon: '🔇', description: 'سکوت مطلق' },
  { id: 'rain', label: 'باران آرام', icon: '🌧️', description: 'ریزش یکنواخت قطرات باران' },
  { id: 'waves', label: 'امواج دریا', icon: '🌊', description: 'جزر و مد آرام ساحل' },
  { id: 'brown', label: 'نویز قهوه‌ای', icon: '☕', description: 'فرکانس بم و عمیق برای تمرکز ADHD' },
  { id: 'breeze', label: 'نسیم طبیعت', icon: '🌲', description: 'وزش باد ملایم در میان درختان' },
];

export function useAmbientAudio() {
  const [currentSound, setCurrentSound] = useState<AmbientSoundType>('none');
  const [volume, setVolume] = useState<number>(0.5);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<{ stop?: () => void; disconnect: () => void }[]>([]);

  // Initialize or get existing AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();

      const masterGain = audioCtxRef.current.createGain();
      masterGain.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
      masterGain.connect(audioCtxRef.current.destination);
      masterGainRef.current = masterGain;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, [volume]);

  // Stop currently playing sound generators
  const stopCurrentGenerators = useCallback(() => {
    activeNodesRef.current.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {}
    });
    activeNodesRef.current = [];
  }, []);

  // Procedural Noise Generator Buffer
  const createNoiseBuffer = useCallback((ctx: AudioContext, seconds: number = 4) => {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }, []);

  // Synthesize specific ambient soundscapes
  const startSound = useCallback((sound: AmbientSoundType) => {
    stopCurrentGenerators();

    if (sound === 'none') {
      setIsPlaying(false);
      setCurrentSound('none');
      return;
    }

    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current) return;

    const noiseBuffer = createNoiseBuffer(ctx, 4);

    if (sound === 'brown') {
      // Deep brown noise: integrated white noise with steep lowpass
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const lowpass1 = ctx.createBiquadFilter();
      lowpass1.type = 'lowpass';
      lowpass1.frequency.setValueAtTime(280, ctx.currentTime);

      const lowpass2 = ctx.createBiquadFilter();
      lowpass2.type = 'lowpass';
      lowpass2.frequency.setValueAtTime(450, ctx.currentTime);

      const soundGain = ctx.createGain();
      soundGain.gain.setValueAtTime(1.8, ctx.currentTime);

      noiseSource.connect(lowpass1);
      lowpass1.connect(lowpass2);
      lowpass2.connect(soundGain);
      soundGain.connect(masterGainRef.current);

      noiseSource.start();
      activeNodesRef.current.push(noiseSource, lowpass1, lowpass2, soundGain);
    } else if (sound === 'rain') {
      // Gentle rain: pink-filtered noise with subtle high crackles
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1000, ctx.currentTime);
      bandpass.Q.setValueAtTime(0.5, ctx.currentTime);

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(200, ctx.currentTime);

      const soundGain = ctx.createGain();
      soundGain.gain.setValueAtTime(1.2, ctx.currentTime);

      noiseSource.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(soundGain);
      soundGain.connect(masterGainRef.current);

      noiseSource.start();
      activeNodesRef.current.push(noiseSource, highpass, bandpass, soundGain);
    } else if (sound === 'waves') {
      // Ocean waves: white noise modulated by a periodic wave swell (LFO)
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);

      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.3, ctx.currentTime);

      // LFO for wave rhythmic surge (every ~7 seconds)
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.14, ctx.currentTime); // ~7.1s cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.45, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(swellGain.gain);

      noiseSource.connect(filter);
      filter.connect(swellGain);
      swellGain.connect(masterGainRef.current);

      noiseSource.start();
      lfo.start();
      activeNodesRef.current.push(noiseSource, lfo, filter, lfoGain, swellGain);
    } else if (sound === 'breeze') {
      // Forest breeze: sweeping bandpass noise
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      // LFO for breeze variation
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(180, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const soundGain = ctx.createGain();
      soundGain.gain.setValueAtTime(1.4, ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(soundGain);
      soundGain.connect(masterGainRef.current);

      noiseSource.start();
      lfo.start();
      activeNodesRef.current.push(noiseSource, lfo, filter, lfoGain, soundGain);
    }

    setIsPlaying(true);
    setCurrentSound(sound);
  }, [createNoiseBuffer, getAudioContext, stopCurrentGenerators]);

  // Change volume
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(newVolume, audioCtxRef.current.currentTime);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentGenerators();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopCurrentGenerators]);

  return {
    currentSound,
    isPlaying,
    volume,
    setVolume: handleVolumeChange,
    startSound,
    stopSound: () => startSound('none'),
  };
}
