import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_FULL_WEEKDAY_NAMES,
  toPersianDigits,
  parseJalaliKey,
  formatJalaliKey,
  getTodayJalaliKey,
  addJalaliDays,
  nextWeekendFrom,
  getJalaliMonthLength,
  getJalaliMonthFirstDayOfWeek,
  jalaliToDate,
  getIranianDayOfWeek,
} from '@/lib/jalali';
import { isOfficialHoliday, getHolidaysForDate } from '@/lib/holidays';
import {
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiSunLine,
  RiCalendarEventLine,
  RiCalendarCheckLine,
  RiUmbrellaLine,
  RiForbid2Line,
  RiTimeLine,
  RiRepeatLine,
  RiCloseLine,
  RiCheckLine,
  RiCalendar2Line,
} from '@remixicon/react';
import { formatRecurrenceDisplay, PERSIAN_WEEKDAYS } from '@/lib/recurrence';

export interface DateTimeSelectionResult {
  dateKey: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  repeat?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
}

export interface JalaliDatePickerProps {
  value?: string | null;
  onChange: (dateKey: string | null) => void;
  onClose?: () => void;
  timeValue?: string | null;
  durationMinutes?: number | null;
  repeatValue?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  onDateTimeChange?: (result: DateTimeSelectionResult) => void;
}

const WEEK_DAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const REPEAT_OPTIONS = [
  { id: 'none', label: 'بدون تکرار' },
  { id: 'daily', label: 'هر روز' },
  { id: 'every_other_day', label: 'یک روز در میان' },
  { id: 'workdays', label: 'روزهای کاری (شنبه تا چهارشنبه)' },
  { id: 'custom_weekdays', label: 'روزهای مشخص هفته' },
  { id: 'weekly', label: 'هر هفته' },
  { id: 'monthly', label: 'هر ماه' },
  { id: 'yearly', label: 'هر سال' },
];

const DURATION_PRESETS = [
  { minutes: 15, label: '۱۵ دقیقه' },
  { minutes: 30, label: '۳۰ دقیقه' },
  { minutes: 45, label: '۴۵ دقیقه' },
  { minutes: 60, label: '۱ ساعت' },
  { minutes: 90, label: '۱:۳۰ ساعت' },
  { minutes: 120, label: '۲ ساعت' },
];

