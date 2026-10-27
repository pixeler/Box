import React, { useMemo } from 'react';
import type { Task } from '@/types/models';
import {
  formatJalaliKey,
  getJalaliMonthFirstDayOfWeek,
  getJalaliMonthLength,
  toPersianDigits,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_SHORT_NAMES,
} from '@/lib/jalali';
import { getHolidaysForDate } from '@/lib/holidays';
import { cn } from '@/lib/utils';

interface CalendarYearViewProps {
  jy: number;
  todayKey: string;
  activeMonth: number;
  tasksForDate: (dateKey: string) => Task[];
  onOpenMonth: (jm: number) => void;
}

interface MiniDay {
  dateKey: string;
  dayNumber: number;
  isToday: boolean;
  isRedDay: boolean;
  hasTasks: boolean;
}

export const CalendarYearView: React.FC<CalendarYearViewProps> = ({
  jy,
  todayKey,
  activeMonth,
  tasksForDate,
  onOpenMonth,
}) => {
  const months = useMemo(() => {
    return PERSIAN_MONTH_NAMES.map((name, index) => {
      const jm = index + 1;
      const monthLength = getJalaliMonthLength(jy, jm);
      const firstDayOfWeek = getJalaliMonthFirstDayOfWeek(jy, jm);

      const days: MiniDay[] = [];
      let taskCount = 0;

      for (let day = 1; day <= monthLength; day++) {
        const dateKey = formatJalaliKey({ jy, jm, jd: day });
        const tasks = tasksForDate(dateKey);
        const holidays = getHolidaysForDate(dateKey);
        const isFriday = (firstDayOfWeek + day - 1) % 7 === 6;

        taskCount += tasks.length;
        days.push({
          dateKey,
          dayNumber: day,
          isToday: dateKey === todayKey,
          isRedDay: isFriday || holidays.some((holiday) => holiday.isOfficial),
          hasTasks: tasks.length > 0,
        });
      }

      return { name, jm, firstDayOfWeek, days, taskCount };
    });
  }, [jy, todayKey, tasksForDate]);

  return (
    <div
      className="h-full overflow-y-auto no-scrollbar pb-28 pt-3 lg:overflow-hidden lg:pb-4"
      dir="rtl"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:h-full lg:max-w-none lg:grid-cols-4 lg:grid-rows-3">
        {months.map((month) => {
          const isActive = month.jm === activeMonth;

          return (
            <button
              key={month.name}
              type="button"
              onClick={() => onOpenMonth(month.jm)}
              aria-label={`نمایش ${month.name} ${toPersianDigits(jy)}`}
              className={cn(
                'group flex min-h-0 flex-col gap-2 rounded-2xl border bg-card/40 p-2.5 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3.5',
                isActive
                  ? 'border-foreground/15 bg-secondary/40 dark:border-white/10 dark:bg-black/25'
                  : 'border-border/25 hover:border-border/60 hover:bg-secondary/30 dark:hover:bg-black/20'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-darvish text-sm font-bold text-foreground sm:text-base">
                  {month.name}
                </h2>
                <span className="text-[9.5px] text-muted-foreground/80">
                  {month.taskCount > 0 ? `${toPersianDigits(month.taskCount)} کار` : 'بدون کار'}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
                {PERSIAN_WEEKDAY_SHORT_NAMES.map((weekday, index) => (
                  <span
                    key={`${weekday}-${index}`}
                    className={cn(
                      'flex h-4 items-center justify-center text-[8px] font-semibold lg:h-full',
                      index === 6 ? 'text-rose-500/70' : 'text-muted-foreground/60'
                    )}
                  >
                    {weekday}
                  </span>
                ))}

                {Array.from({ length: month.firstDayOfWeek }).map((_, index) => (
                  <span key={`empty-${index}`} className="h-[18px] lg:self-center" />
                ))}

                {month.days.map((day) => (
                  <span
                    key={day.dateKey}
                    className={cn(
                      'relative mx-auto flex size-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-medium tabular-nums sm:text-[10px] lg:self-center lg:text-[11px]',
                      day.isToday
                        ? day.isRedDay
                          ? 'bg-rose-500 font-bold text-white shadow-xs'
                          : 'bg-neutral-900 font-bold text-white dark:bg-white dark:text-neutral-900'
                        : day.isRedDay
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-foreground/80'
                    )}
                  >
                    {toPersianDigits(day.dayNumber)}
                    {day.hasTasks && (
                      <span
                        className={cn(
                          'absolute bottom-[1px] left-1/2 size-[3px] -translate-x-1/2 rounded-full',
                          day.isToday
                            ? day.isRedDay
                              ? 'bg-white/90'
                              : 'bg-white/80 dark:bg-neutral-900/80'
                            : 'bg-foreground/40'
                        )}
                      />
                    )}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
