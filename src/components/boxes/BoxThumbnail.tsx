import React from 'react';
import type { Box } from '@/types/models';
import { BoxIconRenderer } from './BoxIconRenderer';

interface BoxThumbnailProps {
  box: Pick<Box, 'image' | 'icon' | 'title'> & { badge_icon?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const BoxThumbnail: React.FC<BoxThumbnailProps> = ({
  box,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-10 h-10',
    md: 'w-16 h-16 sm:w-[72px] sm:h-[72px]',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4 sm:w-5 sm:h-5',
    lg: 'w-7 h-7 sm:w-8 sm:h-8',
  }[size];


  // Resolve image source
  let rawImg = box.image || 'Box 1.png';
  if (rawImg.toLowerCase().includes('bix 2')) {
    rawImg = 'Box 2.png';
  }
  let imgSrc = rawImg;
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
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          if (!target.src.includes('Box%201.png') && !target.src.includes('Box 1.png')) {
            target.src = '/Boxs/Box%201.png';
          }
        }}
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

    </div>
  );
};
