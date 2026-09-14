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
    // 1. Crystal Harmonic Bell Chime (Apple-inspired pleasant achievement chime)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        // Ascending celestial crystal chord (C6, E6, G6, C7 shimmer)
        const chimePitches = [1046.5, 1318.5, 1567.98, 2093.0];
        
        chimePitches.forEach((freq, idx) => {
          const startTime = ctx.currentTime + idx * 0.065;
          const duration = 0.6;

          // Main fundamental tone (pure sine)
          const oscMain = ctx.createOscillator();
          const gainMain = ctx.createGain();
          oscMain.type = 'sine';
          oscMain.frequency.setValueAtTime(freq, startTime);

          // Soft shimmer overtone (2.75x crystal chime overtone)
          const oscShimmer = ctx.createOscillator();
          const gainShimmer = ctx.createGain();
          oscShimmer.type = 'sine';
          oscShimmer.frequency.setValueAtTime(freq * 2.75, startTime);

          // Gentle envelope: fast smooth attack (4ms) and natural bell decay
          gainMain.gain.setValueAtTime(0.0001, startTime);
          gainMain.gain.exponentialRampToValueAtTime(0.09, startTime + 0.006);
          gainMain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          gainShimmer.gain.setValueAtTime(0.0001, startTime);
          gainShimmer.gain.exponentialRampToValueAtTime(0.025, startTime + 0.004);
          gainShimmer.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

          oscMain.connect(gainMain);
          gainMain.connect(ctx.destination);
          oscShimmer.connect(gainShimmer);
          gainShimmer.connect(ctx.destination);

          oscMain.start(startTime);
          oscMain.stop(startTime + duration + 0.05);
          oscShimmer.start(startTime);
          oscShimmer.stop(startTime + duration + 0.05);
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
