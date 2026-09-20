import React, { useRef, useState, useEffect, useId } from 'react';
import {
  RiUser3Line,
  RiInboxLine,
  RiCalendarEventLine,
  RiHourglass2Line,
} from '@remixicon/react';

export type ActiveTab = 'day' | 'todo' | 'focus' | 'notebook' | 'profile' | 'boxes';

interface BottomDockProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
}


/**
 * Generates an accurate normal displacement map for a pill glass shape
 * based on Figma parameters: Refraction (68), Depth (27), Splay (47).
 */
function generatePillDisplacementMap(width: number, height: number, depth: number = 27, splay: number = 47): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const w = Math.max(Math.round(width), 160);
  const h = Math.max(Math.round(height), 48);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  const radius = h / 2;
  const rimThickness = Math.max(8, Math.min(radius, (depth / 100) * radius + (splay / 100) * 12));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      let dx = 0;
      const dy = y - h / 2;
      if (x < radius) {
        dx = x - radius;
      } else if (x > w - radius) {
        dx = x - (w - radius);
      } else {
        dx = 0;
      }

      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const distFromEdge = radius - distFromCenter;

      if (distFromEdge <= 0) {
        // Outside pill boundary
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
      } else if (distFromEdge < rimThickness) {
        // Glass rim refraction zone
        const t = distFromEdge / rimThickness; // 0 at outer edge, 1 at inner flat region
        // Sine wave normal derivative for smooth optical curvature
        const normalMagnitude = Math.sin((1 - t) * Math.PI * 0.5);

        const len = distFromCenter > 0.001 ? distFromCenter : 1;
        const nx = -(dx / len) * normalMagnitude;
        const ny = -(dy / len) * normalMagnitude;

        data[idx] = Math.max(0, Math.min(255, Math.round(128 + nx * 127)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + ny * 127)));
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else {
        // Crystal clear flat center
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  onOpenAdd,
}) => {

  const dockRef = useRef<HTMLElement>(null);
  const rawId = useId();
  const filterId = `figma-glass-${rawId.replace(/:/g, '')}`;
  const [dispMapUrl, setDispMapUrl] = useState<string>('');

  // Figma Exact Settings:
  // Refraction: 68
  // Depth: 27
  // Dispersion: 53
  // Frost: 1 (blur 1.5px)
  // Splay: 47
  // Light: -45°, 80%

  useEffect(() => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const w = rect.width || 270;
    const h = rect.height || 60;
    const url = generatePillDisplacementMap(w, h, 27, 47);
    setDispMapUrl(url);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDispMapUrl(generatePillDisplacementMap(width, height, 27, 47));
        }
      }
    });

    observer.observe(dockRef.current);
    return () => observer.disconnect();
  }, []);

  const refractionScale = 48; // Scaled for CSS displacement coordinates
  const dispersionOffset = 14; // Dispersion: 53 -> RGB chromatic split

  return (
    <>
      {/* SVG Chromatic Dispersion & Refraction Filter */}
      {dispMapUrl && (
        <svg
          className="absolute w-0 h-0 pointer-events-none"
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, height: 0 }}
        >
          <defs>
            <filter
              id={filterId}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={dispMapUrl}
                result="DISPLACEMENT_MAP"
                preserveAspectRatio="none"
              />

              {/* 1. Red Channel Displaced (Refraction + Dispersion) */}
              <feDisplacementMap
                in="SourceGraphic"
                in2="DISPLACEMENT_MAP"
                scale={refractionScale + dispersionOffset}
                xChannelSelector="R"
                yChannelSelector="G"
                result="RED_DISPLACED"
              />
              <feColorMatrix
                in="RED_DISPLACED"
                type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="RED_CHANNEL"
              />

              {/* 2. Green Channel Displaced (Base Refraction: 68) */}
              <feDisplacementMap
                in="SourceGraphic"
                in2="DISPLACEMENT_MAP"
                scale={refractionScale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="GREEN_DISPLACED"
              />
              <feColorMatrix
                in="GREEN_DISPLACED"
                type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="GREEN_CHANNEL"
              />

              {/* 3. Blue Channel Displaced (Refraction - Dispersion) */}
              <feDisplacementMap
                in="SourceGraphic"
                in2="DISPLACEMENT_MAP"
                scale={Math.max(10, refractionScale - dispersionOffset)}
                xChannelSelector="R"
                yChannelSelector="G"
                result="BLUE_DISPLACED"
              />
              <feColorMatrix
                in="BLUE_DISPLACED"
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="BLUE_CHANNEL"
              />

              {/* 4. Combine RGB with screen blend */}
              <feBlend
                in="GREEN_CHANNEL"
                in2="BLUE_CHANNEL"
                mode="screen"
                result="GB_COMBINED"
              />
              <feBlend
                in="RED_CHANNEL"
                in2="GB_COMBINED"
                mode="screen"
                result="RGB_COMBINED"
              />

              {/* 5. Frost: 1 (Subtle Gaussian Blur) */}
              <feGaussianBlur
                in="RGB_COMBINED"
                stdDeviation="0.4"
                result="FINAL_GLASS"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* Main Glass Navigation Dock */}
      <nav
        ref={dockRef}
        className="figma-glass-dock relative flex items-center gap-1.5 h-[60px] px-2 py-1 rounded-full select-none pointer-events-auto transition-all duration-300 overflow-hidden"
        style={{
          // Filter + Frost 1 + Specular Lighting (-45°, 80%)
          backdropFilter: dispMapUrl
            ? `url(#${filterId}) blur(1.5px) saturate(180%)`
            : 'blur(3px) saturate(180%)',
          WebkitBackdropFilter: dispMapUrl
            ? `url(#${filterId}) blur(1.5px) saturate(180%)`
            : 'blur(3px) saturate(180%)',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.02) 50%, rgba(255, 255, 255, 0.08) 100%)',
          boxShadow: `
            inset 1px 1px 2px 0px rgba(255, 255, 255, 0.8),
            inset -0.5px -0.5px 1.5px 0px rgba(255, 255, 255, 0.35),
            0 8px 24px -4px rgba(0, 0, 0, 0.08),
            0 2px 6px -1px rgba(0, 0, 0, 0.04)
          `,
          border: '1px solid rgba(255, 255, 255, 0.65)',
        }}
        dir="rtl"
        aria-label="منوی ناوبری اصلی"
      >
        {/* Pure colorless specular sheen overlay (-45° light at 80%) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.08) 100%)',
          }}
        />

        {/* 1. اول از سمت راست: گزینه امروز (Today Button) */}
        <button
          type="button"
          onClick={() => onTabChange('day')}
          className={`group/today h-11 px-3.5 rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold relative z-10 ${
            activeTab === 'day'
              ? 'liquid-glass-pill-active text-primary'
              : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
          }`}
          title="امروز"
        >
          <RiCalendarEventLine
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'day' ? 'text-primary' : 'text-foreground/75'
            }`}
          />
        </button>

        {/* 2. دوم از راست: گزینه اینباکس (Inbox / To-do Button) */}
        <button
          type="button"
          onClick={() => onTabChange('todo')}
          className={`group/inbox h-11 px-3.5 rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold relative z-10 ${
            activeTab === 'todo'
              ? 'liquid-glass-pill-active text-primary'
              : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
          }`}
          title="لیست کارها"
        >
          <RiInboxLine
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'todo' ? 'text-primary' : 'text-foreground/75'
            }`}
          />
        </button>

        {/* 3. سوم (وسط): دکمه اضافه کردن (Add Button) */}
        <div className="relative z-10 group/add p-[1px] rounded-full overflow-hidden transition-colors duration-200 active:scale-95 shrink-0 w-auto min-w-fit">
          {/* Rotating gradient stroke animation - Dark mode only */}
          <div
            className="hidden dark:block absolute -inset-[150%] rounded-full opacity-0 group-hover/add:opacity-100 transition-opacity duration-300 pointer-events-none animate-spin-slow"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)) 80deg, rgba(255,255,255,0.85) 180deg, hsl(var(--primary)) 280deg, transparent 360deg)',
            }}
          />

          <button
            type="button"
            onClick={onOpenAdd}
            className="relative z-10 h-[48px] px-5 py-3 rounded-full flex items-center justify-center gap-2 font-medium cursor-pointer select-none whitespace-nowrap theme-glass-pill theme-add-btn transition-colors duration-200 shrink-0 w-auto min-w-fit"
            title="اضافه کردن (N)"
          >
            <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">
              اضافه کردن
            </span>
            <kbd className="hidden sm:inline-flex items-center justify-center text-[10px] font-bold text-current/80 bg-black/15 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono tracking-normal select-none shrink-0">
              N
            </kbd>
          </button>
        </div>

        {/* 4. چهارم: تمرکز (Focus Button) */}
        <button
          type="button"
          onClick={() => onTabChange('focus')}
          className={`group/focus h-11 px-3.5 rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold relative z-10 ${
            activeTab === 'focus'
              ? 'liquid-glass-pill-active text-primary'
              : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
          }`}
          title="تمرکز"
        >
          <RiHourglass2Line
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'focus' ? 'text-primary' : 'text-foreground/75'
            }`}
          />
        </button>

        {/* 5. پنجم (سمت چپ): پروفایل و تنظیمات (Profile Button) */}
        <button
          type="button"
          onClick={() => onTabChange(activeTab === 'profile' ? 'day' : 'profile')}
          className={`group/profile h-11 px-3.5 rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold relative z-10 ${
            activeTab === 'profile'
              ? 'liquid-glass-pill-active text-primary'
              : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
          }`}
          title="پروفایل و تنظیمات"
        >
          <RiUser3Line
            className={`w-5 h-5 transition-colors duration-200 ${
              activeTab === 'profile' ? 'text-primary' : 'text-foreground/75'
            }`}
          />
        </button>
      </nav>
    </>
  );
};