function getWeekdayNameFromDateKey(dateKey: string): string {
  try {
    const j = parseJalaliKey(dateKey);
    const g = jalaliToDate(j.jy, j.jm, j.jd);
    const dayIdx = getIranianDayOfWeek(g);
    return PERSIAN_FULL_WEEKDAY_NAMES[dayIdx] || '';
  } catch {
    return '';
  }
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  onClose,
  timeValue,
  durationMinutes: initialDuration,
  repeatValue,
  recurrenceStartDate: initialRecurrenceStartDate,
  recurrenceEndDate: initialRecurrenceEndDate,
  onDateTimeChange,
}) => {
  const todayKey = getTodayJalaliKey();
  const initialJ = value ? parseJalaliKey(value) : parseJalaliKey(todayKey);

  const [isClosing, setIsClosing] = useState(false);

  // Sub-views: 'date' | 'time' | 'repeat'
  const [currentView, setCurrentView] = useState<'date' | 'time' | 'repeat'>('date');

  // Selected Date
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(value || todayKey);
  const [viewYear, setViewYear] = useState(initialJ.jy);
  const [viewMonth, setViewMonth] = useState(initialJ.jm);
  const [hoveredDate, setHoveredDate] = useState<string | null>(value || null);

  // Time & Duration state
  const [hasTime, setHasTime] = useState<boolean>(Boolean(timeValue));
  const initialTimeParts = useMemo(() => {
    if (!timeValue) return { h: 10, m: 30 };
    const m = timeValue.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
    }
    return { h: 10, m: 30 };
  }, [timeValue]);

  const [startHour, setStartHour] = useState<number>(initialTimeParts.h);
  const [startMinute, setStartMinute] = useState<number>(initialTimeParts.m);
  const [hasDuration, setHasDuration] = useState<boolean>(Boolean(initialDuration && initialDuration > 0));
  const [durationMinutes, setDurationMinutes] = useState<number>(initialDuration || 60);

  // Repeat state
  const initialRepeatInfo = useMemo(() => {
    if (!repeatValue || repeatValue === 'none') {
      return { type: 'none', days: [0] };
    }
    if (repeatValue.startsWith('weekdays:') || repeatValue.startsWith('custom:')) {
      const parts = repeatValue
        .replace(/^(weekdays:|custom:)/, '')
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n));
      return { type: 'custom_weekdays', days: parts.length > 0 ? parts : [0] };
    }
    return { type: repeatValue, days: [0] };
  }, [repeatValue]);

  const [repeat, setRepeat] = useState<string>(initialRepeatInfo.type);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(initialRepeatInfo.days);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>(
    initialRecurrenceStartDate || value || todayKey
  );
  const [hasEndDate, setHasEndDate] = useState<boolean>(Boolean(initialRecurrenceEndDate));
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
    initialRecurrenceEndDate || addJalaliDays(initialRecurrenceStartDate || value || todayKey, 30)
  );

  useEffect(() => {
    if (selectedDateKey && (!initialRecurrenceStartDate || initialRecurrenceStartDate === value)) {
      setRecurrenceStartDate(selectedDateKey);
    }
  }, [selectedDateKey, initialRecurrenceStartDate, value]);

  const computedRepeatRule = useMemo(() => {
    if (repeat === 'none') return null;
    if (repeat === 'custom_weekdays') {
      const sorted = [...selectedWeekdays].sort((a, b) => a - b);
      return sorted.length > 0 ? `weekdays:${sorted.join(',')}` : 'daily';
    }
    return repeat;
  }, [repeat, selectedWeekdays]);

  const handleToggleWeekday = (dayId: number) => {
    setSelectedWeekdays((prev) => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayId);
      } else {
        return [...prev, dayId].sort((a, b) => a - b);
      }
    });
  };

  const parsedEndJ = useMemo(() => {
    try {
      return parseJalaliKey(recurrenceEndDate || todayKey);
    } catch {
      return parseJalaliKey(todayKey);
    }
  }, [recurrenceEndDate, todayKey]);

  const updateEndDateParts = (jy: number, jm: number, jd: number) => {
    const maxDays = getJalaliMonthLength(jy, jm);
    const validDay = Math.min(jd, maxDays);
    setRecurrenceEndDate(formatJalaliKey({ jy, jm, jd: validDay }));
  };

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
      setIsClosing(false);
    }, 200);
  };

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

  const tomorrowKey = useMemo(() => addJalaliDays(todayKey, 1), [todayKey]);
  const weekendKey = useMemo(() => nextWeekendFrom(todayKey), [todayKey]);
  const nextWeekKey = useMemo(() => addJalaliDays(todayKey, 7), [todayKey]);

  const endFormattedTime = useMemo(() => {
    if (!hasDuration) return null;
    const totalMins = startHour * 60 + startMinute + durationMinutes;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${toPersianDigits(String(endH).padStart(2, '0'))}:${toPersianDigits(String(endM).padStart(2, '0'))}`;
  }, [hasDuration, startHour, startMinute, durationMinutes]);

  const startFormattedTime = useMemo(() => {
    return `${toPersianDigits(String(startHour).padStart(2, '0'))}:${toPersianDigits(String(startMinute).padStart(2, '0'))}`;
  }, [startHour, startMinute]);

  const durationFormattedText = useMemo(() => {
    if (!hasDuration) return '';
    if (durationMinutes < 60) {
      return `${toPersianDigits(durationMinutes)} دقیقه`;
    }
    const h = Math.floor(durationMinutes / 60);
    const m = durationMinutes % 60;
    if (m === 0) {
      return `${toPersianDigits(h)} ساعت`;
    }
    return `${toPersianDigits(h)} ساعت و ${toPersianDigits(m)} دقیقه`;
  }, [hasDuration, durationMinutes]);

  const summaryBanner = useMemo(() => {
    if (!selectedDateKey) return 'بدون تاریخ';
    const j = parseJalaliKey(selectedDateKey);
    let str = `${toPersianDigits(j.jd)} ${PERSIAN_MONTH_NAMES[j.jm - 1]}`;
    if (j.jy !== parseJalaliKey(todayKey).jy) {
      str += ` ${toPersianDigits(j.jy)}`;
    }
    if (hasTime) {
      if (hasDuration && endFormattedTime) {
        str += `، ${startFormattedTime} تا ${endFormattedTime} (${durationFormattedText})`;
      } else {
        str += `، ساعت ${startFormattedTime}`;
      }
    }
    if (computedRepeatRule) {
      str += `، ${formatRecurrenceDisplay(computedRepeatRule)}`;
      if (hasEndDate && recurrenceEndDate) {
        try {
          const ej = parseJalaliKey(recurrenceEndDate);
          str += ` (تا ${toPersianDigits(ej.jd)} ${PERSIAN_MONTH_NAMES[ej.jm - 1]})`;
        } catch {}
      }
    }
    return str;
  }, [
    selectedDateKey,
    todayKey,
    hasTime,
    hasDuration,
    startFormattedTime,
    endFormattedTime,
    durationFormattedText,
    computedRepeatRule,
    hasEndDate,
    recurrenceEndDate,
  ]);

  const handleConfirm = () => {
    let finalTime: string | null = null;
    if (hasTime) {
      const rawStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
      if (hasDuration) {
        const totalMins = startHour * 60 + startMinute + durationMinutes;
        const endH = Math.floor(totalMins / 60) % 24;
        const endM = totalMins % 60;
        const rawEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        finalTime = `${rawStart}-${rawEnd}`;
      } else {
        finalTime = rawStart;
      }
    }

    onChange(selectedDateKey);
    onDateTimeChange?.({
      dateKey: selectedDateKey,
      time: finalTime,
      durationMinutes: hasTime && hasDuration ? durationMinutes : null,
      repeat: computedRepeatRule,
      recurrenceStartDate: computedRepeatRule ? recurrenceStartDate : null,
      recurrenceEndDate: computedRepeatRule && hasEndDate ? recurrenceEndDate : null,
    });
    handleClose();
  };

  const handleSelectDay = (dayNum: number) => {
    const key = formatJalaliKey({
      jy: viewYear,
      jm: viewMonth,
      jd: dayNum,
    });
    setSelectedDateKey(key);
  };

  const handleSelectPreset = (dateKey: string | null) => {
    setSelectedDateKey(dateKey);
    if (dateKey) {
      const j = parseJalaliKey(dateKey);
      setViewYear(j.jy);
      setViewMonth(j.jm);
    }
  };

  const activeHolidayInfo = hoveredDate ? getHolidaysForDate(hoveredDate) : [];

  const portalTarget = getOverlayPortalTarget();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-[80] flex flex-col justify-end bg-black/70 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-4 font-sans text-right flex flex-col min-h-[460px] max-h-[92%] h-[88%] overflow-hidden relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab active:cursor-grabbing" />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            {currentView !== 'date' ? (
              <button
                type="button"
                onClick={() => setCurrentView('date')}
                className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="بازگشت"
              >
                <RiArrowRightSLine className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-2" />
            )}
            <h3 className="text-sm font-bold text-foreground leading-tight">
              {currentView === 'date'
                ? 'انتخاب تاریخ و زمان'
                : currentView === 'time'
                ? 'تنظیم زمان و مدت'
                : 'تکرار خودکار'}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-muted/60 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Middle Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 py-1 flex flex-col gap-3">
          {/* -------------------------------------------------------------
              VIEW 1: MAIN DATE VIEW (Matching Todoist Layout)
             ------------------------------------------------------------- */}
          {currentView === 'date' && (
            <div className="flex flex-col gap-3">
              {/* Live Summary Box */}
              <div className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 dark:bg-zinc-800/50 border border-border/60 flex items-center text-xs font-medium text-foreground/90 truncate select-all">
                <span className="truncate">{summaryBanner}</span>
              </div>

              {/* Quick Presets Vertical List (Todoist Style) */}
              <div className="flex flex-col divide-y divide-border/40 -mx-1 text-xs">
                {/* امروز */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(todayKey)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
                    selectedDateKey === todayKey ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RiCalendarCheckLine className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium text-xs">امروز</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-normal">
                    {getWeekdayNameFromDateKey(todayKey)}
                  </span>
                </button>

                {/* فردا */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(tomorrowKey)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
                    selectedDateKey === tomorrowKey ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RiSunLine className="size-4 text-amber-500 shrink-0" />
                    <span className="font-medium text-xs">فردا</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-normal">
                    {getWeekdayNameFromDateKey(tomorrowKey)}
                  </span>
                </button>

                {/* آخر هفته */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(weekendKey)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer ${
                    selectedDateKey === weekendKey ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RiUmbrellaLine className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                    <span className="font-medium">آخر هفته</span>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground font-normal">جمعه</span>
                </button>

                {/* هفته بعد */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(nextWeekKey)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer ${
                    selectedDateKey === nextWeekKey ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RiCalendarEventLine className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                    <span className="font-medium">هفته بعد</span>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground font-normal">
                    {getWeekdayNameFromDateKey(nextWeekKey)}
                  </span>
                </button>

                {/* بدون تاریخ */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(null)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer ${
                    selectedDateKey === null ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RiForbid2Line className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">بدون تاریخ</span>
                  </div>
                </button>
              </div>

              {/* Month & Year Navigator */}
              <div className="pt-2.5 border-t border-border/60">
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title="ماه قبل"
                  >
                    <RiArrowRightSLine className="size-4" />
                  </button>

                  <span className="text-xs font-semibold text-foreground tracking-tight">
                    {PERSIAN_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}
                  </span>

                  <button
                    type="button"
                    onClick={nextMonth}
                    className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title="ماه بعد"
                  >
                    <RiArrowLeftSLine className="size-4" />
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 text-center mb-1.5 text-xs font-medium text-muted-foreground">
                  {WEEK_DAYS_SHORT.map((wd, i) => (
                    <div key={i} className={i === 6 ? 'text-destructive font-semibold' : ''}>
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
                  {Array.from({ length: firstDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="size-8" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const currentKey = formatJalaliKey({
                      jy: viewYear,
                      jm: viewMonth,
                      jd: dayNum,
                    });
                    const isSelected = selectedDateKey === currentKey;
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
                        onClick={() => handleSelectDay(dayNum)}
                        title={dayHolidays.map((h) => h.title).join(' | ')}
                        className={`size-8 mx-auto rounded-full flex items-center justify-center transition-colors cursor-pointer text-xs tabular-nums ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs scale-105'
                            : isToday
                            ? 'border border-border font-semibold text-foreground bg-accent/40 hover:bg-accent'
                            : isRedDay
                            ? 'text-destructive font-semibold hover:bg-destructive/10'
                            : 'text-foreground/90 hover:bg-accent hover:text-accent-foreground font-normal'
                        }`}
                      >
                        {toPersianDigits(dayNum)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Holiday Occasions */}
              {activeHolidayInfo.length > 0 && (
                <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
                  {activeHolidayInfo.map((h, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 text-[10.5px] ${
                        h.isOfficial ? 'text-rose-500 font-medium' : 'text-emerald-600 dark:text-emerald-400'
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

              {/* Bottom Rows: Time & Repeat */}
              <div className="pt-2.5 border-t border-border/60 flex flex-col divide-y divide-border/40 text-xs">
                {/* Time Row */}
                <button
                  type="button"
                  onClick={() => setCurrentView('time')}
                  className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <RiTimeLine className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-semibold text-foreground">زمان</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-[11.5px] font-medium text-foreground/80">
                      {hasTime
                        ? hasDuration && endFormattedTime
                          ? `${startFormattedTime} - ${endFormattedTime}`
                          : startFormattedTime
                        : 'بدون زمان'}
                    </span>
                    <RiArrowLeftSLine className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                </button>

                {/* Repeat Row */}
                <button
                  type="button"
                  onClick={() => setCurrentView('repeat')}
                  className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <RiRepeatLine className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-semibold text-foreground">تکرار</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-[11.5px] font-medium text-foreground/80">
                      {formatRecurrenceDisplay(computedRepeatRule)}
                    </span>
                    <RiArrowLeftSLine className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* -------------------------------------------------------------
              VIEW 2: TIME SUB-VIEW
             ------------------------------------------------------------- */}
          {currentView === 'time' && (
            <div className="flex flex-col gap-3.5">
              {/* Time Card */}
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">زمان انتخابی</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="px-3 py-1.5 rounded-lg bg-card border border-border/70 shadow-2xs text-foreground">
                      {startFormattedTime}
                    </span>
                    {hasDuration && endFormattedTime && (
                      <>
                        <span className="text-muted-foreground">-</span>
                        <span className="px-3 py-1.5 rounded-lg bg-card border border-border/70 shadow-2xs text-foreground">
                          {endFormattedTime}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Add Duration Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs font-semibold text-foreground">تعیین مدت زمان</p>
                    <p className="text-[10.5px] text-muted-foreground">مشخص کردن طول مدت تسک یا رویداد</p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={hasDuration}
                    onClick={() => setHasDuration(!hasDuration)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
                      hasDuration ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        hasDuration ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {hasDuration && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                    <span className="text-foreground font-medium">مدت زمان:</span>
                    <span className="font-bold text-primary">{durationFormattedText}</span>
                  </div>
                )}
              </div>

              {/* Interactive Hour & Minute Selector */}
              <div className="flex flex-col gap-2 p-3.5 rounded-2xl border border-border/60 bg-muted/20">
                <span className="text-[11px] font-semibold text-muted-foreground">انتخاب ساعت شروع</span>
                <div className="flex items-center justify-center gap-3 dir-ltr">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground mb-1">ساعت</span>
                    <select
                      value={startHour}
                      onChange={(e) => {
                        setStartHour(parseInt(e.target.value, 10));
                        setHasTime(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-center"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>
                          {toPersianDigits(String(h).padStart(2, '0'))}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-base font-bold text-muted-foreground mt-4">:</span>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground mb-1">دقیقه</span>
                    <select
                      value={startMinute}
                      onChange={(e) => {
                        setStartMinute(parseInt(e.target.value, 10));
                        setHasTime(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-center"
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={m}>
                          {toPersianDigits(String(m).padStart(2, '0'))}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Duration Presets */}
              {hasDuration && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">طول مدت</span>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.minutes}
                        type="button"
                        onClick={() => setDurationMinutes(p.minutes)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          durationMinutes === p.minutes
                            ? 'bg-primary/15 text-primary border-primary/40 font-bold shadow-2xs'
                            : 'bg-card text-foreground/80 border-border/70 hover:bg-muted/70'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Zone */}
              <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
                <span>منطقه زمانی</span>
                <span>زمان شناور (ایران)</span>
              </div>

              {/* Clear Time */}
              {hasTime && (
                <button
                  type="button"
                  onClick={() => {
                    setHasTime(false);
                    setHasDuration(false);
                    setCurrentView('date');
                  }}
                  className="w-full py-2.5 rounded-xl bg-muted/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-medium transition-colors cursor-pointer text-center"
                >
                  حذف زمان
                </button>
              )}
            </div>
          )}

          {/* -------------------------------------------------------------
              VIEW 3: REPEAT SUB-VIEW
             ------------------------------------------------------------- */}
          {currentView === 'repeat' && (
            <div className="flex flex-col gap-3.5 pb-2">
              {/* Repeat Options */}
              <div className="flex flex-col divide-y divide-border/50 rounded-2xl bg-secondary/25 border border-border/70 overflow-hidden text-xs">
                {REPEAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setRepeat(opt.id);
                      if (opt.id === 'none') {
                        setCurrentView('date');
                      }
                    }}
                    className="flex items-center justify-between p-3.5 hover:bg-secondary/60 transition-colors text-right cursor-pointer"
                  >
                    <span className={`font-medium ${repeat === opt.id ? 'text-primary font-bold' : 'text-foreground'}`}>
                      {opt.label}
                    </span>
                    {repeat === opt.id && <RiCheckLine className="w-4.5 h-4.5 text-primary shrink-0 stroke-[2.5]" />}
                  </button>
                ))}
              </div>

              {/* Custom Weekday Selector (shown when 'custom_weekdays' is selected) */}
              {repeat === 'custom_weekdays' && (
                <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">روزهای هفته برای تکرار</span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedWeekdays.length === 7
                        ? 'هر روز'
                        : `${toPersianDigits(selectedWeekdays.length)} روز انتخاب شده`}
                    </span>
                  </div>

                  {/* 7 Days circle/capsule buttons */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {PERSIAN_WEEKDAYS.map((w) => {
                      const isSelected = selectedWeekdays.includes(w.id);
                      const isFriday = w.id === 6;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => handleToggleWeekday(w.id)}
                          className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs scale-102'
                              : isFriday
                              ? 'bg-card border-border/70 text-rose-500 hover:bg-rose-500/10 font-semibold'
                              : 'bg-card border-border/70 text-foreground/80 hover:bg-muted/70 font-medium'
                          }`}
                        >
                          <span className="text-xs">{w.label}</span>
                          <span className={`text-[9.5px] mt-0.5 opacity-80 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                            {w.name.replace('‌', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick weekday presets */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([0, 2, 4])}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      روزهای فرد (ش، د، چ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([1, 3, 5])}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      روزهای زوج (ی، س، پ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6])}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      همه روزها
                    </button>
                  </div>
                </div>
              )}

              {/* Start & End Dates Section (shown when repeat is not 'none') */}
              {repeat !== 'none' && (
                <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <RiCalendar2Line className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">بازه زمانی تکرار</span>
                    </div>
                  </div>

                  {/* Start Date Display / Info */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">تاریخ شروع:</span>
                    <span className="font-semibold text-foreground dir-rtl">
                      {recurrenceStartDate ? (() => {
                        const sj = parseJalaliKey(recurrenceStartDate);
                        return `${getWeekdayNameFromDateKey(recurrenceStartDate)}، ${toPersianDigits(sj.jd)} ${PERSIAN_MONTH_NAMES[sj.jm - 1]} ${toPersianDigits(sj.jy)}`;
                      })() : 'از امروز'}
                    </span>
                  </div>

                  {/* End Date Type Toggle */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-semibold">پایان تکرار</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-card border border-border/70 text-xs">
                      <button
                        type="button"
                        onClick={() => setHasEndDate(false)}
                        className={`py-1.5 px-2 rounded-lg text-center font-medium transition-colors cursor-pointer ${
                          !hasEndDate
                            ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        همیشه (بدون پایان)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHasEndDate(true);
                          if (!recurrenceEndDate) {
                            setRecurrenceEndDate(addJalaliDays(recurrenceStartDate || todayKey, 30));
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-medium transition-colors cursor-pointer ${
                          hasEndDate
                            ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        تا تاریخ مشخص
                      </button>
                    </div>

                    {/* When End Date is active: Quick presets + Inline Year/Month/Day Selector */}
                    {hasEndDate && (
                      <div className="flex flex-col gap-2.5 mt-1 p-3 rounded-xl bg-background/60 border border-border/50">
                        {/* Quick Presets */}
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="text-muted-foreground shrink-0">میانبرها:</span>
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                            <button
                              type="button"
                              onClick={() => setRecurrenceEndDate(addJalaliDays(recurrenceStartDate || todayKey, 30))}
                              className="px-2 py-0.5 rounded-md bg-secondary hover:bg-muted text-foreground border border-border/50 cursor-pointer"
                            >
                              +۱ ماه
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecurrenceEndDate(addJalaliDays(recurrenceStartDate || todayKey, 90))}
                              className="px-2 py-0.5 rounded-md bg-secondary hover:bg-muted text-foreground border border-border/50 cursor-pointer"
                            >
                              +۳ ماه
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecurrenceEndDate(addJalaliDays(recurrenceStartDate || todayKey, 180))}
                              className="px-2 py-0.5 rounded-md bg-secondary hover:bg-muted text-foreground border border-border/50 cursor-pointer"
                            >
                              +۶ ماه
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const sj = parseJalaliKey(recurrenceStartDate || todayKey);
                                setRecurrenceEndDate(formatJalaliKey({ jy: sj.jy, jm: 12, jd: 29 }));
                              }}
                              className="px-2 py-0.5 rounded-md bg-secondary hover:bg-muted text-foreground border border-border/50 cursor-pointer"
                            >
                              پایان سال
                            </button>
                          </div>
                        </div>

                        {/* Interactive Jalali Date Selectors for End Date */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {/* Day */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">روز</span>
                            <select
                              value={parsedEndJ.jd}
                              onChange={(e) => updateEndDateParts(parsedEndJ.jy, parsedEndJ.jm, parseInt(e.target.value, 10))}
                              className="px-2 py-1.5 rounded-lg bg-card border border-border text-foreground font-semibold text-center focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                              {Array.from({ length: getJalaliMonthLength(parsedEndJ.jy, parsedEndJ.jm) }).map((_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {toPersianDigits(i + 1)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Month */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">ماه</span>
                            <select
                              value={parsedEndJ.jm}
                              onChange={(e) => updateEndDateParts(parsedEndJ.jy, parseInt(e.target.value, 10), parsedEndJ.jd)}
                              className="px-2 py-1.5 rounded-lg bg-card border border-border text-foreground font-semibold text-center focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                              {PERSIAN_MONTH_NAMES.map((name, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Year */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground">سال</span>
                            <select
                              value={parsedEndJ.jy}
                              onChange={(e) => updateEndDateParts(parseInt(e.target.value, 10), parsedEndJ.jm, parsedEndJ.jd)}
                              className="px-2 py-1.5 rounded-lg bg-card border border-border text-foreground font-semibold text-center focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                              {[viewYear - 1, viewYear, viewYear + 1, viewYear + 2, viewYear + 3].map((y) => (
                                <option key={y} value={y}>
                                  {toPersianDigits(y)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* End date preview text */}
                        <div className="text-[11px] text-primary font-medium text-center pt-1 border-t border-border/30">
                          تکرار تا {toPersianDigits(parsedEndJ.jd)} {PERSIAN_MONTH_NAMES[parsedEndJ.jm - 1]} {toPersianDigits(parsedEndJ.jy)} ({getWeekdayNameFromDateKey(recurrenceEndDate)})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------
            BOTTOM NAVIGATION / ACTION BAR (باتم نویگشین)
            Matching QuickCapture style and dimensions
           ------------------------------------------------------------- */}
        <div className="pt-3 border-t border-border flex items-center justify-between shrink-0">
          {/* Submit / Confirm Button (Right side in RTL) */}
          {currentView === 'date' ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 h-9 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <RiCheckLine className="size-4 stroke-[2.5]" />
              <span>انتخاب تاریخ</span>
            </button>
          ) : currentView === 'time' ? (
            <button
              type="button"
              onClick={() => {
                setHasTime(true);
                setCurrentView('date');
              }}
              className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 h-9 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <RiCheckLine className="size-4 stroke-[2.5]" />
              <span>تأیید زمان</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentView('date')}
              className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 h-9 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <RiCheckLine className="size-4 stroke-[2.5]" />
              <span>تأیید تکرار</span>
            </button>
          )}

          {/* Cancel / Secondary actions (Left side in RTL) */}
          <div className="flex items-center gap-2">
            {currentView === 'date' && selectedDateKey && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDateKey(null);
                  setHasTime(false);
                  setHasDuration(false);
                  setRepeat('none');
                }}
                className="px-3 h-9 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                بدون تاریخ
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-4 h-9 rounded-full border border-input bg-background shadow-xs text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <span>انصراف</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
};
