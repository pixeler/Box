import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  type WeekDayInfo,
  getWeekDaysForDate,
  toPersianDigits,
  jalaliToDate,
  parseJalaliKey,
  getJalaliDate,
  formatJalaliKey,
  getTodayJalaliKey,
  getJalaliMonthLength,
  getJalaliMonthFirstDayOfWeek,
  getIranianDayOfWeek,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_SHORT_NAMES,
} from '@/lib/jalali';
import { isOfficialHoliday, getHolidaysForDate, IranianHoliday } from '@/lib/holidays';
import { RiArrowRightSLine, RiArrowLeftSLine } from '@remixicon/react';

interface WeeklyStripProps {
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  datesWithItems?: Set<string>;
}

interface MonthData {
  jy: number;
  jm: number;
  daysInMonth: number;
  firstDayOffset: number;
  rowCount: number;
  monthName: string;
}

const WEEK_HEIGHT = 74; // 48px day capsules + 8px padding + 18px dragger

const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface ThreeCalendarsInfo {
  solar: string;
  lunar?: string;
  gregDay: number;
  gregMonth: string;
  gregYear: number;
  gregFull: string;
  holidays: IranianHoliday[];
  holidayText?: string;
  mainText: string;
}

interface HoveredTooltipState extends ThreeCalendarsInfo {
  x: number;
  y: number;
  arrowOffset: number;
}

/**
 * Format 3 calendars on hover: Solar / Lunar Hijri / Gregorian + Holiday occasion
 * Example: ۱۳ فروردین ۱۴۰۴ / ۵ رجب ۱۴۴۶ / 3 Dec 2025
 */
function formatThreeCalendars(
  date: Date,
  jy: number,
  jm: number,
  jd: number,
  dateKey: string
): ThreeCalendarsInfo {
  // 1. Solar Jalali
  const solar = `${toPersianDigits(jd)} ${PERSIAN_MONTH_NAMES[jm - 1]} ${toPersianDigits(jy)}`;

  // 2. Islamic Lunar Hijri
  let lunar = '';
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    lunar = formatter.format(date).replace(/ه[\s\S]*ق\.?/g, '').trim();
  } catch {
    lunar = '';
  }

  // 3. Gregorian
  const gregDay = date.getDate();
  const gregMonth = EN_MONTHS[date.getMonth()];
  const gregYear = date.getFullYear();
  const gregFull = `${gregDay} ${gregMonth} ${gregYear}`;

  const mainText = lunar ? `${solar} / ${lunar} / ${gregFull}` : `${solar} / ${gregFull}`;

  const holidays = getHolidaysForDate(dateKey);
  const holidayText = holidays.length > 0 ? holidays.map((h) => h.title).join(' | ') : undefined;

  return {
    solar,
    lunar: lunar || undefined,
    gregDay,
    gregMonth,
    gregYear,
    gregFull,
    holidays,
    holidayText,
    mainText,
  };
}

function getMonthData(jy: number, jm: number): MonthData {
  const daysInMonth = getJalaliMonthLength(jy, jm);
  const firstDayOffset = getJalaliMonthFirstDayOfWeek(jy, jm);
  const rowCount = Math.ceil((firstDayOffset + daysInMonth) / 7);
  return {
    jy,
    jm,
    daysInMonth,
    firstDayOffset,
    rowCount,
    monthName: PERSIAN_MONTH_NAMES[jm - 1] || '',
  };
}

function getPrevMonthYear(jy: number, jm: number) {
  if (jm === 1) return { jy: jy - 1, jm: 12 };
  return { jy, jm: jm - 1 };
}

function getNextMonthYear(jy: number, jm: number) {
  if (jm === 12) return { jy: jy + 1, jm: 1 };
  return { jy, jm: jm + 1 };
}

