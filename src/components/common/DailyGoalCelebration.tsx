import React, { useEffect, useRef } from 'react';
import { type ThemeId, THEMES } from '../../lib/theme';

interface DailyGoalCelebrationProps {
  originX: number; // Viewport X coordinate of the goal pill
  originY: number; // Viewport Y coordinate of the goal pill
  theme?: ThemeId;
  onComplete: () => void;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  flipAngle: number;
  flipSpeed: number;
  opacity: number;
  type: 'strip' | 'streamer' | 'sparkle';
  curveOffset: number;
  wobbleSpeed: number;
  phase: number;
  friction: number;
}

function getThemeCelebrationPalette(themeId?: ThemeId): string[] {
  let baseColors: string[];

  switch (themeId) {
    case 'miku-dark':
      baseColors = ['#39c5bb', '#00f0ff', '#ff2a85', '#70e000', '#38bdf8', '#f43f5e', '#a7f3d0'];
      break;
    case 'caffeine-dark':
      baseColors = ['#d48b46', '#e09f53', '#f6d8ae', '#f59e0b', '#c27803', '#fbbf24', '#fef3c7', '#e76f51'];
      break;
    case 'rose-pine-dark':
    case 'rose-pine-dawn':
      baseColors = ['#eb6f92', '#9ccfd8', '#f6c177', '#c4a7e7', '#ea9a97', '#3e8fb0', '#f43f5e', '#fbbf24'];
      break;
    case 'github-dark':
    case 'github-light':
      baseColors = ['#58a6ff', '#3fb950', '#bc8cff', '#f0883e', '#ff7b72', '#2dd4bf', '#38bdf8', '#e3b341'];
      break;
    case 'dracula-dark':
      baseColors = ['#bd93f9', '#ff79c6', '#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff5555', '#a855f7'];
      break;
    case 'nord-dark':
    case 'nord-light':
      baseColors = ['#88c0d0', '#81a1c1', '#a3be8c', '#ebcb8b', '#bf616a', '#b48ead', '#8fbcbb', '#5e81ac'];
      break;
    case 'tokyo-night':
      baseColors = ['#7aa2f7', '#7dcfff', '#bb9af7', '#ff9e64', '#9ece6a', '#f7768e', '#e0af68', '#2ac3de'];
      break;
    case 'retro-keyboard':
      baseColors = ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#e63946', '#f39c12', '#d97706'];
      break;
    case 'sky-light':
      baseColors = ['#0284c7', '#38bdf8', '#0ea5e9', '#34d399', '#facc15', '#fb7185', '#60a5fa', '#3b82f6'];
      break;
    case 'solarized-light':
      baseColors = ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900'];
      break;
    case 'one-dark':
    case 'one-light':
      baseColors = ['#61afef', '#98c379', '#e5c07b', '#e06c75', '#c678dd', '#56b6c2', '#d19a66', '#4fa6ed'];
      break;
    default:
      baseColors = ['#f97316', '#10b981', '#0ea5e9', '#f43f5e', '#fbbf24', '#3b82f6', '#a855f7', '#2dd4bf'];
      break;
  }

  // Prepend the theme's official accent color if available
  const themeConfig = THEMES.find((t) => t.id === themeId);
  if (themeConfig?.previewColors?.accent) {
    return [themeConfig.previewColors.accent, ...baseColors];
  }

  return baseColors;
}

