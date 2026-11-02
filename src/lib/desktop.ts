export interface DesktopBridge {
  platform: string;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  /** Native OS notification (Windows toast). */
  notify: (title: string, body: string) => void;
  /** Taskbar badge: a PNG data URL plus a label, or null to clear it. */
  setFocusBadge: (dataUrl: string | null, label?: string) => void;
  /** Reload the desktop renderer window. */
  reload?: () => void;
  /** Toggle Chromium DevTools in the desktop window. */
  toggleDevTools?: () => void;
  /** Render an HTML document to a real PDF file through a save dialog. */
  savePdfAsFile?: (
    html: string,
    fileName: string
  ) => Promise<{ saved: boolean; canceled?: boolean; filePath?: string; error?: string }>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

/** Present only inside the Electron shell, never in a browser tab. */
export const desktop: DesktopBridge | undefined =
  typeof window !== 'undefined' ? window.desktop : undefined;
