import React, { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toPersianDigits, PERSIAN_MONTH_NAMES } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import type { CalendarViewMode } from './calendarUtils';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiCalendar2Line,
  RiGridLine,
  RiLayoutGridLine,
  RiSunLine,
} from '@remixicon/react';

interface CalendarHeaderProps {
  mode: CalendarViewMode;
  title: string;
  subtitle: string;
  canGoBack: boolean;
  isOnToday: boolean;
  currentYear: number;
  currentMonth: number;
  onBack: () => void;
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
  { key: 'day', label: 'روز', icon: RiSunLine },
  { key: 'week', label: 'هفته', icon: RiCalendar2Line },
  { key: 'month', label: 'ماه', icon: RiGridLine },
  { key: 'year', label: 'سال', icon: RiLayoutGridLine },
];

const NAV_LABELS: Record<CalendarViewMode, { prev: string; next: string }> = {
  day: { prev: 'روز قبل', next: 'روز بعد' },
  week: { prev: 'هفته قبل', next: 'هفته بعد' },
  month: { prev: 'ماه قبل', next: 'ماه بعد' },
  year: { prev: 'سال قبل', next: 'سال بعد' },
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  mode,
  title,
  subtitle,
  canGoBack,
  isOnToday,
  currentYear,
  currentMonth,
  onBack,
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

  const renderModeSwitch = (fullWidth: boolean) => (
    <div
      role="group"
      aria-label="نمای تقویم"
      dir="rtl"
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-border/60 bg-secondary/40 p-0.5',
        fullWidth && 'w-full'
      )}
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
              'flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:text-xs',
              fullWidth && 'flex-1',
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <header
      dir="rtl"
      className="relative z-30 w-full shrink-0 border-b border-border/50 bg-card/60 px-3 pb-2.5 pt-3 backdrop-blur-xl sm:px-6 sm:pb-3 sm:pt-4"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="بازگشت"
          title={canGoBack ? 'بازگشت به نمای قبلی' : 'بازگشت به برنامه امروز'}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground transition-colors hover:bg-secondary active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RiArrowRightLine className="size-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group flex min-w-0 items-center gap-1 rounded-lg text-right cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="انتخاب ماه و سال"
                title="انتخاب ماه و سال"
              >
                <h1 className="truncate font-darvish text-lg font-bold leading-tight text-foreground sm:text-2xl">
                  {title}
                </h1>
                <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
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
                        'rounded-xl px-2 py-2 text-xs font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-foreground font-bold text-background shadow-xs'
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
                  className="w-full rounded-xl bg-secondary/40 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer"
                >
                  رفتن به امروز
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>
        </div>

        <div className="hidden shrink-0 sm:block">{renderModeSwitch(false)}</div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isOnToday && (
            <button
              type="button"
              onClick={onToday}
              title="رفتن به امروز"
              className="h-8 rounded-full border border-border/70 bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary cursor-pointer active:scale-95 sm:text-xs"
            >
              امروز
            </button>
          )}

          <div className="flex items-center rounded-full border border-border/60 bg-card/70 p-0.5">
            <button
              type="button"
              onClick={onPrev}
              aria-label={navLabels.prev}
              title={navLabels.prev}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer"
            >
              <RiArrowRightSLine className="size-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label={navLabels.next}
              title={navLabels.next}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer"
            >
              <RiArrowLeftSLine className="size-4" />
            </button>
          </div>

          {onOpenAdd && (
            <button
              type="button"
              onClick={onOpenAdd}
              aria-label="افزودن کار"
              title="افزودن کار"
              className="hidden size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
            >
              <RiAddLine className="size-[18px]" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 sm:hidden">{renderModeSwitch(true)}</div>
    </header>
  );
};
