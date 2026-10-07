import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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
} from '@/lib/jalali';
import { isOfficialHoliday } from '@/lib/holidays';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { RiArrowGoBackLine } from '@remixicon/react';

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

interface MonthDayCell {
  dayNum: number;
  dateKey: string;
  dayDate: Date;
  isCurrentMonth: boolean;
  isHoliday: boolean;
  isFriday: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasDot: boolean;
  dayName: string;
}

const WEEK_HEIGHT = 94; // Compact week view: 6px pt + 68px body + 20px dragger
const ROW_HEIGHT = 44;  // Consistent, equal height for every week row
const GRID_TOP_PADDING = 0; // Space between headers and numbers is handled by the 8px header padding

const PERSIAN_WEEKDAY_NAMES = ['شنبه', '۱شنبه', '۲شنبه', '۳شنبه', '۴شنبه', '۵شنبه', 'جمعه'];

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

export const WeeklyStrip: React.FC<WeeklyStripProps> = React.memo(({
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


  // Week 3-pane carousel
  const [displayedWeekDate, setDisplayedWeekDate] = useState<Date>(currentDate);
  const [slideTransition, setSlideTransition] = useState<{
    direction: 'to-left' | 'to-right';
    incomingWeekDays: WeekDayInfo[];
  } | null>(null);
  const prevDateKeyRef = useRef(selectedDateKey);

  const isGestureSwipeRef = useRef(false);
  const weekCarouselRef = useRef<HTMLDivElement>(null);
  const weekDragStartTimeRef = useRef<number>(0);
  const weekDragOffsetRef = useRef<number>(0);

  // Sync displayed week with selectedDateKey and animate slide when switching weeks
  useEffect(() => {
    if (selectedDateKey === prevDateKeyRef.current) return;
    const oldKey = prevDateKeyRef.current;
    prevDateKeyRef.current = selectedDateKey;

    if (isGestureSwipeRef.current) {
      isGestureSwipeRef.current = false;
      return;
    }

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

    if (oldSat.getTime() === newSat.getTime()) {
      setDisplayedWeekDate(newD);
      return;
    }

    const isFuture = newSat.getTime() > oldSat.getTime();
    // In Persian RTL (Sat on right, Fri on left):
    // Next week (future) is on the left (-100%); parent moves to-right (+100%) to bring it in from the left.
    // Prev week (past) is on the right (+100%); parent moves to-left (-100%) to bring it in from the right.
    const direction: 'to-left' | 'to-right' = isFuture ? 'to-right' : 'to-left';
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

  const convertWeekDaysToCells = useCallback((days: WeekDayInfo[]): MonthDayCell[] => {
    return days.map((day) => {
      const currentKey = day.formattedDate;
      const isSelected = currentKey === selectedDateKey;
      const isToday = currentKey === todayKey;
      const isHoliday = day.isFriday || isOfficialHoliday(currentKey);
      const hasDot = datesWithItems ? datesWithItems.has(currentKey) : false;
      return {
        dayNum: day.dayNumber,
        dateKey: currentKey,
        dayDate: day.date,
        isCurrentMonth: true,
        isHoliday,
        isFriday: day.isFriday,
        isToday,
        isSelected,
        hasDot,
        dayName: day.dayName,
      };
    });
  }, [selectedDateKey, todayKey, datesWithItems]);

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

  const prevWeekCells = useMemo(() => {
    const days = slideTransition?.direction === 'to-left' ? slideTransition.incomingWeekDays : prevWeekDays;
    return convertWeekDaysToCells(days);
  }, [slideTransition, prevWeekDays, convertWeekDaysToCells]);

  const nextWeekCells = useMemo(() => {
    const days = slideTransition?.direction === 'to-right' ? slideTransition.incomingWeekDays : nextWeekDays;
    return convertWeekDaysToCells(days);
  }, [slideTransition, nextWeekDays, convertWeekDaysToCells]);

  const [weekDragOffset, setWeekDragOffset] = useState(0);
  const [weekAnimating, setWeekAnimating] = useState<'to-left' | 'to-right' | 'reset' | null>(null);
  const weekDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const weekDragModeRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Month data
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
  const [monthAnimating, setMonthAnimating] = useState<'to-left' | 'to-right' | 'reset' | null>(null);
  const monthDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const monthDragModeRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Guard flag to avoid selecting dates while dragging
  const hasDraggedFar = useRef(false);

  // -------------------------------------------------------------
  // Full Month Grid Rows with Adjacent Month Days
  // -------------------------------------------------------------
  const buildMonthGridRows = useCallback(
    (mData: MonthData) => {
      const { jy, jm, daysInMonth, firstDayOffset } = mData;
      const prevMY = getPrevMonthYear(jy, jm);
      const prevMonthLength = getJalaliMonthLength(prevMY.jy, prevMY.jm);
      const nextMY = getNextMonthYear(jy, jm);

      const rows: MonthDayCell[][] = [];
      let currentCells: MonthDayCell[] = [];

      // 1. Leading days from previous month
      for (let i = 0; i < firstDayOffset; i++) {
        const d = prevMonthLength - firstDayOffset + 1 + i;
        const currentKey = formatJalaliKey({ jy: prevMY.jy, jm: prevMY.jm, jd: d });
        const dayDate = jalaliToDate(prevMY.jy, prevMY.jm, d);
        const dayOfWeek = i; // 0 = Sat, 6 = Fri
        const isFriday = dayOfWeek === 6;
        const isHoliday = isFriday || isOfficialHoliday(currentKey);
        const isSelected = currentKey === selectedDateKey;
        const isToday = currentKey === todayKey;
        const hasDot = datesWithItems ? datesWithItems.has(currentKey) : false;
        const dayName = PERSIAN_WEEKDAY_NAMES[dayOfWeek];

        currentCells.push({
          dayNum: d,
          dateKey: currentKey,
          dayDate,
          isCurrentMonth: false,
          isHoliday,
          isFriday,
          isToday,
          isSelected,
          hasDot,
          dayName,
        });
      }

      // 2. Days of current month
      for (let d = 1; d <= daysInMonth; d++) {
        const currentKey = formatJalaliKey({ jy, jm, jd: d });
        const dayDate = jalaliToDate(jy, jm, d);
        const dayOfWeek = (firstDayOffset + d - 1) % 7;
        const isFriday = dayOfWeek === 6;
        const isHoliday = isFriday || isOfficialHoliday(currentKey);
        const isSelected = currentKey === selectedDateKey;
        const isToday = currentKey === todayKey;
        const hasDot = datesWithItems ? datesWithItems.has(currentKey) : false;
        const dayName = PERSIAN_WEEKDAY_NAMES[dayOfWeek];

        currentCells.push({
          dayNum: d,
          dateKey: currentKey,
          dayDate,
          isCurrentMonth: true,
          isHoliday,
          isFriday,
          isToday,
          isSelected,
          hasDot,
          dayName,
        });

        if (currentCells.length === 7) {
          rows.push(currentCells);
          currentCells = [];
        }
      }

      // 3. Trailing days from next month
      if (currentCells.length > 0) {
        const remaining = 7 - currentCells.length;
        for (let d = 1; d <= remaining; d++) {
          const currentKey = formatJalaliKey({ jy: nextMY.jy, jm: nextMY.jm, jd: d });
          const dayDate = jalaliToDate(nextMY.jy, nextMY.jm, d);
          const dayOfWeek = (7 - remaining + d - 1) % 7;
          const isFriday = dayOfWeek === 6;
          const isHoliday = isFriday || isOfficialHoliday(currentKey);
          const isSelected = currentKey === selectedDateKey;
          const isToday = currentKey === todayKey;
          const hasDot = datesWithItems ? datesWithItems.has(currentKey) : false;
          const dayName = PERSIAN_WEEKDAY_NAMES[dayOfWeek];

          currentCells.push({
            dayNum: d,
            dateKey: currentKey,
            dayDate,
            isCurrentMonth: false,
            isHoliday,
            isFriday,
            isToday,
            isSelected,
            hasDot,
            dayName,
          });
        }
        rows.push(currentCells);
      }

      return rows;
    },
    [selectedDateKey, todayKey, datesWithItems]
  );

  const currentMonthRows = useMemo(() => buildMonthGridRows(currentMonthData), [
    buildMonthGridRows,
    currentMonthData,
  ]);
  const prevMonthRows = useMemo(() => buildMonthGridRows(prevMonthData), [
    buildMonthGridRows,
    prevMonthData,
  ]);
  const nextMonthRows = useMemo(() => buildMonthGridRows(nextMonthData), [
    buildMonthGridRows,
    nextMonthData,
  ]);

  // Which row index in current month corresponds to the active/selected date
  const selectedWeekRowIndex = useMemo(() => {
    // Check if any row directly contains the selected date
    for (let r = 0; r < currentMonthRows.length; r++) {
      if (currentMonthRows[r].some((c) => c.dateKey === selectedDateKey)) {
        return r;
      }
    }
    // If not found in current month rows, clamp based on selected day
    if (selectedJalali.jy === viewYear && selectedJalali.jm === viewMonth) {
      const slotIndex = currentMonthData.firstDayOffset + (selectedJalali.jd - 1);
      const r = Math.floor(slotIndex / 7);
      return Math.max(0, Math.min(currentMonthRows.length - 1, r));
    }
    return 0;
  }, [currentMonthRows, selectedDateKey, selectedJalali, viewYear, viewMonth, currentMonthData.firstDayOffset]);

  const isSelectedOtherThanToday = selectedDateKey !== todayKey;
  const returnBtnOffset = isSelectedOtherThanToday ? 36 : 0;

  // Calculated target height for full month view:
  // 6px pt + 32px header + 28px weekdays + (rowCount * ROW_HEIGHT) + 20px dragger + return button offset
  const targetMonthHeight = useMemo(() => {
    return 86 + currentMonthRows.length * ROW_HEIGHT + returnBtnOffset;
  }, [currentMonthRows.length, returnBtnOffset]);

  // Current active height
  const currentHeight = useMemo(() => {
    if (expandHeight !== null) return expandHeight;
    const baseWeekH = WEEK_HEIGHT + returnBtnOffset;
    return isExpanded ? targetMonthHeight : baseWeekH;
  }, [expandHeight, isExpanded, targetMonthHeight, returnBtnOffset]);

  // Expansion progress ratio from 0 (week) to 1 (full month)
  const expansionProgress = useMemo(() => {
    const baseWeekH = WEEK_HEIGHT + returnBtnOffset;
    const range = targetMonthHeight - baseWeekH;
    if (range <= 0) return isExpanded ? 1 : 0;
    const progress = (currentHeight - baseWeekH) / range;
    return Math.max(0, Math.min(1, progress));
  }, [currentHeight, targetMonthHeight, isExpanded, returnBtnOffset]);

  // -------------------------------------------------------------
  // Week Navigation
  // -------------------------------------------------------------
  const goToPrevWeek = useCallback(() => {
    const prevDate = new Date(displayedWeekDate);
    prevDate.setDate(displayedWeekDate.getDate() - 7);
    const prevJalali = getJalaliDate(prevDate);
    onSelectDate(formatJalaliKey(prevJalali));
  }, [displayedWeekDate, onSelectDate]);

  const goToNextWeek = useCallback(() => {
    const nextDate = new Date(displayedWeekDate);
    nextDate.setDate(displayedWeekDate.getDate() + 7);
    const nextJalali = getJalaliDate(nextDate);
    onSelectDate(formatJalaliKey(nextJalali));
  }, [displayedWeekDate, onSelectDate]);

  // -------------------------------------------------------------
  // Month Navigation
  // -------------------------------------------------------------
  const goToPrevMonth = useCallback(() => {
    if (monthAnimating) return;
    setMonthAnimating('to-left');
    setTimeout(() => {
      const prev = getPrevMonthYear(viewYear, viewMonth);
      setViewYear(prev.jy);
      setViewMonth(prev.jm);
      setMonthAnimating(null);
      setMonthDragOffset(0);
    }, 280);
  }, [viewYear, viewMonth, monthAnimating]);

  const goToNextMonth = useCallback(() => {
    if (monthAnimating) return;
    setMonthAnimating('to-right');
    setTimeout(() => {
      const next = getNextMonthYear(viewYear, viewMonth);
      setViewYear(next.jy);
      setViewMonth(next.jm);
      setMonthAnimating(null);
      setMonthDragOffset(0);
    }, 280);
  }, [viewYear, viewMonth, monthAnimating]);

  // -------------------------------------------------------------
  // Dragger Pointer Handlers (Pulling down/up on the dragger line)
  // -------------------------------------------------------------
  const handleDraggerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsVerticalDragging(true);
    verticalStartYRef.current = e.clientY;
    initialHeightRef.current = currentHeight;
    hasDraggedFar.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDraggerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalDragging) return;
    e.stopPropagation();
    const deltaY = e.clientY - verticalStartYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasDraggedFar.current = true;
    }
    const newHeight = Math.max(
      WEEK_HEIGHT,
      Math.min(initialHeightRef.current + deltaY, targetMonthHeight)
    );
    setExpandHeight(newHeight);
  };

  const handleDraggerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalDragging) return;
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const deltaY = e.clientY - verticalStartYRef.current;
    setIsVerticalDragging(false);

    if (hasDraggedFar.current) {
      const midPoint = (WEEK_HEIGHT + targetMonthHeight) / 2;
      const finalH = expandHeight !== null ? expandHeight : initialHeightRef.current + deltaY;
      if (isExpanded) {
        setIsExpanded(deltaY > -25 && finalH > midPoint);
      } else {
        setIsExpanded(deltaY > 25 || finalH > midPoint);
      }
    }
    setExpandHeight(null);
    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 100);
  };

  const handleDraggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDraggedFar.current) return;
    setIsExpanded((prev) => !prev);
  };

  // -------------------------------------------------------------
  // Horizontal & Vertical Gestures on Calendar Body
  // -------------------------------------------------------------
  const handleWeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || weekAnimating || isVerticalDragging) return;
    if ((e.target as HTMLElement).closest('.calendar-nav-chevron')) return;
    e.stopPropagation();
    weekDragStartRef.current = { x: e.clientX, y: e.clientY };
    weekDragStartTimeRef.current = performance.now();
    weekDragOffsetRef.current = 0;
    weekDragModeRef.current = null;
    hasDraggedFar.current = false;
  };

  const handleWeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!weekDragStartRef.current || weekAnimating) return;
    e.stopPropagation();
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
      weekDragOffsetRef.current = deltaX;
      // Direct GPU transform - 0ms main thread lag, 120fps smooth!
      if (weekCarouselRef.current) {
        weekCarouselRef.current.style.transition = 'none';
        weekCarouselRef.current.style.transform = `translate3d(${deltaX}px, 0, 0)`;
      }
    } else if (weekDragModeRef.current === 'vertical') {
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

    const deltaX = weekDragOffsetRef.current;
    const deltaY = e.clientY - weekDragStartRef.current.y;
    const mode = weekDragModeRef.current;
    const dt = Math.max(1, performance.now() - weekDragStartTimeRef.current);
    const velocity = deltaX / dt;

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
      const containerWidth = weekCarouselRef.current?.offsetWidth || window.innerWidth || 360;
      // Threshold: 20% of screen width OR flick velocity (> 0.22 px/ms)
      const passedDistanceLeft = deltaX < -(containerWidth * 0.2);
      const passedDistanceRight = deltaX > (containerWidth * 0.2);
      const isFlickLeft = velocity < -0.22;
      const isFlickRight = velocity > 0.22;

      if (passedDistanceLeft || isFlickLeft) {
        // Dragged left -> Next week enters from left (-100%) in RTL
        isGestureSwipeRef.current = true;
        setWeekAnimating('to-left');
        if (weekCarouselRef.current) {
          weekCarouselRef.current.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';
          weekCarouselRef.current.style.transform = 'translate3d(-100%, 0, 0)';
        }
        setTimeout(() => {
          const nextDate = new Date(displayedWeekDate);
          nextDate.setDate(displayedWeekDate.getDate() + 7);
          const nextJ = getJalaliDate(nextDate);
          setDisplayedWeekDate(nextDate);
          onSelectDate(formatJalaliKey(nextJ));
          setWeekAnimating(null);
          weekDragOffsetRef.current = 0;
          if (weekCarouselRef.current) {
            weekCarouselRef.current.style.transition = 'none';
            weekCarouselRef.current.style.transform = 'translate3d(0, 0, 0)';
          }
        }, 280);
      } else if (passedDistanceRight || isFlickRight) {
        // Dragged right -> Previous week enters from right (+100%) in RTL
        isGestureSwipeRef.current = true;
        setWeekAnimating('to-right');
        if (weekCarouselRef.current) {
          weekCarouselRef.current.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';
          weekCarouselRef.current.style.transform = 'translate3d(100%, 0, 0)';
        }
        setTimeout(() => {
          const prevDate = new Date(displayedWeekDate);
          prevDate.setDate(displayedWeekDate.getDate() - 7);
          const prevJ = getJalaliDate(prevDate);
          setDisplayedWeekDate(prevDate);
          onSelectDate(formatJalaliKey(prevJ));
          setWeekAnimating(null);
          weekDragOffsetRef.current = 0;
          if (weekCarouselRef.current) {
            weekCarouselRef.current.style.transition = 'none';
            weekCarouselRef.current.style.transform = 'translate3d(0, 0, 0)';
          }
        }, 280);
      } else {
        // Snap back to 0 smoothly if released below threshold
        if (weekCarouselRef.current) {
          weekCarouselRef.current.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
          weekCarouselRef.current.style.transform = 'translate3d(0, 0, 0)';
        }
        weekDragOffsetRef.current = 0;
      }
    }

    setTimeout(() => {
      hasDraggedFar.current = false;
    }, 120);
  };

  const handleMonthPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || monthAnimating || isVerticalDragging) return;
    if ((e.target as HTMLElement).closest('.calendar-nav-chevron')) return;
    e.stopPropagation();
    monthDragStartRef.current = { x: e.clientX, y: e.clientY };
    monthDragModeRef.current = null;
    hasDraggedFar.current = false;
  };

  const handleMonthPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!monthDragStartRef.current || monthAnimating) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
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
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }
      }
    }

    if (monthDragModeRef.current === 'horizontal') {
      if (Math.abs(deltaX) > 8) {
        hasDraggedFar.current = true;
      }
      setMonthDragOffset(deltaX);
    } else if (monthDragModeRef.current === 'vertical') {
      if (!isVerticalDragging) {
        setIsVerticalDragging(true);
        verticalStartYRef.current = monthDragStartRef.current.y;
        initialHeightRef.current = targetMonthHeight;
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
    e.stopPropagation();
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
      setIsExpanded(deltaY > -25 && finalH > midPoint);
      setExpandHeight(null);
      return;
    }

    if (mode === 'horizontal') {
      const threshold = 40;
      if (deltaX < -threshold) {
        // Dragged left -> Previous month enters from the right
        setMonthAnimating('to-left');
        setTimeout(() => {
          goToPrevMonth();
          setMonthAnimating(null);
          setMonthDragOffset(0);
        }, 260);
      } else if (deltaX > threshold) {
        // Dragged right -> Next month enters from the left
        setMonthAnimating('to-right');
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
  // Render: Single Week Day Button (in Week Row or Morphing Grid)
  // -------------------------------------------------------------
  const renderDayButton = (
    cell: MonthDayCell,
    showDayNameUnder: boolean
  ) => {
    const isSelected = cell.dateKey === selectedDateKey;

    return (
      <button
        key={cell.dateKey}
        type="button"
        onClick={(e) => {
          if (hasDraggedFar.current) {
            e.preventDefault();
            return;
          }
          onSelectDate(cell.dateKey);
        }}
        className="group relative flex flex-col items-center justify-center flex-1 h-11 outline-none focus-visible:outline-none ring-0 border-none select-none cursor-pointer overflow-visible"
      >
        {/* Circle container: Selected day is size-10 (40px), unselected is size-8 (32px) */}
        <div
          className={`relative rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
            isSelected
              ? `size-10 ${
                  cell.isHoliday
                    ? 'theme-holiday-btn text-white font-bold shadow-xs'
                    : 'theme-add-btn text-white font-bold shadow-xs'
                }`
              : `size-8 ${
                  cell.isToday
                    ? cell.isHoliday
                      ? 'text-destructive font-bold border border-destructive/40 bg-destructive/5'
                      : 'text-foreground font-bold border border-border bg-accent/40'
                    : !cell.isCurrentMonth
                    ? 'text-muted-foreground/35 font-normal hover:bg-muted/40'
                    : cell.isHoliday
                    ? 'text-destructive font-semibold hover:bg-destructive/10'
                    : 'text-foreground/90 font-medium hover:bg-accent/60'
                }`
          }`}
        >
          <span className={`relative z-10 leading-none select-none tabular-nums ${isSelected ? 'text-sm font-bold' : 'text-xs font-semibold'}`}>
            {toPersianDigits(cell.dayNum)}
          </span>

          {/* Event dot indicator */}
          {!isSelected && cell.hasDot && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-muted-foreground pointer-events-none" />
          )}
        </div>

        {/* Persian Weekday Name directly under the circle in the active week */}
        {showDayNameUnder && (
          <span
            style={{
              position: 'absolute',
              top: '50px',
              opacity: Math.max(0, 1 - expansionProgress * 2.5),
              transform: `translateY(${-expansionProgress * 12}px)`,
              transition: isVerticalDragging || expansionProgress === 0 ? 'none' : 'opacity 0.22s ease, transform 0.22s ease',
              display: expansionProgress > 0.65 ? 'none' : 'block',
            }}
            className={`text-xs leading-tight select-none pointer-events-none whitespace-nowrap ${
              cell.isHoliday
                ? 'text-destructive font-medium'
                : isSelected
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground font-normal group-hover:text-foreground'
            }`}
          >
            {cell.dayName}
          </span>
        )}
      </button>
    );
  };

  // -------------------------------------------------------------
  // Render: Month Grid with Morphing Week Rows (Strictly equal spacing)
  // -------------------------------------------------------------
  const renderMonthRowsGrid = (rows: MonthDayCell[][], isStatic: boolean = false) => {
    return (
      <div className="w-full relative overflow-visible">
        {rows.map((rowCells, r) => {
          const isCurrentWeekRow = r === selectedWeekRowIndex;

          // For the current active week row:
          // In week view (p = 0): Y = GRID_TOP_PADDING
          // In month view (p = 1): Y = GRID_TOP_PADDING + r * ROW_HEIGHT
          // Thus it slides down to its exact slot in the month with equal row height!
          const activeWeekY =
            GRID_TOP_PADDING + Math.round(expansionProgress * (r * ROW_HEIGHT));

          // For non-active rows:
          // They unfold smoothly from the active week row into their month positions
          const otherRowY =
            GRID_TOP_PADDING +
            Math.round(
              expansionProgress * (r * ROW_HEIGHT) +
                (1 - expansionProgress) * (selectedWeekRowIndex * ROW_HEIGHT)
            );

          const rowY = isStatic
            ? GRID_TOP_PADDING + r * ROW_HEIGHT
            : isCurrentWeekRow
            ? activeWeekY
            : otherRowY;

          const rowOpacity = isStatic
            ? 1
            : isCurrentWeekRow
            ? 1
            : Math.max(0, (expansionProgress - 0.25) / 0.75);

          const pointerEvents = isStatic
            ? 'auto'
            : isCurrentWeekRow
            ? 'auto'
            : expansionProgress > 0.5
            ? 'auto'
            : 'none';

          return (
            <div
              key={`month-row-${r}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${ROW_HEIGHT}px`,
                transform: `translateY(${rowY}px)`,
                opacity: rowOpacity,
                pointerEvents,
                transition: isVerticalDragging || expansionProgress === 0
                  ? 'none'
                  : 'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
              }}
              className="flex items-center justify-between px-4 sm:px-6 overflow-visible"
            >
              {rowCells.map((cell) =>
                renderDayButton(cell, isCurrentWeekRow)
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Dynamic transforms for carousels
  const getWeekTransform = () => {
    if (weekAnimating === 'to-left') return 'translateX(-100%)';
    if (weekAnimating === 'to-right') return 'translateX(100%)';
    if (weekAnimating === 'reset') return 'translateX(0px)';
    return 'none';
  };

  const getWeekTransition = () => {
    if (weekAnimating) return 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';
    return 'none';
  };

  const getMonthTransform = () => {
    if (monthAnimating === 'to-left') return 'translateX(-100%)';
    if (monthAnimating === 'to-right') return 'translateX(100%)';
    if (monthAnimating === 'reset') return 'translateX(0px)';
    return `translateX(${monthDragOffset}px)`;
  };

  const getMonthTransition = () => {
    if (monthAnimating) return 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
    return 'none';
  };

  return (
    <div
      data-no-drag-scroll="true"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        height: `${currentHeight}px`,
        touchAction: 'none',
        transition: isVerticalDragging
          ? 'none'
          : 'height 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="w-full relative flex flex-col justify-start select-none group/strip pt-1.5 overflow-visible touch-none"
    >
      {/* -------------------------------------------------------------
          1. TOP MONTH HEADER (Month Name + Year + Chevrons)
          Fades and expands gracefully in place as calendar opens
         ------------------------------------------------------------- */}
      <div
        style={{
          height: `${Math.round(expansionProgress * 32)}px`,
          opacity: Math.max(0, (expansionProgress - 0.25) / 0.75),
          transform: `translateY(${(1 - expansionProgress) * -12}px)`,
          transition: isVerticalDragging
            ? 'none'
            : 'height 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, transform 0.28s ease',
        }}
        className="w-full flex items-center justify-between px-6 overflow-hidden shrink-0 select-none"
      >
        <span className="text-sm font-semibold text-foreground tracking-tight">
          {currentMonthData.monthName} {toPersianDigits(currentMonthData.jy)}
        </span>

        <div className="flex items-center gap-1">
          {/* In Persian RTL: Right button navigates to previous month */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevMonth();
            }}
            className="calendar-nav-chevron inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="ماه قبل"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0" />
          </button>

          {/* Left button navigates to next month */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNextMonth();
            }}
            className="calendar-nav-chevron inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="ماه بعد"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. TOP WEEKDAY COLUMN HEADERS (Above the numbers)
          Glides smoothly up from below to sit above the columns!
         ------------------------------------------------------------- */}
      <div
        style={{
          height: `${Math.round(expansionProgress * 28)}px`,
          paddingBottom: `${Math.round(expansionProgress * 8)}px`,
          opacity: Math.max(0, (expansionProgress - 0.15) / 0.85),
          transform: `translateY(${(1 - expansionProgress) * 16}px)`,
          transition: isVerticalDragging
            ? 'none'
            : 'height 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, transform 0.28s ease, padding 0.34s ease',
        }}
        className="w-full grid grid-cols-7 text-center overflow-hidden px-4 sm:px-6 shrink-0 select-none"
      >
        {PERSIAN_WEEKDAY_NAMES.map((wd, i) => (
          <div
            key={i}
            className={`text-xs font-medium flex items-center justify-center tracking-tight ${
              i === 6 ? 'text-destructive font-semibold' : 'text-muted-foreground'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* -------------------------------------------------------------
          3. MAIN CALENDAR BODY (Morphing Week-to-Month Rows)
         ------------------------------------------------------------- */}
      <div
        onPointerDown={isExpanded ? handleMonthPointerDown : handleWeekPointerDown}
        onPointerMove={isExpanded ? handleMonthPointerMove : handleWeekPointerMove}
        onPointerUp={isExpanded ? handleMonthPointerUp : handleWeekPointerUp}
        onPointerCancel={isExpanded ? handleMonthPointerUp : handleWeekPointerUp}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        data-no-drag-scroll="true"
        style={{
          touchAction: 'none',
          height: `${Math.round(
            68 + expansionProgress * (currentMonthRows.length * ROW_HEIGHT - 68)
          )}px`,
          transition: isVerticalDragging
            ? 'none'
            : 'height 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`w-full relative shrink-0 overflow-visible touch-none ${
          weekDragOffset !== 0 || monthDragOffset !== 0 ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Desktop-only hover navigation chevrons for Week view: Clean Hugeicons, no border, no background */}
        {!isExpanded && expansionProgress === 0 && (
          <>
            {/* Right Chevron: Previous Week (هفته قبل) in RTL */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                goToPrevWeek();
              }}
              className="calendar-nav-chevron flex absolute right-0.5 top-1/2 -translate-y-1/2 z-30 size-7 items-center justify-center rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 cursor-pointer opacity-0 group-hover/strip:opacity-100 transition-all duration-200 pointer-events-none group-hover/strip:pointer-events-auto select-none"
              title="هفته قبل"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0" />
            </button>

            {/* Left Chevron: Next Week (هفته بعد) in RTL */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                goToNextWeek();
              }}
              className="calendar-nav-chevron flex absolute left-0.5 top-1/2 -translate-y-1/2 z-30 size-7 items-center justify-center rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 cursor-pointer opacity-0 group-hover/strip:opacity-100 transition-all duration-200 pointer-events-none group-hover/strip:pointer-events-auto select-none"
              title="هفته بعد"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 shrink-0" />
            </button>
          </>
        )}

        {/* Unified calendar rows container: Never unmounts between static / morphing */}
        <div
          ref={weekCarouselRef}
          className="w-full relative will-change-transform"
          style={{
            transform:
              expansionProgress === 1
                ? getMonthTransform()
                : expansionProgress === 0
                ? getWeekTransform()
                : 'none',
            transition:
              expansionProgress === 1
                ? getMonthTransition()
                : expansionProgress === 0
                ? getWeekTransition()
                : 'none',
          }}
        >
          {/* When collapsed and week swiping is active, show adjacent weeks */}
          {expansionProgress === 0 && (
            <>
              {/* Previous Week Pane (+100%, entering from the right) */}
              <div
                className="w-full absolute top-0 left-0 right-0 h-[44px] flex items-center justify-between px-4 sm:px-6 overflow-visible"
                style={{ transform: 'translateX(100%)' }}
              >
                {prevWeekCells.map((cell) => renderDayButton(cell, true))}
              </div>

              {/* Next Week Pane (-100%, entering from the left) */}
              <div
                className="w-full absolute top-0 left-0 right-0 h-[44px] flex items-center justify-between px-4 sm:px-6 overflow-visible"
                style={{ transform: 'translateX(-100%)' }}
              >
                {nextWeekCells.map((cell) => renderDayButton(cell, true))}
              </div>
            </>
          )}

          {/* When expanded to month view and swiping between months */}
          {expansionProgress > 0.8 && (
            <>
              {/* Previous Month (+100%, entering from the right) */}
              <div
                className="w-full absolute inset-x-0 top-0 pointer-events-none"
                style={{
                  transform: 'translateX(100%)',
                  opacity: Math.max(0, (expansionProgress - 0.8) / 0.2),
                }}
              >
                {renderMonthRowsGrid(prevMonthRows, true)}
              </div>

              {/* Next Month (-100%, entering from the left) */}
              <div
                className="w-full absolute inset-x-0 top-0 pointer-events-none"
                style={{
                  transform: 'translateX(-100%)',
                  opacity: Math.max(0, (expansionProgress - 0.8) / 0.2),
                }}
              >
                {renderMonthRowsGrid(nextMonthRows, true)}
              </div>
            </>
          )}

          {/* Morphing Month Rows: Active week glides down to row index; others unfold */}
          {renderMonthRowsGrid(currentMonthRows, false)}
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. RETURN TO TODAY PILL BUTTON:
          Appears smoothly below days and above dragger when viewing another day
         ------------------------------------------------------------- */}
      <div
        style={{
          height: isSelectedOtherThanToday ? '30px' : '0px',
          opacity: isSelectedOtherThanToday ? 1 : 0,
          marginTop: isSelectedOtherThanToday ? '6px' : '0px',
          transition: isVerticalDragging
            ? 'none'
            : 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, margin-top 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isSelectedOtherThanToday ? 'auto' : 'none',
        }}
        className="w-full flex items-center justify-end px-4 sm:px-6 overflow-hidden shrink-0 select-none"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDate(todayKey);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-medium border border-border shadow-xs cursor-pointer transition-colors active:scale-95"
          title="بازگشت به امروز"
        >
          <span>امروز</span>
          <RiArrowGoBackLine className="size-3 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* -------------------------------------------------------------
          CENTERED DRAGGER LINE:
          12px padding top, 4px padding bottom, interactive & non-scroll!
         ------------------------------------------------------------- */}
      <div
        data-no-drag-scroll="true"
        onPointerDown={handleDraggerPointerDown}
        onPointerMove={handleDraggerPointerMove}
        onPointerUp={handleDraggerPointerUp}
        onPointerCancel={handleDraggerPointerUp}
        onClick={handleDraggerClick}
        style={{ paddingTop: '12px', paddingBottom: '4px' }}
        className="w-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none group/dragger"
        title={isExpanded ? 'بستن نمای ماهانه' : 'نمایش تقویم ماهانه'}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 group-hover/dragger:bg-foreground/50 transition-colors" />
      </div>
    </div>
  );
});
