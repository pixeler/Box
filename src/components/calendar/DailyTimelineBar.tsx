import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { EventItem, Task } from '@/types/models';
import {
  toPersianDigits,
  getTodayJalaliKey,
  addJalaliDays,
  getJalaliDaysDiff,
} from '../../lib/jalali';
import { RiArrowGoBackLine } from '@remixicon/react';

interface DailyTimelineBarProps {
  selectedDateKey: string;
  events: EventItem[];
  tasks?: Task[];
  onSelectEvent?: (event: EventItem) => void;
  onSelectTask?: (task: Task) => void;
  onSelectDate?: (dateKey: string) => void;
  onScheduleTask?: (
    taskId: string,
    targetDateKey: string,
    dueTime: string,
    durationMinutes: number
  ) => Promise<void> | void;
  activeFocusInterval?: {
    startMinute: number;
    durationMinutes: number;
    elapsedMinutes: number;
  } | null;
}

interface ParsedInterval {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  startFormatted: string;
  endFormatted: string;
  rawEvent?: EventItem;
  rawTask?: Task;
}

// Extract hours and minutes from strings like "12:30", "12:30:00", "1404/10/30 12:30"
function parseTimeToMinutes(timeStr?: string): { minutes: number; formatted: string } | null {
  if (!timeStr) return null;

  // Match HH:MM
  const match = timeStr.match(/(?:^|\s|[T])(\d{1,2}):(\d{2})/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) {
      const minutes = h * 60 + m;
      const formatted = `${toPersianDigits(h)}:${toPersianDigits(String(m).padStart(2, '0'))}`;
      return { minutes, formatted };
    }
  }

  // Try ISO parsing
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      const m = d.getMinutes();
      const minutes = h * 60 + m;
      const formatted = `${toPersianDigits(h)}:${toPersianDigits(String(m).padStart(2, '0'))}`;
      return { minutes, formatted };
    }
  } catch {}

  return null;
}

// Time period markers along the 24-hour track
interface TimePeriodDef {
  minute: number;
  label: string;
  timeDisplay: string;
}

const TIME_PERIODS: TimePeriodDef[] = [
  { minute: 6 * 60 + 30, label: 'صبح', timeDisplay: '۰۶:۳۰' },
  { minute: 12 * 60, label: 'ظهر', timeDisplay: '۱۲:۰۰' },
  { minute: 15 * 60 + 30, label: 'بعدظهر', timeDisplay: '۱۵:۳۰' },
  { minute: 19 * 60, label: 'غروب', timeDisplay: '۱۹:۰۰' },
  { minute: 22 * 60, label: 'شب', timeDisplay: '۲۲:۰۰' },
];

const MIDNIGHT_PERIOD: TimePeriodDef = {
  minute: 0,
  label: 'نیمه‌شب',
  timeDisplay: '۰۰:۰۰',
};

const PX_PER_MINUTE = 1.0; // 60px per hour -> 1440px for 24h
const DAY_TRACK_WIDTH = 1440 * PX_PER_MINUTE; // 1440px
const MIDNIGHT_GAP = 28; // 28px physical gap in the line at midnight
const DAY_STEP = DAY_TRACK_WIDTH + MIDNIGHT_GAP; // 1468px per day cycle
const RENDER_DAYS = [-1, 0, 1]; // Yesterday, Today, Tomorrow (infinite loop feel)
const TOMORROW_DASHED_WIDTH = 6.5 * 60 * PX_PER_MINUTE; // 390px (dashed from midnight to 06:30 morning)

