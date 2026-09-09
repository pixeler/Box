import React, { useState, useMemo } from 'react';
import {
  PERSIAN_MONTH_NAMES,
  toPersianDigits,
  parseJalaliKey,
  formatJalaliKey,
  getTodayJalaliKey,
  addJalaliDays,
  nextWeekendFrom,
  getJalaliMonthLength,
  getJalaliMonthFirstDayOfWeek,
} from '@/lib/jalali';
import { isOfficialHoliday, getHolidaysForDate } from '@/lib/holidays';
import {
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiSunLine,
  RiCloudyLine,
  RiCalendarLine,
  RiUmbrellaLine,
  RiForbid2Line,
} from '@remixicon/react';

interface JalaliDatePickerProps {
  value?: string | null;
  onChange: (dateKey: string | null) => void;
  onClose?: () => void;
}

const WEEK_DAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  onClose,
}) => {
  const todayKey = getTodayJalaliKey();
  const initialJ = value ? parseJalaliKey(value) : parseJalaliKey(todayKey);

  const [viewYear, setViewYear] = useState(initialJ.jy);
  const [viewMonth, setViewMonth] = useState(initialJ.jm);
  const [hoveredDate, setHoveredDate] = useState<string | null>(value || null);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysInMonth = useMemo(
    () => getJalaliMonthLength(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const firstDayOffset = useMemo(
    () => getJalaliMonthFirstDayOfWeek(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const handleSelectDate = (dayNumber: number) => {
    const formatted = formatJalaliKey({
      jy: viewYear,
      jm: viewMonth,
      jd: dayNumber,
    });
    onChange(formatted);
    onClose?.();
  };

  const handleQuickPreset = (date: string | null) => {
    onChange(date);
    onClose?.();
  };

  const activeHolidayInfo = hoveredDate ? getHolidaysForDate(hoveredDate) : [];

  return (
    <div
      dir="rtl"
      className="w-[270px] bg-white rounded-[8px] border border-gray-200 shadow-xl p-3 select-none text-right font-sans"
    >
      {/* Quick Presets */}
      <div className="grid grid-cols-5 gap-1 pb-2.5 mb-2.5 border-b border-gray-100 text-[11px]">
        <button
          type="button"
          onClick={() => handleQuickPreset(todayKey)}
          title="امروز"
          className="flex flex-col items-center justify-center p-1 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          <RiSunLine className="w-3.5 h-3.5 text-amber-500 mb-0.5" />
          <span>امروز</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickPreset(addJalaliDays(todayKey, 1))}
          title="فردا"
          className="flex flex-col items-center justify-center p-1 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          <RiCloudyLine className="w-3.5 h-3.5 text-blue-500 mb-0.5" />
          <span>فردا</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickPreset(addJalaliDays(todayKey, 7))}
          title="هفته بعد"
          className="flex flex-col items-center justify-center p-1 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          <RiCalendarLine className="w-3.5 h-3.5 text-indigo-500 mb-0.5" />
          <span>هفته بعد</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickPreset(nextWeekendFrom(todayKey))}
          title="آخر هفته"
          className="flex flex-col items-center justify-center p-1 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          <RiUmbrellaLine className="w-3.5 h-3.5 text-teal-600 mb-0.5" />
          <span>آخر هفته</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickPreset(null)}
          title="بدون تاریخ"
          className="flex flex-col items-center justify-center p-1 rounded-md hover:bg-gray-100 text-gray-700 cursor-pointer"
        >
          <RiForbid2Line className="w-3.5 h-3.5 text-rose-500 mb-0.5" />
          <span>بدون تاریخ</span>
        </button>
      </div>

      {/* Month & Year Navigator */}
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors"
          title="ماه قبل"
        >
          <RiArrowRightSLine className="w-4 h-4" />
        </button>

        <span className="text-xs font-bold text-gray-800">
          {PERSIAN_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors"
          title="ماه بعد"
        >
          <RiArrowLeftSLine className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 text-center mb-1 text-[11px] font-semibold text-gray-400">
        {WEEK_DAYS_SHORT.map((wd, i) => (
          <div key={i} className={i === 6 ? 'text-rose-500' : ''}>
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {/* Empty slots before first day */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="w-7 h-7" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const currentKey = formatJalaliKey({
            jy: viewYear,
            jm: viewMonth,
            jd: dayNum,
          });
          const isSelected = value === currentKey;
          const isToday = currentKey === todayKey;
          const dayHolidays = getHolidaysForDate(currentKey);
          const isOfficial = isOfficialHoliday(currentKey);
          const isFriday = (firstDayOffset + i) % 7 === 6;
          const isRedDay = isFriday || isOfficial;

          return (
            <button
              key={dayNum}
              type="button"
              onMouseEnter={() => setHoveredDate(currentKey)}
              onClick={() => handleSelectDate(dayNum)}
              title={dayHolidays.map((h) => h.title).join(' | ')}
              className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center transition-all cursor-pointer text-xs ${
                isSelected
                  ? 'bg-[#27272a] text-white font-bold shadow-xs'
                  : isToday
                  ? 'border border-black font-bold text-black'
                  : isRedDay
                  ? 'text-rose-600 font-bold hover:bg-rose-50'
                  : 'text-gray-700 hover:bg-gray-100 font-medium'
              }`}
            >
              {toPersianDigits(dayNum)}
            </button>
          );
        })}
      </div>

      {/* Bottom Occasion Info */}
      {activeHolidayInfo.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-col gap-1">
          {activeHolidayInfo.map((h, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 text-[10.5px] ${
                h.isOfficial ? 'text-rose-600 font-medium' : 'text-emerald-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  h.isOfficial ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              <span className="truncate">{h.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
