import React, { useMemo } from 'react';
import { parseJalaliKey, formatJalaliDisplay, toPersianDigits, jalaliToDate, getTodayJalaliKey } from '@/lib/jalali';
import { getHolidaysForDate } from '@/lib/holidays';
import { HugeiconsIcon } from '@hugeicons/react';
import { PartyIcon } from '@hugeicons/core-free-icons';

interface DayHeaderProps {
  selectedDateKey: string;
  filterType?: 'all' | 'task' | 'note' | 'event';
  onFilterTypeChange?: (type: 'all' | 'task' | 'note' | 'event') => void;
  sortBy?: 'priority' | 'created' | 'alpha';
  onSortByChange?: (sort: 'priority' | 'created' | 'alpha') => void;
  onGoToToday?: () => void;
  todayDoneCount?: number;
  todayTotalCount?: number;
}

export const DayHeader: React.FC<DayHeaderProps> = ({
  selectedDateKey,
  todayDoneCount = 0,
  todayTotalCount = 5,
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
    <div className="w-full flex items-center justify-between select-none px-6 mt-3.5 mb-2">
      {/* 1. Date title on the FAR RIGHT (First child in RTL): 14px font size, vertically centered */}
      <div className="flex flex-col text-right justify-center">
        <h2 className="text-[14px] font-medium text-muted-foreground/90 tracking-normal select-none leading-none">
          {displayTitle}
        </h2>
        {dayHolidays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {dayHolidays.map((h, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  h.isOfficial ? 'text-rose-500' : 'text-emerald-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    h.isOfficial ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
                <span>{h.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Celebration/Task Count Badge stuck to the FAR LEFT, 28px height, center aligned, party icon on the left */}
      <div
        dir="ltr"
        className="h-[28px] inline-flex items-center justify-center gap-1 px-2.5 rounded-full bg-card text-card-foreground border border-border/50 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)] select-none shrink-0"
        title={`هدف روزانه: ${toPersianDigits(todayTotalCount)} تسک (${toPersianDigits(todayDoneCount)} از ${toPersianDigits(todayTotalCount)} انجام شد)`}
      >
        {/* Party icon on the left */}
        <HugeiconsIcon icon={PartyIcon} size={14} strokeWidth={1.8} className="shrink-0 text-muted-foreground/80" />
        <span className="font-semibold text-[11.5px] leading-none pt-0.5 text-foreground/80 tabular-nums">
          {toPersianDigits(todayDoneCount)}/{toPersianDigits(todayTotalCount)}
        </span>
      </div>
    </div>
  );
};
