import { useState, useEffect } from 'react';
import { isNative } from './capacitor';

function mobileQuery(breakpoint: number): string {
  return `(max-width: ${(isNative() ? 768 : breakpoint) - 1}px)`;
}

function desktopQuery(breakpoint: number): string {
  return `(min-width: ${breakpoint}px)`;
}

/**
 * Hook to detect if the current view is a mobile device/screen.
 * Returns true for mobile screens (< 640px) or native mobile phones (< 768px).
 * Returns false for tablets and desktop screens.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(mobileQuery(breakpoint)).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia(mobileQuery(breakpoint));
    const handleChange = () => setIsMobile(query.matches);
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to detect a desktop-class viewport (>= 1024px, not a native mobile app).
 * Used to switch to the sidebar + floating-window desktop shell.
 */
export function useIsDesktop(breakpoint = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !isNative() && window.matchMedia(desktopQuery(breakpoint)).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || isNative()) return;
    const query = window.matchMedia(desktopQuery(breakpoint));
    const handleChange = () => setIsDesktop(query.matches);
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isDesktop;
}
