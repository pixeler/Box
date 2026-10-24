import React, { useEffect, useMemo, useState } from 'react';
import type { Task, Tag } from '@/types/models';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import {
  getJalaliMonthLength,
  getJalaliMonthFirstDayOfWeek,
  formatJalaliKey,
  formatJalaliDisplay,
  getFullPersianWeekdayName,
  jalaliToDate,
  parseJalaliKey,
  toPersianDigits,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_NAMES,
  PERSIAN_WEEKDAY_SHORT_NAMES,
} from '@/lib/jalali';
import { getHolidaysForDate } from '@/lib/holidays';
import { useIsMobile } from '@/lib/device';
import { cn, getTaskPencilPattern } from '@/lib/utils';
import { RiAddLine, RiArrowLeftSLine } from '@remixicon/react';
import {
  priorityDotClass,
  sortTasksForAgenda,
} from './calendarUtils';

interface CalendarMonthViewProps {
  jy: number;
  jm: number;
  todayKey: string;
  selectedDateKey: string;
  tasksForDate: (dateKey: string) => Task[];
  tagsMap: Record<string, Tag>;
  onStatusChanged: () => void;
  onOpenDay: (dateKey: string) => void;
  onOpenAddForDate?: (dateKey: string) => void;
  dragOverCell: string | null;
  onCellDragOver: (e: React.DragEvent, cellId: string) => void;
  onCellDragLeave: () => void;
  onCellDrop: (e: React.DragEvent, dateKey: string) => void;
  onTaskDragStart: (e: React.DragEvent, taskId: string) => void;
}

