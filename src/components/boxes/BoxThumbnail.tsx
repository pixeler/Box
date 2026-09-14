import React from 'react';
import type { Box } from '@/types/models';
import { BoxIconRenderer, BoxBadgeRenderer } from './BoxIconRenderer';

interface BoxThumbnailProps {
  box: Pick<Box, 'image' | 'icon' | 'badge_icon' | 'title'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BoxThumbnail: React.FC<BoxThumbnailProps> = ({
  box,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20 sm:w-24 sm:h-24',
    lg: 'w-28 h-28 sm:w-32 sm:h-32',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5 sm:w-6 sm:h-6',
    lg: 'w-8 h-8 sm:w-9 sm:h-9',
  }[size];

  const badgeSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  // Resolve image source
  let imgSrc = box.image;
  if (!imgSrc.startsWith('/') && !imgSrc.startsWith('http')) {
    imgSrc = `/Boxs/${imgSrc}`;
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 select-none ${sizeClasses} ${className}`}>
      {/* 3D Box Graphic */}
      <img
        src={imgSrc}
        alt={box.title}
        loading="lazy"
        className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.12)] transition-transform duration-200"
      />

      {/* Embossed / Stamped Icon on Box Lid */}
      {box.icon && (
        <div
          className="absolute inset-x-0 pointer-events-none flex items-center justify-center"
          style={{ top: '30%' }}
        >
          <BoxIconRenderer
            iconId={box.icon}
            boxImage={box.image}
            className={iconSizes}
          />
        </div>
      )}

      {/* Optional Corner Badge */}
      {box.badge_icon && (
        <BoxBadgeRenderer
          badgeId={box.badge_icon}
          className={badgeSizes}
        />
      )}
    </div>
  );
};
