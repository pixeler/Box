import React, { useEffect, useRef, useState } from 'react';

interface MorningSkyBackgroundProps {
  className?: string;
  isDark?: boolean;
}

type SkyMode = 'smooth' | 'pixel';

const STORAGE_KEY = 'second_brain_morning_sky_mode';

// Very short, gentle Persian greetings (rendered in Nastaliq)
const PHRASES = [
  'صبح بخیر',
  'روزت زیبا',
  'نفس عمیق',
  'آرام و آهسته',
  'امروز روز توست',
  'سبک باش',
  'لبخند بزن',
  'یک قدم کوچک',
  'سپیده‌دم مبارک',
  'دلت آرام',
];

// Glyph ramp for the pixel / ASCII mode (light → dense)
const PIXEL_GLYPHS = ['·', '·', ':', '+', '*', '░', '▒', '▓'];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function paintSky(ctx: CanvasRenderingContext2D, W: number, H: number, isDark: boolean) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (isDark) {
    g.addColorStop(0, '#0b1938');
    g.addColorStop(0.5, '#27467f');
    g.addColorStop(0.82, '#7f7fb0');
    g.addColorStop(1, '#eaa98f');
  } else {
    g.addColorStop(0, '#3a8fe0');
    g.addColorStop(0.42, '#78baf0');
    g.addColorStop(0.78, '#c9e7fa');
    g.addColorStop(1, '#fff0d6');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft morning sun glow
  const sx = W * 0.78;
  const sy = H * 0.2;
  const r = Math.max(W, H) * 0.55;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  if (isDark) {
    sun.addColorStop(0, 'rgba(255, 205, 170, 0.55)');
    sun.addColorStop(0.35, 'rgba(255, 170, 150, 0.18)');
    sun.addColorStop(1, 'rgba(255, 170, 150, 0)');
  } else {
    sun.addColorStop(0, 'rgba(255, 248, 220, 0.85)');
    sun.addColorStop(0.3, 'rgba(255, 240, 200, 0.32)');
    sun.addColorStop(1, 'rgba(255, 240, 200, 0)');
  }
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

function makeCloudSprite(w: number, h: number, rng: () => number, isDark: boolean) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.floor(w));
  c.height = Math.max(2, Math.floor(h));
  const x = c.getContext('2d')!;

  const puffs = 8 + Math.floor(rng() * 5);
  const base = h * 0.74;

  for (let i = 0; i < puffs; i++) {
    const t = (i + 0.5) / puffs;
    const bump = Math.sin(Math.PI * t);
    const r = h * (0.17 + 0.3 * bump) * (0.8 + rng() * 0.4);
    const px = w * (0.09 + 0.82 * t) + (rng() - 0.5) * w * 0.03;
    const py = base - r * 0.55 - bump * h * 0.14 * (0.5 + rng() * 0.7);
    const g = x.createRadialGradient(px, py, r * 0.1, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.78)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }

  // Slightly flattened cumulus base
  const bg = x.createRadialGradient(w / 2, base, 0, w / 2, base, w * 0.45);
  bg.addColorStop(0, 'rgba(255,255,255,0.7)');
  bg.addColorStop(1, 'rgba(255,255,255,0)');
  x.save();
  x.translate(0, base);
  x.scale(1, 0.22);
  x.translate(0, -base);
  x.fillStyle = bg;
  x.beginPath();
  x.arc(w / 2, base, w * 0.45, 0, Math.PI * 2);
  x.fill();
  x.restore();

  // Volume shading: warm tops, cool blue-grey bellies
  x.globalCompositeOperation = 'source-atop';
  const shade = x.createLinearGradient(0, h * 0.2, 0, h * 0.82);
  if (isDark) {
    shade.addColorStop(0, 'rgba(255,214,196,0.35)');
    shade.addColorStop(0.5, 'rgba(190,190,230,0.35)');
    shade.addColorStop(1, 'rgba(70,80,135,0.6)');
  } else {
    shade.addColorStop(0, 'rgba(255,248,230,0.0)');
    shade.addColorStop(0.55, 'rgba(210,225,245,0.18)');
    shade.addColorStop(1, 'rgba(135,165,210,0.5)');
  }
  x.fillStyle = shade;
  x.fillRect(0, 0, w, h);

  return c;
}

interface CloudInstance {
  sprite: HTMLCanvasElement;
  y: number;
  x0: number;
  speed: number;
  alpha: number;
  bob: number;
  bobSpeed: number;
  phase: number;
}

interface PhraseInstance {
  text: string;
  x: number;
  y: number;
  size: number;
  born: number;
  life: number;
  vx: number;
  phase: number;
}

