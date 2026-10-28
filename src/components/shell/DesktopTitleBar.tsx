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
import { cn } from '@/lib/utils';

interface DesktopTitleBarProps {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  canToggleSidebar: boolean;
  onToggleSidebar: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

/**
 * The whole strip is the drag handle. It is forced to LTR so the window
 * controls stay on the physical right edge in Persian (or any other) layout.
 * Navigation and the sidebar toggle sit at the sidebar boundary, mirroring the
 * familiar desktop pattern.
 */
export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({
  sidebarWidth,
  sidebarCollapsed,
  canToggleSidebar,
  onToggleSidebar,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
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

  const navButtonClass =
    'desktop-no-drag flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer';

  // The titlebar spans the whole window, while the sidebar starts under the
  // window controls. Anchor the toggle to the sidebar's left edge and keep the
  // arrows just outside it, so both line up with the real sidebar divider.
  const sidebarExpanded = canToggleSidebar && !sidebarCollapsed;
  const toggleRight = sidebarExpanded ? Math.max(sidebarWidth - 36, 12) : 152;
  const arrowsRight = sidebarExpanded ? sidebarWidth + 8 : 224;

  return (
    <div
      dir="ltr"
      className="desktop-titlebar fixed inset-x-0 top-0 z-30 flex h-10 select-none items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground"
      onDoubleClick={() => bridge.toggleMaximize()}
    >
      <div className="relative flex h-full w-full items-center">
        <div
          className="desktop-no-drag absolute flex items-center gap-0.5"
          style={{ right: arrowsRight }}
        >
          <button
            type="button"
            className={navButtonClass}
            onClick={onBack}
            disabled={!canGoBack}
            title="بازگشت"
            aria-label="بازگشت"
          >
            <RiArrowRightSLine className="size-[18px]" />
          </button>
          <button
            type="button"
            className={navButtonClass}
            onClick={onForward}
            disabled={!canGoForward}
            title="جلو"
            aria-label="جلو"
          >
            <RiArrowLeftSLine className="size-[18px]" />
          </button>
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-sidebar-border/70"
          style={{ right: sidebarWidth }}
        />

        {canToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'باز کردن سایدبار (Ctrl+B)' : 'بستن سایدبار (Ctrl+B)'}
            aria-label={sidebarCollapsed ? 'باز کردن سایدبار' : 'بستن سایدبار'}
            aria-expanded={!sidebarCollapsed}
            className="desktop-no-drag absolute flex size-8 items-center justify-center rounded-md text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer"
            style={{ right: toggleRight }}
          >
            <PanelRight className={cn('size-[17px]')} />
          </button>
        )}

        <div className="ms-auto flex h-full shrink-0 items-center">
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
            {isMaximized ? (
              <RiFileCopyLine className="size-[17px]" />
            ) : (
              <RiCheckboxBlankLine className="size-4" />
            )}
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
      </div>
    </div>
  );
};
