export interface DesktopBridge {
  platform: string;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

/** Present only inside the Electron shell, never in a browser tab. */
export const desktop: DesktopBridge | undefined =
  typeof window !== 'undefined' ? window.desktop : undefined;
