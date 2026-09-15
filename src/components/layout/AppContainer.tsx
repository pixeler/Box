import React from 'react';
import { WALLPAPER_LIST } from '../profile/ProfileView';

interface AppContainerProps {
  wallpaper: string;
  glassBackground?: boolean;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  wallpaper,
  glassBackground = false,
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
      className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 transition-all duration-500 font-sans"
      dir="rtl"
    >
      {/* Central App Card matching desktop width 460px, height 720px and rounded 16px */}
      <main
        id="app-main"
        className={`w-full max-w-[460px] h-[720px] min-h-[720px] max-h-[720px] text-card-foreground rounded-[16px] flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
          glassBackground
            ? 'figma-glass-card'
            : 'bg-card border border-border shadow-2xl shadow-black/25'
        }`}
      >
        {/* Specular sheen overlay for glass mode */}
        {glassBackground && (
          <div
            className="figma-glass-sheen absolute inset-0 rounded-[16px] pointer-events-none z-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.08) 100%)',
            }}
          />
        )}
        <div className="relative z-1 flex flex-col h-full w-full justify-between overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};