export const DailyGoalCelebration: React.FC<DailyGoalCelebrationProps> = ({
  originX,
  originY,
  theme,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. Joyful Celebration Fanfare with Confetti Popper (Celebratory sound instead of a bell chime)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // A. Confetti Popper "Pop!" (Filtered celebratory noise impulse)
        try {
          const bufferSize = Math.floor(ctx.sampleRate * 0.09);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;

          const popFilter = ctx.createBiquadFilter();
          popFilter.type = 'lowpass';
          popFilter.frequency.setValueAtTime(900, now);
          popFilter.frequency.exponentialRampToValueAtTime(80, now + 0.09);

          const popGain = ctx.createGain();
          popGain.gain.setValueAtTime(0.22, now);
          popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

          whiteNoise.connect(popFilter);
          popFilter.connect(popGain);
          popGain.connect(ctx.destination);
          whiteNoise.start(now);
        } catch {}

        // B. Triumphant Celebration Brass Fanfare (Ta-da-da-daaa! 🎺✨)
        // Arpeggiated festive major fanfare notes ending in a vibrant sustained chord
        const fanfare = [
          { freq: 523.25, time: 0.03, dur: 0.12, gain: 0.10 }, // C5
          { freq: 659.25, time: 0.13, dur: 0.12, gain: 0.11 }, // E5
          { freq: 783.99, time: 0.23, dur: 0.14, gain: 0.13 }, // G5
          { freq: 1046.50, time: 0.35, dur: 0.75, gain: 0.16 }, // C6 (Finale)
          { freq: 523.25, time: 0.35, dur: 0.75, gain: 0.09 }, // C5 harmony
          { freq: 659.25, time: 0.35, dur: 0.75, gain: 0.09 }, // E5 harmony
        ];

        fanfare.forEach((note) => {
          const noteStart = now + note.time;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          // Warm brass timbre: triangle base + warm low-passed sawtooth
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(note.freq, noteStart);

          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(note.freq, noteStart);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2200, noteStart);
          filter.frequency.exponentialRampToValueAtTime(1000, noteStart + note.dur);

          noteGain.gain.setValueAtTime(0.001, noteStart);
          noteGain.gain.exponentialRampToValueAtTime(note.gain, noteStart + 0.025);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.dur);

          const sawGain = ctx.createGain();
          sawGain.gain.value = 0.28;

          osc1.connect(filter);
          osc2.connect(sawGain);
          sawGain.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(ctx.destination);

          osc1.start(noteStart);
          osc1.stop(noteStart + note.dur + 0.05);
          osc2.start(noteStart);
          osc2.stop(noteStart + note.dur + 0.05);
        });
      }
    } catch {}

    // 2. Visual Canvas Confetti with Theme Palette and Wide Spread
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces: ConfettiPiece[] = [];
    const totalCount = 110;
    const palette = getThemeCelebrationPalette(theme);

    for (let i = 0; i < totalCount; i++) {
      // 360-degree radial explosion
      const angle = Math.random() * Math.PI * 2;
      
      // Tiered speed distribution for wide, expansive screen coverage
      const randTier = Math.random();
      let speed: number;
      if (randTier < 0.45) {
        speed = 13 + Math.random() * 15; // High velocity wide burst across the screen
      } else if (randTier < 0.8) {
        speed = 7 + Math.random() * 7;   // Mid-field spread
      } else {
        speed = 3 + Math.random() * 4;   // Near-field floating shimmer
      }

      const color = palette[i % palette.length];

      // Type distribution: 60% rectangular fluttering strips, 25% wavy ribbon streamers, 15% sparkles
      const randType = Math.random();
      const type: ConfettiPiece['type'] = randType < 0.6 ? 'strip' : randType < 0.85 ? 'streamer' : 'sparkle';

      // Friction customized per particle for organic depth
      const friction = 0.958 + Math.random() * 0.016;

      pieces.push({
        x: originX + (Math.random() - 0.5) * 20,
        y: originY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        width: type === 'strip' ? 8 + Math.random() * 5 : type === 'streamer' ? 5 + Math.random() * 3 : 6 + Math.random() * 4,
        height: type === 'strip' ? 16 + Math.random() * 12 : type === 'streamer' ? 32 + Math.random() * 24 : 6 + Math.random() * 4,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        flipAngle: Math.random() * Math.PI * 2,
        flipSpeed: 0.08 + Math.random() * 0.16,
        opacity: 1,
        type,
        curveOffset: (Math.random() - 0.5) * 24,
        wobbleSpeed: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        friction,
      });
    }

    let animationFrameId: number;
    const startTime = performance.now();
    const duration = 2700; // 2.7 seconds duration for majestic float

    const render = (time: number) => {
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];

        // Decelerate with customized air friction
        p.vx *= p.friction;
        p.vy *= p.friction;

        // Gentle floating drift with zero downward gravity
        p.x += p.vx + Math.sin(elapsed * 0.0025 + p.phase) * 0.6;
        p.y += p.vy + Math.cos(elapsed * 0.0025 + p.phase) * 0.5;

        p.rotation += p.rotationSpeed;
        p.flipAngle += p.flipSpeed;

        // Smooth gradual fade out starting at 1500ms
        if (elapsed > 1500) {
          p.opacity = Math.max(0, 1 - (elapsed - 1500) / 1200);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // 3D paper flutter perspective simulation
        const flipScale = Math.cos(p.flipAngle);
        ctx.scale(flipScale, 1);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.type === 'strip') {
          // Rectangular fluttering paper slip
          ctx.beginPath();
          ctx.roundRect(-p.width / 2, -p.height / 2, p.width, p.height, 2);
          ctx.fill();
        } else if (p.type === 'streamer') {
          // Curved wavy festive ribbon streamer
          ctx.beginPath();
          ctx.lineWidth = p.width;
          ctx.lineCap = 'round';
          ctx.moveTo(0, -p.height / 2);
          ctx.quadraticCurveTo(p.curveOffset, 0, 0, p.height / 2);
          ctx.stroke();
        } else {
          // 4-point diamond sparkle
          ctx.beginPath();
          const s = p.width;
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.4, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.4, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [originX, originY, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
    />
  );
};
