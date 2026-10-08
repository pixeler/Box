import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, Tag, TimeOfDay } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import {
  parseJalaliKey,
  formatJalaliKey,
  getTodayJalaliKey,
  getWeekDaysForDate,
  toPersianDigits,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_NAMES,
  jalaliToDate,
  getJalaliMonthLength,
  getJalaliMonthFirstDayOfWeek,
  extractDateOnly,
} from '@/lib/jalali';
import { isTaskOccurringOnDate } from '@/lib/recurrence';
import { getHolidaysForDate, isOfficialHoliday } from '@/lib/holidays';
import { cn, getTaskPencilPattern } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { TaskEditModal } from '@/components/task/TaskEditModal';
import { TIME_OF_DAY_SECTIONS } from '@/components/stream/timeOfDayConfig';
import {
  RiAddLine,
  RiArrowGoBackLine,
  RiCalendar2Line,
  RiGridLine,
  RiLayoutGridLine,
  RiCheckLine,
  RiTimeLine,
} from '@remixicon/react';

function formatDurationPersian(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ساعت و ${m} دقیقه`;
  if (h > 0) return `${h} ساعت`;
  return `${m} دقیقه`;
}

function formatTaskTimeRange(startTime?: string, durationMinutes?: number): string {
  if (!startTime) return '';
  const [hStr, mStr] = startTime.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const dur = durationMinutes || 30;
  const endMinutesTotal = h * 60 + m + dur;
  const endH = Math.floor(endMinutesTotal / 60) % 24;
  const endM = endMinutesTotal % 60;
  const endStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  return `${startTime} - ${endStr}`;
}

type CalendarViewMode = 'week' | 'month' | 'year';

interface CalendarViewProps {
  selectedDateKey: string;
  enableDaySections?: boolean;
  refreshTrigger?: any;
  onSelectDate: (dateKey: string) => void;
  onOpenAddForDate?: (dateKey: string) => void;
  onBackToToday?: () => void;
  onTaskChanged?: () => void;
}

// 24-hour slots for timeline mode
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDateKey,
  enableDaySections = false,
  refreshTrigger,
  onSelectDate,
  onOpenAddForDate,
  onBackToToday,
  onTaskChanged,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  // Active anchor date for calendar navigation
  const [currentDateKey, setCurrentDateKey] = useState<string>(() => selectedDateKey || getTodayJalaliKey());

  useEffect(() => {
    if (selectedDateKey) {
      setCurrentDateKey(selectedDateKey);
    }
  }, [selectedDateKey]);

  // Tasks and tags state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [_isLoading, setIsLoading] = useState(false);

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Google Calendar style resizing and editing state
  const [resizingTask, setResizingTask] = useState<{
    id: string;
    startY: number;
    initialDuration: number;
    currentDuration: number;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Live current time state (for red live indicator line)
  const [currentTime, setCurrentTime] = useState<{ hour: number; minute: number }>(() => {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolledRef = useRef(false);

  // Update live time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime({ hour: now.getHours(), minute: now.getMinutes() });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Dropdown refs for click-outside
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(target)) {
        setIsMonthPickerOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setIsYearPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load all tasks and tags
  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTasks, allTags] = await Promise.all([
        taskRepo.list(),
        tagRepo.listAll(),
      ]);
      setTasks(allTasks);

      const tMap: Record<string, Tag> = {};
      allTags.forEach((t) => (tMap[t.id] = t));
      setTagsMap(tMap);
    } catch (err) {
      console.error('Failed to load calendar data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and reload on refreshTrigger
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData, refreshTrigger]);

  // Global listener for task updates
  useEffect(() => {
    const handleTaskUpdated = () => {
      loadCalendarData();
    };
    window.addEventListener('task-updated', handleTaskUpdated);
    window.addEventListener('focus', handleTaskUpdated);
    return () => {
      window.removeEventListener('task-updated', handleTaskUpdated);
      window.removeEventListener('focus', handleTaskUpdated);
    };
  }, [loadCalendarData]);

  // Mouse listeners for resizing task duration in 15-minute increments (16px = 15 min)
  useEffect(() => {
    if (!resizingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingTask.startY;
      // 16px is 15 minutes (64px = 60 min)
      const deltaMinutes = Math.round(deltaY / 16) * 15;
      const nextDuration = Math.max(15, resizingTask.initialDuration + deltaMinutes);
      setResizingTask((prev) => (prev ? { ...prev, currentDuration: nextDuration } : null));
    };

    const handleMouseUp = async () => {
      const finalDuration = resizingTask.currentDuration;
      const taskId = resizingTask.id;
      const initialDur = resizingTask.initialDuration;
      setResizingTask(null);

      if (finalDuration !== initialDur) {
        try {
          await taskRepo.update(taskId, { duration_minutes: finalDuration });
          await loadCalendarData();
          if (onTaskChanged) onTaskChanged();
          toast.show(`مدت زمان به ${toPersianDigits(formatDurationPersian(finalDuration))} تنظیم شد`);
        } catch (err) {
          console.error('Failed to update task duration', err);
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

  const toggleTaskDone = async (task: Task) => {
    try {
      const nextStatus = task.status === 'done' ? 'open' : 'done';
      await taskRepo.update(task.id, { status: nextStatus });
      await loadCalendarData();
      if (onTaskChanged) onTaskChanged();
    } catch (err) {
      console.error('Failed to toggle task status', err);
    }
  };

  const parsedCurrent = useMemo(() => parseJalaliKey(currentDateKey), [currentDateKey]);
  const todayKey = useMemo(() => getTodayJalaliKey(), []);

  // Week days for weekly mode (7 days: Saturday to Friday)
  const weekDays = useMemo(() => {
    const curDate = jalaliToDate(parsedCurrent.jy, parsedCurrent.jm, parsedCurrent.jd);
    return getWeekDaysForDate(curDate);
  }, [parsedCurrent]);

  // Auto-scroll to current time on week view mount or viewMode switch
  useEffect(() => {
    if (viewMode === 'week') {
      const scrollTimer = setTimeout(() => {
        if (timelineScrollRef.current) {
          const currentHour = new Date().getHours();
          const currentMinute = new Date().getMinutes();
          const currentPixelTop = (currentHour + currentMinute / 60) * 64;
          const targetScroll = Math.max(0, currentPixelTop - 64);
          timelineScrollRef.current.scrollTop = targetScroll;
          hasAutoScrolledRef.current = true;
        }
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [viewMode]);

  // Current month & year components
  const currentMonthName = useMemo(() => {
    return PERSIAN_MONTH_NAMES[parsedCurrent.jm - 1] || '';
  }, [parsedCurrent]);

  const currentYearNumber = useMemo(() => {
    return parsedCurrent.jy;
  }, [parsedCurrent]);

  // Year options for Google Calendar style year picker (-5 to +5 years)
  const yearOptions = useMemo(() => {
    const baseYear = parsedCurrent.jy;
    const years: number[] = [];
    for (let y = baseYear - 5; y <= baseYear + 5; y++) {
      years.push(y);
    }
    return years;
  }, [parsedCurrent.jy]);

  // Helper to get active tasks for a specific Jalali date
  const getTasksForDate = useCallback((dateKey: string): Task[] => {
    const targetDate = extractDateOnly(dateKey);
    return tasks
      .filter((task) => {
        if (task.status === 'dropped') return false;
        return isTaskOccurringOnDate(task, targetDate);
      })
      .map((task) => {
        if (task.recurrence_rule && task.recurrence_rule !== 'none') {
          const isDoneOnDate = (task.done_dates || []).map(extractDateOnly).includes(targetDate);
          return {
            ...task,
            status: isDoneOnDate ? 'done' : 'open',
          };
        }
        return task;
      });
  }, [tasks]);

  // Drag and drop handlers
  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleCellDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCell !== cellId) {
      setDragOverCell(cellId);
    }
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
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const patch: Partial<Task> = {
        due_date: targetDateKey,
      };

      if (options?.timeOfDay) {
        patch.time_of_day = options.timeOfDay;
        if (options.timeOfDay === 'anytime') {
          patch.due_time = undefined;
        }
      }

      if (options?.hour !== undefined) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetY = Math.max(0, e.clientY - rect.top);
        const quarter = Math.min(3, Math.max(0, Math.floor((offsetY / 64) * 4)));
        const minutes = quarter * 15;
        const hourStr = `${options.hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        patch.due_time = hourStr;
        if (!task.duration_minutes || task.duration_minutes < 15) {
          patch.duration_minutes = 30; // default 30 min, minimum 15 min
        }
        patch.time_of_day = undefined;
      }

      if (task.recurrence_rule && task.recurrence_rule !== 'none') {
        patch.recurrence_start_date = targetDateKey;
      }

      await taskRepo.update(taskId, patch);
      await loadCalendarData();
      if (onTaskChanged) onTaskChanged();

      toast.show(`تسک به تاریخ ${toPersianDigits(targetDateKey)} منتقل شد`);
    } catch (err) {
      console.error('Failed to move task on drop', err);
      toast.show('خطا در انتقال تسک');
    }
  };

  const isNotToday = currentDateKey !== todayKey;

  // Live indicator vertical position calculation: 64px per hour slot
  const currentLiveTop = useMemo(() => {
    return currentTime.hour * 64 + (currentTime.minute / 60) * 64;
  }, [currentTime]);

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground overflow-hidden select-none calendar-smooth-open">
      {/* 1. Header Bar:
          - RIGHT SIDE (RTL): Month & Year Clickable side-by-side (NO arrows, NO dividing line underneath)
          - LEFT SIDE (RTL): Mode Switcher dropdown (هفته ⌄ / ماه / سال)
      */}
      <header className="w-full relative flex items-center justify-between px-6 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 shrink-0 border-b-0" dir="rtl">
        {/* RIGHT SIDE in RTL: Return to today button (if viewing date other than today) */}
        <div className="flex items-center min-w-[32px] sm:min-w-[120px] justify-start z-10">
          {isNotToday && (
            <button
              type="button"
              onClick={() => {
                setCurrentDateKey(todayKey);
                if (viewMode === 'week' && timelineScrollRef.current) {
                  const currentHour = new Date().getHours();
                  const currentMinute = new Date().getMinutes();
                  const currentPixelTop = (currentHour + currentMinute / 60) * 64;
                  timelineScrollRef.current.scrollTop = Math.max(0, currentPixelTop - 64);
                }
                if (onBackToToday) onBackToToday();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground border border-border/50 transition-all cursor-pointer shadow-xs active:scale-95"
              title="بازگشت به امروز"
            >
              <RiArrowGoBackLine className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">بازگشت به امروز</span>
            </button>
          )}
        </div>

        {/* CENTER: Month & Year clickable text side-by-side with minimal gap */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-20">
          {/* Separate Month Dropdown Picker */}
          <div className="relative" ref={monthDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsMonthPickerOpen(!isMonthPickerOpen);
                setIsYearPickerOpen(false);
              }}
              className="font-darvish text-xl sm:text-2xl font-bold text-foreground hover:text-foreground/80 hover:bg-secondary/40 px-1 py-0.5 rounded-xl transition-all cursor-pointer active:scale-95"
              title="انتخاب ماه"
            >
              <span>{currentMonthName}</span>
            </button>

            {/* Google Calendar Style Month Dropdown */}
            {isMonthPickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 sm:w-64 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl p-2.5 z-50 animate-in zoom-in-95 duration-150">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 mb-1">
                  انتخاب ماه:
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PERSIAN_MONTH_NAMES.map((mName, idx) => {
                    const monthNum = idx + 1;
                    const isSelected = parsedCurrent.jm === monthNum;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          setCurrentDateKey(
                            formatJalaliKey({ jy: parsedCurrent.jy, jm: monthNum, jd: 1 })
                          );
                          setIsMonthPickerOpen(false);
                        }}
                        className={cn(
                          'py-1.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-center',
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-sm'
                            : 'bg-secondary/30 hover:bg-secondary/80 text-foreground'
                        )}
                      >
                        {mName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Separate Year Dropdown Picker */}
          <div className="relative" ref={yearDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsYearPickerOpen(!isYearPickerOpen);
                setIsMonthPickerOpen(false);
              }}
              className="font-darvish text-xl sm:text-2xl font-bold text-foreground hover:text-foreground/80 hover:bg-secondary/40 px-1 py-0.5 rounded-xl transition-all cursor-pointer active:scale-95"
              title="انتخاب سال"
            >
              <span>{toPersianDigits(currentYearNumber)}</span>
            </button>

            {/* Google Calendar Style Year Dropdown */}
            {isYearPickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-44 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto animate-in zoom-in-95 duration-150">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 mb-1">
                  انتخاب سال:
                </div>
                <div className="flex flex-col gap-1">
                  {yearOptions.map((yr) => {
                    const isSelected = yr === parsedCurrent.jy;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setCurrentDateKey(
                            formatJalaliKey({ jy: yr, jm: parsedCurrent.jm, jd: 1 })
                          );
                          setIsYearPickerOpen(false);
                        }}
                        className={cn(
                          'w-full text-right px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer',
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-sm'
                            : 'hover:bg-secondary/80 text-foreground'
                        )}
                      >
                        {toPersianDigits(yr)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LEFT SIDE in RTL: View Mode Segment Selector (هفته / ماه / سال with icons) */}
        <div className="flex items-center p-1 rounded-full bg-secondary/50 border border-border/70 backdrop-blur-xs shadow-xs z-10" dir="rtl">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'week'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="نمای هفتگی"
          >
            <RiCalendar2Line className="size-3.5" />
            <span>هفته</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'month'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="نمای ماهانه"
          >
            <RiGridLine className="size-3.5" />
            <span>ماه</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('year')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer',
              viewMode === 'year'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="نمای سالانه"
          >
            <RiLayoutGridLine className="size-3.5" />
            <span>سال</span>
          </button>
        </div>
      </header>

      {/* 2. Main Views Area */}
      <div
        ref={viewMode !== 'week' ? scrollContainerRef : undefined}
        className={cn(
          'flex-1 w-full px-2 sm:px-6 pt-1 min-h-0',
          viewMode === 'week' ? 'flex flex-col h-full overflow-hidden' : 'overflow-y-auto pb-24'
        )}
        dir="rtl"
      >
        {/* WEEKLY VIEW: Full 7-column continuous vertical layout with live time */}
        {viewMode === 'week' && (
          <div className="w-full flex flex-col h-full min-h-0 flex-1 overflow-hidden">
            {/* 1. FIXED TOP SECTION: Header + Anytime / Unscheduled tasks (Hugs content) */}
            <div
              onWheel={(e) => {
                if (timelineScrollRef.current) {
                  timelineScrollRef.current.scrollTop += e.deltaY;
                }
              }}
              className="w-full shrink-0 flex flex-col bg-background/98 z-20"
            >
              {/* Week Columns Header: Day numbers and Weekday names */}
              <div className="w-full flex cal-dashed-row">
                {/* Spacer matching hour label width */}
                <div className="w-12 sm:w-16 shrink-0 py-2 sm:py-2.5" />

                {/* 7 Columns Header */}
                <div className="flex-1 grid grid-cols-7">
                  {weekDays.map((day, dIdx) => {
                    const isToday = day.formattedDate === todayKey;
                    const isFriday = dIdx === 6;
                    const isHoliday = isFriday || isOfficialHoliday(day.formattedDate);

                    return (
                      <div
                        key={day.formattedDate}
                        className={cn(
                          'flex flex-col items-center px-1 sm:px-2 py-2 sm:py-2.5 relative transition-colors h-full justify-center',
                          dIdx > 0 && 'cal-dashed-col',
                          isToday && 'bg-primary/[0.04] dark:bg-white/[0.04] rounded-t-2xl'
                        )}
                      >
                        {/* Day Number + Full Weekday Name */}
                        <div className="flex flex-col items-center py-0.5 justify-center">
                          {/* Day Number: smaller number font inside circle */}
                          <div
                            className={cn(
                              'size-8 sm:size-8.5 rounded-full flex items-center justify-center font-darvish text-base sm:text-lg font-bold transition-all',
                              isToday
                                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                                : isHoliday
                                ? 'text-rose-500 dark:text-rose-400 font-black'
                                : 'text-foreground'
                            )}
                          >
                            {toPersianDigits(day.dayNumber)}
                          </div>

                          {/* Full Weekday Name in Darvish Font */}
                          <span
                            className={cn(
                              'font-darvish text-xs mt-1 transition-colors',
                              isHoliday && !isToday
                                ? 'text-rose-500/90 dark:text-rose-400/90 font-medium'
                                : 'text-muted-foreground'
                            )}
                          >
                            {day.dayName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* When day sections is disabled, show SECTION 1 (Unscheduled) fixed at top */}
              {!enableDaySections && (
                <div className="w-full flex cal-dashed-row shrink-0">
                  {/* Row Label */}
                  <div className="w-12 sm:w-16 shrink-0 flex items-start justify-center pt-3 text-[10px] sm:text-[11px] font-semibold text-muted-foreground select-none">
                    <span>هر زمان</span>
                  </div>

                  {/* 7 Columns for unscheduled tasks */}
                  <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                    {weekDays.map((day, dIdx) => {
                      const isToday = day.formattedDate === todayKey;
                      const dayHolidays = getHolidaysForDate(day.formattedDate);
                      const isFriday = dIdx === 6;
                      const dayTasks = getTasksForDate(day.formattedDate);
                      const unscheduledTasks = dayTasks.filter((t) => {
                        if (t.due_time && t.due_time.trim()) return false;
                        return true;
                      });

                      const cellKey = `unscheduled-${day.formattedDate}`;
                      const isDragOver = dragOverCell === cellKey;

                      return (
                        <div
                          key={cellKey}
                          onDragOver={(e) => handleCellDragOver(e, cellKey)}
                          onDragLeave={handleCellDragLeave}
                          onDrop={(e) => handleCellDrop(e, day.formattedDate, { timeOfDay: 'anytime' })}
                          className={cn(
                            'min-h-[70px] p-1.5 pb-2.5 flex flex-col gap-1 transition-colors h-full',
                            dIdx > 0 && 'cal-dashed-col',
                            isToday && 'bg-primary/[0.04] dark:bg-white/[0.04]',
                            isDragOver && 'bg-primary/5 ring-2 ring-primary/40'
                          )}
                        >
                          {/* Occasions & Holidays as Bullet Points right below the dashed line */}
                          {(dayHolidays.length > 0 || isFriday) && (
                            <div className="w-full px-1.5 pt-0.5 pb-1 flex flex-col gap-1 select-none border-b border-border/25 mb-0.5">
                              {dayHolidays.map((h, hIdx) => {
                                const isRed = h.isOfficial;
                                return (
                                  <div
                                    key={hIdx}
                                    className="flex items-start gap-1.5 text-[9.5px] sm:text-[10px] leading-tight"
                                    title={h.title}
                                  >
                                    <span
                                      className={cn(
                                        'size-1.5 rounded-full mt-1 shrink-0',
                                        isRed ? 'bg-rose-500 shadow-xs' : 'bg-primary/50 dark:bg-primary/70'
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'break-words font-medium text-right leading-tight',
                                        isRed
                                          ? 'text-rose-500 dark:text-rose-400 font-semibold'
                                          : 'text-muted-foreground'
                                      )}
                                    >
                                      {h.title}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* Friday label if Friday and no other official holiday */}
                              {isFriday && !dayHolidays.some((h) => h.isOfficial) && (
                                <div className="flex items-start gap-1.5 text-[9.5px] sm:text-[10px] leading-tight">
                                  <span className="size-1.5 rounded-full mt-1 shrink-0 bg-rose-500 shadow-xs" />
                                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                                    تعطیل
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tasks List */}
                          {unscheduledTasks.map((task, idx) => (
                            <div key={task.id} className="w-full">
                              <TaskItemRow
                                task={task}
                                tagsMap={tagsMap}
                                currentDateKey={day.formattedDate}
                                onStatusChanged={() => {
                                  loadCalendarData();
                                  if (onTaskChanged) onTaskChanged();
                                }}
                                draggable={true}
                                onDragStart={(e) => handleTaskDragStart(e, task.id)}
                                isLast={idx === unscheduledTasks.length - 1}
                                className="py-1.5 px-2 text-xs"
                              />
                            </div>
                          ))}

                          {/* Minimal "+ اضافه کردن کار" Button placed UNDER the last task */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenAddForDate) {
                                onOpenAddForDate(day.formattedDate);
                              } else {
                                onSelectDate(day.formattedDate);
                              }
                            }}
                            className="w-[calc(100%-8px)] mx-auto mt-1 mb-1 py-1 px-2 rounded-lg border border-dashed border-border/70 hover:border-foreground/30 bg-card/60 hover:bg-secondary/60 text-[10px] text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 group shrink-0"
                            title={`افزودن کار برای ${day.dayName}`}
                          >
                            <RiAddLine className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                            <span className="truncate">اضافه کردن کار</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. MAIN BODY: Day Sections (fills remaining container height equally) OR 24-Hour Timeline */}
            <div
              ref={timelineScrollRef}
              className={cn(
                'flex-1 w-full min-h-0 relative',
                enableDaySections
                  ? 'overflow-y-auto no-scrollbar pb-1.5 flex flex-col'
                  : 'overflow-y-auto no-scrollbar pb-24'
              )}
            >
              {enableDaySections ? (
                /* 4 Day Sections (هر زمان, صبح, ظهر, عصر و شب): Equally distributed with flex-1 to fill all vertical container space! */
                <div className="w-full flex flex-col flex-1 min-h-full">
                  {TIME_OF_DAY_SECTIONS.map((sectionConfig, sIdx) => {
                    const sectionKey = sectionConfig.key;
                    const isAnytime = sectionKey === 'anytime';
                    const isLastSection = sIdx === TIME_OF_DAY_SECTIONS.length - 1; // 'evening'
                    return (
                      <div
                        key={sectionKey}
                        className="w-full flex cal-dashed-row flex-1 min-h-[95px] sm:min-h-[110px]"
                      >
                        {/* Section Label on right */}
                        <div className="w-12 sm:w-16 shrink-0 flex items-start justify-center pt-2.5 sm:pt-3 text-[10px] sm:text-[11px] font-semibold text-muted-foreground select-none">
                          <span>{sectionConfig.label}</span>
                        </div>

                        {/* 7 Columns for this section */}
                        <div className="flex-1 grid grid-cols-7 auto-rows-fr h-full">
                          {weekDays.map((day, dIdx) => {
                            const isToday = day.formattedDate === todayKey;
                            const dayHolidays = getHolidaysForDate(day.formattedDate);
                            const isFriday = dIdx === 6;
                            const dayTasks = getTasksForDate(day.formattedDate);
                            const sectionTasks = isAnytime
                              ? dayTasks.filter((t) => {
                                  if (t.due_time && t.due_time.trim()) return false;
                                  return !t.time_of_day || t.time_of_day === 'anytime';
                                })
                              : dayTasks.filter((t) => t.time_of_day === sectionKey);

                            const cellKey = `tod-${sectionKey}-${day.formattedDate}`;
                            const isDragOver = dragOverCell === cellKey;

                            return (
                              <div
                                key={cellKey}
                                onDragOver={(e) => handleCellDragOver(e, cellKey)}
                                onDragLeave={handleCellDragLeave}
                                onDrop={(e) => handleCellDrop(e, day.formattedDate, { timeOfDay: sectionKey })}
                                className={cn(
                                  'min-h-[85px] sm:min-h-[100px] p-1.5 pb-2.5 flex flex-col gap-1 transition-colors h-full flex-1',
                                  dIdx > 0 && 'cal-dashed-col',
                                  isToday && 'bg-primary/[0.04] dark:bg-white/[0.04]',
                                  isToday && isLastSection && 'rounded-b-2xl',
                                  isDragOver && 'bg-primary/5 ring-2 ring-primary/40'
                                )}
                              >
                                {/* Occasions & Holidays as Bullet Points right below the dashed line */}
                                {isAnytime && (dayHolidays.length > 0 || isFriday) && (
                                  <div className="w-full px-1.5 pt-0.5 pb-1 flex flex-col gap-1 select-none border-b border-border/25 mb-0.5">
                                    {dayHolidays.map((h, hIdx) => {
                                      const isRed = h.isOfficial;
                                      return (
                                        <div
                                          key={hIdx}
                                          className="flex items-start gap-1.5 text-[9.5px] sm:text-[10px] leading-tight"
                                          title={h.title}
                                        >
                                          <span
                                            className={cn(
                                              'size-1.5 rounded-full mt-1 shrink-0',
                                              isRed ? 'bg-rose-500 shadow-xs' : 'bg-primary/50 dark:bg-primary/70'
                                            )}
                                          />
                                          <span
                                            className={cn(
                                              'break-words font-medium text-right leading-tight',
                                              isRed
                                                ? 'text-rose-500 dark:text-rose-400 font-semibold'
                                                : 'text-muted-foreground'
                                            )}
                                          >
                                            {h.title}
                                          </span>
                                        </div>
                                      );
                                    })}

                                    {/* Friday label if Friday and no other official holiday */}
                                    {isFriday && !dayHolidays.some((h) => h.isOfficial) && (
                                      <div className="flex items-start gap-1.5 text-[9.5px] sm:text-[10px] leading-tight">
                                        <span className="size-1.5 rounded-full mt-1 shrink-0 bg-rose-500 shadow-xs" />
                                        <span className="font-semibold text-rose-500 dark:text-rose-400">
                                          تعطیل
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Tasks List */}
                                {sectionTasks.map((task, idx) => (
                                  <div key={task.id} className="w-full">
                                    <TaskItemRow
                                      task={task}
                                      tagsMap={tagsMap}
                                      currentDateKey={day.formattedDate}
                                      onStatusChanged={() => {
                                        loadCalendarData();
                                        if (onTaskChanged) onTaskChanged();
                                      }}
                                      draggable={true}
                                      onDragStart={(e) => handleTaskDragStart(e, task.id)}
                                      isLast={idx === sectionTasks.length - 1}
                                      className="py-1.5 px-2 text-xs"
                                    />
                                  </div>
                                ))}

                                {/* Minimal "+ اضافه کردن کار" Button placed UNDER the last task */}
                                {isAnytime && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onOpenAddForDate) {
                                        onOpenAddForDate(day.formattedDate);
                                      } else {
                                        onSelectDate(day.formattedDate);
                                      }
                                    }}
                                    className="w-[calc(100%-8px)] mx-auto mt-1 mb-1 py-1 px-2 rounded-lg border border-dashed border-border/70 hover:border-foreground/30 bg-card/60 hover:bg-secondary/60 text-[10px] text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 group shrink-0"
                                    title={`افزودن کار برای ${day.dayName}`}
                                  >
                                    <RiAddLine className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                                    <span className="truncate">اضافه کردن کار</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Continuous 24-Hour Timeline with Live Red Horizontal Indicator & Google Calendar Task Blocks */
                <div className="w-full flex relative select-none">
                  {/* Live Current Time Line Indicator across the 7 columns */}
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center transition-all duration-300"
                    style={{ top: `${currentLiveTop}px` }}
                  >
                    <div className="w-12 sm:w-16 shrink-0 flex justify-center">
                      <span className="size-2 rounded-full bg-rose-500 shadow-sm" />
                    </div>
                    <div className="flex-1 h-[2px] bg-rose-500 shadow-sm opacity-85" />
                  </div>

                  {/* Right side: 24 Hour Labels Column (00:00 to 23:00) */}
                  <div className="w-12 sm:w-16 shrink-0 flex flex-col">
                    {HOURS.map((hour) => {
                      const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
                      return (
                        <div
                          key={hour}
                          className="h-[64px] min-h-[64px] cal-dashed-row flex items-start justify-center pt-1.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground select-none"
                        >
                          <span>{toPersianDigits(hourLabel)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Left side in RTL: 7 Columns Grid */}
                  <div className="flex-1 grid grid-cols-7 relative h-[1536px]">
                    {weekDays.map((day, dIdx) => {
                      const isToday = day.formattedDate === todayKey;
                      const dayTasks = getTasksForDate(day.formattedDate);
                      const timedTasks = dayTasks.filter((t) => Boolean(t.due_time && t.due_time.trim()));

                      return (
                        <div
                          key={day.formattedDate}
                          className={cn(
                            'relative h-[1536px]',
                            dIdx > 0 && 'cal-dashed-col',
                            isToday && 'bg-primary/[0.04] dark:bg-white/[0.04] rounded-b-2xl'
                          )}
                        >
                          {/* 24 Hour Drop Zones (Horizontal Dashed Grid Lines) */}
                          {HOURS.map((hour) => {
                            const cellKey = `hour-${hour}-${day.formattedDate}`;
                            const isDragOver = dragOverCell === cellKey;
                            return (
                              <div
                                key={cellKey}
                                onDragOver={(e) => handleCellDragOver(e, cellKey)}
                                onDragLeave={handleCellDragLeave}
                                onDrop={(e) => handleCellDrop(e, day.formattedDate, { hour })}
                                className={cn(
                                  'h-[64px] cal-dashed-row transition-colors',
                                  isDragOver && 'bg-primary/10 ring-2 ring-primary/40'
                                )}
                              />
                            );
                          })}

                          {/* Timed Task Blocks positioned at their start time with duration & resize handle */}
                          {timedTasks.map((task) => {
                            const [hStr, mStr] = (task.due_time || '00:00').split(':');
                            const hour = parseInt(hStr, 10) || 0;
                            const minute = parseInt(mStr, 10) || 0;
                            const topPx = hour * 64 + (minute / 60) * 64;

                            const isResizingThis = resizingTask?.id === task.id;
                            const duration = isResizingThis
                              ? resizingTask.currentDuration
                              : Math.max(15, task.duration_minutes || 30);
                            const heightPx = Math.max(16, (duration / 60) * 64 - 2);

                            const isDone = task.status === 'done';

                            return (
                              <div
                                key={task.id}
                                draggable={!resizingTask}
                                onDragStart={(e) => handleTaskDragStart(e, task.id)}
                                onClick={() => setEditingTask(task)}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                }}
                                className={cn(
                                  'absolute inset-x-1 z-10 rounded-md border text-xs shadow-xs transition-shadow flex flex-col justify-between overflow-hidden cursor-pointer select-none group/task',
                                  isDone
                                    ? 'opacity-60 bg-muted/60 border-border text-muted-foreground'
                                    : task.priority === 3
                                    ? 'bg-rose-500/15 border-rose-500/40 text-foreground hover:bg-rose-500/25'
                                    : task.priority === 2
                                    ? 'bg-amber-500/15 border-amber-500/40 text-foreground hover:bg-amber-500/25'
                                    : task.priority === 1
                                    ? 'bg-blue-500/15 border-blue-500/40 text-foreground hover:bg-blue-500/25'
                                    : 'bg-card/90 border-border/80 hover:border-foreground/30 text-foreground hover:bg-card',
                                  isResizingThis && 'ring-2 ring-primary shadow-md z-30'
                                )}
                              >
                                {/* Task Content */}
                                <div className="p-1 flex flex-col min-w-0 flex-1 overflow-hidden pointer-events-none">
                                  <div className="flex items-center gap-1 min-w-0">
                                    {/* Small Checkbox */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTaskDone(task);
                                      }}
                                      className={cn(
                                        'size-3.5 rounded-full border flex items-center justify-center shrink-0 pointer-events-auto transition-colors cursor-pointer',
                                        isDone
                                          ? 'bg-primary border-primary text-primary-foreground'
                                          : 'border-muted-foreground/50 hover:border-foreground bg-background'
                                      )}
                                    >
                                      {isDone && <RiCheckLine className="size-2.5 stroke-[3]" />}
                                    </button>

                                    {/* Title */}
                                    <span
                                      className={cn(
                                        heightPx > 36 ? 'break-words line-clamp-2' : 'truncate',
                                        'font-semibold text-[11px] leading-tight flex-1',
                                        isDone && ['pencil-strike', getTaskPencilPattern(task.id), 'text-muted-foreground']
                                      )}
                                    >
                                      {task.title}
                                    </span>

                                    {/* Compact time if card is short */}
                                    {heightPx <= 26 && (
                                      <span className="text-[9px] text-muted-foreground shrink-0 font-medium">
                                        {toPersianDigits(task.due_time || '')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Time range (shown if height >= 28px) */}
                                  {heightPx > 28 && (
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5 font-medium">
                                      <RiTimeLine className="size-2.5 shrink-0" />
                                      <span>{toPersianDigits(formatTaskTimeRange(task.due_time, duration))}</span>
                                    </div>
                                  )}

                                  {/* Description (shown if height >= 52px) */}
                                  {heightPx >= 52 && task.description && (
                                    <p className="text-[9px] text-muted-foreground/80 truncate mt-0.5 line-clamp-1">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                {/* Floating Live Duration Tooltip during Resizing */}
                                {isResizingThis && (
                                  <div className="absolute -top-7 right-1 z-40 px-2 py-0.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold shadow-lg border border-border/50 animate-in fade-in duration-100 flex items-center gap-1 select-none pointer-events-none">
                                    <span>{toPersianDigits(formatDurationPersian(duration))}</span>
                                    <span className="opacity-75 text-[9px]">
                                      ({toPersianDigits(formatTaskTimeRange(task.due_time, duration))})
                                    </span>
                                  </div>
                                )}

                                {/* Bottom Resize Handle ("درگر") */}
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, task)}
                                  className="h-2 w-full cursor-ns-resize group/resizer hover:bg-foreground/20 flex items-center justify-center rounded-b-md transition-colors shrink-0 z-20"
                                  title="تغییر مدت زمان (گام‌های ۱۵ دقیقه‌ای)"
                                >
                                  <div className="w-5 h-0.5 rounded-full bg-foreground/30 group-hover/resizer:bg-foreground/70 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MONTHLY VIEW: Full window grid with dashed separators */}
        {viewMode === 'month' && (
          <div className="w-full h-full flex flex-col gap-2">
            {/* Weekday headers across full container width */}
            <div className="grid grid-cols-7 gap-2 text-center py-2 text-xs font-semibold text-muted-foreground cal-dashed-row shrink-0">
              {PERSIAN_WEEKDAY_NAMES.map((name) => (
                <div key={name} className="font-darvish text-sm sm:text-base">
                  {name}
                </div>
              ))}
            </div>

            {/* Full-window Month grid */}
            <div className="w-full flex-1 grid grid-cols-7 auto-rows-fr pt-1 pb-6">
              {(() => {
                const totalDays = getJalaliMonthLength(parsedCurrent.jy, parsedCurrent.jm);
                const firstDayWeekday = getJalaliMonthFirstDayOfWeek(parsedCurrent.jy, parsedCurrent.jm);
                const cells = [];

                // Empty prefix cells
                for (let i = 0; i < firstDayWeekday; i++) {
                  cells.push(
                    <div
                      key={`empty-${i}`}
                      className={cn(
                        'min-h-[105px] p-2 bg-muted/10 opacity-25 cal-dashed-row',
                        i % 7 !== 0 && 'cal-dashed-col'
                      )}
                    />
                  );
                }

                  for (let d = 1; d <= totalDays; d++) {
                    const dayKey = formatJalaliKey({
                      jy: parsedCurrent.jy,
                      jm: parsedCurrent.jm,
                      jd: d,
                    });
                    const dayTasks = getTasksForDate(dayKey);
                    const isToday = dayKey === todayKey;
                    const cellIndex = firstDayWeekday + d - 1;
                    const isDragOver = dragOverCell === dayKey;
                    const dayHolidays = getHolidaysForDate(dayKey);
                    const isFriday = cellIndex % 7 === 6;
                    const isHoliday = isFriday || isOfficialHoliday(dayKey);

                    cells.push(
                      <div
                        key={dayKey}
                        onDragOver={(e) => handleCellDragOver(e, dayKey)}
                        onDragLeave={handleCellDragLeave}
                        onDrop={(e) => handleCellDrop(e, dayKey)}
                        onClick={() => {
                          onSelectDate(dayKey);
                          setViewMode('week');
                        }}
                        className={cn(
                          'min-h-[105px] p-2.5 cal-dashed-row hover:bg-secondary/40 transition-all flex flex-col justify-between cursor-pointer group',
                          cellIndex % 7 !== 0 && 'cal-dashed-col',
                          isToday && 'ring-2 ring-primary/70 bg-primary/5',
                          isDragOver && 'bg-primary/10 ring-2 ring-primary scale-[1.01]'
                        )}
                      >
                        {/* Day Number and count */}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                'size-7 rounded-full flex items-center justify-center font-darvish text-sm sm:text-base font-bold',
                                isToday
                                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                                  : isHoliday
                                  ? 'text-rose-500 dark:text-rose-400 font-black'
                                  : 'text-foreground'
                              )}
                            >
                              {toPersianDigits(d)}
                            </span>
                            {dayTasks.length > 0 && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                                {toPersianDigits(dayTasks.length)}
                              </span>
                            )}
                          </div>

                          {/* Holiday / Occasion Name */}
                          {dayHolidays.length > 0 && (
                            <div
                              className={cn(
                                'text-[10px] truncate mt-0.5 select-none',
                                isHoliday
                                  ? 'text-rose-500 dark:text-rose-400 font-medium'
                                  : 'text-muted-foreground/80 font-normal'
                              )}
                              title={dayHolidays.map((h) => h.title).join(' • ')}
                            >
                              {dayHolidays[0].title}
                            </div>
                          )}
                        </div>

                        {/* Snippet of tasks in monthly cell with drag support */}
                        <div className="flex flex-col gap-1.5 mt-2 flex-1 overflow-hidden">
                          {dayTasks.slice(0, 3).map((t) => (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleTaskDragStart(e, t.id);
                              }}
                              className={cn(
                                'text-[11px] truncate py-1 px-2 rounded-md bg-secondary/60 text-foreground font-medium cursor-grab active:cursor-grabbing hover:bg-secondary transition-colors',
                                t.status === 'done' && ['pencil-strike', getTaskPencilPattern(t.id), 'opacity-60']
                              )}
                              title={t.title}
                            >
                              {t.title}
                            </div>
                          ))}
                        {dayTasks.length > 3 && (
                          <div className="text-[10px] text-muted-foreground/70 pr-1">
                            +{toPersianDigits(dayTasks.length - 3)} مورد دیگر
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return cells;
              })()}
            </div>
          </div>
        )}

        {/* YEARLY VIEW */}
        {viewMode === 'year' && (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-5xl mx-auto py-4">
            {PERSIAN_MONTH_NAMES.map((mName, mIdx) => {
              const monthNum = mIdx + 1;
              const isCurMonth = parsedCurrent.jm === monthNum;
              const monthLen = getJalaliMonthLength(parsedCurrent.jy, monthNum);

              return (
                <div
                  key={mName}
                  onClick={() => {
                    setCurrentDateKey(
                      formatJalaliKey({ jy: parsedCurrent.jy, jm: monthNum, jd: 1 })
                    );
                    setViewMode('month');
                  }}
                  className={cn(
                    'p-4 rounded-3xl border border-border/50 bg-card hover:bg-secondary/40 transition-all cursor-pointer flex flex-col gap-2.5 group shadow-xs',
                    isCurMonth && 'ring-2 ring-primary/60 border-transparent bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-darvish text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {mName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {toPersianDigits(monthLen)} روز
                    </span>
                  </div>

                  {/* Mini month days dots / preview */}
                  <div className="grid grid-cols-7 gap-1.5 py-1.5 opacity-70">
                    {Array.from({ length: Math.min(28, monthLen) }).map((_, i) => (
                      <div
                        key={i}
                        className="size-1.5 rounded-full bg-muted-foreground/30 mx-auto"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            loadCalendarData();
            if (onTaskChanged) onTaskChanged();
          }}
        />
      )}
    </div>
  );
};
