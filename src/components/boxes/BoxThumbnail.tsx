import React, { useMemo } from 'react';
import type { Box } from '@/types/models';
import { BoxIconRenderer } from './BoxIconRenderer';

/** Every artwork that actually ships in /public/Boxs (note: Box6 has no space). */
export const BOX_IMAGE_FILES = [
  'Box 1.png',
  'Box 2.png',
  'Box 3.png',
  'Box 4.png',
  'Box 5.png',
  'Box6.png',
  'Box 7.png',
  'Box 8.png',
  'Box 9.png',
  'Box 10.png',
];

/** Files that older records may point at, mapped onto the artwork that replaced them. */
const IMAGE_ALIASES: Record<string, string> = {
  'box 6.png': 'Box6.png',
  'box6.png': 'Box6.png',
  'bix 2.png': 'Box 2.png',
  'bix2.png': 'Box 2.png',
};

const availableByLowerName: Record<string, string> = BOX_IMAGE_FILES.reduce(
  (map, file) => ({ ...map, [file.toLowerCase()]: file }),
  {}
);

/** Stable, title-based pick so a folder without valid artwork still gets its own box. */
const fallbackImageFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return BOX_IMAGE_FILES[hash % BOX_IMAGE_FILES.length];
};

/**
 * Turns whatever is stored on a box (`Box 5.png`, `/Boxs/Box%205.png`,
 * `box6.png`, a legacy `Bix 2.png`, an empty string…) into a file that exists.
 * Nothing is ever handed to <img> unless it is known artwork, so a stale record
 * can no longer render a broken image.
 */
export const resolveBoxImage = (rawImage: string | undefined, title = ''): string => {
  const raw = (rawImage || '').trim();
  let name = raw.split('?')[0].split('#')[0];
  name = name.slice(name.lastIndexOf('/') + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the raw name if it is not valid percent-encoding
  }
  name = name.trim();

  const alias = IMAGE_ALIASES[name.toLowerCase()];
  if (alias) return `/Boxs/${alias}`;

  const direct = availableByLowerName[name.toLowerCase()];
  if (direct) return `/Boxs/${direct}`;

  // "box6.png" / "Box 6.png" / "Box 06.png" all land on the same artwork
  const numbered = name.match(/^box\s*0*(\d{1,2})\.png$/i);
  if (numbered) {
    const candidate = `${numbered[1] === '6' ? 'Box6' : `Box ${numbered[1]}`}.png`;
    const known = availableByLowerName[candidate.toLowerCase()];
    if (known) return `/Boxs/${known}`;
  }

  return `/Boxs/${fallbackImageFor(title || name)}`;
};

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

  const imgSrc = useMemo(() => resolveBoxImage(box.image, box.title), [box.image, box.title]);

  return (
    <div className={`relative flex items-center justify-center shrink-0 select-none ${sizeClasses} ${className}`}>
      {/* 3D Box Graphic */}
      <img
        src={imgSrc}
        alt={box.title}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          if (!target.src.includes('Box%201.png') && !target.src.includes('Box 1.png')) {
            target.src = '/Boxs/Box%201.png';
          }
        }}
        className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
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
