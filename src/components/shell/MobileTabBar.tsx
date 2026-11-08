import React from 'react';
import type { ActiveTab } from '@/components/navigation/BottomDock';
import { cn } from '@/lib/utils';
import {
  RiStickyNoteFill,
  RiStickyNoteLine,
  RiTaskFill,
  RiTaskLine,
  RiTimerFill,
  RiTimerLine,
} from '@remixicon/react';

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

/**
 * Three destinations on a phone: tasks, notes and focus. The old today /
 * calendar / all-tasks trio is one entry now — the tasks screen switches
 * between them — so the bar has room for focus instead.
 */
const ITEMS: { id: ActiveTab; label: string; icon: typeof RiTaskLine; activeIcon: typeof RiTaskFill; match: ActiveTab[] }[] = [
  {
    id: 'day',
    label: 'کارها',
    icon: RiTaskLine,
    activeIcon: RiTaskFill,
    match: ['day', 'todo', 'calendar'],
  },
  {
    id: 'notebook',
    label: 'یادداشت',
    icon: RiStickyNoteLine,
    activeIcon: RiStickyNoteFill,
    match: ['notebook'],
  },
  {
    id: 'focus',
    label: 'تمرکز',
    icon: RiTimerLine,
    activeIcon: RiTimerFill,
    match: ['focus'],
  },
];

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onTabChange }) => (
  <nav
    aria-label="ناوبری اصلی"
    className="flex h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] shrink-0 items-stretch border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom,0px)]"
  >
    {ITEMS.map((item) => {
      const active = item.match.includes(activeTab);
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
