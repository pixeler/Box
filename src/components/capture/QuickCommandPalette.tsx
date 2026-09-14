import React, { useState, useEffect, useRef } from 'react';
import type { Box } from '@/types/models';
import {
  RiCalendarLine,
  RiFlagFill,
  RiFlagLine,
  RiPriceTag3Line,
  RiInboxArchiveLine,
} from '@remixicon/react';
import { getTodayJalaliKey, addJalaliDays, nextWeekendFrom } from '@/lib/jalali';

export interface CommandItem {
  id: string;
  category: 'تاریخ' | 'اولویت' | 'برچسب' | 'جعبه';
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface QuickCommandPaletteProps {
  query: string;
  boxes: Box[];
  onSelectDueDate: (dateKey: string) => void;
  onOpenDatePicker: () => void;
  onSelectPriority: (p?: 1 | 2 | 3) => void;
  onOpenTagPicker: () => void;
  onSelectBox: (boxId: string) => void;
  onClose: () => void;
}

export const QuickCommandPalette: React.FC<QuickCommandPaletteProps> = ({
  query,
  boxes,
  onSelectDueDate,
  onOpenDatePicker,
  onSelectPriority,
  onOpenTagPicker,
  onSelectBox,
  onClose,
}) => {
  const cleanQuery = query.replace(/^\//, '').trim().toLowerCase();
  const todayKey = getTodayJalaliKey();

  const allItems: CommandItem[] = [
    // Dates
    {
      id: 'date-today',
      category: 'تاریخ',
      label: 'امروز',
      subLabel: todayKey,
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectDueDate(todayKey),
    },
    {
      id: 'date-tomorrow',
      category: 'تاریخ',
      label: 'فردا',
      subLabel: addJalaliDays(todayKey, 1),
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectDueDate(addJalaliDays(todayKey, 1)),
    },
    {
      id: 'date-day-after',
      category: 'تاریخ',
      label: 'پس‌فردا',
      subLabel: addJalaliDays(todayKey, 2),
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectDueDate(addJalaliDays(todayKey, 2)),
    },
    {
      id: 'date-weekend',
      category: 'تاریخ',
      label: 'آخر هفته (جمعه)',
      subLabel: nextWeekendFrom(todayKey),
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectDueDate(nextWeekendFrom(todayKey)),
    },
    {
      id: 'date-next-week',
      category: 'تاریخ',
      label: 'هفته بعد',
      subLabel: addJalaliDays(todayKey, 7),
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectDueDate(addJalaliDays(todayKey, 7)),
    },
    {
      id: 'date-custom',
      category: 'تاریخ',
      label: 'انتخاب از تقویم...',
      icon: <RiCalendarLine className="w-4 h-4 text-muted-foreground" />,
      action: onOpenDatePicker,
    },

    // Priority
    {
      id: 'priority-1',
      category: 'اولویت',
      label: 'اولویت فوری (P1)',
      icon: <RiFlagFill className="w-4 h-4 text-foreground/80" />,
      action: () => onSelectPriority(3),
    },
    {
      id: 'priority-2',
      category: 'اولویت',
      label: 'اولویت متوسط (P2)',
      icon: <RiFlagFill className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectPriority(2),
    },
    {
      id: 'priority-3',
      category: 'اولویت',
      label: 'اولویت کم (P3)',
      icon: <RiFlagFill className="w-4 h-4 text-muted-foreground/60" />,
      action: () => onSelectPriority(1),
    },
    {
      id: 'priority-none',
      category: 'اولویت',
      label: 'بدون اولویت',
      icon: <RiFlagLine className="w-4 h-4 text-muted-foreground/50" />,
      action: () => onSelectPriority(undefined),
    },

    // Tags
    {
      id: 'tag-picker',
      category: 'برچسب',
      label: 'انتخاب یا افزودن برچسب...',
      icon: <RiPriceTag3Line className="w-4 h-4 text-muted-foreground" />,
      action: onOpenTagPicker,
    },

    // Boxes
    ...boxes.map((b) => ({
      id: `box-${b.id}`,
      category: 'جعبه' as const,
      label: b.title,
      icon: <RiInboxArchiveLine className="w-4 h-4 text-muted-foreground" />,
      action: () => onSelectBox(b.id),
    })),
  ];

  const filteredItems = allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery) ||
      (item.subLabel && item.subLabel.toLowerCase().includes(cleanQuery))
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) =>
          filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) =>
          filteredItems.length > 0
            ? (prev - 1 + filteredItems.length) % filteredItems.length
            : 0
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredItems.length > 0 && activeIndex >= 0 && activeIndex < filteredItems.length) {
          e.preventDefault();
          e.stopPropagation();
          filteredItems[activeIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filteredItems, activeIndex, onClose]);

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div
      className="absolute top-full right-0 mt-2 z-50 w-72 max-w-[92vw] bg-popover/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-border/80 dark:border-white/15 shadow-2xl overflow-hidden animate-sheet-up text-right select-none"
      dir="rtl"
    >
      <div className="px-3 py-2 border-b border-border/50 dark:border-white/10 flex items-center justify-between text-xs text-muted-foreground font-medium bg-muted/30">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-primary font-bold">/</span>
          <span>دستورات سریع تسک</span>
        </span>
        <span className="text-[10px] opacity-70">↑↓ ناوبری • ↵ اعمال</span>
      </div>

      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto p-1.5 space-y-0.5"
      >
        {filteredItems.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            دستوری یافت نشد
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-right ${
                  isSelected
                    ? 'bg-muted text-foreground font-semibold shadow-2xs'
                    : 'hover:bg-muted/50 text-foreground/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0">{item.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.subLabel && (
                      <span className="text-[10px] truncate text-muted-foreground">
                        {item.subLabel}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="text-[9.5px] px-2 py-0.5 rounded-full shrink-0 bg-muted/60 text-muted-foreground border border-border/40"
                >
                  {item.category}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
