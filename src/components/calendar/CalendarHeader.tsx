import React, { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toPersianDigits, PERSIAN_MONTH_NAMES } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import type { CalendarViewMode } from './calendarUtils';
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendar2Line,
  RiGridLine,
  RiLayoutGridLine,
} from '@remixicon/react';

interface CalendarHeaderProps {
  mode: CalendarViewMode;
  title: string;
  subtitle: string;
  isOnToday: boolean;
  currentYear: number;
  currentMonth: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onModeChange: (mode: CalendarViewMode) => void;
  onPickMonth: (jm: number, jy: number) => void;
  onOpenAdd?: () => void;
}

const MODES: Array<{
  key: CalendarViewMode;
  label: string;
  icon: React.ElementType;
}> = [
  { key: 'week', label: 'هفته', icon: RiCalendar2Line },
  { key: 'month', label: 'ماه', icon: RiGridLine },
  { key: 'year', label: 'سال', icon: RiLayoutGridLine },
];

const NAV_LABELS: Record<CalendarViewMode, { prev: string; next: string }> = {
  week: { prev: 'هفته قبل', next: 'هفته بعد' },
  month: { prev: 'ماه قبل', next: 'ماه بعد' },
  year: { prev: 'سال قبل', next: 'سال بعد' },
};

/**
 * The calendar toolbar: the current period is the title, with the view switch
 * and the day's actions sitting quietly on the other side.
 */
export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  mode,
  title,
  subtitle,
  isOnToday,
  currentYear,
  currentMonth,
  onPrev,
  onNext,
  onToday,
  onModeChange,
  onPickMonth,
  onOpenAdd,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);

  useEffect(() => {
    if (pickerOpen) setPickerYear(currentYear);
  }, [pickerOpen, currentYear]);

  const navLabels = NAV_LABELS[mode];

  return (
    <header
      dir="rtl"
      className="relative z-30 w-full shrink-0 px-0 pb-3 pt-5 min-[1100px]:px-5 min-[1400px]:px-10 min-[1100px]:pt-6"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 max-sm:grid-cols-2">
        {/* View switch, on the physical right */}
        <div className="flex justify-self-start max-sm:col-start-1 max-sm:row-start-2">
          <div
            role="group"
            aria-label="نمای تقویم"
            className="flex h-8 items-center gap-0.5 rounded-md border border-border/60 p-0.5"
          >
            {MODES.map(({ key, label, icon: Icon }) => {
              const isActive = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onModeChange(key)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex h-7 items-center justify-center gap-1.5 rounded-[5px] px-2 text-[12px] font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Period title in the middle, with its two step arrows together */}
        <div className="flex min-w-0 items-center justify-center gap-0.5 max-sm:col-span-2 max-sm:row-start-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label={navLabels.prev}
            title={navLabels.prev}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground cursor-pointer"
          >
            <RiArrowRightSLine className="size-4" />
          </button>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group flex min-w-0 items-center rounded-md text-right cursor-pointer"
                aria-label="انتخاب ماه و سال"
                title="انتخاب ماه و سال"
              >
                <h1 className="truncate font-darvish text-[22px] font-semibold leading-8 text-foreground transition-colors group-hover:text-foreground/80 sm:text-[24px]">
                  {title}
                </h1>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="center"
              sideOffset={8}
              dir="rtl"
              className="z-[140] w-[19rem] rounded-2xl border-border/70 bg-card p-3 text-foreground shadow-2xl"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y - 1)}
                  aria-label="سال قبل"
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <RiArrowRightSLine className="size-4" />
                </button>
                <span className="font-darvish text-base font-bold text-foreground">
                  {toPersianDigits(pickerYear)}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y + 1)}
                  aria-label="سال بعد"
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <RiArrowLeftSLine className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PERSIAN_MONTH_NAMES.map((monthName, index) => {
                  const jm = index + 1;
                  const isSelected = pickerYear === currentYear && jm === currentMonth;
                  return (
                    <button
                      key={monthName}
                      type="button"
                      onClick={() => {
                        onPickMonth(jm, pickerYear);
                        setPickerOpen(false);
                      }}
                      className={cn(
                        'rounded-lg px-2 py-2 text-xs font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-foreground font-bold text-background'
                          : 'bg-secondary/40 text-foreground hover:bg-secondary'
                      )}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onToday();
                    setPickerOpen(false);
                  }}
                  className="w-full rounded-lg bg-secondary/40 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer"
                >
                  رفتن به امروز
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={onNext}
            aria-label={navLabels.next}
            title={navLabels.next}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground cursor-pointer"
          >
            <RiArrowLeftSLine className="size-4" />
          </button>
        </div>

        {/* Today / add, on the physical left */}
        <div className="flex items-center justify-self-end gap-2 max-sm:col-start-2 max-sm:row-start-2">
          {!isOnToday && (
            <button
              type="button"
              onClick={onToday}
              title="رفتن به امروز"
              className="h-8 rounded-md border border-border/70 px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.05] cursor-pointer"
            >
              امروز
            </button>
          )}

          {onOpenAdd && (
            <button
              type="button"
              onClick={onOpenAdd}
              aria-label="افزودن کار"
              title="افزودن کار"
              className="hidden size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer sm:flex"
            >
              <RiAddLine className="size-[18px]" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-center text-[12px] leading-5 text-muted-foreground">{subtitle}</p>
    </header>
  );
};
