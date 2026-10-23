import React, { useEffect, useState } from 'react';
import {
  RiSunLine,
  RiSunFill,
  RiCalendar2Line,
  RiCalendar2Fill,
  RiFileList3Line,
  RiFileList3Fill,
  RiAddLine,
  RiSideBarLine,
  RiUserLine,
  RiRefreshLine,
  RiSettings3Line,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';
import { useAuth } from '@/lib/auth';
import { syncManager, type SyncState } from '@/lib/sync';
import { cn } from '@/lib/utils';
import type { ActiveTab } from './BottomDock';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAdd?: () => void;
  onOpenSettings?: () => void;
  settingsOpen?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: RemixiconComponentType;
  activeIcon: RemixiconComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'day', label: 'امروز', icon: RiSunLine, activeIcon: RiSunFill },
  { id: 'calendar', label: 'تقویم', icon: RiCalendar2Line, activeIcon: RiCalendar2Fill },
  { id: 'notebook', label: 'یادداشت', icon: RiFileList3Line, activeIcon: RiFileList3Fill },
];

/** Tooltip shown to the left of an icon (toward the canvas) when the sidebar is collapsed. */
const CollapsedTooltip: React.FC<{ label: string; hint?: string; show: boolean }> = ({
  label,
  hint,
  show,
}) =>
  show ? (
    <span className="desktop-sidebar-tooltip pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap rounded-lg bg-popover text-popover-foreground px-2.5 py-1 text-xs font-medium shadow-lg border border-border opacity-0 translate-x-1 transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0 z-50">
      {label}
      {hint && <kbd className="mr-1.5 text-[10px] text-muted-foreground font-sans">{hint}</kbd>}
    </span>
  ) : null;

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenAdd,
  onOpenSettings,
  settingsOpen = false,
  collapsed,
  onToggleCollapsed,
}) => {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState().state);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => syncManager.subscribe((st) => setSyncState(st)), []);

  const avatarUrl = user?.user_metadata?.avatar_url || '/avatar.png';
  const displayName: string =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'مهمان';

  const itemBase =
    'group/item relative flex items-center h-10 rounded-xl text-[13px] font-medium transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <aside
      className={cn(
        'desktop-sidebar relative z-20 h-full shrink-0 flex flex-col py-4 text-foreground transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed ? 'w-[68px] px-3' : 'w-[236px] px-3'
      )}
      aria-label="منوی ناوبری اصلی"
    >
      {/* Brand row */}
      <div className={cn('flex items-center h-10 mb-5', collapsed ? 'justify-center' : 'justify-between pr-1.5')}>
        {collapsed ? (
          // Collapsed: logo doubles as the expand button (shows sidebar icon on hover)
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="group/item relative size-9 rounded-xl flex items-center justify-center hover:bg-foreground/[0.08] transition-colors cursor-pointer"
            title="باز کردن منو (Ctrl+B)"
          >
            <img
              src="/Boxs/Box 2.png"
              alt="جعبه"
              className="size-7 rounded-lg object-contain group-hover/item:opacity-0 transition-opacity"
            />
            <RiSideBarLine className="size-5 absolute text-foreground/80 opacity-0 group-hover/item:opacity-100 transition-opacity" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/Boxs/Box 2.png" alt="جعبه" className="size-7 rounded-lg object-contain shrink-0" />
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-dana text-xl font-bold tracking-tight leading-none pt-0.5 truncate text-foreground">
                  جعبه
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-wider uppercase font-sans">
                  Box
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-colors cursor-pointer"
              title="بستن منو (Ctrl+B)"
            >
              <RiSideBarLine className="size-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                itemBase,
                collapsed ? 'justify-center w-10 mx-auto' : 'gap-3 px-3',
                isActive
                  ? 'bg-foreground/[0.09] text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]'
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="leading-none pt-0.5 truncate">{item.label}</span>}
              {!collapsed && isActive && (
                <span className="mr-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              <CollapsedTooltip label={item.label} show={collapsed} />
            </button>
          );
        })}

        {/* Add action */}
        {onOpenAdd && (
          <button
            type="button"
            onClick={onOpenAdd}
            className={cn(
              itemBase,
              'mt-3 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]',
              collapsed ? 'justify-center w-10 mx-auto' : 'gap-3 px-3'
            )}
          >
            <span className="size-[18px] rounded-md border border-foreground/20 flex items-center justify-center shrink-0 group-hover/item:border-foreground/50 transition-colors">
              <RiAddLine className="size-3.5" />
            </span>
            {!collapsed && (
              <>
                <span className="leading-none pt-0.5">افزودن</span>
                <kbd className="mr-auto text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-muted-foreground border border-foreground/10">
                  N
                </kbd>
              </>
            )}
            <CollapsedTooltip label="افزودن" hint="N" show={collapsed} />
          </button>
        )}
      </nav>

      <div className="flex-1" />

      {/* Bottom: settings + profile */}
      <div className="flex flex-col gap-1">
        <button
          id="desktop-settings-trigger"
          type="button"
          onClick={() => {
            if (onOpenSettings) {
              onOpenSettings();
            } else {
              onTabChange(activeTab === 'profile' ? 'day' : 'profile');
            }
          }}
          aria-expanded={onOpenSettings ? settingsOpen : undefined}
          aria-controls={onOpenSettings ? 'desktop-settings-panel' : undefined}
          className={cn(
            itemBase,
            collapsed ? 'justify-center w-10 mx-auto' : 'gap-3 px-3',
            settingsOpen || (!onOpenSettings && activeTab === 'profile')
              ? 'bg-foreground/[0.09] text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]'
          )}
        >
          <RiSettings3Line className="size-[18px] shrink-0" />
          {!collapsed && <span className="leading-none pt-0.5">تنظیمات</span>}
          <CollapsedTooltip label="تنظیمات" show={collapsed} />
        </button>

        <div className={cn('my-2 h-px bg-border/60', collapsed ? 'mx-2' : 'mx-1')} />

        <button
          type="button"
          onClick={() => {
            if (onOpenSettings) {
              onOpenSettings();
            } else {
              onTabChange('profile');
            }
          }}
          aria-expanded={onOpenSettings ? settingsOpen : undefined}
          aria-controls={onOpenSettings ? 'desktop-settings-panel' : undefined}
          className={cn(
            itemBase,
            'h-11',
            collapsed ? 'justify-center w-10 mx-auto' : 'gap-2.5 px-2 hover:bg-foreground/[0.05]'
          )}
        >
          <span className="relative shrink-0">
            <span className="size-7 rounded-full overflow-hidden bg-secondary ring-1 ring-border flex items-center justify-center">
              {!avatarError && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <RiUserLine className="size-4 text-muted-foreground" />
              )}
            </span>
            {syncState === 'syncing' && (
              <span className="absolute -bottom-0.5 -left-0.5 size-3.5 rounded-full bg-card ring-1 ring-emerald-500/50 flex items-center justify-center">
                <RiRefreshLine className="size-2 text-emerald-500 animate-spin" />
              </span>
            )}
          </span>
          {!collapsed && (
            <span className="flex flex-col items-start min-w-0 text-right">
              <span className="text-[13px] text-foreground font-medium leading-tight truncate max-w-[150px]">
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {user ? (syncState === 'syncing' ? 'در حال همگام‌سازی…' : 'همگام شده') : 'ورود نکرده'}
              </span>
            </span>
          )}
          <CollapsedTooltip label={displayName} show={collapsed} />
        </button>
      </div>
    </aside>
  );
};
