import React from 'react';
import { WALLPAPER_LIST } from '../profile/ProfileView';

interface AppContainerProps {
  wallpaper: string;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({
  wallpaper,
  children,
}) => {
  const currentItem = WALLPAPER_LIST.find((w) => w.id === wallpaper) || WALLPAPER_LIST[0];

  const getBackgroundStyle = (): React.CSSProperties => {
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
      <main id="app-main" className="w-full max-w-[460px] h-[720px] min-h-[720px] max-h-[720px] bg-white rounded-[16px] shadow-2xl shadow-black/25 border border-black/10 flex flex-col justify-between relative overflow-hidden transition-all">
        {children}
      </main>
    </div>
  );
};
