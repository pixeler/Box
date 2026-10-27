import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Tag, TimeOfDay } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import {
  parseJalaliKey,
  formatJalaliKey,
  getTodayJalaliKey,
  getWeekDaysForDate,
  toPersianDigits,
  PERSIAN_MONTH_NAMES,
  jalaliToDate,
  getJalaliMonthLength,
  extractDateOnly,
  getJalaliDate,
  formatJalaliDisplay,
  formatTaskDateDisplay,
} from '@/lib/jalali';
import { isTaskOccurringOnDate } from '@/lib/recurrence';
import { getHolidaysForDate } from '@/lib/holidays';
import { cn, getTaskPencilPattern } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { TaskEditModal } from '@/components/task/TaskEditModal';
import { QuickCaptureInput } from '@/components/capture/QuickCaptureInput';
import { TIME_OF_DAY_SECTIONS } from '@/components/stream/timeOfDayConfig';
import { useIsMobile } from '@/lib/device';
import { CalendarHeader } from './CalendarHeader';
import { CalendarAddRow } from './CalendarAddRow';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarYearView } from './CalendarYearView';
import type { CalendarViewMode } from './calendarUtils';
import {
  formatWeekRange,
  getTaskSection,
  getWeekOfMonthLabel,
  priorityDotClass,
  sortTasksForAgenda,
} from './calendarUtils';
import {
  RiArrowLeftSLine,
  RiCheckLine,
  RiCloseLine,
  RiHistoryLine,
  RiSunLine,
  RiTimeLine,
} from '@remixicon/react';