export const MorningSkyBackground: React.FC<MorningSkyBackgroundProps> = ({
  className = '',
  isDark = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<SkyMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'pixel' ? 'pixel' : 'smooth';
  });
  const modeRef = useRef<SkyMode>(mode);
  modeRef.current = mode;

  const handleModeChange = (next: SkyMode) => {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.min(window.devicePixelRatio || 1, 1.5);

    let W = 0;
    let H = 0;
    let animId = 0;
    let disposed = false;

    // Offscreen layers
    const skyCanvas = document.createElement('canvas');
    const cloudCanvas = document.createElement('canvas');
    const skyCtx = skyCanvas.getContext('2d')!;
    const cloudCtx = cloudCanvas.getContext('2d')!;

    // Pixel-mode helpers
    const pixelSkyCanvas = document.createElement('canvas'); // cached quantized sky mosaic
    const cloudSmall = document.createElement('canvas');
    const cloudSmallCtx = cloudSmall.getContext('2d', { willReadFrequently: true })!;
    let cols = 0;
    let rows = 0;
    let cw = 0;
    let ch = 0;

    let clouds: CloudInstance[] = [];
    const phrases: PhraseInstance[] = [];
    let lastPhraseSpawn = -999;
    let lastPhraseText = '';

    const buildPixelSky = () => {
      cw = 9 * scale;
      ch = 12 * scale;
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);

      const skySmall = document.createElement('canvas');
      skySmall.width = cols;
      skySmall.height = rows;
      const sctx = skySmall.getContext('2d', { willReadFrequently: true })!;
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(skyCanvas, 0, 0, cols, rows);
      const data = sctx.getImageData(0, 0, cols, rows).data;

      pixelSkyCanvas.width = W;
      pixelSkyCanvas.height = H;
      const pctx = pixelSkyCanvas.getContext('2d')!;
      const q = 11;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 4;
          const d = ((c + r) & 1) * 3; // tiny checker dither
          const R = Math.min(255, Math.round((data[i] + d) / q) * q);
          const G = Math.min(255, Math.round((data[i + 1] + d) / q) * q);
          const B = Math.min(255, Math.round((data[i + 2] + d) / q) * q);
          pctx.fillStyle = `rgb(${R},${G},${B})`;
          pctx.fillRect(Math.floor(c * cw), Math.floor(r * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
        }
      }

      cloudSmall.width = cols;
      cloudSmall.height = rows;
    };

    const buildScene = () => {
      const rect = container.getBoundingClientRect();
      W = Math.max(2, Math.floor(rect.width * scale));
      H = Math.max(2, Math.floor(rect.height * scale));
      canvas.width = W;
      canvas.height = H;
      skyCanvas.width = W;
      skyCanvas.height = H;
      cloudCanvas.width = W;
      cloudCanvas.height = H;

      paintSky(skyCtx, W, H, isDark);

      // Three parallax layers of cumulus clouds
      const rng = mulberry32(20260408);
      const layers = [
        { count: 4, minY: 0.1, maxY: 0.38, wMin: 0.28, wMax: 0.42, speed: 3.2, alpha: 0.55 },
        { count: 4, minY: 0.28, maxY: 0.6, wMin: 0.36, wMax: 0.55, speed: 6, alpha: 0.82 },
        { count: 3, minY: 0.56, maxY: 0.86, wMin: 0.5, wMax: 0.78, speed: 10, alpha: 1 },
      ];
      clouds = [];
      for (const L of layers) {
        for (let i = 0; i < L.count; i++) {
          const w = W * (L.wMin + rng() * (L.wMax - L.wMin));
          const h = w * (0.34 + rng() * 0.12);
          const sprite = makeCloudSprite(w, h, rng, isDark);
          clouds.push({
            sprite,
            y: H * (L.minY + rng() * (L.maxY - L.minY)) - h / 2,
            x0: rng() * (W + w),
            speed: L.speed * scale * (0.85 + rng() * 0.3),
            alpha: L.alpha,
            bob: (4 + rng() * 6) * scale,
            bobSpeed: 0.12 + rng() * 0.12,
            phase: rng() * Math.PI * 2,
          });
        }
      }

      buildPixelSky();
    };

    buildScene();

    const ro = new ResizeObserver(() => {
      if (!disposed) buildScene();
    });
    ro.observe(container);

    const drawClouds = (t: number) => {
      cloudCtx.clearRect(0, 0, W, H);
      for (const c of clouds) {
        const sw = c.sprite.width;
        const span = W + sw;
        const x = ((c.x0 + t * c.speed) % span) - sw;
        const y = c.y + Math.sin(t * c.bobSpeed + c.phase) * c.bob;
        cloudCtx.globalAlpha = c.alpha;
        cloudCtx.drawImage(c.sprite, x, y);
      }
      cloudCtx.globalAlpha = 1;
    };

    const drawPixelClouds = () => {
      ctx.drawImage(pixelSkyCanvas, 0, 0);

      cloudSmallCtx.clearRect(0, 0, cols, rows);
      cloudSmallCtx.imageSmoothingEnabled = true;
      cloudSmallCtx.imageSmoothingQuality = 'high';
      cloudSmallCtx.drawImage(cloudCanvas, 0, 0, cols, rows);
      const data = cloudSmallCtx.getImageData(0, 0, cols, rows).data;

      ctx.font = `700 ${(ch * 0.95).toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const gl = PIXEL_GLYPHS.length;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 4;
          const a = data[i + 3] / 255;
          if (a < 0.05) continue;

          const R = data[i];
          const G = data[i + 1];
          const B = data[i + 2];
          const px = Math.floor(c * cw);
          const py = Math.floor(r * ch);

          // Mosaic block of cloud colour
          ctx.fillStyle = `rgba(${R},${G},${B},${(a * 0.88).toFixed(2)})`;
          ctx.fillRect(px, py, Math.ceil(cw) + 1, Math.ceil(ch) + 1);

          // ASCII texture on top of the mosaic
          const idx = Math.min(gl - 1, Math.floor(a * gl));
          const lr = Math.round(255 - (255 - R) * 0.55);
          const lg = Math.round(255 - (255 - G) * 0.55);
          const lb = Math.round(255 - (255 - B) * 0.55);
          ctx.fillStyle = `rgba(${lr},${lg},${lb},${(0.35 + a * 0.55).toFixed(2)})`;
          ctx.fillText(PIXEL_GLYPHS[idx], px + cw / 2, py + ch / 2);
        }
      }
    };

    const spawnPhrase = (t: number) => {
      let text = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      if (text === lastPhraseText) {
        text = PHRASES[(PHRASES.indexOf(text) + 1) % PHRASES.length];
      }
      lastPhraseText = text;
      const size = Math.max(28 * scale, Math.min(W * 0.042, 58 * scale));
      phrases.push({
        text,
        x: W * (0.18 + Math.random() * 0.64),
        y: H * (0.1 + Math.random() * 0.46),
        size,
        born: t,
        life: 10 + Math.random() * 4,
        vx: (4 + Math.random() * 4) * scale, // drifts with the clouds
        phase: Math.random() * Math.PI * 2,
      });
      lastPhraseSpawn = t;
    };

    const drawPhrases = (t: number) => {
      if (phrases.length < 2 && t - lastPhraseSpawn > 4.5) spawnPhrase(t);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      (ctx as CanvasRenderingContext2D & { direction: string }).direction = 'rtl';

      for (let i = phrases.length - 1; i >= 0; i--) {
        const p = phrases[i];
        const age = t - p.born;
        if (age > p.life) {
          phrases.splice(i, 1);
          continue;
        }
        const fade = smoothstep(0, 3, age) * (1 - smoothstep(p.life - 3.2, p.life, age));
        if (fade <= 0.01) continue;

        const x = p.x + age * p.vx;
        const y = p.y + Math.sin(age * 0.5 + p.phase) * 6 * scale;

        ctx.font = `500 ${p.size.toFixed(0)}px NastaliqSky, 'Noto Nastaliq Urdu', serif`;
        ctx.save();
        ctx.globalAlpha = fade * 0.92;
        ctx.shadowColor = isDark ? 'rgba(10, 20, 50, 0.55)' : 'rgba(40, 95, 160, 0.4)';
        ctx.shadowBlur = 14 * scale;
        ctx.shadowOffsetY = 2 * scale;
        ctx.fillStyle = isDark ? 'rgba(255, 244, 232, 1)' : 'rgba(255, 255, 255, 1)';
        ctx.fillText(p.text, x, y);
        ctx.restore();
      }
      (ctx as CanvasRenderingContext2D & { direction: string }).direction = 'ltr';
    };

    const start = performance.now();
    let lastFrame = 0;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;
      if (now - lastFrame < 33) return; // ~30fps is plenty for slow drifting clouds
      lastFrame = now;

      const t = (now - start) / 1000;
      drawClouds(t);

      ctx.clearRect(0, 0, W, H);
      if (modeRef.current === 'pixel') {
        drawPixelClouds();
      } else {
        ctx.drawImage(skyCanvas, 0, 0);
        ctx.drawImage(cloudCanvas, 0, 0);
      }
      drawPhrases(t);
    };

    animId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [isDark]);

  const pillBtn = (active: boolean) =>
    `px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium ${
      active ? 'bg-white/25 text-white font-bold shadow-xs' : 'text-white/60 hover:text-white'
    }`;

  return (
    <div
      ref={containerRef}
      className={`morning-sky-container absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Smooth / Pixel-ASCII switcher */}
      <div
        className="absolute bottom-3 left-4 z-20 flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/25 backdrop-blur-md border border-white/15 text-[10px] text-white/85 shadow-md transition-opacity duration-300 opacity-60 hover:opacity-100 pointer-events-auto"
        dir="rtl"
      >
        <span className="text-[9px] px-1 text-white/50 font-medium select-none">نمایش:</span>
        <button
          type="button"
          onClick={() => handleModeChange('smooth')}
          className={pillBtn(mode === 'smooth')}
          title="آسمان نرم و عادی"
        >
          نرم
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('pixel')}
          className={pillBtn(mode === 'pixel')}
          title="حالت پیکسلی / اسکی"
        >
          پیکسلی
        </button>
      </div>
    </div>
  );
};