export const WeeklyStrip: React.FC<WeeklyStripProps> = ({
  selectedDateKey,
  onSelectDate,
  datesWithItems,
}) => {
  const todayKey = getTodayJalaliKey();
  const selectedJalali = useMemo(() => parseJalaliKey(selectedDateKey), [selectedDateKey]);
  const currentDate = useMemo(
    () => jalaliToDate(selectedJalali.jy, selectedJalali.jm, selectedJalali.jd),
    [selectedJalali]
  );

  // Month view state
  const [viewYear, setViewYear] = useState<number>(selectedJalali.jy);
  const [viewMonth, setViewMonth] = useState<number>(selectedJalali.jm);

  // Sync month view if selected date changes from outside
  useEffect(() => {
    setViewYear(selectedJalali.jy);
    setViewMonth(selectedJalali.jm);
  }, [selectedJalali.jy, selectedJalali.jm]);

  // Expand / Collapse state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const [expandHeight, setExpandHeight] = useState<number | null>(null);
  const verticalStartYRef = useRef<number>(0);
  const initialHeightRef = useRef<number>(WEEK_HEIGHT);
  const hasDraggedVertically = useRef(false);

  // Hovered day 3-calendar tooltip state anchored under hovered day with fade transition
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltipState | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hideTooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTooltipTimerRef.current) {
        clearTimeout(hideTooltipTimerRef.current);
      }
    };
  }, []);

  // Week 3-pane carousel
  const [displayedWeekDate, setDisplayedWeekDate] = useState<Date>(currentDate);
  const [slideTransition, setSlideTransition] = useState<{
    direction: 'left' | 'right';
    incomingWeekDays: WeekDayInfo[];
  } | null>(null);
  const prevDateKeyRef = useRef(selectedDateKey);

  // Sync displayed week with selectedDateKey and animate slide when switching weeks
  useEffect(() => {
    if (selectedDateKey === prevDateKeyRef.current) return;
    const oldKey = prevDateKeyRef.current;
    prevDateKeyRef.current = selectedDateKey;

    const oldJ = parseJalaliKey(oldKey);
    const oldD = jalaliToDate(oldJ.jy, oldJ.jm, oldJ.jd);
    const newJ = parseJalaliKey(selectedDateKey);
    const newD = jalaliToDate(newJ.jy, newJ.jm, newJ.jd);

    const oldSat = new Date(oldD);
    oldSat.setDate(oldD.getDate() - getIranianDayOfWeek(oldD));
    oldSat.setHours(0, 0, 0, 0);

    const newSat = new Date(newD);
    newSat.setDate(newD.getDate() - getIranianDayOfWeek(newD));
    newSat.setHours(0, 0, 0, 0);

    // If same week, just sync displayedWeekDate without slide
    if (oldSat.getTime() === newSat.getTime()) {
      setDisplayedWeekDate(newD);
      return;
    }

    // Different week: trigger sliding days animation!
    // In Persian RTL layout:
    // Future dates are to the left -> slide left (translateX: -100%)
    // Past dates are to the right -> slide right (translateX: +100%)
    const isFuture = newSat.getTime() > oldSat.getTime();
    const direction: 'left' | 'right' = isFuture ? 'left' : 'right';
    const incomingDays = getWeekDaysForDate(newD);

    setSlideTransition({ direction, incomingWeekDays: incomingDays });
    setWeekAnimating(direction);

    const timer = setTimeout(() => {
      setDisplayedWeekDate(newD);
      setSlideTransition(null);
      setWeekAnimating(null);
      setWeekDragOffset(0);
    }, 280);

    return () => clearTimeout(timer);
  }, [selectedDateKey]);

  const currentWeekDays = useMemo(() => getWeekDaysForDate(displayedWeekDate), [displayedWeekDate]);
  const prevWeekDays = useMemo(() => {
    const prevDate = new Date(displayedWeekDate);
    prevDate.setDate(displayedWeekDate.getDate() - 7);
    return getWeekDaysForDate(prevDate);
  }, [displayedWeekDate]);
  const nextWeekDays = useMemo(() => {
    const nextDate = new Date(displayedWeekDate);
    nextDate.setDate(displayedWeekDate.getDate() + 7);
    return getWeekDaysForDate(nextDate);
  }, [displayedWeekDate]);

  const [weekDragOffset, setWeekDragOffset] = useState(0);
  const [weekAnimating, setWeekAnimating] = useState<'left' | 'right' | 'reset' | null>(null);
  const weekDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const weekDragModeRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Month 3-pane carousel
  const currentMonthData = useMemo(() => getMonthData(viewYear, viewMonth), [viewYear, viewMonth]);
  const prevMonthYear = useMemo(() => getPrevMonthYear(viewYear, viewMonth), [viewYear, viewMonth]);
  const prevMonthData = useMemo(
    () => getMonthData(prevMonthYear.jy, prevMonthYear.jm),
    [prevMonthYear]
  );
  const nextMonthYear = useMemo(() => getNextMonthYear(viewYear, viewMonth), [viewYear, viewMonth]);
  const nextMonthData = useMemo(
    () => getMonthData(nextMonthYear.jy, nextMonthYear.jm),
    [nextMonthYear]
  );

  const [monthDragOffset, setMonthDragOffset] = useState(0);
  const [monthAnimating, setMonthAnimating] = useState<'left' | 'right' | 'reset' | null>(null);
  const monthDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const monthDragModeRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Guard flag to avoid selecting dates while dragging
  const hasDraggedFar = useRef(false);

  const handleDayMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, info: ThreeCalendarsInfo) => {
      if (isVerticalDragging || weekAnimating || monthAnimating) return;
      if (hideTooltipTimerRef.current) {
        clearTimeout(hideTooltipTimerRef.current);
        hideTooltipTimerRef.current = null;
      }

      const buttonRect = e.currentTarget.getBoundingClientRect();
      const buttonCenterX = buttonRect.left + buttonRect.width / 2;
      const buttonBottomY = buttonRect.bottom + 6;

      setHoveredTooltip({
        ...info,
        x: buttonCenterX,
        y: buttonBottomY,
        arrowOffset: 0,
      });
      setIsTooltipVisible(true);
    },
    [isVerticalDragging, weekAnimating, monthAnimating]
  );

  const handleDayMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
    if (hideTooltipTimerRef.current) {
      clearTimeout(hideTooltipTimerRef.current);
    }
    hideTooltipTimerRef.current = setTimeout(() => {
      setHoveredTooltip(null);
    }, 180);
  }, []);

  const clearTooltipImmediately = useCallback(() => {
    if (hideTooltipTimerRef.current) {
      clearTimeout(hideTooltipTimerRef.current);
      hideTooltipTimerRef.current = null;
    }
    setIsTooltipVisible(false);
    setHoveredTooltip(null);
  }, []);

  // Calculated target height for full month view:
  // 32px Month Header + 24px weekday header + (rowCount * 46px) + 26px bottom breathing room
  const targetMonthHeight = useMemo(() => {
    return 32 + 24 + currentMonthData.rowCount * 46 + 26;
  }, [currentMonthData.rowCount]);

  // Current active height
  const currentHeight = useMemo(() => {
    if (expandHeight !== null) return expandHeight;
    return isExpanded ? targetMonthHeight : WEEK_HEIGHT;
  }, [expandHeight, isExpanded, targetMonthHeight]);

  // Expansion progress ratio from 0 (week) to 1 (full month)
  const expansionProgress = useMemo(() => {
    const range = targetMonthHeight - WEEK_HEIGHT;
    if (range <= 0) return isExpanded ? 1 : 0;
    const progress = (currentHeight - WEEK_HEIGHT) / range;
    return Math.max(0, Math.min(1, progress));
  }, [currentHeight, targetMonthHeight, isExpanded]);

  // -------------------------------------------------------------
  // Week Navigation
  // -------------------------------------------------------------
  const goToPrevWeek = useCallback(() => {
    if (weekAnimating) return;
    const prevDate = new Date(displayedWeekDate);
    prevDate.setDate(displayedWeekDate.getDate() - 7);
    const prevJalali = getJalaliDate(prevDate);
    onSelectDate(formatJalaliKey(prevJalali));
  }, [displayedWeekDate, onSelectDate, weekAnimating]);

  const goToNextWeek = useCallback(() => {
    if (weekAnimating) return;
    const nextDate = new Date(displayedWeekDate);
    nextDate.setDate(displayedWeekDate.getDate() + 7);
    const nextJalali = getJalaliDate(nextDate);
    onSelectDate(formatJalaliKey(nextJalali));
  }, [displayedWeekDate, onSelectDate, weekAnimating]);

  // -------------------------------------------------------------
  // Month Navigation
  // -------------------------------------------------------------
  const goToPrevMonth = useCallback(() => {
    const prev = getPrevMonthYear(viewYear, viewMonth);
    setViewYear(prev.jy);
    setViewMonth(prev.jm);
  }, [viewYear, viewMonth]);

  const goToNextMonth = useCallback(() => {
    const next = getNextMonthYear(viewYear, viewMonth);
    setViewYear(next.jy);
    setViewMonth(next.jm);
  }, [viewYear, viewMonth]);

  // -------------------------------------------------------------
  // Vertical Drag Handle Gesture (Down to expand, Up to collapse)
  // -------------------------------------------------------------
  const handleHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    clearTooltipImmediately();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    verticalStartYRef.current = e.clientY;
    initialHeightRef.current = isExpanded ? targetMonthHeight : WEEK_HEIGHT;
    hasDraggedVertically.current = false;
    setIsVerticalDragging(true);
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalDragging) return;
    const deltaY = e.clientY - verticalStartYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasDraggedVertically.current = true;
    }
    const newHeight = Math.max(
      WEEK_HEIGHT,
      Math.min(initialHeightRef.current + deltaY, targetMonthHeight)
    );
    setExpandHeight(newHeight);
  };

  const handleHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalDragging) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const deltaY = e.clientY - verticalStartYRef.current;
    setIsVerticalDragging(false);

    const midPoint = (WEEK_HEIGHT + targetMonthHeight) / 2;
    const finalH = expandHeight !== null ? expandHeight : initialHeightRef.current + deltaY;

    if (initialHeightRef.current === WEEK_HEIGHT) {
      // Dragged down: expand if moved > 25px or past halfway
      setIsExpanded(deltaY > 25 || finalH > midPoint);
    } else {
      // Dragged up: collapse if moved up > 25px or below halfway
      setIsExpanded(deltaY > -25 && finalH > midPoint);
    }

    setExpandHeight(null);
  };

  const handleHandlePointerCancel = () => {
    setIsVerticalDragging(false);
    setExpandHeight(null);
  };

  const handleHandleClick = () => {
    if (hasDraggedVertically.current) {
      hasDraggedVertically.current = false;
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  // -------------------------------------------------------------
  // Horizontal & Vertical Swipe Gestures on Week Strip
  // -------------------------------------------------------------
  const handleWeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || weekAnimating || isVerticalDragging) return;
    clearTooltipImmediately();
    weekDragStartRef.current = { x: e.clientX, y: e.clientY };
    weekDragModeRef.current = null;
    hasDraggedFar.current = false;
  };

  const handleWeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!weekDragStartRef.current || weekAnimating) return;
    const deltaX = e.clientX - weekDragStartRef.current.x;
    const deltaY = e.clientY - weekDragStartRef.current.y;

    if (weekDragModeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
          weekDragModeRef.current = 'horizontal';
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          weekDragModeRef.current = 'vertical';
        }
      }
    }

    if (weekDragModeRef.current === 'horizontal') {
      if (Math.abs(deltaX) > 8) {
        hasDraggedFar.current = true;
      }
      setWeekDragOffset(deltaX);
    } else if (weekDragModeRef.current === 'vertical') {
      // Swiping down on week strip initiates vertical expansion
      if (deltaY > 6 && !isExpanded) {
        if (!isVerticalDragging) {
          setIsVerticalDragging(true);
          verticalStartYRef.current = weekDragStartRef.current.y;
          initialHeightRef.current = WEEK_HEIGHT;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }
        const newHeight = Math.max(
          WEEK_HEIGHT,
          Math.min(WEEK_HEIGHT + deltaY, targetMonthHeight)
        );
        setExpandHeight(newHeight);
      }
    }
  };

  const handleWeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!weekDragStartRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const deltaX = weekDragOffset;
    const deltaY = e.clientY - weekDragStartRef.current.y;
    const mode = weekDragModeRef.current;
    weekDragStartRef.current = null;
    weekDragModeRef.current = null;

    if (isVerticalDragging) {
      setIsVerticalDragging(false);
      const midPoint = (WEEK_HEIGHT + targetMonthHeight) / 2;
      const finalH = expandHeight !== null ? expandHeight : WEEK_HEIGHT + deltaY;
      setIsExpanded(deltaY > 25 || finalH > midPoint);
      setExpandHeight(null);
      return;
    }

    if (mode === 'horizontal') {
      const threshold = 40;
      if (deltaX > threshold) {
        // Dragged to right in RTL -> previous week
        goToPrevWeek();
      } else if (deltaX < -threshold) {
        // Dragged to left in RTL -> next week
        goToNextWeek();
      } else {
        setWeekAnimating('reset');
        setTimeout(() => {
          setWeekAnimating(null);
          setWeekDragOffset(0);
        }, 220);
      }
    }

    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 150);
  };

  // -------------------------------------------------------------
  // Horizontal & Vertical Swipe Gestures on Month View
  // -------------------------------------------------------------
  const handleMonthPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || monthAnimating || isVerticalDragging) return;
    clearTooltipImmediately();
    monthDragStartRef.current = { x: e.clientX, y: e.clientY };
    monthDragModeRef.current = null;
    hasDraggedFar.current = false;
  };

  const handleMonthPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!monthDragStartRef.current || monthAnimating) return;
    const deltaX = e.clientX - monthDragStartRef.current.x;
    const deltaY = e.clientY - monthDragStartRef.current.y;

    if (monthDragModeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
          monthDragModeRef.current = 'horizontal';
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          monthDragModeRef.current = 'vertical';
        }
      }
    }

    if (monthDragModeRef.current === 'horizontal') {
      if (Math.abs(deltaX) > 8) {
        hasDraggedFar.current = true;
      }
      setMonthDragOffset(deltaX);
    } else if (monthDragModeRef.current === 'vertical') {
      // Swiping up/down on month view smoothly collapses or expands
      if (!isVerticalDragging) {
        setIsVerticalDragging(true);
        verticalStartYRef.current = monthDragStartRef.current.y;
        initialHeightRef.current = targetMonthHeight;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
      const newHeight = Math.max(
        WEEK_HEIGHT,
        Math.min(targetMonthHeight + deltaY, targetMonthHeight)
      );
      setExpandHeight(newHeight);
    }
  };

  const handleMonthPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!monthDragStartRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const deltaX = monthDragOffset;
    const deltaY = e.clientY - monthDragStartRef.current.y;
    const mode = monthDragModeRef.current;
    monthDragStartRef.current = null;
    monthDragModeRef.current = null;

    if (isVerticalDragging) {
      setIsVerticalDragging(false);
      const midPoint = (WEEK_HEIGHT + targetMonthHeight) / 2;
      const finalH = expandHeight !== null ? expandHeight : targetMonthHeight + deltaY;
      // If dragged up by > 25px or collapsed past midpoint, collapse!
      setIsExpanded(deltaY > -25 && finalH > midPoint);
      setExpandHeight(null);
      return;
    }

    if (mode === 'horizontal') {
      const threshold = 40;
      if (deltaX > threshold) {
        // Dragged right -> Previous month
        setMonthAnimating('right');
        setTimeout(() => {
          goToPrevMonth();
          setMonthAnimating(null);
          setMonthDragOffset(0);
        }, 260);
      } else if (deltaX < -threshold) {
        // Dragged left -> Next month
        setMonthAnimating('left');
        setTimeout(() => {
          goToNextMonth();
          setMonthAnimating(null);
          setMonthDragOffset(0);
        }, 260);
      } else {
        setMonthAnimating('reset');
        setTimeout(() => {
          setMonthAnimating(null);
          setMonthDragOffset(0);
        }, 220);
      }
    }

    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 150);
  };

  // -------------------------------------------------------------
  // Render Helpers: Single Week Row (Matching User Screenshot)
  // -------------------------------------------------------------
  const renderWeekDays = (weekDays: WeekDayInfo[]) => (
    <div className="w-full flex items-center justify-between px-6">
      {weekDays.map((day) => {
        const isSelected = day.formattedDate === selectedDateKey;
        const isToday = day.formattedDate === todayKey;
        const isHoliday = day.isFriday || isOfficialHoliday(day.formattedDate);
        const hasDot = datesWithItems
          ? datesWithItems.has(day.formattedDate)
          : day.dayNumber === 1 || day.dayNumber === 2 || day.dayNumber === 3;

        const threeInfo = formatThreeCalendars(
          day.date,
          day.jalali.jy,
          day.jalali.jm,
          day.dayNumber,
          day.formattedDate
        );

        return (
          <button
            key={day.formattedDate}
            type="button"
            onMouseEnter={(e) => handleDayMouseEnter(e, threeInfo)}
            onMouseLeave={handleDayMouseLeave}
            onClick={(e) => {
              if (hasDraggedFar.current) {
                e.preventDefault();
                return;
              }
              onSelectDate(day.formattedDate);
            }}
            className="group flex flex-col items-center justify-center flex-1 outline-none focus:outline-none ring-0 border-none select-none cursor-pointer"
          >
            {/* Capsule container enclosing weekday letter on top + day number below */}
            <div
              className={`relative w-[40px] h-[48px] rounded-full flex flex-col items-center justify-center transition-all duration-150 border-[1.5px] ${
                isSelected
                  ? isHoliday
                    ? 'holiday-glass-pill border-transparent text-white'
                    : 'theme-glass-pill border-transparent text-white'
                  : isToday
                  ? isHoliday
                    ? 'border-rose-400 text-rose-500 bg-transparent font-bold'
                    : 'border-border text-foreground bg-transparent font-bold'
                  : 'border-transparent bg-transparent text-foreground/80'
              }`}
            >
              {/* 1. Day Abbreviation Letter on TOP */}
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

              <div className="h-[5px]" />

              {/* 2. Day Number BELOW letter */}
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

              {/* 3. Event dot indicator */}
              {!isSelected && hasDot && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-muted-foreground/80 pointer-events-none" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------
  // Render Helpers: Month Days Grid (15px digits matching week view)
  // -------------------------------------------------------------
  const renderMonthGrid = (mData: MonthData) => {
    const { jy, jm, daysInMonth, firstDayOffset } = mData;
    return (
      <div className="grid grid-cols-7 gap-y-1.5 text-center select-none px-6 pb-3">
        {/* Empty leading slots */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 flex items-center justify-center" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const currentKey = formatJalaliKey({ jy, jm, jd: dayNum });
          const isSelected = selectedDateKey === currentKey;
          const isToday = currentKey === todayKey;
          const isFriday = (firstDayOffset + i) % 7 === 6;
          const isHoliday = isFriday || isOfficialHoliday(currentKey);
          const hasDot = datesWithItems ? datesWithItems.has(currentKey) : false;

          const dayDate = jalaliToDate(jy, jm, dayNum);
          const threeInfo = formatThreeCalendars(dayDate, jy, jm, dayNum, currentKey);

          return (
            <button
              key={dayNum}
              type="button"
              onMouseEnter={(e) => handleDayMouseEnter(e, threeInfo)}
              onMouseLeave={handleDayMouseLeave}
              onClick={(e) => {
                if (hasDraggedFar.current) {
                  e.preventDefault();
                  return;
                }
                onSelectDate(currentKey);
              }}
              className="flex flex-col items-center justify-center h-10 outline-none group cursor-pointer"
            >
              <div
                className={`relative w-[38px] h-[38px] rounded-full flex items-center justify-center text-[15px] leading-none transition-all border-[1.5px] ${
                  isSelected
                    ? isHoliday
                      ? 'holiday-glass-pill border-transparent text-white font-bold'
                      : 'theme-glass-pill border-transparent text-white font-bold'
                    : isToday
                    ? isHoliday
                      ? 'border-rose-400 text-rose-500 bg-transparent font-bold'
                      : 'border-border text-foreground bg-transparent font-bold'
                    : 'border-transparent bg-transparent text-foreground/80'
                }`}
              >
                <span
                  className={`transition-colors ${
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
                  {toPersianDigits(dayNum)}
                </span>
                {!isSelected && hasDot && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-muted-foreground/80 pointer-events-none" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Dynamic Transform Helpers for Carousels
  // -------------------------------------------------------------
  const getWeekTransform = () => {
    if (weekAnimating === 'left') return 'translateX(-100%)';
    if (weekAnimating === 'right') return 'translateX(100%)';
    if (weekAnimating === 'reset') return 'translateX(0px)';
    return `translateX(${weekDragOffset}px)`;
  };

  const getWeekTransition = () => {
    if (weekAnimating) return 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
    return 'none';
  };

  const getMonthTransform = () => {
    if (monthAnimating === 'left') return 'translateX(-100%)';
    if (monthAnimating === 'right') return 'translateX(100%)';
    if (monthAnimating === 'reset') return 'translateX(0px)';
    return `translateX(${monthDragOffset}px)`;
  };

  const getMonthTransition = () => {
    if (monthAnimating) return 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
    return 'none';
  };

  return (
    <div
      style={{
        height: `${currentHeight}px`,
        transition: isVerticalDragging
          ? 'none'
          : 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`w-full relative flex flex-col justify-between select-none ${
        isExpanded || isVerticalDragging ? 'overflow-hidden' : 'overflow-visible'
      }`}
    >
      {/* -------------------------------------------------------------
          MAIN CALENDAR BODY (Week row OR Month grid)
         ------------------------------------------------------------- */}
      <div
        className={`w-full flex-1 relative flex flex-col ${
          isExpanded || isVerticalDragging ? 'overflow-hidden' : 'overflow-visible'
        }`}
      >
        {!isExpanded && !isVerticalDragging ? (
          /* 1. WEEK VIEW CAROUSEL (Visible when collapsed) */
          <div
            onPointerDown={handleWeekPointerDown}
            onPointerMove={handleWeekPointerMove}
            onPointerUp={handleWeekPointerUp}
            onPointerCancel={handleWeekPointerUp}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            data-no-drag-scroll="true"
            style={{ touchAction: 'pan-y' }}
            className={`w-full h-full flex flex-col justify-center will-change-transform group/week relative py-0.5 ${
              weekDragOffset !== 0 ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Desktop-only hover navigation chevrons for Week view: Clean icons, no border, no background */}
            {/* Right Chevron: Previous Week (هفته قبل) in RTL */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevWeek();
              }}
              className="hidden md:flex absolute right-0.5 top-1/2 -translate-y-1/2 z-20 p-1 items-center justify-center text-muted-foreground/60 hover:text-foreground hover:scale-125 cursor-pointer opacity-0 group-hover/week:opacity-100 transition-all duration-200 pointer-events-none group-hover/week:pointer-events-auto select-none"
              title="هفته قبل"
            >
              <RiArrowRightSLine className="w-5 h-5 shrink-0" />
            </button>

            {/* Left Chevron: Next Week (هفته بعد) in RTL */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNextWeek();
              }}
              className="hidden md:flex absolute left-0.5 top-1/2 -translate-y-1/2 z-20 p-1 items-center justify-center text-muted-foreground/60 hover:text-foreground hover:scale-125 cursor-pointer opacity-0 group-hover/week:opacity-100 transition-all duration-200 pointer-events-none group-hover/week:pointer-events-auto select-none"
              title="هفته بعد"
            >
              <RiArrowLeftSLine className="w-5 h-5 shrink-0" />
            </button>

            <div
              className="w-full h-[52px] relative will-change-transform"
              style={{
                transform: getWeekTransform(),
                transition: getWeekTransition(),
              }}
            >
              {/* Previous Week Pane (-100%) */}
              <div
                className="w-full h-full absolute inset-0 flex items-center justify-between"
                style={{ transform: 'translateX(-100%)' }}
              >
                {renderWeekDays(
                  slideTransition?.direction === 'right'
                    ? slideTransition.incomingWeekDays
                    : prevWeekDays
                )}
              </div>

              {/* Current Week Pane (0%) */}
              <div
                className="w-full h-full absolute inset-0 flex items-center justify-between"
                style={{ transform: 'translateX(0%)' }}
              >
                {renderWeekDays(currentWeekDays)}
              </div>

              {/* Next Week Pane (+100%) */}
              <div
                className="w-full h-full absolute inset-0 flex items-center justify-between"
                style={{ transform: 'translateX(100%)' }}
              >
                {renderWeekDays(
                  slideTransition?.direction === 'left'
                    ? slideTransition.incomingWeekDays
                    : nextWeekDays
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 2. MONTH VIEW (Visible when expanded or dragging) */
          <div className="w-full h-full flex flex-col pt-0.5 overflow-hidden animate-in fade-in duration-150">
            {/* Month Header: Month Name + Year + Chevrons (Smoothly fades in as expanded) */}
            <div
              style={{
                opacity: isVerticalDragging
                  ? Math.max(0, (expansionProgress - 0.45) * 1.8)
                  : isExpanded
                  ? 1
                  : 0,
              }}
              className="flex items-center justify-between px-6 pb-1.5 pt-0.5 select-none shrink-0 transition-opacity duration-150"
            >
              <span className="text-sm font-bold text-foreground">
                {currentMonthData.monthName} {toPersianDigits(currentMonthData.jy)}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1 rounded-full hover:bg-muted/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="ماه قبل"
                >
                  <RiArrowRightSLine className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1 rounded-full hover:bg-muted/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="ماه بعد"
                >
                  <RiArrowLeftSLine className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Weekday Abbreviations Row */}
            <div
              style={{
                opacity: isVerticalDragging
                  ? Math.max(0, (expansionProgress - 0.25) * 1.33)
                  : isExpanded
                  ? 1
                  : 0,
              }}
              className="grid grid-cols-7 text-center mb-1 text-[11px] font-semibold text-muted-foreground/70 px-6 shrink-0 transition-opacity duration-150"
            >
              {PERSIAN_WEEKDAY_SHORT_NAMES.map((wd, i) => (
                <div key={i} className={i === 6 ? 'text-rose-500' : ''}>
                  {wd}
                </div>
              ))}
            </div>

            {/* 3-Pane Month Carousel for Smooth Horizontal Swiping */}
            <div
              onPointerDown={handleMonthPointerDown}
              onPointerMove={handleMonthPointerMove}
              onPointerUp={handleMonthPointerUp}
              onPointerCancel={handleMonthPointerUp}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              data-no-drag-scroll="true"
              style={{ touchAction: 'pan-y' }}
              className={`w-full flex-1 relative will-change-transform ${
                monthDragOffset !== 0 ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                className="w-full relative will-change-transform"
                style={{
                  transform: getMonthTransform(),
                  transition: getMonthTransition(),
                }}
              >
                {/* Previous Month (-100%) */}
                <div
                  className="w-full absolute inset-x-0 top-0"
                  style={{ transform: 'translateX(-100%)' }}
                >
                  {renderMonthGrid(prevMonthData)}
                </div>

                {/* Current Month (0%) */}
                <div
                  className="w-full absolute inset-x-0 top-0"
                  style={{ transform: 'translateX(0%)' }}
                >
                  {renderMonthGrid(currentMonthData)}
                </div>

                {/* Next Month (+100%) */}
                <div
                  className="w-full absolute inset-x-0 top-0"
                  style={{ transform: 'translateX(100%)' }}
                >
                  {renderMonthGrid(nextMonthData)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          FLOATING TOOLTIP ANCHORED DIRECTLY UNDER HOVERED DAY
          (Portaled to document.body with fixed positioning so it never gets clipped)
         ------------------------------------------------------------- */}
      {hoveredTooltip && typeof document !== 'undefined' && (() => {
        return createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${hoveredTooltip.x}px`,
              top: `${hoveredTooltip.y}px`,
              transform: 'translateX(-50%)',
              transition: 'left 150ms ease-out, top 150ms ease-out',
            }}
            className={`fixed z-[9999] pointer-events-none flex flex-col items-center will-change-transform max-w-[92vw] sm:max-w-md ${
              isTooltipVisible ? 'animate-tooltip-in' : 'animate-tooltip-out'
            }`}
          >
            {/* Popover Bubble */}
            <div
              dir="rtl"
              className="relative flex flex-col gap-1.5 px-3.5 py-2 rounded-xl bg-secondary/95 dark:bg-zinc-900/95 text-foreground border border-border/85 shadow-xl backdrop-blur-md select-none text-right min-w-[210px]"
            >
              {/* Caret pointing straight up to hovered day */}
              <div
                style={{
                  left: '50%',
                }}
                className="absolute -top-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-secondary/95 dark:bg-zinc-900/95 border-t border-l border-border/85"
              />

              {/* 1. Top Section: 3 Calendars (Solar / Lunar / Gregorian) */}
              <div className="inline-flex items-center justify-center gap-2 text-[11px] font-medium whitespace-nowrap">
                {/* Solar Jalali */}
                <span className="font-bold text-foreground">
                  {hoveredTooltip.solar}
                </span>

                <span className="text-muted-foreground/40 font-light select-none">/</span>

                {/* Islamic Lunar Hijri */}
                {hoveredTooltip.lunar && (
                  <>
                    <span className="text-foreground/80 font-medium">
                      {hoveredTooltip.lunar}
                    </span>
                    <span className="text-muted-foreground/40 font-light select-none">/</span>
                  </>
                )}

                {/* Gregorian: strictly isolated with dir="ltr" and bdi */}
                <bdi
                  dir="ltr"
                  style={{ unicodeBidi: 'isolate' }}
                  className="inline-flex items-center gap-1 font-semibold text-foreground/90 tabular-nums"
                >
                  <span>{hoveredTooltip.gregDay}</span>
                  <span>{hoveredTooltip.gregMonth}</span>
                  <span>{hoveredTooltip.gregYear}</span>
                </bdi>
              </div>

              {/* 2. Bottom Section: Occasions / Holidays as a bulleted list below */}
              {hoveredTooltip.holidays && hoveredTooltip.holidays.length > 0 && (
                <div className="pt-1.5 border-t border-border/50 flex flex-col gap-1">
                  {hoveredTooltip.holidays.map((h, idx) => {
                    const isHolidayRed = h.isOfficial;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-1.5 text-[11px] leading-snug font-medium ${
                          isHolidayRed
                            ? 'text-rose-500'
                            : 'text-foreground/90 dark:text-zinc-200'
                        }`}
                      >
                        <span
                          className={`text-[13px] leading-none select-none shrink-0 ${
                            isHolidayRed ? 'text-rose-500' : 'text-foreground/70 dark:text-zinc-400'
                          }`}
                        >
                          •
                        </span>
                        <span className="leading-tight">{h.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* -------------------------------------------------------------
          3. DRAG HANDLE BAR (Strictly below the days row, centered)
         ------------------------------------------------------------- */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          handleHandlePointerDown(e);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        onPointerMove={handleHandlePointerMove}
        onPointerUp={handleHandlePointerUp}
        onPointerCancel={handleHandlePointerCancel}
        onClick={handleHandleClick}
        data-no-drag-scroll="true"
        className="w-full flex items-center justify-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing touch-none select-none group shrink-0"
      >
        <div
          className={`h-1 rounded-full transition-all duration-200 ${
            isVerticalDragging
              ? 'w-14 bg-foreground/60 dark:bg-white/60 scale-y-125'
              : 'w-10 bg-muted-foreground/30 group-hover:bg-muted-foreground/50 dark:bg-zinc-600 dark:group-hover:bg-zinc-400'
          }`}
        />
      </div>
    </div>
  );
};
