import React, { useEffect, useMemo, useState } from 'react';
import type { Task, Tag, TimeOfDay } from '@/types/models';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { QuickCaptureInput } from '@/components/capture/QuickCaptureInput';
import { CalendarAddRow } from './CalendarAddRow';
import { TIME_OF_DAY_SECTIONS } from '@/components/stream/timeOfDayConfig';
import { getHolidaysForDate } from '@/lib/holidays';
import { jalaliToDate, parseJalaliKey, toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { RiAddLine, RiCalendarEventLine, RiCheckLine } from '@remixicon/react';
import { getTaskSection, sortTasksForAgenda } from './calendarUtils';

interface CalendarDayViewProps {
  dateKey: string;
  tasks: Task[];
  tagsMap: Record<string, Tag>;
  isToday: boolean;
  onStatusChanged: () => void;
  onDropTask?: (taskId: string, timeOfDay: TimeOfDay) => void;
  onDragStartTask?: (e: React.DragEvent, taskId: string) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  dateKey,
  tasks,
  tagsMap,
  isToday,
  onStatusChanged,
  onDropTask,
  onDragStartTask,
}) => {
  const [dragOverSection, setDragOverSection] = useState<TimeOfDay | null>(null);
  const [inlineAdd, setInlineAdd] = useState<TimeOfDay | null>(null);

  useEffect(() => {
    setInlineAdd(null);
  }, [dateKey]);

  const { grouped, doneCount } = useMemo(() => {
    const map: Record<TimeOfDay, Task[]> = {
      anytime: [],
      morning: [],
      day: [],
      evening: [],
    };
    tasks.forEach((task) => {
      map[getTaskSection(task)].push(task);
    });
    (Object.keys(map) as TimeOfDay[]).forEach((key) => {
      map[key] = sortTasksForAgenda(map[key]);
    });
    return {
      grouped: map,
      doneCount: tasks.filter((task) => task.status === 'done').length,
    };
  }, [tasks]);

  const holidays = useMemo(() => getHolidaysForDate(dateKey), [dateKey]);
  const isFriday = useMemo(() => {
    const j = parseJalaliKey(dateKey);
    return jalaliToDate(j.jy, j.jm, j.jd).getDay() === 5;
  }, [dateKey]);

  const hasOfficialHoliday = holidays.some((holiday) => holiday.isOfficial);
  const isRedDay = hasOfficialHoliday || isFriday;

  const renderInlineComposer = (timeOfDay: TimeOfDay) => (
    <QuickCaptureInput
      key={`${dateKey}-${timeOfDay}`}
      variant="inline"
      currentSelectedDateKey={dateKey}
      initialTimeOfDay={timeOfDay}
      onItemCreated={() => onStatusChanged()}
      onClose={() => setInlineAdd(null)}
    />
  );

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-28" dir="rtl">
      <div className="flex items-center px-4 pb-1 pt-3 sm:px-6">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
          <span className="font-medium text-foreground">
            {isToday ? 'برنامه امروز' : 'برنامه این روز'}
          </span>
          <span className="opacity-40">·</span>
          <span>{toPersianDigits(tasks.length)} کار</span>
          {doneCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                <RiCheckLine className="size-3" />
                {toPersianDigits(doneCount)}
              </span>
            </>
          )}
        </div>
      </div>

      {(holidays.length > 0 || isFriday) && (
        <div
          className={cn(
            'mx-4 mt-2 rounded-2xl border px-3.5 py-2.5 sm:mx-6',
            isRedDay
              ? 'border-rose-500/20 bg-rose-500/[0.06]'
              : 'border-border/50 bg-secondary/30'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-semibold',
              isRedDay ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
            )}
          >
            <RiCalendarEventLine className="size-3.5 shrink-0" />
            <span>{hasOfficialHoliday ? 'تعطیل رسمی' : isFriday ? 'تعطیل' : 'مناسبت روز'}</span>
          </div>

          {holidays.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {holidays.map((holiday, index) => (
                <li
                  key={`${holiday.title}-${index}`}
                  className={cn(
                    'text-xs leading-relaxed',
                    holiday.isOfficial
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {holiday.title}
                </li>
              ))}
            </ul>
          )}

          {isFriday && !hasOfficialHoliday && (
            <p className="mt-1 text-xs leading-relaxed text-rose-600 dark:text-rose-400">
              جمعه، پایان هفته
            </p>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-10 pt-8 text-center">
          <img
            src="/empty-today.png"
            alt=""
            className="h-32 w-32 select-none object-contain sm:h-36 sm:w-36"
            draggable={false}
          />
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {isToday ? 'امروز کاری برای انجام دادن نیست' : 'برای این روز کاری تعریف نشده است'}
          </p>
          <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-muted-foreground/75">
            از دکمه زیر شروع کن یا یک کار را از روزهای دیگر به اینجا منتقل کن.
          </p>
          {inlineAdd ? (
            <div className="mt-4 w-full max-w-[420px] text-right">
              {renderInlineComposer(inlineAdd)}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setInlineAdd('anytime')}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer active:scale-95 dark:bg-white dark:text-neutral-900"
            >
              <RiAddLine className="size-4" />
              افزودن کار
            </button>
          )}
        </div>
      ) : (
        <div className="w-full">
          {TIME_OF_DAY_SECTIONS.map((section) => {
            const sectionTasks = grouped[section.key];
            const isDragOver = dragOverSection === section.key;

            return (
              <section
                key={section.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverSection !== section.key) setDragOverSection(section.key);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverSection(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain');
                  setDragOverSection(null);
                  if (taskId) onDropTask?.(taskId, section.key);
                }}
                className={cn(
                  'transition-colors duration-150',
                  isDragOver && 'bg-primary/[0.04]'
                )}
              >
                <div className="flex items-center px-6 pb-1 pt-3.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium select-none',
                      section.pillClasses
                    )}
                  >
                    <HugeiconsIcon
                      icon={section.icon}
                      size={15}
                      className="shrink-0 text-current opacity-70"
                    />
                    <span className="tracking-tight">{section.label}</span>
                    <span className="font-normal tabular-nums opacity-70">
                      ({toPersianDigits(sectionTasks.length)})
                    </span>
                  </span>
                </div>

                {sectionTasks.length > 0 && (
                  <div className="w-full">
                    {sectionTasks.map((task, index) => (
                      <TaskItemRow
                        key={task.id}
                        task={task}
                        tagsMap={tagsMap}
                        currentDateKey={dateKey}
                        onStatusChanged={onStatusChanged}
                        draggable
                        onDragStart={(e) => onDragStartTask?.(e, task.id)}
                        isLast={index === sectionTasks.length - 1}
                      />
                    ))}
                  </div>
                )}

                <div className="px-4 pb-2 pt-1 sm:px-6">
                  {inlineAdd === section.key ? (
                    renderInlineComposer(section.key)
                  ) : (
                    <CalendarAddRow
                      label={sectionTasks.length === 0 ? section.emptyHint : 'افزودن کار'}
                      ariaLabel={`افزودن کار به ${section.label}`}
                      onClick={() => setInlineAdd(section.key)}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