interface MonthCell {
  dateKey: string;
  dayNumber: number;
  monthName: string;
  inMonth: boolean;
  isToday: boolean;
  isFriday: boolean;
  isRedDay: boolean;
  holidays: Array<{ title: string; isOfficial: boolean }>;
  tasks: Task[];
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  jy,
  jm,
  todayKey,
  selectedDateKey,
  tasksForDate,
  tagsMap,
  onStatusChanged,
  onOpenDay,
  onOpenAddForDate,
  dragOverCell,
  onCellDragOver,
  onCellDragLeave,
  onCellDrop,
  onTaskDragStart,
}) => {
  const isMobile = useIsMobile();
  const [previewDateKey, setPreviewDateKey] = useState<string | null>(null);

  useEffect(() => {
    setPreviewDateKey(null);
  }, [jy, jm]);

  const cells = useMemo<MonthCell[]>(() => {
    const result: MonthCell[] = [];

    const makeCell = (year: number, month: number, day: number, inMonth: boolean): MonthCell => {
      const dateKey = formatJalaliKey({ jy: year, jm: month, jd: day });
      const holidays = getHolidaysForDate(dateKey);
      const isFriday = result.length % 7 === 6;
      return {
        dateKey,
        dayNumber: day,
        monthName: PERSIAN_MONTH_NAMES[month - 1],
        inMonth,
        isToday: dateKey === todayKey,
        isFriday,
        isRedDay: isFriday || holidays.some((holiday) => holiday.isOfficial),
        holidays,
        tasks: tasksForDate(dateKey),
      };
    };

    const firstDayOfWeek = getJalaliMonthFirstDayOfWeek(jy, jm);
    const monthLength = getJalaliMonthLength(jy, jm);

    const prevYear = jm === 1 ? jy - 1 : jy;
    const prevMonth = jm === 1 ? 12 : jm - 1;
    const prevMonthLength = getJalaliMonthLength(prevYear, prevMonth);
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      result.push(makeCell(prevYear, prevMonth, prevMonthLength - i, false));
    }

    for (let day = 1; day <= monthLength; day++) {
      result.push(makeCell(jy, jm, day, true));
    }

    const totalCells = Math.ceil(result.length / 7) * 7;
    const nextYear = jm === 12 ? jy + 1 : jy;
    const nextMonth = jm === 12 ? 1 : jm + 1;
    let nextDay = 1;
    while (result.length < totalCells) {
      result.push(makeCell(nextYear, nextMonth, nextDay, false));
      nextDay += 1;
    }

    return result;
  }, [jy, jm, todayKey, tasksForDate]);

  const previewKey = useMemo(() => {
    if (previewDateKey) {
      const parsed = parseJalaliKey(previewDateKey);
      if (parsed.jy === jy && parsed.jm === jm) return previewDateKey;
    }
    const today = parseJalaliKey(todayKey);
    if (today.jy === jy && today.jm === jm) return todayKey;
    const selected = parseJalaliKey(selectedDateKey);
    if (selected.jy === jy && selected.jm === jm) return selectedDateKey;
    return formatJalaliKey({ jy, jm, jd: 1 });
  }, [previewDateKey, selectedDateKey, todayKey, jy, jm]);

  const previewDate = useMemo(() => {
    const parsed = parseJalaliKey(previewKey);
    const date = jalaliToDate(parsed.jy, parsed.jm, parsed.jd);
    return {
      parsed,
      weekday: getFullPersianWeekdayName(date),
      display: formatJalaliDisplay(parsed),
      holidays: getHolidaysForDate(previewKey),
    };
  }, [previewKey]);

  const previewTasks = useMemo(
    () => sortTasksForAgenda(tasksForDate(previewKey)),
    [previewKey, tasksForDate]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" dir="rtl">
      {/* Desktop month grid */}
      {!isMobile && (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 pb-2 pt-1">
          {PERSIAN_WEEKDAY_NAMES.map((name, index) => (
            <div
              key={name}
              className={cn(
                'text-center font-darvish text-xs',
                index === 6 ? 'text-rose-500/90' : 'text-muted-foreground'
              )}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-24">
          <div className="grid h-full auto-rows-fr grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border/50 bg-border/40">
            {cells.map((cell) => {
              const isDragOver = dragOverCell === cell.dateKey;
              const isSelected = cell.dateKey === selectedDateKey;

              return (
                <div
                  key={cell.dateKey}
                  role="button"
                  tabIndex={0}
                  aria-label={`نمایش روز ${toPersianDigits(cell.dayNumber)} ${cell.monthName}`}
                  onClick={() => onOpenDay(cell.dateKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenDay(cell.dateKey);
                    }
                  }}
                  onDragOver={(e) => onCellDragOver(e, cell.dateKey)}
                  onDragLeave={onCellDragLeave}
                  onDrop={(e) => onCellDrop(e, cell.dateKey)}
                  className={cn(
                    'flex min-h-[104px] flex-col bg-card/55 p-1.5 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !cell.inMonth && 'bg-secondary/[0.18]',
                    cell.inMonth && 'hover:bg-secondary/30 dark:hover:bg-black/20',
                    cell.isToday && 'bg-primary/[0.05] dark:bg-black/25',
                    isSelected && !cell.isToday && 'bg-secondary/40 dark:bg-black/25',
                    isDragOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full font-darvish text-[13px] font-bold tabular-nums',
                        cell.isToday
                          ? cell.isRedDay
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : cell.isRedDay
                          ? 'text-rose-500 dark:text-rose-400'
                          : cell.inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/45'
                      )}
                    >
                      {toPersianDigits(cell.dayNumber)}
                    </span>

                    {cell.inMonth && cell.tasks.length > 0 && (
                      <span className="mt-1 text-[9px] tabular-nums text-muted-foreground/70">
                        {toPersianDigits(cell.tasks.length)}
                      </span>
                    )}
                  </div>

                  {cell.holidays.length > 0 ? (
                    <span
                      className={cn(
                        'mt-0.5 truncate text-[9.5px] leading-tight',
                        cell.isRedDay
                          ? 'font-medium text-rose-500/90 dark:text-rose-400/90'
                          : 'text-muted-foreground/80'
                      )}
                      title={cell.holidays.map((holiday) => holiday.title).join(' • ')}
                    >
                      {cell.holidays[0].title}
                    </span>
                  ) : cell.isFriday ? (
                    <span className="mt-0.5 text-[9.5px] font-medium leading-tight text-rose-500/80 dark:text-rose-400/80">
                      تعطیل
                    </span>
                  ) : null}

                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {cell.tasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          onTaskDragStart(e, task.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDay(cell.dateKey);
                        }}
                        title={task.title}
                        className={cn(
                          'flex cursor-grab items-center gap-1 rounded-md px-1.5 py-[3px] text-[10.5px] font-medium leading-tight transition-colors active:cursor-grabbing',
                          cell.isToday
                            ? 'bg-foreground/[0.06] hover:bg-foreground/10'
                            : 'bg-secondary/60 hover:bg-secondary',
                          task.status === 'done' && 'opacity-60'
                        )}
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            task.status === 'done'
                              ? 'bg-muted-foreground/30'
                              : priorityDotClass(task.priority)
                          )}
                        />
                        <span
                          className={cn(
                            'truncate',
                            task.status === 'done' && [
                              'pencil-strike',
                              getTaskPencilPattern(task.id),
                              'text-muted-foreground',
                            ]
                          )}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}

                    {cell.tasks.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDay(cell.dateKey);
                        }}
                        className="w-full rounded-md px-1.5 py-0.5 text-right text-[9.5px] font-medium text-muted-foreground/80 transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer"
                      >
                        +{toPersianDigits(cell.tasks.length - 3)} کار دیگر
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Mobile compact grid + selected-day preview */}
      {isMobile && (
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-28">
        <div className="grid grid-cols-7 gap-1 px-1">
          {PERSIAN_WEEKDAY_SHORT_NAMES.map((name, index) => (
            <div
              key={`${name}-${index}`}
              className={cn(
                'pb-1 text-center font-darvish text-[11px]',
                index === 6 ? 'text-rose-500/90' : 'text-muted-foreground'
              )}
            >
              {name}
            </div>
          ))}

          {cells.map((cell) =>
            cell.inMonth ? (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setPreviewDateKey(cell.dateKey)}
                className={cn(
                  'flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer active:scale-95',
                  previewKey === cell.dateKey
                    ? 'bg-secondary/60 dark:bg-black/30'
                    : cell.isToday && 'bg-secondary/30 dark:bg-black/20'
                )}
                aria-label={`انتخاب روز ${toPersianDigits(cell.dayNumber)} ${cell.monthName}`}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full font-darvish text-[13px] font-bold tabular-nums',
                    cell.isToday
                      ? cell.isRedDay
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : cell.isRedDay
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-foreground'
                  )}
                >
                  {toPersianDigits(cell.dayNumber)}
                </span>

                <span className="flex h-1 items-center gap-[3px]">
                  {cell.tasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className={cn(
                        'size-1 rounded-full',
                        task.status === 'done'
                          ? 'bg-muted-foreground/30'
                          : priorityDotClass(task.priority)
                      )}
                    />
                  ))}
                </span>
              </button>
            ) : (
              <div key={cell.dateKey} className="h-12" />
            )
          )}
        </div>

        <div className="mt-4 border-t border-border/40 pt-1">
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {previewDate.weekday} {previewDate.display}
              </h2>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {previewTasks.length > 0
                  ? `${toPersianDigits(previewTasks.length)} کار`
                  : 'کاری ثبت نشده'}
                {previewDate.holidays.length > 0 && ` · ${previewDate.holidays[0].title}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenAddForDate?.(previewKey)}
                aria-label="افزودن کار به این روز"
                title="افزودن کار"
                className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer active:scale-95"
              >
                <RiAddLine className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenDay(previewKey)}
                className="inline-flex h-8 items-center gap-0.5 rounded-full border border-border/60 bg-card/60 px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary cursor-pointer active:scale-95"
              >
                باز کردن روز
                <RiArrowLeftSLine className="size-3.5" />
              </button>
            </div>
          </div>

          {previewTasks.length === 0 ? (
            <div className="px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenAddForDate?.(previewKey)}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-border/70 bg-secondary/20 px-3.5 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground cursor-pointer"
              >
                <span>کاری برای این روز برنامه‌ریزی نشده</span>
                <RiAddLine className="size-4" />
              </button>
            </div>
          ) : (
            <div>
              {previewTasks.slice(0, 3).map((task, index) => (
                <TaskItemRow
                  key={task.id}
                  task={task}
                  tagsMap={tagsMap}
                  currentDateKey={previewKey}
                  onStatusChanged={onStatusChanged}
                  isLast={index === Math.min(previewTasks.length, 3) - 1}
                />
              ))}
              {previewTasks.length > 3 && (
                <button
                  type="button"
                  onClick={() => onOpenDay(previewKey)}
                  className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-xl py-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground cursor-pointer"
                >
                  و {toPersianDigits(previewTasks.length - 3)} کار دیگر
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
