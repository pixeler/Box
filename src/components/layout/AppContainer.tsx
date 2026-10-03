import React, { useRef, useState, useEffect } from 'react';
import { WALLPAPER_LIST } from '../profile/ProfileView';
import { useIsMobile } from '@/lib/device';
import { generatePillDisplacementMap } from '@/lib/glass';

export type DesktopPosition = 'right' | 'center' | 'left';

interface AppContainerProps {
  wallpaper: string;
  glassBackground?: boolean;
  glassOpacity?: number;
  desktopPosition?: DesktopPosition;
  bottomDock?: React.ReactNode;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  wallpaper,
  glassBackground = false,
  glassOpacity = 0.18,
  desktopPosition = 'center',
  bottomDock,
  children,
}) => {
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLElement>(null);
  const filterId = 'figma-glass-card-filter';
  const [dispMapUrl, setDispMapUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return generatePillDisplacementMap(390, 68, 27, 47);
    }
    return '';
  });

  useEffect(() => {
    if (isMobile) return;
    const url = generatePillDisplacementMap(390, 68, 27, 47);
    setDispMapUrl(url);
  }, [isMobile]);

  const refractionScale = 54; // Scaled for CSS displacement coordinates
  const dispersionOffset = 22; // Dispersion: strong vivid RGB chromatic split

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

  return (
    <div
      style={getBackgroundStyle()}
      className={`min-h-screen w-full flex items-center p-0 sm:p-4 md:px-10 font-sans ${
        desktopPosition === 'right'
          ? 'justify-center sm:justify-start'
          : desktopPosition === 'left'
          ? 'justify-center sm:justify-end'
          : 'justify-center'
      }`}
      dir="rtl"
    >
      <div className="flex flex-col items-center w-full sm:w-[460px] sm:min-w-[460px] sm:max-w-[460px] relative">
        {/* SVG Chromatic Dispersion & Refraction Filter for Main Card (Desktop/Tablet) */}
        {!isMobile && dispMapUrl && (
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

              <filter
                id="figma-glass-card-filter"
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
                  stdDeviation="0.4"
                  result="FINAL_GLASS"
                />
              </filter>
            </defs>
          </svg>
        )}

        {/* Central App Card: full height (h-dvh) and full width on mobile; strictly 460px width and 750px height on desktop */}
        <main
          ref={cardRef}
          id="app-main"
          className={`w-full sm:w-[460px] sm:min-w-[460px] sm:max-w-[460px] h-dvh sm:h-[750px] sm:min-h-[750px] sm:max-h-[750px] text-card-foreground rounded-none sm:rounded-[16px] flex flex-col justify-between relative overflow-hidden transition-colors duration-200 ${
            glassBackground
              ? 'figma-glass-card'
              : 'bg-card border-0 sm:border border-border shadow-none sm:shadow-2xl sm:shadow-black/25'
          }`}
          style={
            glassBackground
              ? {
                  backdropFilter:
                    !isMobile && dispMapUrl
                      ? `url(#${filterId}) blur(1.5px) saturate(180%)`
                      : 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter:
                    !isMobile && dispMapUrl
                      ? `url(#${filterId}) blur(1.5px) saturate(180%)`
                      : 'blur(20px) saturate(180%)',
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

          {/* Specular sheen overlay for glass mode */}
          {glassBackground && (
            <div
              className="figma-glass-sheen absolute inset-0 sm:rounded-[16px] pointer-events-none z-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.12) 100%)',
              }}
            />
          )}
          <div className="relative z-1 flex flex-col flex-1 h-full w-full justify-between overflow-hidden min-h-0">
            {children}
          </div>

          {/* Floating Bottom Navigation Dock (Inside main card for both mobile and desktop) */}
          {bottomDock && (
            <div
              className="absolute bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none px-4"
              style={{
                bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {bottomDock}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
