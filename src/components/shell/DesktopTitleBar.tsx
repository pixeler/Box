import React, { useEffect, useState } from 'react';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckboxBlankLine,
  RiCloseLine,
  RiFileCopyLine,
  RiSubtractLine,
} from '@remixicon/react';
import { PanelRight } from 'lucide-react';
import { desktop } from '@/lib/desktop';

interface DesktopTitleBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  /** Sidebar width in px, so the divider sits exactly on the sidebar's edge. */
  sidebarWidth: number;
}

/** Three window controls plus the sidebar toggle: the narrowest usable band. */
const HEADER_CONTROLS_WIDTH = 3 * 48 + 32;

/**
 * The window's only top row, ordered right to left like the rest of the shell:
 * OS controls, sidebar toggle, the sidebar divider, browser-style history, and
 * then the slot the open note fills with its breadcrumb and actions.
 */
export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onToggleSidebar,
  sidebarCollapsed,
  sidebarWidth,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const bridge = desktop;

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge.isMaximized().then((value) => {
      if (!cancelled) setIsMaximized(value);
    });
    const unsubscribe = bridge.onMaximizedChange(setIsMaximized);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);

  if (!bridge) return null;

  const controlClass =
    'desktop-no-drag flex h-10 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer';
  const iconClass =
    'desktop-no-drag flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

  return (
    <div
      dir="rtl"
      className="desktop-titlebar fixed inset-x-0 top-0 z-30 flex h-10 select-none items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground"
      onDoubleClick={() => bridge.toggleMaximize()}
    >
      {/* The band is exactly as wide as the sidebar, so its inner border lands
          on the sidebar's edge and everything after it starts at the content. */}
      <div
        className="flex h-full shrink-0 items-center border-e border-sidebar-border"
        style={{ width: Math.max(sidebarWidth, HEADER_CONTROLS_WIDTH) }}
      >
      {/* Windows controls keep their native order on the physical right edge. */}
      <div dir="ltr" className="flex h-full shrink-0 items-center">
        <button
          type="button"
          className={controlClass}
          onClick={() => bridge.minimize()}
          title="کوچک کردن"
          aria-label="کوچک کردن پنجره"
        >
          <RiSubtractLine className="size-5" />
        </button>
        <button
          type="button"
          className={controlClass}
          onClick={() => bridge.toggleMaximize()}
          title={isMaximized ? 'بازگرداندن' : 'بزرگ کردن'}
          aria-label={isMaximized ? 'بازگرداندن پنجره' : 'بزرگ کردن پنجره'}
        >
          {isMaximized ? <RiFileCopyLine className="size-[17px]" /> : <RiCheckboxBlankLine className="size-4" />}
        </button>
        <button
          type="button"
          className={`${controlClass} hover:bg-rose-600 hover:text-white`}
          onClick={() => bridge.close()}
          title="بستن"
          aria-label="بستن پنجره"
        >
          <RiCloseLine className="size-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? 'باز کردن سایدبار' : 'بستن سایدبار'}
        aria-label={sidebarCollapsed ? 'باز کردن سایدبار' : 'بستن سایدبار'}
        aria-expanded={!sidebarCollapsed}
        className={iconClass}
      >
        <PanelRight className="size-[17px]" />
      </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        title="بازگشت"
        aria-label="بازگشت"
        className={iconClass}
      >
        <RiArrowRightSLine className="size-[18px]" />
      </button>
      <button
        type="button"
        onClick={onForward}
        disabled={!canGoForward}
        title="جلو"
        aria-label="جلو"
        className={iconClass}
      >
        <RiArrowLeftSLine className="size-[18px]" />
      </button>

      <div
        id="app-header-slot"
        className="desktop-no-drag flex h-full min-w-0 flex-1 items-center pe-3"
      />
    </div>
  );
};
