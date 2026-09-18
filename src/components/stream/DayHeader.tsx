import React, { useState } from 'react';
import { parseJalaliKey, formatJalaliDisplay } from '@/lib/jalali';
import { getHolidaysForDate } from '@/lib/holidays';
import { RiCheckLine, RiFilter3Line } from '@remixicon/react';

interface DayHeaderProps {
  selectedDateKey: string;
  filterType: 'all' | 'task' | 'note' | 'event';
  onFilterTypeChange: (type: 'all' | 'task' | 'note' | 'event') => void;
  sortBy: 'priority' | 'created' | 'alpha';
  onSortByChange: (sort: 'priority' | 'created' | 'alpha') => void;
  onGoToToday?: () => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({
  selectedDateKey,
  filterType,
  onFilterTypeChange,
  sortBy,
  onSortByChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const j = parseJalaliKey(selectedDateKey);
  const formattedDate = formatJalaliDisplay(j);
  const dayHolidays = getHolidaysForDate(selectedDateKey);

  return (
    <div className="w-full flex items-center justify-between mt-4 mb-1.5 relative select-none px-6">
      {/* 1. Date title and occasions on the FAR RIGHT (First child in RTL) */}
      <div className="flex flex-col text-right">
        <h2 className="text-[13.5px] font-medium text-muted-foreground/80 tracking-normal">
          {formattedDate}
        </h2>
        {dayHolidays.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
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

      {/* 2. Filter/Sort button on the FAR LEFT (Second child in RTL) */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
          title="فیلتر و مرتب‌سازی"
        >
          <RiFilter3Line className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl z-30 p-2 text-xs">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                فیلتر بر اساس نوع
              </div>
              <button
                onClick={() => {
                  onFilterTypeChange('all');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>همه موارد</span>
                {filterType === 'all' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button
                onClick={() => {
                  onFilterTypeChange('task');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>فقط تسک‌ها</span>
                {filterType === 'task' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button
                onClick={() => {
                  onFilterTypeChange('note');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>فقط یادداشت‌ها</span>
                {filterType === 'note' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button
                onClick={() => {
                  onFilterTypeChange('event');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>فقط رویدادها</span>
                {filterType === 'event' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>

              <div className="border-t border-border my-1.5" />

              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                مرتب‌سازی
              </div>
              <button
                onClick={() => {
                  onSortByChange('priority');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>بر اساس اولویت</span>
                {sortBy === 'priority' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button
                onClick={() => {
                  onSortByChange('created');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-secondary text-foreground cursor-pointer"
              >
                <span>جدیدترین به قدیمی‌ترین</span>
                {sortBy === 'created' && <RiCheckLine className="w-3.5 h-3.5 text-primary" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
