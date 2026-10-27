import React, { useRef, useEffect, useState } from 'react';

interface DynamicSkyBackgroundProps {
  className?: string;
  isDark?: boolean;
}

type AsciiOverlayMode = 'hybrid' | 'ascii' | 'mosaic';

// Curated ASCII & Mosaic glyph ramps
const ASCII_CHARS = ['·', ':', '+', '*', '%', '#', '@', 'W'];
const MOSAIC_CHARS = ['·', ':', '░', '▒', '▓', '█'];
const HYBRID_CHARS = ['·', ':', '+', '░', '*', '▒', '#', '▓'];

export const DynamicSkyBackground: React.FC<DynamicSkyBackgroundProps> = ({
  className = '',
  isDark = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLDivElement>(null);

  const [overlayMode, setOverlayMode] = useState<AsciiOverlayMode>(() => {
    return (localStorage.getItem('second_brain_sky_ascii_mode') as AsciiOverlayMode) || 'hybrid';
  });

  const handleModeChange = (mode: AsciiOverlayMode) => {
    setOverlayMode(mode);
    localStorage.setItem('second_brain_sky_ascii_mode', mode);
  };

  const mouseRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    normX: number;
    normY: number;
    smoothNormX: number;
    smoothNormY: number;
  }>({
    x: 0,
    y: 0,
    active: false,
    normX: 0,
    normY: 0,
    smoothNormX: 0,
    smoothNormY: 0,
  });

  // Track pointer for gentle interactive parallax & hover response
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mouseRef.current.x = x;
      mouseRef.current.y = y;
      mouseRef.current.active = true;
      mouseRef.current.normX = (x / rect.width - 0.5) * 2;
      mouseRef.current.normY = (y / rect.height - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.normX = 0;
      mouseRef.current.normY = 0;
    };

    const targetEl = containerRef.current || window;
    targetEl.addEventListener('pointermove', handlePointerMove as any, { passive: true });
    targetEl.addEventListener('pointerleave', handlePointerLeave as any, { passive: true });

    return () => {
      targetEl.removeEventListener('pointermove', handlePointerMove as any);
      targetEl.removeEventListener('pointerleave', handlePointerLeave as any);
    };
  }, []);

  // Animation loop: Realistic clouds staying in place with soft left/right sway & reactive ASCII overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    // Grid cell size for the ASCII / mosaic matrix overlay
    const charW = 10;
    const charH = 13;

    // The character matrix is static artwork, so it is painted once into an
    // offscreen canvas and re-used until the size or palette changes.
    let glyphLayer: HTMLCanvasElement | null = null;
    let glyphDirty = true;

    let lastDraw = 0;
    // Slow cloud drift: 30fps is visually identical and halves the painting cost.
    const frameInterval = 1000 / 30;

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      canvas.width = width;
      canvas.height = height;
      glyphDirty = true;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    let simTime = 0;

    // Cloud presence definition (anchored realistic clouds along bottom-left, center-bottom, bottom-right)
    // Clouds stay in place, swaying gently left and right
    const cloudZones = [
      // 1. Grand Left/Bottom Cumulus Mass
      { originX: 0.22, originY: 0.76, rx: 0.38, ry: 0.28, strength: 1.0, swayPhase: 0 },
      // 2. Grand Right/Bottom Cumulus Mass
      { originX: 0.82, originY: 0.74, rx: 0.35, ry: 0.32, strength: 0.95, swayPhase: 1.8 },
      // 3. Central Rising Billow Dome
      { originX: 0.52, originY: 0.84, rx: 0.42, ry: 0.26, strength: 0.9, swayPhase: 0.9 },
      // 4. Left Mid-Sky Soft Floating Crown
      { originX: 0.12, originY: 0.58, rx: 0.22, ry: 0.18, strength: 0.75, swayPhase: 2.5 },
      // 5. Right Mid-Sky Soft Floating Crown
      { originX: 0.92, originY: 0.54, rx: 0.24, ry: 0.19, strength: 0.8, swayPhase: 3.2 },
    ];

    const paintGlyphs = (
      target: CanvasRenderingContext2D,
      simTime: number,
      totalOffsetX: number,
      totalOffsetY: number
    ) => {
      const glyphs =
        overlayMode === 'mosaic'
          ? MOSAIC_CHARS
          : overlayMode === 'ascii'
          ? ASCII_CHARS
          : HYBRID_CHARS;
      const glyphCount = glyphs.length;

      target.clearRect(0, 0, width, height);
      target.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace';
      target.textAlign = 'center';
      target.textBaseline = 'middle';

      const cols = Math.ceil(width / charW);
      const rows = Math.ceil(height / charH);

      // Render ASCII / Mosaic Overlay across the cloud surfaces
      for (let r = 0; r < rows; r++) {
        const y = r * charH + charH * 0.5;
        const normY = y / height;

        // Optimization: clouds are mainly in lower 65% of screen
        if (normY < 0.28) continue;

        for (let c = 0; c < cols; c++) {
          const x = c * charW + charW * 0.5;
          const normX = x / width;

          // Calculate cloud presence at this cell
          let cloudPresence = 0;
          let edgeGlow = 0;

          for (const zone of cloudZones) {
            // Sway zone center softly with harmonic phase
            const zoneSwayX = (Math.sin(simTime * 0.22 + zone.swayPhase) * 10 + totalOffsetX) / width;
            const zoneSwayY = (Math.cos(simTime * 0.18 + zone.swayPhase) * 5 + totalOffsetY) / height;

            const zx = zone.originX + zoneSwayX;
            const zy = zone.originY + zoneSwayY;

            const dx = (normX - zx) / zone.rx;
            let dy = (normY - zy) / zone.ry;

            // Cumulus shape: flatter base at the bottom
            if (dy > 0) dy *= 1.4;

            // Organic subtle turbulence
            const turb =
              Math.sin(normX * 16 + simTime * 0.15) * 0.05 +
              Math.cos(normY * 18 + zone.swayPhase) * 0.04;

            const dist = Math.hypot(dx, dy) + turb;

            if (dist < 1.0) {
              const val = (1.0 - dist) * zone.strength;
              cloudPresence += val;

              // Cloud crest highlight (near top edge)
              if (dy < 0 && dist > 0.4 && dist < 0.95) {
                edgeGlow = Math.max(edgeGlow, 1.0 - Math.abs(dist - 0.7) * 3);
              }
            }
          }

          // If no cloud here, leave clear sky visible
          if (cloudPresence < 0.06) continue;

          const clampedPresence = Math.min(1.0, cloudPresence);

          // Map presence to glyph
          const glyphIdx = Math.min(
            glyphCount - 1,
            Math.floor(clampedPresence * 0.85 * glyphCount)
          );
          const char = glyphs[glyphIdx];

          // Color & transparency, matched to the painterly clouds underneath
          let rVal: number;
          let gVal: number;
          let bVal: number;
          let alpha: number;

          if (isDark) {
            if (edgeGlow > 0.5) {
              rVal = 250; gVal = 252; bVal = 255;
              alpha = 0.85;
            } else if (clampedPresence > 0.5) {
              rVal = 195; gVal = 210; bVal = 230;
              alpha = 0.6;
            } else {
              rVal = 135; gVal = 150; bVal = 175;
              alpha = 0.35;
            }
          } else {
            if (edgeGlow > 0.4) {
              rVal = 255; gVal = 253; bVal = 240;
              alpha = 0.92;
            } else if (clampedPresence > 0.55) {
              rVal = 250; gVal = 244; bVal = 225;
              alpha = 0.72;
            } else if (clampedPresence > 0.25) {
              rVal = 235; gVal = 228; bVal = 205;
              alpha = 0.52;
            } else {
              rVal = 185; gVal = 205; bVal = 198;
              alpha = 0.32;
            }
          }

          target.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha.toFixed(2)})`;
          target.fillText(char, x, y);
        }
      }
    };

    const buildGlyphLayer = () => {
      if (width <= 0 || height <= 0) return;
      const layer = document.createElement('canvas');
      layer.width = width;
      layer.height = height;
      const layerCtx = layer.getContext('2d');
      if (!layerCtx) return;
      paintGlyphs(layerCtx, 0, 0, 0);
      glyphLayer = layer;
      glyphDirty = false;
    };

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;
      if (time - lastDraw < frameInterval) return;
      lastDraw = time;

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      simTime += dt;

      // Mouse smooth interpolation
      const mouse = mouseRef.current;
      mouse.smoothNormX += (mouse.normX - mouse.smoothNormX) * 0.04;
      mouse.smoothNormY += (mouse.normY - mouse.smoothNormY) * 0.04;

      // SOFT IN-PLACE SWAY: a very slow breathing drift
      const swayX = Math.sin(simTime * 0.25) * 11 + Math.sin(simTime * 0.11) * 4;
      const swayY = Math.cos(simTime * 0.2) * 5 + Math.sin(simTime * 0.09) * 2;

      // Combined sway + smooth mouse parallax
      const totalOffsetX = swayX - mouse.smoothNormX * 12;
      const totalOffsetY = swayY - mouse.smoothNormY * 8;

      // Apply the gentle in-place sway to the realistic base wallpaper image
      if (bgImgRef.current) {
        bgImgRef.current.style.transform = `translate3d(${totalOffsetX.toFixed(2)}px, ${totalOffsetY.toFixed(2)}px, 0) scale(1.05)`;
      }

      if (!glyphLayer || glyphDirty) buildGlyphLayer();

      ctx.clearRect(0, 0, width, height);
      if (glyphLayer) {
        // One blit per frame; the glyphs themselves were already rasterized.
        ctx.drawImage(glyphLayer, totalOffsetX * 0.7, totalOffsetY * 0.7);
      }

      // Subtle atmospheric mouse halo over the clouds
      if (mouse.active) {
        const mx = mouse.x;
        const my = mouse.y;
        const radGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        if (isDark) {
          radGrad.addColorStop(0, 'rgba(200, 225, 255, 0.08)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          radGrad.addColorStop(0, 'rgba(255, 250, 230, 0.14)');
          radGrad.addColorStop(0.5, 'rgba(255, 245, 215, 0.05)');
          radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, width, height);
      }
    };


    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [overlayMode, isDark]);

  return (
    <div
      ref={containerRef}
      className={`dynamic-sky-container absolute inset-0 overflow-hidden pointer-events-auto select-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. REALISTIC CLOUD BASE LAYER:
          High-res painterly cumulus clouds & sky blue atmosphere.
          Firmly anchored at bottom/corners, gently swaying left and right in place. */}
      <div
        ref={bgImgRef}
        className="absolute -inset-6 bg-cover bg-bottom sm:bg-center transition-transform duration-700 ease-out will-change-transform"
        style={{
          backgroundImage: "url('/wallpapers/wafer-sky.jpg')",
          backgroundColor: '#8fa89e',
        }}
      />

      {/* 2. Theme Atmospheric Tint */}
      <div
        className={`absolute inset-0 transition-colors duration-500 pointer-events-none ${
          isDark
            ? 'bg-gradient-to-b from-slate-950/40 via-slate-900/20 to-slate-950/45 mix-blend-multiply'
            : 'bg-gradient-to-b from-transparent via-transparent to-amber-50/10'
        }`}
      />

      {/* 3. REAL-TIME ASCII & MOSAIC TEXTURE OVERLAY:
          Blends directly onto the clouds with delicate retro character matrix. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 4. Micro-Dither Grid Texture: Authentic retro stippling */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(#000 1px, transparent 1px), radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '4px 4px',
          backgroundPosition: '0 0, 2px 2px',
        }}
      />

      {/* 5. Discreet Glassmorphic Mode Pill Switcher in the Canvas corner */}
      <div
        className="absolute bottom-3 left-4 z-20 flex items-center gap-1 px-1.5 py-1 rounded-full bg-black/25 dark:bg-black/40 backdrop-blur-md border border-white/15 text-[10px] text-white/85 shadow-md transition-opacity duration-300 opacity-60 hover:opacity-100"
        dir="rtl"
        title="حالت نمایش بافت ابرهای اسکی / موزاییکی"
      >
        <span className="text-[9px] px-1 text-white/50 font-medium select-none">
          بافت:
        </span>
        <button
          type="button"
          onClick={() => handleModeChange('hybrid')}
          className={`px-2 py-0.5 rounded-full transition cursor-pointer font-medium ${
            overlayMode === 'hybrid'
              ? 'bg-white/25 text-white font-bold shadow-xs'
              : 'text-white/60 hover:text-white'
          }`}
          title="ترکیبی (اسکی + موزاییک روی ابرهای واقع‌گرایانه)"
        >
          ترکیبی
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('ascii')}
          className={`px-2 py-0.5 rounded-full transition cursor-pointer font-medium ${
            overlayMode === 'ascii'
              ? 'bg-white/25 text-white font-bold shadow-xs'
              : 'text-white/60 hover:text-white'
          }`}
          title="کدهای اسکی کلاسیک"
        >
          Ascii
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('mosaic')}
          className={`px-2 py-0.5 rounded-full transition cursor-pointer font-medium ${
            overlayMode === 'mosaic'
              ? 'bg-white/25 text-white font-bold shadow-xs'
              : 'text-white/60 hover:text-white'
          }`}
          title="موزاییک و پیکسل"
        >
          موزاییک
        </button>
      </div>
    </div>
  );
};
