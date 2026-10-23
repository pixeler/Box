import React, { useRef, useState, useEffect } from 'react';
import { WALLPAPER_LIST } from '../profile/ProfileView';
import { useIsMobile, useIsDesktop } from '@/lib/device';
import { generateLensDisplacementMap, generatePillDisplacementMap } from '@/lib/glass';
import { DynamicSkyBackground } from './DynamicSkyBackground';
import { MorningSkyBackground } from './MorningSkyBackground';

const isLiveSkyWallpaper = (id: string) => id === 'wafer-sky' || id === 'morning-live';

export type DesktopPosition = 'right' | 'center' | 'left';

interface AppContainerProps {
  wallpaper: string;
  glassBackground?: boolean;
  glassOpacity?: number;
  desktopPosition?: DesktopPosition;
  isCalendarExpanded?: boolean;
  isNotebookExpanded?: boolean;
  bottomDock?: React.ReactNode;
  /** Desktop-only (>=1024px): sidebar rendered inside the dark frame. Replaces bottomDock. */
  desktopSidebar?: React.ReactNode;
  /** Desktop-only: secondary sidebar (e.g. notebook tree navigation) next to main sidebar. */
  secondarySidebar?: React.ReactNode;
  /** Desktop-only: floating element in the canvas' top corner (e.g. glass search pill). */
  desktopCorner?: React.ReactNode;
  isDark?: boolean;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  wallpaper,
  glassBackground = false,
  glassOpacity = 0.18,
  desktopPosition = 'center',
  isCalendarExpanded = false,
  isNotebookExpanded = false,
  bottomDock,
  desktopSidebar,
  secondarySidebar,
  desktopCorner,
  isDark = false,
  children,
}) => {
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const useDesktopShell = isDesktop && Boolean(desktopSidebar);
  const cardRef = useRef<HTMLElement>(null);
  const filterId = 'figma-glass-card-filter';
  const [dispMapUrl, setDispMapUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return generatePillDisplacementMap(390, 68, 27, 47);
    }
    return '';
  });
  // Refraction map shaped like the card itself: the lens follows the window
  // edges instead of a stretched pill silhouette.
  const [lensMapUrl, setLensMapUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return generateLensDisplacementMap(460, 750, 26, 0.06, 64);
    }
    return '';
  });

  useEffect(() => {
    if (isMobile) return;
    const url = generatePillDisplacementMap(390, 68, 27, 47);
    setDispMapUrl(url);
  }, [isMobile]);

  // Regenerate the lens map whenever the floating window changes size.
  useEffect(() => {
    if (isMobile) return;
    const el = cardRef.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) return;
      const radius = rect.width >= 600 ? 24 : 26;
      const url = generateLensDisplacementMap(rect.width, rect.height, radius, 0.06, 64);
      if (url) setLensMapUrl(url);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    schedule();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isMobile]);

  const activeMap = lensMapUrl || dispMapUrl;
  // The window uses a thick lens with a wide chromatic split; the dock is much
  // smaller, so it needs a gentler scale or the whole pill smears.
  const cardRefractionScale = 98;
  const cardDispersionOffset = 40;
  const dockRefractionScale = 38;
  const dockDispersionOffset = 16;

  const currentItem = WALLPAPER_LIST.find((w) => w.id === wallpaper || wallpaper.startsWith(w.id)) || WALLPAPER_LIST[0];

  const getBackgroundStyle = (): React.CSSProperties => {
    // 1. Check for custom user-selected wallpaper (uploaded from computer or cached)
    if (
      wallpaper.startsWith('custom-image') ||
      wallpaper.startsWith('custom-unsplash') ||
      wallpaper.startsWith('data:') ||
      wallpaper.startsWith('http')
    ) {
      const cached =
        localStorage.getItem('second_brain_custom_wallpaper') ||
        localStorage.getItem('second_brain_cached_unsplash_wallpaper') ||
        (wallpaper.startsWith('data:') || wallpaper.startsWith('http') ? wallpaper : null);

      if (cached) {
        return {
          backgroundImage: `url('${cached}')`,
          backgroundColor: 'transparent',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };
      }
    }

    if (currentItem?.url) {
      return {
        backgroundImage: `url('${currentItem.url}')`,
        backgroundColor: 'transparent',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    }
    if (currentItem?.bgGradient) {
      return {
        backgroundImage: currentItem.bgGradient,
        backgroundColor: 'transparent',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (currentItem?.bgColor) {
      return {
        backgroundImage: 'none',
        backgroundColor: currentItem.bgColor,
      };
    }
    return {
      backgroundImage: 'none',
      backgroundColor: '#f8fafc',
    };
  };

  // Card sizing: the desktop shell sizes the window against the canvas (not the viewport)
  const cardSizeClass = useDesktopShell
    ? isCalendarExpanded
      ? 'w-full h-full max-w-[1600px]'
      : isNotebookExpanded
      ? 'w-full min-w-0 max-w-[1040px] h-[820px] max-h-full'
      : 'w-[460px] max-w-full h-[750px] max-h-full'
    : isCalendarExpanded
    ? 'sm:w-full h-dvh sm:h-[890px] sm:min-h-[890px] sm:max-h-[94vh]'
    : isNotebookExpanded
    ? 'sm:w-[calc(100vw-320px)] sm:min-w-[680px] sm:max-w-[1040px] h-dvh sm:h-[820px] sm:min-h-[780px] sm:max-h-[92vh]'
    : 'sm:w-[460px] sm:min-w-[460px] sm:max-w-[460px] h-dvh sm:h-[750px] sm:min-h-[750px] sm:max-h-[750px]';

  const svgFilters = !isMobile && activeMap && (
          <svg
            className="absolute w-0 h-0 pointer-events-none"
            aria-hidden="true"
            style={{ position: 'absolute', width: 0, height: 0 }}
          >
            <defs>
              <filter
                id="figma-glass-dock-filter"
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
                  scale={dockRefractionScale + dockDispersionOffset}
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
                  scale={dockRefractionScale}
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
                  scale={Math.max(10, dockRefractionScale - dockDispersionOffset)}
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

              {/* The card filter maps the lens 1:1 onto the window, so the
                  refraction ring lands on the visible edges instead of the
                  padded filter region. */}
              <filter
                id="figma-glass-card-filter"
                x="0"
                y="0"
                width="100%"
                height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feImage
                  href={activeMap}
                  result="DISPLACEMENT_MAP"
                  preserveAspectRatio="none"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="DISPLACEMENT_MAP"
                  scale={cardRefractionScale + cardDispersionOffset}
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
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="DISPLACEMENT_MAP"
                  scale={cardRefractionScale}
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
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="DISPLACEMENT_MAP"
                  scale={Math.max(10, cardRefractionScale - cardDispersionOffset)}
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
                <feGaussianBlur
                  in="RGB_COMBINED"
                  stdDeviation="0.25"
                  result="FINAL_GLASS"
                />
              </filter>
            </defs>
          </svg>
  );

  // Central App Card: full height/width on mobile; fixed 460×750 floating window on tablet/desktop
  const card = (
        <main
          ref={cardRef}
          id="app-main"
          className={`w-full text-card-foreground rounded-none sm:rounded-[24px] flex flex-col justify-between relative overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${cardSizeClass} ${
            glassBackground
              ? 'figma-glass-card'
              : 'bg-card border-0 sm:border border-border shadow-none sm:shadow-2xl sm:shadow-black/25'
          }`}
          style={
            glassBackground
              ? {
                  backdropFilter:
                    !isMobile && activeMap
                      ? `url(#${filterId}) blur(4px) saturate(175%) brightness(1.03)`
                      : 'blur(16px) saturate(180%)',
                  WebkitBackdropFilter:
                    !isMobile && activeMap
                      ? `url(#${filterId}) blur(4px) saturate(175%) brightness(1.03)`
                      : 'blur(16px) saturate(180%)',
                  // @ts-ignore
                  '--glass-opacity': String(glassOpacity ?? 0.18),
                }
              : undefined
          }
        >
          {/* Mobile Status Bar Area Fill - Seamlessly matches calendar header (bg-card) in light and dark mode, transparent in glass mode */}
          <div
            className={`w-full shrink-0 sm:hidden transition-colors duration-300 pointer-events-none z-10 ${
              glassBackground ? 'bg-transparent' : 'bg-card'
            }`}
            style={{ height: 'var(--safe-area-top)' }}
            aria-hidden="true"
          />

          {/* Specular sheen overlay for glass mode: a diagonal streak, a soft
              corner bloom and a bright rim so the pane reads as a physical slab. */}
          {glassBackground && (
            <>
              <div
                className="figma-glass-sheen absolute inset-0 sm:rounded-[24px] pointer-events-none z-0"
                style={{
                  background:
                    'linear-gradient(118deg, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0.14) 18%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.10) 84%, rgba(255,255,255,0.30) 100%)',
                }}
              />
              <div className="figma-glass-rim absolute inset-0 sm:rounded-[24px] pointer-events-none z-0" />
              <div
                className="figma-glass-bloom absolute inset-0 sm:rounded-[24px] pointer-events-none z-0"
                style={{
                  background:
                    'radial-gradient(120% 70% at 12% 0%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 55%), radial-gradient(90% 60% at 100% 100%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 60%)',
                }}
              />
            </>
          )}
          <div className="relative z-1 flex flex-col flex-1 h-full w-full justify-between overflow-hidden min-h-0">
            {children}
          </div>
        </main>
  );

  // ===== DESKTOP SHELL: dark frame → [sidebar | rounded wallpaper canvas → floating window] =====
  if (useDesktopShell) {
    return (
      <div className="desktop-shell h-dvh w-full flex overflow-hidden font-sans" dir="rtl">
        {desktopSidebar}
        {secondarySidebar}

        <div className="flex-1 min-w-0 h-full py-2 pl-2">
          <div
            className="desktop-canvas relative w-full h-full rounded-[22px] overflow-hidden isolate"
            style={isLiveSkyWallpaper(wallpaper) ? undefined : { ...getBackgroundStyle(), backgroundAttachment: 'scroll' }}
          >
            {/* Dynamic Interactive Cloud & Sky Background */}
            {wallpaper === 'wafer-sky' && <DynamicSkyBackground isDark={isDark} />}
            {wallpaper === 'morning-live' && <MorningSkyBackground isDark={isDark} />}

            {svgFilters}

            {desktopCorner && <div className="absolute top-4 left-4 z-30">{desktopCorner}</div>}

            <div
              className={`absolute inset-0 flex items-center transition-all duration-500 ease-out z-10 ${
                isCalendarExpanded
                  ? 'pt-16 pb-6 px-6'
                  : isNotebookExpanded
                  ? 'py-8 px-6 sm:px-8'
                  : 'py-16 px-10'
              } ${
                isCalendarExpanded
                  ? 'justify-center'
                  : desktopPosition === 'right'
                  ? 'justify-start'
                  : desktopPosition === 'left'
                  ? 'justify-end'
                  : 'justify-center'
              }`}
            >
              {card}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== MOBILE / TABLET: original centered card + floating bottom dock =====
  return (
    <div
      style={isLiveSkyWallpaper(wallpaper) ? undefined : getBackgroundStyle()}
      className={`min-h-screen w-full flex items-center p-0 sm:p-4 md:px-10 font-sans transition-all duration-500 ease-out relative overflow-hidden ${
        isCalendarExpanded
          ? 'justify-center'
          : desktopPosition === 'right'
          ? 'justify-center sm:justify-start'
          : desktopPosition === 'left'
          ? 'justify-center sm:justify-end'
          : 'justify-center'
      }`}
      dir="rtl"
    >
      {/* Dynamic Interactive Cloud & Sky Background */}
      {wallpaper === 'wafer-sky' && <DynamicSkyBackground isDark={isDark} />}
      {wallpaper === 'morning-live' && <MorningSkyBackground isDark={isDark} />}

      <div className={`flex flex-col items-center w-full relative z-1 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isCalendarExpanded
          ? 'sm:w-[98vw] sm:max-w-[1600px]'
          : isNotebookExpanded
          ? 'sm:w-[calc(100vw-320px)] sm:min-w-[680px] sm:max-w-[1040px]'
          : 'sm:w-[460px] sm:min-w-[460px] sm:max-w-[460px]'
      }`}>
        {/* SVG Chromatic Dispersion & Refraction Filter for Main Card (Desktop/Tablet) */}
        {svgFilters}
        {card}
      </div>

      {/* Floating Bottom Navigation Dock: Fixed 40px from browser bottom on desktop */}
      {bottomDock && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-none flex justify-center"
          style={{
            bottom: isMobile ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '40px',
          }}
        >
          {bottomDock}
        </div>
      )}
    </div>
  );
};
