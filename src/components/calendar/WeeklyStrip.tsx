import React, { useRef, useState } from 'react';
import {
  type WeekDayInfo,
  getWeekDaysForDate,
  toPersianDigits,
  jalaliToDate,
  parseJalaliKey,
  getJalaliDate,
  formatJalaliKey,
  getTodayJalaliKey,
} from '@/lib/jalali';
import { isOfficialHoliday } from '@/lib/holidays';

interface WeeklyStripProps {
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  datesWithItems?: Set<string>;
}

export const WeeklyStrip: React.FC<WeeklyStripProps> = ({
  selectedDateKey,
  onSelectDate,
  datesWithItems,
}) => {
  const currentJalali = parseJalaliKey(selectedDateKey);
  const currentDate = jalaliToDate(currentJalali.jy, currentJalali.jm, currentJalali.jd);
  const weekDays: WeekDayInfo[] = getWeekDaysForDate(currentDate);

  const goToPrevWeek = () => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 7);
    const prevJalali = getJalaliDate(prevDate);
    onSelectDate(formatJalaliKey(prevJalali));
  };

  const goToNextWeek = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 7);
    const nextJalali = getJalaliDate(nextDate);
    onSelectDate(formatJalaliKey(nextJalali));
  };

  // State for visual drag translation
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Gesture tracking refs
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const isHorizontalMove = useRef<boolean | null>(null);
  const hasDraggedFar = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    isHorizontalMove.current = null;
    hasDraggedFar.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null || pointerStartY.current === null) return;
    const deltaX = e.clientX - pointerStartX.current;
    const deltaY = e.clientY - pointerStartY.current;

    if (isHorizontalMove.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
          isHorizontalMove.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          isHorizontalMove.current = false;
        }
      }
    }

    if (isHorizontalMove.current) {
      if (Math.abs(deltaX) > 8) {
        hasDraggedFar.current = true;
      }
      // Damped horizontal offset (max 80px)
      const damped = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * 0.85, 80);
      setDragOffset(damped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const deltaX = dragOffset;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    pointerStartX.current = null;
    pointerStartY.current = null;
    setIsDragging(false);

    // Threshold of 30px to switch week
    if (Math.abs(deltaX) >= 30) {
      if (deltaX > 0) {
        // Dragged to right in RTL -> previous week
        goToPrevWeek();
      } else {
        // Dragged to left in RTL -> next week
        goToNextWeek();
      }
    }

    // Reset translation back to 0
    setDragOffset(0);

    // Keep hasDraggedFar flag active for 150ms to prevent accidental click on day buttons
    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 150);
  };

  const handlePointerCancel = () => {
    pointerStartX.current = null;
    pointerStartY.current = null;
    setIsDragging(false);
    setDragOffset(0);
    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 150);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'pan-y' }}
      className={`w-full flex flex-col items-center pt-1 pb-1 select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      title="برای رفتن به هفته قبل یا بعد، به چپ یا راست بکشید"
    >
      {/* 7 Days of the week in Persian order (شنبه to جمعه) with drag translation */}
      <div
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="w-full flex items-center justify-between px-6 will-change-transform"
      >
        {weekDays.map((day) => {
          const todayKey = getTodayJalaliKey();
          const isSelected = day.formattedDate === selectedDateKey;
          const isToday = day.formattedDate === todayKey;
          const isHoliday = day.isFriday || isOfficialHoliday(day.formattedDate);
          const hasDot = datesWithItems
            ? datesWithItems.has(day.formattedDate)
            : day.dayNumber === 1 || day.dayNumber === 2 || day.dayNumber === 3;

          return (
            <button
              key={day.formattedDate}
              type="button"
              onClick={(e) => {
                if (hasDraggedFar.current) {
                  e.preventDefault();
                  return;
                }
                onSelectDate(day.formattedDate);
              }}
              className="group flex flex-col items-center justify-center flex-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-none select-none cursor-pointer"
            >
              {/* Capsule container */}
              <div
                className={`relative w-[40px] h-[48px] rounded-full flex flex-col items-center justify-center transition-all duration-150 border-[1.5px] ${
                  isSelected
                    ? 'theme-glass-pill border-transparent'
                    : isToday
                    ? isHoliday
                      ? 'border-rose-400 text-rose-500 bg-transparent font-bold'
                      : 'border-border text-foreground bg-transparent font-bold'
                    : 'border-transparent bg-transparent text-foreground/80'
                }`}
              >
                {/* 1. Day Abbreviation Letter on TOP (Bright white text when selected) */}
                <span
                  className={`text-[12px] leading-none transition-colors ${
                    isSelected
                      ? 'text-white font-medium'
                      : isToday
                      ? isHoliday
                        ? 'text-rose-500 font-bold'
                        : 'text-foreground font-bold'
                      : isHoliday
                      ? 'text-rose-500 font-medium'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {day.dayShortName}
                </span>

                {/* Gap between title and number */}
                <div className="h-[5px]" />

                {/* 2. Day Number BELOW letter (Bright white bold text when selected) */}
                <span
                  className={`text-[15px] leading-none transition-colors ${
                    isSelected
                      ? 'text-white font-bold'
                      : isToday
                      ? isHoliday
                        ? 'text-rose-500 font-bold'
                        : 'text-foreground font-bold'
                      : isHoliday
                      ? 'text-rose-500 font-medium'
                      : 'text-foreground/85 font-medium group-hover:text-foreground'
                  }`}
                >
                  {toPersianDigits(day.dayNumber)}
                </span>

                {/* 3. Event dot indicator with absolute positioning */}
                {!isSelected && hasDot && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-muted-foreground/80 pointer-events-none" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