export const DailyTimelineBar: React.FC<DailyTimelineBarProps> = ({
  selectedDateKey,
  events,
  tasks = [],
  onSelectEvent,
  onSelectTask,
  onSelectDate,
  onScheduleTask,
  activeFocusInterval = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);

  // Live time tracking
  const [now, setNow] = useState(() => new Date());
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const currentDragOffsetRef = useRef(0);

  // Tooltip state
  const [hoveredItem, setHoveredItem] = useState<{
    item: ParsedInterval;
    x: number;
    y: number;
  } | null>(null);

  // Period tooltip state (ظهر، بعدظهر و...)
  const [hoveredPeriod, setHoveredPeriod] = useState<{
    label: string;
    timeDisplay: string;
    x: number;
    y: number;
  } | null>(null);

  const [isClockHovered, setIsClockHovered] = useState(false);

  // Drag-and-drop task scheduling state
  const [taskDragOverInfo, setTaskDragOverInfo] = useState<{
    dayIndex: number;
    snappedMinute: number;
    timeStr: string;
    displayStart: string;
    displayEnd: string;
    durationMinutes: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Real-time clock update (every 1 second when hovered to show smooth live seconds, otherwise every 10s)
  useEffect(() => {
    const intervalMs = isClockHovered ? 1000 : 10000;
    const timer = setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isClockHovered]);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Current real-time minutes (0 - 1439)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // If dragOffset is active, compute active day and minute seamlessly across midnight
  const activeTime = useMemo(() => {
    if (dragOffset !== null) {
      const centerTrackX = currentMinutes * PX_PER_MINUTE - dragOffset;
      const shiftedX = centerTrackX + MIDNIGHT_GAP / 2;
      const dayIndex = Math.floor(shiftedX / DAY_STEP);
      const startOfThisDay = dayIndex * DAY_STEP;
      const offsetInDay = Math.max(0, Math.min(DAY_TRACK_WIDTH, centerTrackX - startOfThisDay));
      const minute = Math.max(0, Math.min(1439, Math.round(offsetInDay / PX_PER_MINUTE)));
      return { dayIndex, minute };
    }
    return { dayIndex: 0, minute: currentMinutes };
  }, [dragOffset, currentMinutes]);

  // Format clock display in Persian digits (e.g. ۱۲:۳۴)
  const clockDisplay = useMemo(() => {
    const h = Math.floor(activeTime.minute / 60) % 24;
    const m = activeTime.minute % 60;
    const hStr = toPersianDigits(h);
    const mStr = toPersianDigits(String(m).padStart(2, '0'));
    return `${hStr}:${mStr}`;
  }, [activeTime]);

  // Seconds display in Persian digits (e.g. ۵۶)
  const secondsDisplay = useMemo(() => {
    return toPersianDigits(String(now.getSeconds()).padStart(2, '0'));
  }, [now]);

  // Parse events & tasks with time into intervals
  const intervals: ParsedInterval[] = useMemo(() => {
    const list: ParsedInterval[] = [];

    // 1. Process EventItems
    events.forEach((ev) => {
      const startParsed = parseTimeToMinutes(ev.start_at);
      if (startParsed) {
        let endParsed = parseTimeToMinutes(ev.end_at);
        // Default to 60 mins duration if end_at is not provided or earlier than start
        if (!endParsed || endParsed.minutes <= startParsed.minutes) {
          const endMin = Math.min(1440, startParsed.minutes + 60);
          const endH = Math.floor(endMin / 60);
          const endM = endMin % 60;
          endParsed = {
            minutes: endMin,
            formatted: `${toPersianDigits(endH)}:${toPersianDigits(String(endM).padStart(2, '0'))}`,
          };
        }
        list.push({
          id: `ev-${ev.id}`,
          title: ev.title,
          startMinute: startParsed.minutes,
          endMinute: endParsed.minutes,
          startFormatted: startParsed.formatted,
          endFormatted: endParsed.formatted,
          rawEvent: ev,
        });
      }
    });

    // 2. Process tasks if they have a start/end time in due_time or title or description
    tasks.forEach((t) => {
      let s: { minutes: number; formatted: string } | null = null;
      let e: { minutes: number; formatted: string } | null = null;

      if (t.due_time) {
        const parts = t.due_time.split(/[-–—]/);
        s = parseTimeToMinutes(parts[0]);
        if (parts[1]) {
          e = parseTimeToMinutes(parts[1]);
        } else if (s) {
          const duration = t.duration_minutes || 60;
          const endMin = Math.min(1440, s.minutes + duration);
          const endH = Math.floor(endMin / 60);
          const endM = endMin % 60;
          e = {
            minutes: endMin,
            formatted: `${toPersianDigits(endH)}:${toPersianDigits(String(endM).padStart(2, '0'))}`,
          };
        }
      }

      if (!s) {
        const combined = `${t.title} ${t.description || ''}`;
        const rangeMatch = combined.match(/(\d{1,2}:\d{2})\s*(?:تا|-)\s*(\d{1,2}:\d{2})/);
        if (rangeMatch) {
          s = parseTimeToMinutes(rangeMatch[1]);
          e = parseTimeToMinutes(rangeMatch[2]);
        }
      }

      if (s && e && e.minutes > s.minutes) {
        list.push({
          id: `task-${t.id}`,
          title: t.title,
          startMinute: s.minutes,
          endMinute: e.minutes,
          startFormatted: s.formatted,
          endFormatted: e.formatted,
          rawTask: t,
        });
      }
    });

    return list;
  }, [events, tasks]);

  // Calculate track translation so that active minute is centered
  const baseOffset = containerWidth / 2 - currentMinutes * PX_PER_MINUTE;
  const currentTranslateX = dragOffset !== null ? baseOffset + dragOffset : baseOffset;

  // Touch / Mouse Drag handlers for interactive time scrubbing
  const handlePointerDown = (e: React.PointerEvent) => {
    // If interacting with the return button, do not capture or start dragging
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    e.preventDefault();
    setIsResetting(false);
    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    currentDragOffsetRef.current = dragOffset || 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartXRef.current;
    setDragOffset(currentDragOffsetRef.current + deltaX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    // When released into another day (tomorrow or yesterday), switch the active day in App
    if (activeTime.dayIndex !== 0 && onSelectDate) {
      const targetDateKey = addJalaliDays(todayKey, activeTime.dayIndex);
      if (selectedDateKey !== targetDateKey) {
        onSelectDate(targetDateKey);
      }
    } else if (activeTime.dayIndex === 0 && selectedDateKey && selectedDateKey !== todayKey) {
      onSelectDate?.(todayKey);
    }
    // Note: dragOffset is kept EXACTLY where released. Zero bounce, zero snap-back!
  };

  const todayKey = getTodayJalaliKey();

  // Calculate dayIndex, snapped minute, and formatted times from clientX
  const calculateDropTime = useCallback(
    (clientX: number, durationMinutes: number = 60) => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const trackX = clientX - rect.left - currentTranslateX;
      const shiftedX = trackX + MIDNIGHT_GAP / 2;
      const dayIndex = Math.max(-1, Math.min(1, Math.floor(shiftedX / DAY_STEP)));
      const startOfThisDay = dayIndex * DAY_STEP;
      const offsetInDay = Math.max(0, Math.min(DAY_TRACK_WIDTH, trackX - startOfThisDay));
      const rawMinute = Math.max(0, Math.min(1439, Math.round(offsetInDay / PX_PER_MINUTE)));

      // Snap to nearest 15 minutes, clamped so standard 60-min interval doesn't overflow 24:00 (1440)
      const snappedMinute = Math.min(
        1440 - 15,
        Math.max(0, Math.round(rawMinute / 15) * 15)
      );

      const startH = Math.floor(snappedMinute / 60);
      const startM = snappedMinute % 60;

      const endMinute = Math.min(1440, snappedMinute + durationMinutes);
      const endH = Math.floor(endMinute / 60) % 24;
      const endM = endMinute % 60;

      const timeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      const displayStart = `${toPersianDigits(startH)}:${toPersianDigits(String(startM).padStart(2, '0'))}`;
      const displayEnd = `${toPersianDigits(endH)}:${toPersianDigits(String(endM).padStart(2, '0'))}`;

      return {
        dayIndex,
        snappedMinute,
        timeStr,
        displayStart,
        displayEnd,
        durationMinutes,
        screenX: clientX,
        screenY: rect.top,
      };
    },
    [currentTranslateX]
  );

  const handleTimelineDragOver = (e: React.DragEvent) => {
    const isTask =
      e.dataTransfer.types.includes('application/x-task-id') ||
      e.dataTransfer.types.includes('application/json') ||
      e.dataTransfer.types.includes('text/plain');

    if (!isTask) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dropInfo = calculateDropTime(e.clientX, 60);
    if (dropInfo) {
      setTaskDragOverInfo((prev) => {
        if (
          prev &&
          prev.dayIndex === dropInfo.dayIndex &&
          prev.snappedMinute === dropInfo.snappedMinute &&
          Math.abs(prev.screenX - dropInfo.screenX) < 4
        ) {
          return prev;
        }
        return dropInfo;
      });
    }
  };

  const handleTimelineDragLeave = (e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setTaskDragOverInfo(null);
    }
  };

  const handleTimelineDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const info = taskDragOverInfo || calculateDropTime(e.clientX, 60);
    setTaskDragOverInfo(null);

    let taskId = e.dataTransfer.getData('application/x-task-id');
    if (!taskId) {
      const plainText = e.dataTransfer.getData('text/plain');
      if (plainText.startsWith('migrate:')) {
        taskId = plainText.replace('migrate:', '');
      } else {
        try {
          const json = JSON.parse(e.dataTransfer.getData('application/json'));
          if (json && (json.taskId || json.id)) {
            taskId = json.taskId || json.id;
          }
        } catch {}
      }
      if (!taskId) {
        const num = parseInt(plainText, 10);
        if (!isNaN(num) && tasks[num]) {
          taskId = tasks[num].id;
        }
      }
    }

    if (!taskId || !info) return;

    const targetDateKey = addJalaliDays(todayKey, info.dayIndex);
    if (onScheduleTask) {
      await onScheduleTask(taskId, targetDateKey, info.timeStr, info.durationMinutes);
    }
  };

  // Reset preview on global dragend or drop
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setTaskDragOverInfo(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, []);
  const selectedDayOffset = selectedDateKey ? getJalaliDaysDiff(todayKey, selectedDateKey) : 0;
  const isAwayFromNow =
    !isResetting &&
    ((dragOffset !== null && Math.abs(dragOffset) > 2) ||
      (selectedDateKey ? selectedDateKey !== todayKey : false));

  // Smooth easing animation when resetting to now
  const handleResetToNow = (e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsResetting(true);
    setDragOffset(0);
    if (onSelectDate) {
      onSelectDate(todayKey);
    }
    setTimeout(() => {
      setIsResetting(false);
      setDragOffset(null);
    }, 650);
  };

  // Fluid transition: 0ms lag while dragging, ultra-smooth Apple-grade cubic-bezier deceleration on release/reset
  const transitionStyle = isDragging
    ? 'none'
    : 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div className="w-full flex flex-col items-center select-none pt-0 pb-0.5 relative overflow-visible">
      {/* 1. Timeline track container - Edge to edge without side margins */}
      <div
        ref={containerRef}
        className="w-full relative h-[50px] flex justify-center cursor-grab active:cursor-grabbing touch-none overflow-visible select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={handleTimelineDragOver}
        onDragLeave={handleTimelineDragLeave}
        onDrop={handleTimelineDrop}
      >
        {/* Track wrapper with edge fade mask (does not mask fixed needle or badge) */}
        <div
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          {/* Continuous Multi-Day Track with Midnight Line Gap (Infinite loop feel) */}
          <div
            className="absolute top-[14px] left-0 will-change-transform pointer-events-auto"
            style={{
              transform: `translate3d(${currentTranslateX}px, 0, 0)`,
              transition: transitionStyle,
            }}
          >
            {/* Render each connected day cycle: Yesterday (-1), Today (0), Tomorrow (1) */}
            {RENDER_DAYS.map((dayOffset) => {
              const dayStartX = dayOffset * DAY_STEP;
              const midnightCenter = dayStartX + DAY_TRACK_WIDTH + MIDNIGHT_GAP / 2;

              return (
                <React.Fragment key={`day-cycle-${dayOffset}`}>
                  {/* Day track bar (2px) - Physical gap at midnight before next day */}
                  <div
                    className={`absolute top-0 h-[2px] rounded-full ${
                      dayOffset === 1
                        ? ''
                        : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                    style={{
                      left: `${dayStartX}px`,
                      width: `${DAY_TRACK_WIDTH}px`,
                    }}
                  >
                    {/* Start of tomorrow: dashed track line up to morning (06:30) */}
                    {dayOffset === 1 && (
                      <div className="absolute inset-0 flex items-center pointer-events-none">
                        <div
                          className="h-[2px] shrink-0 text-zinc-400 dark:text-zinc-500 rounded-full"
                          style={{
                            width: `${TOMORROW_DASHED_WIDTH}px`,
                            backgroundImage:
                              'repeating-linear-gradient(to right, currentColor 0px, currentColor 4px, transparent 4px, transparent 8px)',
                          }}
                        />
                        <div className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-full flex-1" />
                      </div>
                    )}
                    {/* Event & Task intervals on top of track for selected day */}
                    {dayOffset === selectedDayOffset && intervals.map((item) => {
                      const leftPx = item.startMinute * PX_PER_MINUTE;
                      const widthPx = Math.max(16, (item.endMinute - item.startMinute) * PX_PER_MINUTE);

                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.rawEvent && onSelectEvent) onSelectEvent(item.rawEvent);
                            if (item.rawTask && onSelectTask) onSelectTask(item.rawTask);
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredItem({
                              item,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setHoveredItem(null)}
                          className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-zinc-800 dark:bg-zinc-200 cursor-pointer group transition-all duration-150 hover:h-[6px]"
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            backgroundImage: `repeating-linear-gradient(
                              -45deg,
                              rgba(255, 255, 255, 0.28) 0px,
                              rgba(255, 255, 255, 0.28) 2px,
                              transparent 2px,
                              transparent 6px
                            )`,
                          }}
                        >
                          {/* Start boundary tick mark */}
                          <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-zinc-900 dark:bg-zinc-100 rounded-full" />

                          {/* End boundary tick mark */}
                          <span className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                        </div>
                      );
                    })}

                    {/* Active Focus Session: Whole interval is gray, elapsed progress turns RED from left */}
                    {activeFocusInterval && dayOffset === selectedDayOffset && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-zinc-400/80 dark:bg-zinc-600 rounded-none shadow-xs z-20 pointer-events-none"
                        style={{
                          left: `${activeFocusInterval.startMinute * PX_PER_MINUTE}px`,
                          width: `${Math.max(4, activeFocusInterval.durationMinutes * PX_PER_MINUTE)}px`,
                        }}
                      >
                        {/* Start boundary tick mark */}
                        <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-zinc-500 dark:bg-zinc-400 rounded-full" />
                        {/* End boundary tick mark */}
                        <span className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-zinc-500 dark:bg-zinc-400 rounded-full" />

                        {/* Red Progressed Segment from left to right */}
                        {activeFocusInterval.elapsedMinutes > 0 && (
                          <div
                            className="absolute top-0 left-0 h-full bg-red-600 dark:bg-red-500 rounded-none shadow-xs transition duration-500"
                            style={{
                              width: `${Math.min(
                                activeFocusInterval.durationMinutes * PX_PER_MINUTE,
                                Math.max(2, activeFocusInterval.elapsedMinutes * PX_PER_MINUTE)
                              )}px`,
                            }}
                          >
                            {/* Red active progress boundary ticks */}
                            <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-red-600 dark:bg-red-500 rounded-full" />
                            <span className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[10px] bg-red-600 dark:bg-red-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Live Drag-and-Drop Scheduling Preview */}
                    {taskDragOverInfo && taskDragOverInfo.dayIndex === dayOffset && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-[6px] bg-primary/90 dark:bg-primary rounded-full border border-primary pointer-events-none shadow-md shadow-primary/40 animate-pulse z-30 transition duration-75"
                        style={{
                          left: `${taskDragOverInfo.snappedMinute * PX_PER_MINUTE}px`,
                          width: `${taskDragOverInfo.durationMinutes * PX_PER_MINUTE}px`,
                        }}
                      >
                        {/* Start boundary tick */}
                        <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[12px] bg-primary rounded-full" />
                        {/* End boundary tick */}
                        <span className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[12px] bg-primary rounded-full" />
                      </div>
                    )}

                    {/* Time period pills along the day track (صبح، ظهر، بعدظهر، غروب، شب) with hover tooltip */}
                    {TIME_PERIODS.map((period, idx) => {
                      const xPos = period.minute * PX_PER_MINUTE;
                      return (
                        <div
                          key={`period-${dayOffset}-${idx}`}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto cursor-default group"
                          style={{ left: `${xPos}px`, top: 'calc(50% - 1px)' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredPeriod({
                              label: period.label,
                              timeDisplay: period.timeDisplay,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 6,
                            });
                          }}
                          onMouseLeave={() => setHoveredPeriod(null)}
                        >
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 whitespace-nowrap transition duration-150 group-hover:scale-105 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600">
                            {period.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Midnight gap separator & "نیمه‌شب" pill connecting into the next day */}
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto cursor-default group"
                    style={{ left: `${midnightCenter}px`, top: 'calc(50% - 1px)' }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const tooltipLabel = dayOffset === 0 ? 'نیمه‌شب (ورود به فردا)' : 'نیمه‌شب';
                      setHoveredPeriod({
                        label: tooltipLabel,
                        timeDisplay: '۰۰:۰۰',
                        x: rect.left + rect.width / 2,
                        y: rect.top - 6,
                      });
                    }}
                    onMouseLeave={() => setHoveredPeriod(null)}
                  >
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 whitespace-nowrap transition duration-150 group-hover:scale-105 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600">
                      {MIDNIGHT_PERIOD.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

      {/* 2. FIXED Center Red Line Indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[7px] z-30 pointer-events-none flex flex-col items-center">
        <div className="w-[2px] h-[16px] bg-rose-600 dark:bg-rose-500 rounded-full shadow-xs" />
      </div>

      {/* 3. FIXED Center Current Time Badge & Reset Button (Theme-tinted dark, 2px gap from red line, smooth seconds on hover) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[25px] z-30 pointer-events-auto flex items-center justify-center">
        {/* Return to today & current time button (smaller, beside the clock, zero layout shift) */}
        {isAwayFromNow && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleResetToNow(e);
            }}
            className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-zinc-800/90 dark:bg-zinc-700/90 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-300 hover:text-white border border-white/10 shadow-xs transition duration-200 hover:scale-110 active:scale-90 cursor-pointer shrink-0 animate-in fade-in zoom-in-95 duration-150 z-40"
            title="بازگشت به امروز و زمان حال"
          >
            <RiArrowGoBackLine className="w-2.5 h-2.5 pointer-events-none" />
          </button>
        )}

        <div
          onMouseEnter={() => {
            setNow(new Date());
            setIsClockHovered(true);
          }}
          onMouseLeave={() => setIsClockHovered(false)}
          className={`group/clock h-[23px] rounded-full text-white text-[11px] font-normal leading-none shadow-[0_1px_3px_rgba(0,0,0,0.3)] flex items-center justify-center border border-white/10 bg-[color-mix(in_srgb,hsl(var(--primary))_14%,#18181b)] dark:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,#2a2b30)] cursor-default select-none transition duration-300 ease-out hover:border-white/20 hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)] tracking-normal ${
            isClockHovered && activeTime.dayIndex === 0
              ? 'pl-1 pr-1.5'
              : 'px-3'
          }`}
          dir="ltr"
        >
          {/* Day label chip when scrubbing into tomorrow or yesterday */}
          {activeTime.dayIndex !== 0 && (
            <span className="text-[9px] font-medium h-[16px] px-1.5 rounded-full bg-rose-500/20 text-rose-300 dark:text-rose-400 border border-rose-500/30 animate-in fade-in zoom-in-95 duration-100 me-1.5 shrink-0 flex items-center justify-center leading-none">
              {activeTime.dayIndex === 1
                ? 'فردا'
                : activeTime.dayIndex === -1
                ? 'دیروز'
                : activeTime.dayIndex > 1
                ? `+${toPersianDigits(activeTime.dayIndex)} روز`
                : `${toPersianDigits(activeTime.dayIndex)} روز`}
            </span>
          )}

          {/* Smooth expanding "اکنون" label on hover when on today (red theme matching فردا, zero height impact) */}
          <span
            className={`overflow-hidden transition duration-300 ease-out whitespace-nowrap text-[9px] font-medium rounded-full shrink-0 flex items-center justify-center leading-none ${
              isClockHovered && activeTime.dayIndex === 0
                ? 'max-w-[48px] h-[16px] opacity-100 me-1.5 px-1.5 bg-rose-500/20 text-rose-300 dark:text-rose-400 border border-rose-500/30'
                : 'max-w-0 h-[16px] opacity-0 me-0 px-0 border-0'
            }`}
          >
            اکنون
          </span>

          <span className="leading-none flex items-center justify-center m-0 p-0 tracking-normal text-center shrink-0">
            {clockDisplay}
          </span>
          <span
            className={`overflow-hidden transition duration-300 ease-out whitespace-nowrap text-[11px] text-zinc-300 font-normal leading-none flex items-center m-0 p-0 tracking-normal ${
              isClockHovered
                ? 'max-w-[36px] opacity-100'
                : 'max-w-0 opacity-0'
            }`}
          >
            :{secondsDisplay}
          </span>
        </div>
      </div>
      </div>

      {/* 5. Tooltip on Hovering Event / Task on the timeline */}
      {hoveredItem && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl text-right text-xs animate-in fade-in zoom-in-95 duration-100 font-sans"
          style={{
            left: `${hoveredItem.x}px`,
            top: `${hoveredItem.y}px`,
          }}
        >
          <div className="font-semibold text-[12px] text-foreground">
            {hoveredItem.item.title}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 dir-ltr flex items-center justify-end gap-1">
            <span>{hoveredItem.item.startFormatted}</span>
            <span>تا</span>
            <span>{hoveredItem.item.endFormatted}</span>
          </div>
        </div>
      )}

      {/* 6. Tooltip on Hovering Time Period Pills (ظهر، بعدظهر و...) - Slides in from top */}
      {hoveredPeriod && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-lg bg-zinc-900/95 dark:bg-zinc-800/95 text-white text-[11px] font-medium shadow-xl border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-1.5 duration-150 flex items-center gap-1.5 font-sans"
          style={{
            left: `${hoveredPeriod.x}px`,
            top: `${hoveredPeriod.y}px`,
          }}
        >
          <span>{hoveredPeriod.label}</span>
          <span className="text-zinc-400 text-[9px]">•</span>
          <span className="text-rose-400 dark:text-rose-300 font-semibold dir-ltr">{hoveredPeriod.timeDisplay}</span>
        </div>
      )}

      {/* 7. Tooltip on Dragging Task over Timeline */}
      {taskDragOverInfo && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-xl bg-zinc-900/95 dark:bg-zinc-800/95 text-white shadow-xl border border-primary/50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1.5 font-sans"
          style={{
            left: `${taskDragOverInfo.screenX}px`,
            top: `${taskDragOverInfo.screenY - 6}px`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          <span className="text-[11px] font-semibold dir-ltr text-white dark:text-zinc-100">
            {taskDragOverInfo.displayStart} تا {taskDragOverInfo.displayEnd}
          </span>
          {taskDragOverInfo.dayIndex === 1 && (
            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full border border-rose-500/30 font-medium">
              فردا
            </span>
          )}
          {taskDragOverInfo.dayIndex === -1 && (
            <span className="text-[9px] bg-zinc-500/20 text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-500/30 font-medium">
              دیروز
            </span>
          )}
        </div>
      )}
    </div>
  );
};