function formatDurationPersian(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours} ساعت و ${rest} دقیقه`;
  if (hours > 0) return `${hours} ساعت`;
  return `${rest} دقیقه`;
}

function formatTaskTimeRange(startTime?: string, durationMinutes?: number): string {
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':');
  const startHour = parseInt(hours, 10) || 0;
  const startMinute = parseInt(minutes, 10) || 0;
  const duration = durationMinutes || 30;
  const endTotal = startHour * 60 + startMinute + duration;
  const endHour = Math.floor(endTotal / 60) % 24;
  const endMinute = endTotal % 60;
  return `${startTime} - ${endHour.toString().padStart(2, '0')}:${endMinute
    .toString()
    .padStart(2, '0')}`;
}

interface CalendarViewProps {
  selectedDateKey: string;
  enableDaySections?: boolean;
  refreshTrigger?: any;
  onSelectDate: (dateKey: string) => void;
  onOpenAddForDate?: (dateKey: string) => void;
  onExitCalendar?: () => void;
  onTaskChanged?: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 64;

// The 1px rules are drawn by the cells themselves instead of by the grid's own
// background, so the grid surface can stay the page colour and the selected
// day's rounded corners reveal the page rather than a border-coloured wedge.
const cellRuleX = 'shadow-[-1px_0_0_0_var(--grid-line)]';
const cellRuleXY = 'shadow-[0_-1px_0_0_var(--grid-line),-1px_0_0_0_var(--grid-line)]';

/**
 * Paints the selected day across the timeline viewport rather than across the
 * scrolling content, so both of its rounded ends stay visible at any scroll
 * position. The columns match the grid template of the content it sits behind.
 */
const SelectedDayViewportFill: React.FC<{
  days: Array<{ formattedDate: string }>;
  selectedDateKey: string;
}> = ({ days, selectedDateKey }) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] grid-rows-[100%] gap-px"
  >
    <div />
    {days.map((day) => (
      <div
        key={day.formattedDate}
        className={cn(
          day.formattedDate === selectedDateKey && 'rounded-b-xl bg-cell-selected'
        )}
      />
    ))}
  </div>
);

// The add control belongs to the bottom of each week cell and only appears
// while that cell is hovered or one of its controls has keyboard focus.
const weekAddRevealClass =
  'pointer-events-none opacity-0 transition-opacity duration-150 group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 group-focus-within/cell:pointer-events-auto group-focus-within/cell:opacity-100';

interface OverdueTaskRowProps {
  task: Task;
  todayKey: string;
  draggable: boolean;
  onOpen: () => void;
  onMoveToToday: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

const OverdueTaskRow: React.FC<OverdueTaskRowProps> = ({
  task,
  todayKey,
  draggable,
  onOpen,
  onMoveToToday,
  onDragStart,
  onDragEnd,
}) => (
  <div
    draggable={draggable}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
    role="button"
    tabIndex={0}
    className={cn(
      'group/overdue flex w-full select-none items-start gap-2 rounded-xl px-2 py-2 text-right outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring',
      draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
    )}
  >
    <span
      className={cn(
        'mt-1.5 size-1.5 shrink-0 rounded-full',
        priorityDotClass(task.priority)
      )}
    />

    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 block text-[11.5px] font-medium leading-snug text-foreground">
        {task.title}
      </span>
      <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
        {formatTaskDateDisplay(
          task.due_date,
          todayKey,
          true,
          task.due_time,
          task.duration_minutes
        )}
      </span>
    </span>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onMoveToToday();
      }}
      aria-label="انتقال به امروز"
      title="انتقال به امروز"
      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 opacity-100 outline-none transition-opacity hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover/overdue:opacity-100 sm:focus-visible:opacity-100"
    >
      <RiSunLine className="size-3.5" />
    </button>
  </div>
);

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDateKey,
  enableDaySections = false,
  refreshTrigger,
  onSelectDate,
  onOpenAddForDate,
  onExitCalendar: _onExitCalendar,
  onTaskChanged,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDateKey, setCurrentDateKey] = useState<string>(
    () => selectedDateKey || getTodayJalaliKey()
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [_isLoading, setIsLoading] = useState(false);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const [resizingTask, setResizingTask] = useState<{
    id: string;
    startY: number;
    initialDuration: number;
    currentDuration: number;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [weekComposer, setWeekComposer] = useState<{
    dateKey: string;
    timeOfDay: TimeOfDay;
  } | null>(null);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const isMobile = useIsMobile();

  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  });

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const periodAnimRef = useRef<HTMLDivElement>(null);

  // A short, direction-aware slide when the period steps forward or back. Runs
  // through the Web Animations API so the grid is never remounted and the
  // timeline keeps its scroll position.
  const animatePeriodShift = useCallback((direction: 'prev' | 'next') => {
    const node = periodAnimRef.current;
    if (!node || typeof node.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const offset = direction === 'next' ? -18 : 18;
    node.animate(
      [
        { opacity: 0.35, transform: `translate3d(${offset}px, 0, 0)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, []);

  useEffect(() => {
    if (!selectedDateKey) return;
    setCurrentDateKey((previous) =>
      previous === selectedDateKey ? previous : selectedDateKey
    );
  }, [selectedDateKey]);

  useEffect(() => {
    setWeekComposer(null);
  }, [viewMode, currentDateKey]);

  useEffect(() => {
    if (viewMode !== 'week') setOverdueOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (!overdueOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverdueOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [overdueOpen, isMobile]);

  useEffect(() => {
    if (isMobile || viewMode !== 'week' || enableDaySections) return;
    const timer = window.setInterval(() => {
      const now = new Date();
      setCurrentTime({ hour: now.getHours(), minute: now.getMinutes() });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isMobile, viewMode, enableDaySections]);

  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTasks, allTags] = await Promise.all([taskRepo.list(), tagRepo.listAll()]);
      setTasks(allTasks);
      const nextTagsMap: Record<string, Tag> = {};
      allTags.forEach((tag) => {
        nextTagsMap[tag.id] = tag;
      });
      setTagsMap(nextTagsMap);
    } catch (error) {
      console.error('Failed to load calendar data', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData, refreshTrigger]);

  useEffect(() => {
    const handleTaskUpdated = () => loadCalendarData();
    window.addEventListener('task-updated', handleTaskUpdated);
    window.addEventListener('focus', handleTaskUpdated);
    return () => {
      window.removeEventListener('task-updated', handleTaskUpdated);
      window.removeEventListener('focus', handleTaskUpdated);
    };
  }, [loadCalendarData]);

  useEffect(() => {
    if (!resizingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingTask.startY;
      const deltaMinutes = Math.round(deltaY / 16) * 15;
      const nextDuration = Math.max(15, resizingTask.initialDuration + deltaMinutes);
      setResizingTask((previous) =>
        previous ? { ...previous, currentDuration: nextDuration } : null
      );
    };

    const handleMouseUp = async () => {
      const finalDuration = resizingTask.currentDuration;
      const taskId = resizingTask.id;
      const initialDuration = resizingTask.initialDuration;
      setResizingTask(null);

      if (finalDuration !== initialDuration) {
        try {
          await taskRepo.update(taskId, { duration_minutes: finalDuration });
          await loadCalendarData();
          onTaskChanged?.();
          toast.show(`مدت زمان به ${toPersianDigits(formatDurationPersian(finalDuration))} تنظیم شد`);
        } catch (error) {
          console.error('Failed to update task duration', error);
          toast.show('خطا در تغییر مدت زمان تسک');
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTask, loadCalendarData, onTaskChanged]);

  const handleResizeStart = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    e.preventDefault();
    const initialDuration = Math.max(15, task.duration_minutes || 30);
    setResizingTask({
      id: task.id,
      startY: e.clientY,
      initialDuration,
      currentDuration: initialDuration,
    });
  };

  const toggleTaskDone = useCallback(
    async (task: Task, dateKey: string) => {
      try {
        await taskRepo.toggleDone(task.id, dateKey);
        await loadCalendarData();
        onTaskChanged?.();
      } catch (error) {
        console.error('Failed to toggle task status', error);
      }
    },
    [loadCalendarData, onTaskChanged]
  );

  const handleStatusChanged = useCallback(() => {
    loadCalendarData();
    onTaskChanged?.();
  }, [loadCalendarData, onTaskChanged]);

  const parsedCurrent = useMemo(() => parseJalaliKey(currentDateKey), [currentDateKey]);
  const todayKey = useMemo(() => getTodayJalaliKey(), []);
  const todayParsed = useMemo(() => parseJalaliKey(todayKey), [todayKey]);

  const weekDays = useMemo(() => {
    const anchor = jalaliToDate(parsedCurrent.jy, parsedCurrent.jm, parsedCurrent.jd);
    return getWeekDaysForDate(anchor);
  }, [parsedCurrent]);

  const weekContainsToday = useMemo(
    () => weekDays.some((day) => day.formattedDate === todayKey),
    [weekDays, todayKey]
  );

  const getTasksForDate = useCallback(
    (dateKey: string): Task[] => {
      const targetDate = extractDateOnly(dateKey);
      return tasks
        .filter((task) => {
          if (task.status === 'dropped') return false;
          return isTaskOccurringOnDate(task, targetDate);
        })
        .map((task) => {
          if (task.recurrence_rule && task.recurrence_rule !== 'none') {
            const isDoneOnDate = (task.done_dates || [])
              .map(extractDateOnly)
              .includes(targetDate);
            return { ...task, status: isDoneOnDate ? 'done' : 'open' } as Task;
          }
          return task;
        });
    },
    [tasks]
  );

  const weekTasks = useMemo(
    () =>
      weekDays.map((day) => {
        const dayTasks = getTasksForDate(day.formattedDate);
        return {
          day,
          tasks: dayTasks,
          sortedTasks: sortTasksForAgenda(dayTasks),
        };
      }),
    [weekDays, getTasksForDate]
  );

  const overdueTasks = useMemo(() => {
    const todayDate = extractDateOnly(todayKey);
    return tasks
      .filter((task) => {
        if (task.status !== 'open') return false;
        const due = extractDateOnly(task.due_date);
        if (!due || due >= todayDate) return false;
        if (
          task.recurrence_rule &&
          task.recurrence_rule !== 'none' &&
          isTaskOccurringOnDate(task, todayDate)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateDiff = extractDateOnly(a.due_date).localeCompare(
          extractDateOnly(b.due_date)
        );
        if (dateDiff !== 0) return dateDiff;
        return (b.priority || 0) - (a.priority || 0);
      });
  }, [tasks, todayKey]);

  const monthTaskCount = useMemo(() => {
    const monthLength = getJalaliMonthLength(parsedCurrent.jy, parsedCurrent.jm);
    let count = 0;
    for (let day = 1; day <= monthLength; day++) {
      const key = formatJalaliKey({
        jy: parsedCurrent.jy,
        jm: parsedCurrent.jm,
        jd: day,
      });
      count += getTasksForDate(key).length;
    }
    return count;
  }, [parsedCurrent.jy, parsedCurrent.jm, getTasksForDate]);

  const isOnToday = useMemo(() => {
    if (viewMode === 'week') return weekContainsToday;
    if (viewMode === 'month') {
      return parsedCurrent.jy === todayParsed.jy && parsedCurrent.jm === todayParsed.jm;
    }
    return parsedCurrent.jy === todayParsed.jy;
  }, [viewMode, currentDateKey, todayKey, weekContainsToday, parsedCurrent, todayParsed]);

  const scrollTimelineToNow = useCallback(() => {
    if (!timelineScrollRef.current) return;
    const hour = weekContainsToday ? currentTime.hour + currentTime.minute / 60 : 8;
    timelineScrollRef.current.scrollTop = Math.max(0, hour * HOUR_HEIGHT - HOUR_HEIGHT);
  }, [weekContainsToday, currentTime.hour, currentTime.minute]);

  useEffect(() => {
    if (isMobile || viewMode !== 'week' || enableDaySections) return;
    const timer = window.setTimeout(() => {
      if (!timelineScrollRef.current) return;
      const now = new Date();
      const hour = weekContainsToday
        ? now.getHours() + now.getMinutes() / 60
        : 8;
      timelineScrollRef.current.scrollTop = Math.max(
        0,
        hour * HOUR_HEIGHT - HOUR_HEIGHT
      );
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isMobile, viewMode, enableDaySections, currentDateKey, weekContainsToday]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'week') {
      return formatWeekRange(weekDays);
    }
    if (viewMode === 'month') {
      return `${PERSIAN_MONTH_NAMES[parsedCurrent.jm - 1]} ${toPersianDigits(
        parsedCurrent.jy
      )}`;
    }
    return toPersianDigits(parsedCurrent.jy);
  }, [viewMode, parsedCurrent, weekDays]);

  const headerSubtitle = useMemo(() => {
    if (viewMode === 'week') {
      return getWeekOfMonthLabel(weekDays);
    }
    if (viewMode === 'month') {
      return `${toPersianDigits(
        getJalaliMonthLength(parsedCurrent.jy, parsedCurrent.jm)
      )} روز · ${toPersianDigits(monthTaskCount)} کار`;
    }
    return 'نمای سالانه';
  }, [
    viewMode,
    currentDateKey,
    todayKey,
    parsedCurrent,
    weekContainsToday,
    monthTaskCount,
  ]);

  const openDay = useCallback(
    (dateKey: string) => {
      setCurrentDateKey(dateKey);
      onSelectDate(dateKey);
    },
    [onSelectDate]
  );

  const openMonth = useCallback(
    (jm: number) => {
      setViewMode('month');
      setCurrentDateKey(formatJalaliKey({ jy: parsedCurrent.jy, jm, jd: 1 }));
    },
    [parsedCurrent.jy]
  );

  const handleModeChange = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
  }, []);

  const handlePickMonth = useCallback((jm: number, jy: number) => {
    setViewMode('month');
    setCurrentDateKey(formatJalaliKey({ jy, jm, jd: 1 }));
  }, []);

  const handleNavigatePrev = useCallback(() => {
    animatePeriodShift('prev');
    if (viewMode === 'week') {
      const date = jalaliToDate(parsedCurrent.jy, parsedCurrent.jm, parsedCurrent.jd);
      date.setDate(date.getDate() - 7);
      setCurrentDateKey(formatJalaliKey(getJalaliDate(date)));
    } else if (viewMode === 'month') {
      const previousMonth = parsedCurrent.jm === 1 ? 12 : parsedCurrent.jm - 1;
      const previousYear = parsedCurrent.jm === 1 ? parsedCurrent.jy - 1 : parsedCurrent.jy;
      setCurrentDateKey(formatJalaliKey({ jy: previousYear, jm: previousMonth, jd: 1 }));
    } else {
      setCurrentDateKey(
        formatJalaliKey({ jy: parsedCurrent.jy - 1, jm: parsedCurrent.jm, jd: 1 })
      );
    }
  }, [viewMode, parsedCurrent, animatePeriodShift]);

  const handleNavigateNext = useCallback(() => {
    animatePeriodShift('next');
    if (viewMode === 'week') {
      const date = jalaliToDate(parsedCurrent.jy, parsedCurrent.jm, parsedCurrent.jd);
      date.setDate(date.getDate() + 7);
      setCurrentDateKey(formatJalaliKey(getJalaliDate(date)));
    } else if (viewMode === 'month') {
      const nextMonth = parsedCurrent.jm === 12 ? 1 : parsedCurrent.jm + 1;
      const nextYear = parsedCurrent.jm === 12 ? parsedCurrent.jy + 1 : parsedCurrent.jy;
      setCurrentDateKey(formatJalaliKey({ jy: nextYear, jm: nextMonth, jd: 1 }));
    } else {
      setCurrentDateKey(
        formatJalaliKey({ jy: parsedCurrent.jy + 1, jm: parsedCurrent.jm, jd: 1 })
      );
    }
  }, [viewMode, parsedCurrent, animatePeriodShift]);

  const handleToday = useCallback(() => {
    setCurrentDateKey(todayKey);
    if (!isMobile && viewMode === 'week' && !enableDaySections) {
      window.setTimeout(scrollTimelineToNow, 80);
    }
  }, [todayKey, viewMode, scrollTimelineToNow, isMobile, enableDaySections]);

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleCellDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCell !== cellId) setDragOverCell(cellId);
  };

  const handleCellDragLeave = () => {
    setDragOverCell(null);
  };

  const handleCellDrop = async (
    e: React.DragEvent,
    targetDateKey: string,
    options?: { timeOfDay?: TimeOfDay; hour?: number }
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverCell(null);
    setDraggedTaskId(null);

    if (!taskId) return;

    try {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;

      const patch: Partial<Task> = { due_date: targetDateKey };

      if (options?.timeOfDay) {
        patch.time_of_day = options.timeOfDay;
        if (options.timeOfDay === 'anytime') patch.due_time = undefined;
      }

      if (options?.hour !== undefined) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetY = Math.max(0, e.clientY - rect.top);
        const quarter = Math.min(3, Math.max(0, Math.floor((offsetY / HOUR_HEIGHT) * 4)));
        patch.due_time = `${options.hour.toString().padStart(2, '0')}:${(quarter * 15)
          .toString()
          .padStart(2, '0')}`;
        if (!task.duration_minutes || task.duration_minutes < 15) {
          patch.duration_minutes = 30;
        }
        patch.time_of_day = undefined;
      }

      if (task.recurrence_rule && task.recurrence_rule !== 'none') {
        patch.recurrence_start_date = targetDateKey;
      }

      await taskRepo.update(taskId, patch);
      await loadCalendarData();
      onTaskChanged?.();
      toast.show(`کار به تاریخ ${toPersianDigits(targetDateKey)} منتقل شد`);
    } catch (error) {
      console.error('Failed to move task on drop', error);
      toast.show('خطا در انتقال کار');
    }
  };

  const currentLiveTop = useMemo(
    () => currentTime.hour * HOUR_HEIGHT + (currentTime.minute / 60) * HOUR_HEIGHT,
    [currentTime]
  );

  const handleWeekItemCreated = useCallback(async () => {
    await loadCalendarData();
    onTaskChanged?.();
  }, [loadCalendarData, onTaskChanged]);

  const moveOverdueToToday = useCallback(
    async (taskId: string) => {
      try {
        await taskRepo.update(taskId, { due_date: todayKey });
        await loadCalendarData();
        onTaskChanged?.();
        toast.show('کار به امروز منتقل شد');
      } catch (error) {
        console.error('Failed to move overdue task', error);
        toast.show('خطا در انتقال کار');
      }
    },
    [todayKey, loadCalendarData, onTaskChanged]
  );

  const renderOverdueRows = (draggable: boolean) =>
    overdueTasks.map((task) => (
      <OverdueTaskRow
        key={task.id}
        task={task}
        todayKey={todayKey}
        draggable={draggable}
        onOpen={() => setEditingTask(task)}
        onMoveToToday={() => moveOverdueToToday(task.id)}
        onDragStart={
          draggable ? (e) => handleTaskDragStart(e, task.id) : undefined
        }
        onDragEnd={draggable ? () => setDraggedTaskId(null) : undefined}
      />
    ));

  const renderWeekInlineComposer = (dateKey: string, timeOfDay: TimeOfDay) => (
    <QuickCaptureInput
      key={`${dateKey}-${timeOfDay}`}
      variant="inline"
      currentSelectedDateKey={dateKey}
      initialTimeOfDay={timeOfDay}
      onItemCreated={handleWeekItemCreated}
      onClose={() => setWeekComposer(null)}
    />
  );

  return (
    <div
      className="calendar-smooth-open flex h-full w-full select-none flex-col overflow-hidden text-foreground"
      dir="rtl"
    >
      <CalendarHeader
        mode={viewMode}
        title={headerTitle}
        subtitle={headerSubtitle}
        isOnToday={isOnToday}
        currentYear={parsedCurrent.jy}
        currentMonth={parsedCurrent.jm}
        onPrev={handleNavigatePrev}
        onNext={handleNavigateNext}
        onToday={handleToday}
        onModeChange={handleModeChange}
        onPickMonth={handlePickMonth}
        onOpenAdd={
          onOpenAddForDate ? () => onOpenAddForDate(currentDateKey) : undefined
        }
      />

      <div ref={periodAnimRef} className="min-h-0 flex-1 px-6 sm:px-12">
        {viewMode === 'week' && (
          <div className="h-full min-h-0 w-full">
            {isMobile ? (
              <div className="h-full overflow-y-auto no-scrollbar pb-28 pt-2">
              {overdueTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOverdueOpen(true)}
                  className="mb-2 flex w-full items-center gap-2 rounded-2xl border border-border/50 bg-card/45 px-3 py-2 text-right outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RiHistoryLine className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-[11.5px] font-medium text-foreground">
                    کارهای عقب‌افتاده
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {toPersianDigits(overdueTasks.length)}
                  </span>
                  <RiArrowLeftSLine className="size-3.5 shrink-0 text-muted-foreground/60" />
                </button>
              )}
              {weekTasks.map(({ day, sortedTasks: dayTasks }) => {
                const holidays = getHolidaysForDate(day.formattedDate);
                const isToday = day.formattedDate === todayKey;
                const isFriday = day.isFriday;
                const isRedDay = isFriday || holidays.some((holiday) => holiday.isOfficial);

                return (
                  <div
                    key={day.formattedDate}
                    className={cn(
                      'mb-2 overflow-hidden rounded-2xl border bg-card/40 transition-colors',
                      isToday
                        ? 'border-foreground/15 bg-secondary/30 dark:bg-black/25'
                        : 'border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => openDay(day.formattedDate)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-right cursor-pointer"
                      >
                        <span
                          className={cn(
                            'flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border',
                            isToday
                              ? isRedDay
                                ? 'border-transparent bg-rose-500 text-white dark:bg-rose-500 dark:text-white'
                                : 'border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                              : 'border-border/50 bg-secondary/40'
                          )}
                        >
                          <span className="font-darvish text-base font-bold leading-none tabular-nums">
                            {toPersianDigits(day.dayNumber)}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 text-[9px] leading-none',
                              isToday ? 'opacity-70' : 'text-muted-foreground'
                            )}
                          >
                            {day.dayShortName}
                          </span>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'truncate font-darvish text-sm font-bold',
                                isRedDay && !isToday
                                  ? 'text-rose-500 dark:text-rose-400'
                                  : 'text-foreground'
                              )}
                            >
                              {day.dayName}
                            </span>
                            {isToday && (
                              <span className="shrink-0 rounded-full bg-foreground/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-foreground">
                                امروز
                              </span>
                            )}
                            {dayTasks.length > 0 && (
                              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                {toPersianDigits(dayTasks.length)} کار
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 block truncate text-[10.5px]',
                              isRedDay
                                ? 'text-rose-500/80 dark:text-rose-400/80'
                                : 'text-muted-foreground'
                            )}
                          >
                            {holidays[0]?.title ||
                              (isFriday ? 'تعطیل' : formatJalaliDisplay(day.jalali))}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openDay(day.formattedDate)}
                        aria-label={`نمایش روز ${day.dayName}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                      >
                        <RiArrowLeftSLine className="size-4" />
                      </button>
                    </div>

                    {dayTasks.length > 0 && (
                      <div className="border-t border-border/40">
                        {dayTasks.map((task, index) => (
                          <TaskItemRow
                            key={task.id}
                            task={task}
                            tagsMap={tagsMap}
                            currentDateKey={day.formattedDate}
                            onStatusChanged={handleStatusChanged}
                            compact
                            isLast={index === dayTasks.length - 1}
                          />
                        ))}
                      </div>
                    )}

                    <div className={cn('p-2', dayTasks.length > 0 && 'border-t border-border/40')}>
                      {weekComposer?.dateKey === day.formattedDate ? (
                        renderWeekInlineComposer(day.formattedDate, weekComposer.timeOfDay)
                      ) : (
                        <CalendarAddRow
                          onClick={() =>
                            setWeekComposer({ dateKey: day.formattedDate, timeOfDay: 'anytime' })
                          }
                          ariaLabel={`افزودن کار برای ${day.dayName}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
            <div className="flex h-full min-h-0 flex-row">
              {overdueOpen && (
                <aside
                  id="week-overdue-panel"
                  aria-label="کارهای عقب‌افتاده"
                  className="flex w-[264px] shrink-0 animate-in fade-in slide-in-from-right-2 flex-col border-e border-border/50 bg-card/45 duration-200"
                >
                  <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
                    <RiHistoryLine className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-foreground">
                        کارهای عقب‌افتاده
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {overdueTasks.length > 0
                          ? `${toPersianDigits(overdueTasks.length)} کار از قبل امروز`
                          : 'چیزی عقب نیفتاده'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOverdueOpen(false)}
                      aria-label="بستن کارهای عقب‌افتاده"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RiCloseLine className="size-4" />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar p-1.5">
                    {overdueTasks.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <RiCheckLine className="size-4" />
                        </span>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          کاری از روزهای قبل باقی نمانده.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {renderOverdueRows(true)}
                      </div>
                    )}
                  </div>

                  {overdueTasks.length > 0 && (
                    <p className="border-t border-border/50 px-3 py-2 text-[9.5px] leading-relaxed text-muted-foreground">
                      هر کار را بکشید و روی روزی در تقویم رها کنید.
                    </p>
                  )}
                </aside>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
              <div className="grid shrink-0 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px border-b border-border/40 bg-background">
                <button
                  type="button"
                  onClick={() => setOverdueOpen((open) => !open)}
                  aria-expanded={overdueOpen}
                  aria-controls="week-overdue-panel"
                  title="کارهای عقب‌افتاده"
                  className={cn(
                    'group flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground outline-none transition-colors hover:bg-secondary/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    overdueOpen ? 'bg-secondary/40 text-foreground' : 'bg-background',
                    cellRuleX
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <RiHistoryLine className="size-[15px]" />
                    {overdueTasks.length > 0 && (
                      <span className="absolute -end-2.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold leading-none text-white">
                        {toPersianDigits(overdueTasks.length)}
                      </span>
                    )}
                  </span>
                  <span className="text-[8.5px] font-medium leading-none">
                    عقب‌افتاده
                  </span>
                </button>

                {weekDays.map((day) => {
                  const holidays = getHolidaysForDate(day.formattedDate);
                  const isToday = day.formattedDate === todayKey;
                  const isRedDay =
                    day.isFriday || holidays.some((holiday) => holiday.isOfficial);

                  return (
                    <button
                      key={day.formattedDate}
                      type="button"
                      onClick={() => openDay(day.formattedDate)}
                      title={`نمایش ${day.dayName}`}
                      className={cn(
                        'group flex flex-col items-center gap-0.5 px-1 pb-2.5 pt-4 transition-colors hover:bg-secondary/30 dark:hover:bg-black/20 cursor-pointer',
                        cellRuleX,
                        day.formattedDate === selectedDateKey
                          ? 'rounded-t-xl bg-cell-selected'
                          : 'bg-background'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full font-darvish text-base font-bold tabular-nums transition-colors',
                          isToday
                            ? isRedDay
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : isRedDay
                            ? 'text-rose-500 dark:text-rose-400'
                            : 'text-foreground group-hover:text-foreground'
                        )}
                      >
                        {toPersianDigits(day.dayNumber)}
                      </span>
                      <span
                        className={cn(
                          'mt-1.5 text-[14.5px] font-medium leading-5',
                          isRedDay
                            ? 'text-rose-500/90 dark:text-rose-400/90'
                            : 'text-muted-foreground'
                        )}
                      >
                        {day.dayName}
                      </span>
                      <span
                        className={cn(
                          'h-3.5 max-w-full truncate text-[9.5px] leading-[14px]',
                          isRedDay
                            ? 'text-rose-500/80 dark:text-rose-400/80'
                            : 'text-muted-foreground/70'
                        )}
                      >
                        {holidays[0]?.title || (day.isFriday ? 'تعطیل' : '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {weekComposer && (
                <div className="shrink-0 border-b border-border/40 bg-secondary/15 px-3 py-2">
                  <div className="mx-auto w-full max-w-[720px]">
                    <div className="mb-1 flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-medium text-foreground">
                        افزودن کار برای{' '}
                        {formatJalaliDisplay(parseJalaliKey(weekComposer.dateKey))}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {
                          TIME_OF_DAY_SECTIONS.find(
                            (section) => section.key === weekComposer.timeOfDay
                          )?.label
                        }
                      </span>
                    </div>
                    {renderWeekInlineComposer(weekComposer.dateKey, weekComposer.timeOfDay)}
                  </div>
                </div>
              )}

              {!enableDaySections && (
                <div className="grid shrink-0 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px bg-background">
                  <div className={cn('flex items-start justify-center bg-background pt-2.5 text-[10px] font-semibold text-muted-foreground', cellRuleX)}>
                    هر زمان
                  </div>

                  {weekDays.map((day, dayIndex) => {
                    const anytimeTasks = weekTasks[dayIndex].tasks.filter(
                      (task) => !task.due_time?.trim()
                    );
                    const cellKey = `anytime-${day.formattedDate}`;
                    const isDragOver = dragOverCell === cellKey;

                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => handleCellDragOver(e, cellKey)}
                        onDragLeave={handleCellDragLeave}
                        onDrop={(e) =>
                          handleCellDrop(e, day.formattedDate, { timeOfDay: 'anytime' })
                        }
                        className={cn(
                          'group/cell flex min-h-[86px] flex-col gap-1 p-1 transition-colors',
                          cellRuleX,
                          day.formattedDate === selectedDateKey
                            ? 'bg-cell-selected'
                            : 'bg-background',
                          isDragOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40'
                        )}
                      >
                        {anytimeTasks.map((task, index) => (
                          <div key={task.id} className="w-full">
                            <TaskItemRow
                              task={task}
                              tagsMap={tagsMap}
                              currentDateKey={day.formattedDate}
                              onStatusChanged={handleStatusChanged}
                              draggable
                              onDragStart={(e) => handleTaskDragStart(e, task.id)}
                              compact
                              isLast={index === anytimeTasks.length - 1}
                              className="px-2 py-1.5"
                            />
                          </div>
                        ))}

                        <div className={cn('mt-auto shrink-0 pt-0.5', weekAddRevealClass)}>
                          <CalendarAddRow
                            compact
                            onClick={() =>
                              setWeekComposer({ dateKey: day.formattedDate, timeOfDay: 'anytime' })
                            }
                            label={anytimeTasks.length === 0 ? 'افزودن کار' : ''}
                            ariaLabel={`افزودن کار برای ${day.dayName}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {enableDaySections ? (
                <div className="relative isolate min-h-0 flex-1">
                  <SelectedDayViewportFill days={weekDays} selectedDateKey={selectedDateKey} />
                  <div className="h-full overflow-y-auto no-scrollbar pb-6">
                  <div className="grid min-h-full grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] items-stretch gap-px bg-transparent">
                    {TIME_OF_DAY_SECTIONS.map((section, sectionIndex) => (
                      <React.Fragment key={section.key}>
                        <div
                          className={cn(
                            'flex min-h-[110px] items-start justify-center bg-background pt-3 text-[10px] font-semibold text-muted-foreground',
                            sectionIndex === 0 ? cellRuleX : cellRuleXY
                          )}
                        >
                          {section.label}
                        </div>

                        {weekDays.map((day, dayIndex) => {
                          const sectionTasks = weekTasks[dayIndex].tasks.filter(
                            (task) => getTaskSection(task) === section.key
                          );
                          const cellKey = `${section.key}-${day.formattedDate}`;
                          const isDragOver = dragOverCell === cellKey;

                          return (
                            <div
                              key={cellKey}
                              onClick={() => openDay(day.formattedDate)}
                              onDragOver={(e) => handleCellDragOver(e, cellKey)}
                              onDragLeave={handleCellDragLeave}
                              onDrop={(e) =>
                                handleCellDrop(e, day.formattedDate, {
                                  timeOfDay: section.key,
                                })
                              }
                              className={cn(
                                'group/cell flex min-h-[110px] flex-col gap-1 p-1 transition-colors cursor-pointer',
                                sectionIndex === 0 ? cellRuleX : cellRuleXY,
                                day.formattedDate === selectedDateKey
                                  ? 'bg-transparent'
                                  : 'bg-background',
                                isDragOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40'
                              )}
                            >
                              {sectionTasks.map((task, index) => (
                                <div
                                  key={task.id}
                                  className="w-full"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <TaskItemRow
                                    task={task}
                                    tagsMap={tagsMap}
                                    currentDateKey={day.formattedDate}
                                    onStatusChanged={handleStatusChanged}
                                    draggable
                                    onDragStart={(e) => handleTaskDragStart(e, task.id)}
                                    compact
                                    isLast={index === sectionTasks.length - 1}
                                    className="px-2 py-1.5"
                                  />
                                </div>
                              ))}

                              <div className={cn('mt-auto shrink-0 pt-0.5', weekAddRevealClass)}>
                                <CalendarAddRow
                                  compact
                                  onClick={() =>
                                    setWeekComposer({
                                      dateKey: day.formattedDate,
                                      timeOfDay: section.key,
                                    })
                                  }
                                  label={sectionTasks.length === 0 ? 'افزودن کار' : ''}
                                  ariaLabel={`افزودن کار به ${section.label} برای ${day.dayName}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                  </div>
                </div>
              ) : (
                <div className="relative isolate min-h-0 flex-1">
                  <SelectedDayViewportFill days={weekDays} selectedDateKey={selectedDateKey} />
                  <div
                    ref={timelineScrollRef}
                    className="h-full overflow-y-auto no-scrollbar pb-6"
                  >
                  <div
                    className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px bg-transparent"
                    style={{ height: HOURS.length * HOUR_HEIGHT }}
                  >
                    <div className={cn('flex flex-col bg-background', cellRuleX)}>
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="flex h-16 shrink-0 items-start justify-center border-b border-border/20 pt-1.5 text-[10px] font-medium tabular-nums text-muted-foreground"
                        >
                          {toPersianDigits(`${hour.toString().padStart(2, '0')}:00`)}
                        </div>
                      ))}
                    </div>

                    {weekDays.map((day, dayIndex) => {
                      const isToday = day.formattedDate === todayKey;
                      const timedTasks = weekTasks[dayIndex].tasks.filter((task) =>
                        Boolean(task.due_time?.trim())
                      );

                      return (
                        <div
                          key={day.formattedDate}
                          className={cn(
                            'relative',
                            cellRuleX,
                            day.formattedDate === selectedDateKey
                              ? 'bg-transparent'
                              : 'bg-background'
                          )}
                          style={{ height: HOURS.length * HOUR_HEIGHT }}
                        >
                          {HOURS.map((hour) => {
                            const cellKey = `hour-${hour}-${day.formattedDate}`;
                            const isDragOver = dragOverCell === cellKey;
                            return (
                              <div
                                key={cellKey}
                                onDragOver={(e) => handleCellDragOver(e, cellKey)}
                                onDragLeave={handleCellDragLeave}
                                onDrop={(e) =>
                                  handleCellDrop(e, day.formattedDate, { hour })
                                }
                                className={cn(
                                  'h-16 border-b border-border/25 transition-colors',
                                  hour === HOURS.length - 1 && 'border-b-0',
                                  isDragOver && 'bg-primary/10'
                                )}
                              />
                            );
                          })}

                          {isToday && (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-30"
                              style={{ top: currentLiveTop }}
                            >
                              <span className="absolute -right-1 -top-[3px] size-2 rounded-full bg-rose-500 shadow-sm" />
                              <div className="h-[2px] w-full bg-rose-500/90" />
                            </div>
                          )}

                          {timedTasks.map((task) => {
                            const [hourText, minuteText] = (task.due_time || '00:00').split(':');
                            const hour = parseInt(hourText, 10) || 0;
                            const minute = parseInt(minuteText, 10) || 0;
                            const topPx = hour * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;

                            const isResizingThis = resizingTask?.id === task.id;
                            const duration = isResizingThis
                              ? resizingTask.currentDuration
                              : Math.max(15, task.duration_minutes || 30);
                            const heightPx = Math.max(
                              18,
                              (duration / 60) * HOUR_HEIGHT - 2
                            );
                            const isDone = task.status === 'done';

                            return (
                              <div
                                key={task.id}
                                draggable={!resizingTask}
                                onDragStart={(e) => handleTaskDragStart(e, task.id)}
                                onClick={() => setEditingTask(task)}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                className={cn(
                                  'group/task absolute inset-x-1 z-10 flex flex-col justify-between overflow-hidden rounded-md border text-xs shadow-xs transition-shadow cursor-pointer select-none',
                                  isDone
                                    ? 'border-border bg-muted/60 text-muted-foreground opacity-60'
                                    : task.priority === 3
                                    ? 'border-rose-500/40 bg-rose-500/10 text-foreground hover:bg-rose-500/20'
                                    : task.priority === 2
                                    ? 'border-amber-500/40 bg-amber-500/10 text-foreground hover:bg-amber-500/20'
                                    : task.priority === 1
                                    ? 'border-blue-500/40 bg-blue-500/10 text-foreground hover:bg-blue-500/20'
                                    : 'border-border/70 bg-card/90 text-foreground hover:border-foreground/30 hover:bg-card',
                                  isResizingThis && 'z-30 shadow-md ring-2 ring-primary'
                                )}
                              >
                                <div className="pointer-events-none flex min-w-0 flex-1 flex-col overflow-hidden p-1">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTaskDone(task, day.formattedDate);
                                      }}
                                      aria-label={isDone ? 'بازگردانی کار' : 'انجام شد'}
                                      className={cn(
                                        'pointer-events-auto flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer',
                                        isDone
                                          ? 'border-primary bg-primary text-primary-foreground'
                                          : 'border-muted-foreground/50 bg-background hover:border-foreground'
                                      )}
                                    >
                                      {isDone && (
                                        <RiCheckLine className="size-2.5 stroke-[3]" />
                                      )}
                                    </button>

                                    <span
                                      className={cn(
                                        'flex-1 font-semibold leading-tight',
                                        heightPx > 36
                                          ? 'line-clamp-2 break-words'
                                          : 'truncate',
                                        'text-[11px]',
                                        isDone && [
                                          'pencil-strike',
                                          getTaskPencilPattern(task.id),
                                          'text-muted-foreground',
                                        ]
                                      )}
                                    >
                                      {task.title}
                                    </span>

                                    {heightPx <= 26 && (
                                      <span className="shrink-0 text-[9px] font-medium text-muted-foreground">
                                        {toPersianDigits(task.due_time || '')}
                                      </span>
                                    )}
                                  </div>

                                  {heightPx > 28 && (
                                    <div className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                                      <RiTimeLine className="size-2.5 shrink-0" />
                                      <span className="tabular-nums">
                                        {toPersianDigits(
                                          formatTaskTimeRange(task.due_time, duration)
                                        )}
                                      </span>
                                    </div>
                                  )}

                                  {heightPx >= 52 && task.description && (
                                    <p className="mt-0.5 line-clamp-1 truncate text-[9px] text-muted-foreground/80">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                {isResizingThis && (
                                  <div className="pointer-events-none absolute -top-7 right-1 z-40 flex items-center gap-1 rounded-md border border-border/50 bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
                                    <span>
                                      {toPersianDigits(formatDurationPersian(duration))}
                                    </span>
                                    <span className="text-[9px] opacity-75">
                                      (
                                      {toPersianDigits(
                                        formatTaskTimeRange(task.due_time, duration)
                                      )}
                                      )
                                    </span>
                                  </div>
                                )}

                                <div
                                  onMouseDown={(e) => handleResizeStart(e, task)}
                                  className="group/resizer z-20 flex h-2 w-full shrink-0 cursor-ns-resize items-center justify-center rounded-b-md transition-colors hover:bg-foreground/20"
                                  title="تغییر مدت زمان (گام‌های ۱۵ دقیقه‌ای)"
                                >
                                  <div className="h-0.5 w-5 rounded-full bg-foreground/30 transition-colors group-hover/resizer:bg-foreground/70" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}
              </div>
            </div>
            )}
          </div>
        )}

        {viewMode === 'month' && (
          <CalendarMonthView
            jy={parsedCurrent.jy}
            jm={parsedCurrent.jm}
            todayKey={todayKey}
            selectedDateKey={selectedDateKey}
            tasksForDate={getTasksForDate}
            tagsMap={tagsMap}
            onStatusChanged={handleStatusChanged}
            onOpenDay={openDay}
            onOpenAddForDate={onOpenAddForDate}
            dragOverCell={dragOverCell}
            onCellDragOver={handleCellDragOver}
            onCellDragLeave={handleCellDragLeave}
            onCellDrop={handleCellDrop}
            onTaskDragStart={handleTaskDragStart}
          />
        )}

        {viewMode === 'year' && (
          <CalendarYearView
            jy={parsedCurrent.jy}
            todayKey={todayKey}
            activeMonth={parsedCurrent.jm}
            tasksForDate={getTasksForDate}
            onOpenMonth={openMonth}
          />
        )}
      </div>

      {isMobile &&
        overdueOpen &&
        createPortal(
          <div className="fixed inset-0 z-[170] flex items-end justify-center" dir="rtl">
            <button
              type="button"
              aria-label="بستن کارهای عقب‌افتاده"
              onClick={() => setOverdueOpen(false)}
              className="absolute inset-0 animate-in bg-black/45 fade-in backdrop-blur-[2px] duration-150"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="کارهای عقب‌افتاده"
              className="relative flex max-h-[72dvh] w-full max-w-lg animate-in flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card shadow-2xl slide-in-from-bottom-4 duration-200"
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />

              <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
                <RiHistoryLine className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    کارهای عقب‌افتاده
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {toPersianDigits(overdueTasks.length)} کار از روزهای قبل
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOverdueOpen(false)}
                  aria-label="بستن"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RiCloseLine className="size-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar border-t border-border/50 px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                {overdueTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <RiCheckLine className="size-4" />
                    </span>
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      کاری از روزهای قبل باقی نمانده.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">{renderOverdueRows(false)}</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSaved={handleStatusChanged}
        />
      )}
    </div>
  );
};
