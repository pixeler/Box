import React, { useMemo } from 'react';
import { parseJalaliKey, formatJalaliDisplay, jalaliToDate, getTodayJalaliKey } from '@/lib/jalali';
import { getHolidaysForDate } from '@/lib/holidays';

interface DayHeaderProps {
  selectedDateKey: string;
  onOpenAdd?: () => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({
  selectedDateKey,
  onOpenAdd,
}) => {
  const displayTitle = useMemo(() => {
    const todayKey = getTodayJalaliKey();
    const selJ = parseJalaliKey(selectedDateKey);
    const todJ = parseJalaliKey(todayKey);
    const selDate = jalaliToDate(selJ.jy, selJ.jm, selJ.jd);
    const todDate = jalaliToDate(todJ.jy, todJ.jm, todJ.jd);

    selDate.setHours(0, 0, 0, 0);
    todDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selDate.getTime() - todDate.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = formatJalaliDisplay(selJ);

    if (diffDays === 0) {
      return `امروز ${dateStr}`;
    } else if (diffDays === 1) {
      return `فردا ${dateStr}`;
    } else if (diffDays === 2) {
      return `پس‌فردا ${dateStr}`;
    } else if (diffDays === -1) {
      return `یک روز گذشته ${dateStr}`;
    } else if (diffDays === -2) {
      return `۲ روز گذشته ${dateStr}`;
    } else {
      return dateStr;
    }
  }, [selectedDateKey]);

  const dayHolidays = useMemo(() => getHolidaysForDate(selectedDateKey), [selectedDateKey]);

  return (
    <div className="w-full flex items-center justify-between select-none px-6 mt-4 mb-2">
      {/* 1. Date title on the FAR RIGHT (First child in RTL): standard text-sm, vertically centered */}
      <div className="flex flex-col text-right justify-center">
        <h2 className="text-sm font-medium text-muted-foreground tracking-tight select-none leading-none">
          {displayTitle}
        </h2>
        {dayHolidays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {dayHolidays.map((h, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  h.isOfficial ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    h.isOfficial ? 'bg-destructive' : 'bg-emerald-500'
                  }`}
                />
                <span>{h.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Minimal muted Add Task button on the FAR LEFT */}
      <button
        type="button"
        onClick={onOpenAdd}
        className="border border-neutral-200 dark:border-neutral-800 text-muted-foreground hover:text-foreground hover:bg-secondary/40 text-xs px-3 py-1 rounded-full flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none"
        title="اضافه کردن کار"
      >
        <span className="text-sm font-light leading-none">+</span>
        <span className="font-normal text-[11px] sm:text-xs">اضافه کردن کار</span>
        <span className="opacity-40 text-[11px] font-mono leading-none">/</span>
      </button>
    </div>
  );
};
