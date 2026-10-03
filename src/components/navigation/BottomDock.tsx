import React, { useRef, useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserIcon,
  Task01Icon,
  Calendar03Icon,
  HourglassIcon,
  Add01Icon,
} from '@hugeicons/core-free-icons';
import { useFocusTimer } from '../focus/FocusTimerContext';
import { toPersianDigits } from '@/lib/jalali';
import { useIsMobile } from '@/lib/device';
import { syncManager, type SyncState } from '@/lib/sync';
import { RiRefreshLine } from '@remixicon/react';
import { generatePillDisplacementMap } from '@/lib/glass';

export type ActiveTab = 'day' | 'todo' | 'focus' | 'notebook' | 'profile' | 'boxes';

interface BottomDockProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
  glassOpacity?: number;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  onOpenAdd,
  glassOpacity = 0.18,
}) => {
  const isMobile = useIsMobile();
  const { timerState, remainingMinutes } = useFocusTimer();
  const isFocusRunning = timerState === 'running' || timerState === 'paused';
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState().state);

  useEffect(() => {
    return syncManager.subscribe((st) => setSyncState(st));
  }, []);

  const dockRef = useRef<HTMLElement>(null);
  const filterId = 'figma-glass-dock-filter';
  const [dispMapUrl, setDispMapUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return generatePillDisplacementMap(390, 68, 27, 47);
    }
    return '';
  });

  useEffect(() => {
    // Skip SVG displacement canvas generation on mobile to boost performance and reduce CPU/GPU lag
    if (isMobile) return;
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const w = rect.width || 390;
    const h = rect.height || 68;
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
  }, [isMobile]);

  const refractionScale = 54; // Scaled for CSS displacement coordinates
  const dispersionOffset = 22; // Dispersion: RGB chromatic split

  return (
    <>
      {/* SVG Chromatic Dispersion & Refraction Filter (Desktop/Tablet only for max 60fps mobile) */}
      {!isMobile && dispMapUrl && (
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

              {/* 2. Green Channel Displaced (Base Refraction) */}
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
        className="figma-glass-dock relative flex items-center justify-between h-[68px] w-full max-w-[390px] px-2.5 py-1.5 rounded-full select-none pointer-events-auto transition-all duration-300 overflow-hidden"
        style={{
          // On mobile, use sleek hardware-accelerated CSS blur; on desktop use displacement filter
          backdropFilter: (!isMobile && dispMapUrl)
            ? `url(#${filterId}) blur(1.5px) saturate(180%)`
            : 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: (!isMobile && dispMapUrl)
            ? `url(#${filterId}) blur(1.5px) saturate(180%)`
            : 'blur(20px) saturate(180%)',
          // @ts-ignore
          '--glass-opacity': String(glassOpacity ?? 0.18),
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

        {/* گروه سمت راست: امروز و اینباکس با فاصله کمتر و گرد کامل */}
        <div className="flex items-center gap-1 shrink-0 z-10">
          {/* 1. اول از سمت راست: گزینه امروز (Today Button) - گرد کامل */}
          <button
            type="button"
            onClick={() => onTabChange('day')}
            className={`group/today w-[46px] h-[46px] aspect-square rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center text-xs font-semibold shrink-0 ${
              activeTab === 'day'
                ? 'liquid-glass-pill-active text-primary'
                : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
            }`}
            title="امروز"
          >
            <HugeiconsIcon
              icon={Calendar03Icon}
              size={22}
              strokeWidth={1.8}
              className={`transition-colors duration-200 ${
                activeTab === 'day' ? 'text-primary' : 'text-foreground/75'
              }`}
            />
          </button>

          {/* 2. دوم از راست: گزینه اینباکس (Inbox / To-do Button) - گرد کامل */}
          <button
            type="button"
            onClick={() => onTabChange('todo')}
            className={`group/inbox w-[46px] h-[46px] aspect-square rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center text-xs font-semibold shrink-0 ${
              activeTab === 'todo'
                ? 'liquid-glass-pill-active text-primary'
                : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
            }`}
            title="لیست کارها"
          >
            <HugeiconsIcon
              icon={Task01Icon}
              size={22}
              strokeWidth={1.8}
              className={`transition-colors duration-200 ${
                activeTab === 'todo' ? 'text-primary' : 'text-foreground/75'
              }`}
            />
          </button>
        </div>

        {/* 3. دکمه اضافه کردن (Add Button) - پر کننده فضای کانتینر (fill) */}
        <div className="relative z-10 group/add flex-1 h-[52px] mx-1 p-[1px] rounded-full overflow-hidden transition-all duration-200 active:scale-95 min-w-[70px]">
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
            className="relative z-10 w-full h-full px-3 py-2 rounded-full flex items-center justify-center gap-1.5 font-medium cursor-pointer select-none whitespace-nowrap theme-glass-pill theme-add-btn transition-colors duration-200"
            title="اضافه کردن (N)"
          >
            <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2.2} className="shrink-0" />
            <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
              اضافه کردن
            </span>
            <kbd className="hidden sm:inline-flex items-center justify-center text-[10px] font-bold text-current/80 bg-black/15 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono tracking-normal select-none shrink-0">
              N
            </kbd>
          </button>
        </div>

        {/* گروه سمت چپ: تمرکز و پروفایل با فاصله کمتر و گرد کامل */}
        <div className="flex items-center gap-1 shrink-0 z-10">
          {/* 4. چهارم: تمرکز (Focus Button) - گرد کامل */}
          <button
            type="button"
            onClick={() => onTabChange('focus')}
            className={`group/focus w-[46px] h-[46px] aspect-square rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center text-xs font-semibold shrink-0 ${
              activeTab === 'focus'
                ? 'liquid-glass-pill-active text-primary'
                : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
            }`}
            title={isFocusRunning ? `تمرکز (${toPersianDigits(remainingMinutes)} دقیقه باقی‌مانده)` : 'تمرکز'}
          >
            <div className="relative flex items-center justify-center">
              <HugeiconsIcon
                icon={HourglassIcon}
                size={22}
                strokeWidth={1.8}
                className={`transition-colors duration-200 ${
                  activeTab === 'focus' ? 'text-primary' : 'text-foreground/75'
                }`}
              />
              {isFocusRunning && (
                <span
                  className="absolute -top-1.5 -left-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center bg-rose-500 font-sans leading-none z-20 shadow-xs"
                >
                  {toPersianDigits(remainingMinutes)}
                </span>
              )}
            </div>
          </button>

          {/* 5. پنجم (سمت چپ): پروفایل و تنظیمات (Profile Button) - گرد کامل */}
          <button
            type="button"
            onClick={() => onTabChange(activeTab === 'profile' ? 'day' : 'profile')}
            className={`group/profile relative w-[46px] h-[46px] aspect-square rounded-full transition-colors duration-200 cursor-pointer flex items-center justify-center text-xs font-semibold shrink-0 ${
              activeTab === 'profile'
                ? 'liquid-glass-pill-active text-primary'
                : 'text-foreground/75 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 active:scale-95'
            }`}
            title="پروفایل و تنظیمات"
          >
            <div className="relative flex items-center justify-center">
              <HugeiconsIcon
                icon={UserIcon}
                size={22}
                strokeWidth={1.8}
                className={`transition-colors duration-200 ${
                  activeTab === 'profile' ? 'text-primary' : 'text-foreground/75'
                }`}
              />
              {syncState === 'syncing' && (
                <span className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-card border border-emerald-500/50 flex items-center justify-center shadow-xs">
                  <RiRefreshLine className="w-2.5 h-2.5 text-emerald-500 animate-spin" />
                </span>
              )}
            </div>
          </button>
        </div>
      </nav>
    </>
  );
};
