import React, { useRef } from 'react';
import {
  type WeekDayInfo,
  getWeekDaysForDate,
  toPersianDigits,
  jalaliToDate,
  parseJalaliKey,
  getJalaliDate,
  formatJalaliKey,
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

  // Touch and Mouse swipe/drag support for week navigation
  const touchStartX = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDraggingMouse = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 35) {
      if (diff > 0) {
        // Swiped right (in RTL: previous week)
        goToPrevWeek();
      } else {
        // Swiped left (in RTL: next week)
        goToNextWeek();
      }
    }
    touchStartX.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseStartX.current = e.clientX;
    isDraggingMouse.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingMouse.current || mouseStartX.current === null) return;
    const diff = e.clientX - mouseStartX.current;
    if (Math.abs(diff) > 35) {
      if (diff > 0) {
        goToPrevWeek();
      } else {
        goToNextWeek();
      }
    }
    mouseStartX.current = null;
    isDraggingMouse.current = false;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className="w-full flex flex-col items-center pt-1 pb-1 select-none cursor-grab active:cursor-grabbing"
      title="برای تغییر هفته به چپ یا راست بکشید"
    >
      {/* 7 Days of the week in Persian order (شنبه to جمعه) */}
      <div
        key={weekDays[0]?.formattedDate}
        className="w-full flex items-center justify-between px-0.5"
      >
        {weekDays.map((day) => {
          const isSelected = day.formattedDate === selectedDateKey;
          const isHoliday = day.isFriday || isOfficialHoliday(day.formattedDate);
          const hasDot = datesWithItems
            ? datesWithItems.has(day.formattedDate)
            : day.dayNumber === 1 || day.dayNumber === 2 || day.dayNumber === 3;

          return (
            <button
              key={day.formattedDate}
              onClick={() => onSelectDate(day.formattedDate)}
              className="group flex flex-col items-center justify-center flex-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-none select-none cursor-pointer"
            >
              {/* Capsule container (encompasses both day letter and number when selected) */}
              <div
                className={`w-[36px] h-[54px] rounded-full flex flex-col items-center justify-center transition-all duration-150 ${
                  isSelected
                    ? 'bg-[#18181b] text-white shadow-xs'
                    : 'bg-transparent text-gray-700'
                }`}
              >
                {/* 1. Day Abbreviation Letter on TOP */}
                <span
                  className={`text-[12px] leading-none transition-colors ${
                    isSelected
                      ? 'text-gray-200 font-medium'
                      : isHoliday
                      ? 'text-rose-500 font-medium'
                      : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                >
                  {day.dayShortName}
                </span>

                {/* 2. Day Number BELOW letter */}
                <span
                  className={`text-[15px] leading-tight mt-1 transition-colors ${
                    isSelected
                      ? 'text-white font-bold'
                      : isHoliday
                      ? 'text-rose-500 font-medium'
                      : 'text-gray-700 font-medium group-hover:text-black'
                  }`}
                >
                  {toPersianDigits(day.dayNumber)}
                </span>
              </div>

              {/* Dot indicator underneath number (only when not selected) */}
              <div className="h-[5px] flex items-center justify-center mt-0.5">
                {!isSelected && hasDot ? (
                  <span className="w-[3px] h-[3px] rounded-full bg-gray-400/90" />
                ) : (
                  <span className="w-[3px] h-[3px]" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
