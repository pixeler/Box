import { useState, useEffect } from 'react';
import { isNative } from './capacitor';

/**
 * Hook to detect if the current view is a mobile device/screen.
 * Returns true for mobile screens (< 640px) or native mobile phones (< 768px).
 * Returns false for tablets and desktop screens.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (isNative() && window.innerWidth < 768) || window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile((isNative() && window.innerWidth < 768) || window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
