import React from 'react';
import { RiSearchLine } from '@remixicon/react';

interface DesktopSearchButtonProps {
  onClick: () => void;
}

/** Transparent glass search pill floating in the canvas corner (desktop only). */
export const DesktopSearchButton: React.FC<DesktopSearchButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="desktop-search-pill group flex items-center gap-1.5 h-9 pr-2.5 pl-1.5 rounded-full cursor-pointer select-none transition duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    title="جستجو (/ یا Ctrl+K)"
    aria-label="جستجو"
  >
    <RiSearchLine className="size-[17px] shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
    <kbd className="desktop-search-kbd min-w-[22px] h-6 px-1.5 rounded-full flex items-center justify-center text-[11px] font-sans font-medium leading-none">
      /
    </kbd>
  </button>
);
