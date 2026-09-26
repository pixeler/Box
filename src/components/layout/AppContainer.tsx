import React from 'react';
import { WALLPAPER_LIST } from '../profile/ProfileView';

export type DesktopPosition = 'right' | 'center' | 'left';

interface AppContainerProps {
  wallpaper: string;
  glassBackground?: boolean;
  desktopPosition?: DesktopPosition;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  wallpaper,
  glassBackground = false,
  desktopPosition = 'center',
  children,
}) => {
  const currentItem = WALLPAPER_LIST.find((w) => w.id === wallpaper) || WALLPAPER_LIST[0];

  const getBackgroundStyle = (): React.CSSProperties => {
    // 1. Check for custom user-selected wallpaper (uploaded from computer or cached)
    if (
      wallpaper === 'custom-image' ||
      wallpaper === 'custom-unsplash' ||
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
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    }
    if (currentItem?.bgGradient) {
      return {
        background: currentItem.bgGradient,
      };
    }
    if (currentItem?.bgColor) {
      return {
        backgroundColor: currentItem.bgColor,
      };
    }
    return {
      backgroundImage: `url('${WALLPAPER_LIST[0].url}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  };

  return (
    <div
      style={getBackgroundStyle()}
      className={`min-h-screen w-full flex items-center p-0 sm:p-4 md:px-10 transition-all duration-500 font-sans ${
        desktopPosition === 'right'
          ? 'justify-center sm:justify-start'
          : desktopPosition === 'left'
          ? 'justify-center sm:justify-end'
          : 'justify-center'
      }`}
      dir="rtl"
    >
      {/* Central App Card: full height (h-dvh) and full width on mobile, 460x720 on desktop */}
      <main
        id="app-main"
        className={`w-full max-w-full sm:max-w-[460px] h-dvh sm:h-[780px] sm:min-h-[780px] sm:max-h-[780px] text-card-foreground rounded-none sm:rounded-[16px] flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
          glassBackground
            ? 'figma-glass-card'
            : 'bg-card border-0 sm:border border-border shadow-none sm:shadow-2xl sm:shadow-black/25'
        }`}
      >
        {/* Mobile Status Bar Area Fill - Seamlessly matches calendar header (bg-card) in light and dark mode */}
        <div
          className="w-full shrink-0 sm:hidden bg-card transition-colors duration-300 pointer-events-none z-10"
          style={{ height: 'var(--safe-area-top)' }}
          aria-hidden="true"
        />

        {/* Specular sheen overlay for glass mode */}
        {glassBackground && (
          <div
            className="figma-glass-sheen absolute inset-0 sm:rounded-[16px] pointer-events-none z-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.08) 100%)',
            }}
          />
        )}
        <div className="relative z-1 flex flex-col flex-1 h-full w-full justify-between overflow-hidden min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};
