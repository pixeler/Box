import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { EventItem, Task } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';

interface DailyTimelineBarProps {
  selectedDateKey: string;
  events: EventItem[];
  tasks?: Task[];
  onSelectEvent?: (event: EventItem) => void;
  onSelectTask?: (task: Task) => void;
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
const TIME_PERIODS = [
  { minute: 0, label: 'نیمه‌شب' },
  { minute: 6 * 60 + 30, label: 'صبح' },       // 06:30
  { minute: 12 * 60, label: 'ظهر' },           // 12:00
  { minute: 15 * 60 + 30, label: 'بعدظهر' },    // 15:30
  { minute: 19 * 60, label: 'غروب' },          // 19:00
  { minute: 22 * 60, label: 'شب' },            // 22:00
  { minute: 24 * 60, label: 'نیمه‌شب' },       // 24:00
];

const PX_PER_MINUTE = 1.0; // 60px per hour -> 1440px for 24h
const TOTAL_TRACK_WIDTH = 1440 * PX_PER_MINUTE; // 1440px

export const DailyTimelineBar: React.FC<DailyTimelineBarProps> = ({
  selectedDateKey: _selectedDateKey,
  events,
  tasks = [],
  onSelectEvent,
  onSelectTask,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);

  // Live time tracking
  const [now, setNow] = useState(() => new Date());
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const currentDragOffsetRef = useRef(0);

  // Tooltip state
  const [hoveredItem, setHoveredItem] = useState<{
    item: ParsedInterval;
    x: number;
    y: number;
  } | null>(null);

  const [isClockHovered, setIsClockHovered] = useState(false);

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

  // If dragOffset is active, compute displayed minutes
  const activeMinutes = useMemo(() => {
    if (dragOffset !== null) {
      const minutesFromCenter = -dragOffset / PX_PER_MINUTE;
      const raw = currentMinutes + minutesFromCenter;
      return Math.max(0, Math.min(1440, Math.round(raw)));
    }
    return currentMinutes;
  }, [dragOffset, currentMinutes]);

  // Format clock display (e.g. ۱۲:۳۴)
  const clockDisplay = useMemo(() => {
    const h = Math.floor(activeMinutes / 60) % 24;
    const m = activeMinutes % 60;
    const hStr = toPersianDigits(h);
    const mStr = toPersianDigits(String(m).padStart(2, '0'));
    return `${hStr}:${mStr}`;
  }, [activeMinutes]);

  // Seconds display for smooth reveal on hover (e.g. ۵۶)
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
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    currentDragOffsetRef.current = dragOffset || 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    setDragOffset(currentDragOffsetRef.current + deltaX);
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setTimeout(() => {
      setDragOffset(null);
    }, 1200);
  };

  return (
    <div className="w-full flex flex-col items-center select-none pt-0 pb-0.5 relative overflow-visible">
      {/* 1. Timeline track container - Edge to edge without side margins */}
      <div
        ref={containerRef}
        className="w-full relative h-[50px] flex justify-center cursor-grab active:cursor-grabbing touch-pan-x overflow-visible"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Track wrapper with edge fade mask (does not mask fixed needle or badge) */}
        <div
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          {/* Continuous 24h Track - Translated smoothly */}
          <div
            className="absolute top-[14px] left-0 transition-transform duration-100 ease-out will-change-transform pointer-events-auto"
            style={{
              width: `${TOTAL_TRACK_WIDTH}px`,
              transform: `translate3d(${currentTranslateX}px, 0, 0)`,
            }}
          >
            {/* Base track bar (24 hours) - 1px thinner: 2px */}
            <div className="w-full h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-full relative">
              {/* Event & Task intervals on top of track */}
              {intervals.map((item) => {
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

            {/* Time period pills along the track (صبح، ظهر، بعدظهر، غروب، نیمه‌شب) - solid matching track color, hides line underneath */}
            {TIME_PERIODS.map((period, idx) => {
              const xPos = period.minute * PX_PER_MINUTE;
              return (
                <div
                  key={`period-${idx}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                  style={{ left: `${xPos}px`, top: 'calc(50% - 1px)' }}
                >
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {period.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. FIXED Center Red Line Indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[7px] z-30 pointer-events-none flex flex-col items-center">
        <div className="w-[2px] h-[16px] bg-rose-600 dark:bg-rose-500 rounded-full shadow-xs" />
      </div>

      {/* 3. FIXED Center Current Time Badge (Theme-tinted dark, 1px gap from red line, smooth seconds on hover) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[24px] z-30 pointer-events-auto">
        <div
          onMouseEnter={() => {
            setNow(new Date());
            setIsClockHovered(true);
          }}
          onMouseLeave={() => setIsClockHovered(false)}
          className="group/clock px-2.5 py-1.5 rounded-[6px] text-white text-[11px] font-medium leading-none shadow-[0_1.5px_3px_rgba(0,0,0,0.3)] flex items-center justify-center tracking-tight border border-white/5 bg-[color-mix(in_srgb,hsl(var(--primary))_14%,#18181b)] dark:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,#2a2b30)] cursor-default select-none transition-all duration-300 ease-out hover:border-white/15 hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          dir="ltr"
        >
          <span>{clockDisplay}</span>
          <span
            className={`overflow-hidden transition-all duration-300 ease-out whitespace-nowrap text-[10.5px] text-white/85 ${
              isClockHovered
                ? 'max-w-[32px] opacity-100 ml-0.5'
                : 'max-w-0 opacity-0 ml-0'
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
    </div>
  );
};
