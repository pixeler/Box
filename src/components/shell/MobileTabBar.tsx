import React from 'react';
import type { ActiveTab } from '@/components/navigation/BottomDock';
import { cn } from '@/lib/utils';
import {
  RiCalendar2Fill,
  RiCalendar2Line,
  RiStickyNoteFill,
  RiStickyNoteLine,
  RiSunFill,
  RiSunLine,
} from '@remixicon/react';

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const ITEMS = [
  { id: 'day' as const, label: 'امروز', icon: RiSunLine, activeIcon: RiSunFill },
  { id: 'calendar' as const, label: 'تقویم', icon: RiCalendar2Line, activeIcon: RiCalendar2Fill },
  { id: 'notebook' as const, label: 'یادداشت', icon: RiStickyNoteLine, activeIcon: RiStickyNoteFill },
];

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onTabChange }) => (
  <nav
    aria-label="ناوبری اصلی"
    className="flex h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] shrink-0 items-stretch border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom,0px)]"
  >
    {ITEMS.map((item) => {
      const active =
        activeTab === item.id ||
        (item.id === 'day' && (activeTab === 'todo' || activeTab === 'focus'));
      const Icon = active ? item.activeIcon : item.icon;

      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
            active ? 'text-foreground' : 'text-subtle hover:text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
          <span className="text-[11px] leading-none">{item.label}</span>
        </button>
      );
    })}
  </nav>
);
