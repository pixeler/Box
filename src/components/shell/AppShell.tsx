import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@/types/models';
import type { ActiveTab } from '@/components/navigation/BottomDock';
import type { SettingsSection } from '@/components/profile/ProfileView';
import { useMediaQuery } from '@/lib/device';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { MobileTopBar } from './MobileTopBar';
import { MobileTabBar } from './MobileTabBar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface AppShellProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
  onOpenNote: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenAuth: () => void;
  onOpenTask: (task: Task) => void;
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'second_brain_sidebar_collapsed';
const SIDEBAR_WIDTH_KEY = 'second_brain_sidebar_width';
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 380;
const SIDEBAR_DEFAULT = 280;

const clampWidth = (value: number) =>
  Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));

/**
 * The product frame: a collapsible, resizable right sidebar on desktop and
 * tablet, a quiet top and bottom bar on phones. On tablet and desktop the
 * content sits in one detached rounded surface, separated from the sidebar by
 * colour rather than a border.
 */
export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  onOpenAdd,
  onOpenNote,
  onOpenSettings,
  onOpenAuth,
  onOpenTask,
  children,
}) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px)');
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT;
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : SIDEBAR_DEFAULT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (isDesktop) localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [isDesktop, sidebarWidth]);

  useEffect(() => {
    if (isDesktop) return;
    setMobileMenuOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isDesktop) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.code !== 'KeyB' && event.key !== 'b' && event.key !== 'B' && event.key !== 'ذ') {
        return;
      }
      event.preventDefault();
      toggleCollapsed();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, toggleCollapsed]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const openAdd = useCallback(() => {
    setMobileMenuOpen(false);
    onOpenAdd();
  }, [onOpenAdd]);

  const openSettings = useCallback(
    (section?: SettingsSection) => {
      setMobileMenuOpen(false);
      onOpenSettings(section);
    },
    [onOpenSettings]
  );

  const openAuth = useCallback(() => {
    setMobileMenuOpen(false);
    onOpenAuth();
  }, [onOpenAuth]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop || collapsed) return;
    event.preventDefault();
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const delta = resizeRef.current.startX - event.clientX;
    setSidebarWidth(clampWidth(resizeRef.current.startWidth + delta));
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isDesktop || collapsed) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth((width) => clampWidth(width + 16));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((width) => clampWidth(width - 16));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MIN);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MAX);
    }
  };

  const resetWidth = () => setSidebarWidth(SIDEBAR_DEFAULT);

  const sidebarWidthPx = isDesktop
    ? collapsed
      ? 64
      : sidebarWidth
    : 64;

  return (
    <div
      dir="rtl"
      className={cn(
        'flex h-dvh w-full overflow-hidden bg-background font-sans text-foreground',
        isTablet && 'bg-sidebar',
        isResizing && 'cursor-col-resize select-none'
      )}
    >
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
      >
        پرش به محتوا
      </a>

      {isTablet && (
        <div
          className={cn(
            'relative h-full shrink-0 overflow-visible',
            !isResizing && 'transition-[width] duration-150 motion-reduce:transition-none'
          )}
          style={{ width: sidebarWidthPx }}
        >
          <Sidebar
            activeTab={activeTab}
            compact={!isDesktop || collapsed}
            canCollapse={isDesktop}
            onToggleCollapsed={toggleCollapsed}
            onTabChange={onTabChange}
            onOpenAdd={openAdd}
            onOpenNote={onOpenNote}
            onOpenSettings={openSettings}
            onOpenAuth={openAuth}
            onOpenTask={onOpenTask}
          />

          {isDesktop && !collapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="تغییر عرض سایدبار"
              aria-valuemin={SIDEBAR_MIN}
              aria-valuemax={SIDEBAR_MAX}
              aria-valuenow={sidebarWidth}
              tabIndex={0}
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onDoubleClick={resetWidth}
              onKeyDown={resizeWithKeyboard}
              className="group/resize absolute inset-y-2 -left-1 z-40 w-2 cursor-col-resize touch-none"
            >
              <span
                className={cn(
                  'mx-auto block h-full w-px transition-colors',
                  isResizing
                    ? 'bg-foreground/20'
                    : 'bg-transparent group-hover/resize:bg-foreground/15'
                )}
              />
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden',
          isTablet && 'py-2.5 pe-2.5 ps-0'
        )}
      >
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden bg-background',
            isTablet && 'rounded-[22px]'
          )}
        >
          {!isTablet && <MobileTopBar onOpenMenu={() => setMobileMenuOpen(true)} onOpenAdd={openAdd} />}

          <main id="app-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>

          {!isTablet && <MobileTabBar activeTab={activeTab} onTabChange={onTabChange} />}
        </div>
      </div>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="left-auto right-0 top-0 flex h-dvh w-[min(300px,86vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">منوی ناوبری</DialogTitle>
          <DialogDescription className="sr-only">
            دسترسی به امروز، تقویم، یادداشت‌ها، پوشه‌ها و تنظیمات
          </DialogDescription>
          <div className="h-full min-h-0 w-full min-w-0 overflow-hidden">
            <Sidebar
              activeTab={activeTab}
              onTabChange={onTabChange}
              onOpenAdd={openAdd}
              onOpenNote={onOpenNote}
              onOpenSettings={openSettings}
              onOpenAuth={openAuth}
              onOpenTask={onOpenTask}
              onNavigate={closeMobileMenu}
              onClose={closeMobileMenu}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
