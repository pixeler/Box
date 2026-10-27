import React, { useState, useEffect } from 'react';
import {
  RiSunLine,
  RiCalendar2Line,
  RiStickyNoteLine,
  RiSearchLine,
  RiUserLine,
  RiRefreshLine,
} from '@remixicon/react';
import { useAuth } from '@/lib/auth';
import { syncManager, type SyncState } from '@/lib/sync';

export type ActiveTab = 'day' | 'calendar' | 'todo' | 'focus' | 'notebook' | 'profile' | 'boxes';

interface BottomDockProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenSearch?: () => void;
  onOpenAdd?: () => void;
  glassOpacity?: number;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
}) => {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState().state);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    return syncManager.subscribe((st) => setSyncState(st));
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || '/avatar.png';

  return (
    <nav
      className="relative flex items-center gap-1.5 sm:gap-2 h-[52px] sm:h-[54px] px-2 sm:px-2.5 py-1.5 rounded-full bg-white/95 dark:bg-neutral-900/95 border border-black/[0.08] dark:border-white/[0.1] shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] backdrop-blur-md select-none pointer-events-auto transition duration-200"
      dir="rtl"
      aria-label="منوی ناوبری اصلی"
    >
      {/* 1. امروز (Today) */}
      <button
        type="button"
        onClick={() => onTabChange('day')}
        className={`group/today h-9 sm:h-10 px-3.5 sm:px-4 rounded-full transition duration-200 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-medium shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          activeTab === 'day'
            ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-neutral-900 shadow-sm'
            : 'text-neutral-700 dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95'
        }`}
        title="امروز"
      >
        <RiSunLine className="size-4.5 sm:size-5 shrink-0" />
        <span className="leading-none pt-0.5">امروز</span>
      </button>

      {/* 2. تقویم (Calendar) */}
      <button
        type="button"
        onClick={() => onTabChange('calendar')}
        className={`group/calendar h-9 sm:h-10 px-3 sm:px-3.5 rounded-full transition duration-200 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-medium shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          activeTab === 'calendar'
            ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-neutral-900 shadow-sm'
            : 'text-neutral-700 dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95'
        }`}
        title="تقویم"
      >
        <RiCalendar2Line className="size-4.5 sm:size-5 shrink-0" />
        <span className="leading-none pt-0.5">تقویم</span>
      </button>

      {/* 3. یادداشت (Notes) */}
      <button
        type="button"
        onClick={() => onTabChange('notebook')}
        className={`group/notes h-9 sm:h-10 px-3 sm:px-3.5 rounded-full transition duration-200 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-medium shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          activeTab === 'notebook'
            ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-neutral-900 shadow-sm'
            : 'text-neutral-700 dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95'
        }`}
        title="یادداشت"
      >
        <RiStickyNoteLine className="size-4.5 sm:size-5 shrink-0" />
        <span className="leading-none pt-0.5">یادداشت</span>
      </button>

      {/* 4. جداکننده عمودی (Vertical Divider) */}
      <div className="h-5 w-[1px] bg-neutral-200 dark:bg-neutral-700/80 mx-1 shrink-0" />

      {/* 5. سرچ (Search) */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="size-8.5 sm:size-9 rounded-full text-neutral-700 dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition duration-200 cursor-pointer shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title="جستجو (Ctrl+P)"
      >
        <RiSearchLine className="size-4.5 sm:size-5 shrink-0" />
      </button>

      {/* 6. پروفایل (Profile) */}
      <button
        type="button"
        onClick={() => onTabChange(activeTab === 'profile' ? 'day' : 'profile')}
        className={`group/profile relative size-8.5 sm:size-9 rounded-full transition duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeTab === 'profile' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        }`}
        title="پروفایل و تنظیمات"
      >
        <div className="size-8 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-secondary flex items-center justify-center shrink-0 shadow-2xs">
          {!avatarError && avatarUrl ? (
            <img
              src={avatarUrl}
              alt="پروفایل"
              className="size-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <RiUserLine className="size-4 text-muted-foreground" />
          )}
        </div>
        {syncState === 'syncing' && (
          <span className="absolute -top-1 -left-1 size-3.5 rounded-full bg-card border border-emerald-500/50 flex items-center justify-center shadow-xs">
            <RiRefreshLine className="size-2 text-emerald-500 animate-spin" />
          </span>
        )}
      </button>
    </nav>
  );
};
