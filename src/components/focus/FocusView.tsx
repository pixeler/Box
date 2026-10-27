import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RiPlayLine,
  RiMusic2Line,
  RiArrowDownSLine,
  RiCheckLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiSparklingFill,
  RiRestartLine,
} from '@remixicon/react';
import { taskRepo } from '@/repositories';
import type { Task, EventItem } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';
import { DailyTimelineBar } from '../calendar/DailyTimelineBar';
import { useFocusTimer } from './FocusTimerContext';
import { AMBIENT_SOUNDS } from './ambientSounds';

export const FocusView: React.FC = () => {
  // Global Focus Timer Context (persists across tabs, windows, and navigation)
  const {
    durationMinutes,
    remainingSeconds,
    timerState,
    selectedTaskId,
    activeSessionStartMinute,
    todayFocusSessions,
    elapsedMinutes,
    // Ambient sound from context
    activeSoundId,
    soundVolume,
    isSoundPlaying,
    selectSound,
    setSoundVolume,
    toggleSoundPlay,
    setDurationMinutes,
    setRemainingSeconds,
    setSelectedTaskId,
    handleStart,
    handlePauseResume,
    handleAddOneMinute,
    handleStopReset,
  } = useFocusTimer();

  // Interactive Dragging on Circle State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dialRef = useRef<SVGSVGElement | null>(null);

  // Task selection state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPickerOpen, setTaskPickerOpen] = useState<boolean>(false);

  // Sound dropdown state
  const [soundDropdownOpen, setSoundDropdownOpen] = useState<boolean>(false);
  const soundDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close sound dropdown on outside click
  useEffect(() => {
    if (!soundDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (soundDropdownRef.current && !soundDropdownRef.current.contains(e.target as Node)) {
        setSoundDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [soundDropdownOpen]);

  // Current live clock for projected end-time display
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(clockInterval);
  }, []);

  // Load open tasks
  const loadTasks = useCallback(async () => {
    try {
      const allTasks = await taskRepo.list();
      const openTasks = allTasks.filter((t) => t.status === 'open');
      setTasks(openTasks);
    } catch (err) {
      console.error('Failed to load tasks for focus mode:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Selected task object
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // Map today focus sessions into timeline events
  const focusTimelineEvents = useMemo<EventItem[]>(() => {
    return todayFocusSessions.map((s) => ({
      id: s.id,
      entry_id: null,
      title: s.task_title || 'تمرکز آزاد',
      start_at: s.start_at,
      end_at: s.end_at,
      tag_ids: [],
      created_at: s.created_at,
      updated_at: s.created_at,
    }));
  }, [todayFocusSessions]);

  // =========================================================================
  // INTERACTIVE CIRCULAR DIAL DRAG LOGIC (Radius 104, Center 140, 140)
  // =========================================================================
  const updateMinutesFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const rad = Math.atan2(dy, dx);
    let angleFromTop = rad + Math.PI / 2;
    if (angleFromTop < 0) {
      angleFromTop += 2 * Math.PI;
    }

    const fraction = angleFromTop / (2 * Math.PI);
    let mins = Math.round(fraction * 60);
    if (mins <= 0) mins = fraction > 0.5 ? 60 : 1;
    if (mins > 60) mins = 60;

    setDurationMinutes(mins);
    setRemainingSeconds(mins * 60);
  }, [setDurationMinutes, setRemainingSeconds]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (timerState !== 'idle') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateMinutesFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || timerState !== 'idle') return;
    updateMinutesFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Format MM:SS with Persian digits
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return `${toPersianDigits(mm)}:${toPersianDigits(ss)}`;
  };

  // Live Projected Time Range (e.g. ۱۲:۳۴ تا ۱۳:۰۴)
  const liveTimeRange = useMemo(() => {
    const startH = now.getHours();
    const startM = now.getMinutes();
    const endTotal = startH * 60 + startM + durationMinutes;
    const endH = Math.floor(endTotal / 60) % 24;
    const endM = endTotal % 60;

    const startStr = `${toPersianDigits(startH)}:${toPersianDigits(String(startM).padStart(2, '0'))}`;
    const endStr = `${toPersianDigits(endH)}:${toPersianDigits(String(endM).padStart(2, '0'))}`;
    return `${startStr} تا ${endStr}`;
  }, [now, durationMinutes]);

  // =========================================================================
  // SVG DIAL: Radius 104px, Center 140, 140, ViewBox 280x280, StrokeWidth 14.5px
  // =========================================================================
  const dialRadius = 104;
  const strokeWidth = 14.5;
  const circumference = 2 * Math.PI * dialRadius;

  const activeFraction =
    timerState === 'idle'
      ? durationMinutes / 60
      : Math.max(0, remainingSeconds / 3600);

  const strokeDashoffset = circumference * (1 - activeFraction);

  // Radial ticks inside the thicker active stroke
  const strokeTicks = useMemo(() => {
    const totalDegrees = activeFraction * 360;
    if (totalDegrees < 8) return [];

    const span = Math.min(100, Math.max(14, totalDegrees - 8));
    const endDeg = totalDegrees - 4.5;
    const startDeg = endDeg - span;

    const ticksArr: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    const step = 2.4;
    const count = Math.floor((endDeg - startDeg) / step);

    for (let i = 0; i < count; i++) {
      const deg = startDeg + i * step;
      const rad = (deg - 90) * (Math.PI / 180);

      const rIn = dialRadius - 4.6;
      const rOut = dialRadius + 4.6;

      const progress = i / Math.max(1, count - 1);
      const opacity = Math.pow(progress, 1.2) * 0.78;

      ticksArr.push({
        x1: 140 + rIn * Math.cos(rad),
        y1: 140 + rIn * Math.sin(rad),
        x2: 140 + rOut * Math.cos(rad),
        y2: 140 + rOut * Math.sin(rad),
        opacity,
      });
    }

    return ticksArr;
  }, [activeFraction, dialRadius]);

  // Arrow at tip
  const arrowConfig = useMemo(() => {
    const totalDegrees = activeFraction * 360;
    if (totalDegrees < 6) return null;

    const arrowDeg = totalDegrees - 3.4;
    const rad = (arrowDeg - 90) * (Math.PI / 180);
    const x = 140 + dialRadius * Math.cos(rad);
    const y = 140 + dialRadius * Math.sin(rad);

    const baseRotation = arrowDeg - 90;
    const rotation = timerState === 'idle' ? baseRotation : baseRotation + 180;

    return { x, y, rotation };
  }, [activeFraction, timerState, dialRadius]);

  return (
    <div
      dir="rtl"
      className="w-full flex flex-col items-center px-4 pt-3 pb-24 select-none font-sans"
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* =========================================================================
            1. TITLE & STATUS DOT (Identical to Weekday Title in Today View)
           ========================================================================= */}
        <div className="w-full flex items-center justify-start gap-2 mb-2 px-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            تمرکز
          </h1>
          <span
            className={`w-2 h-2 rounded-full inline-block shrink-0 transition duration-300 ${
              timerState === 'running'
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse'
                : 'bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.4)]'
            }`}
          />
        </div>

        {/* =========================================================================
            2. FOCUS TIMELINE BAR
            - Authentic DailyTimelineBar with full hover interactions and clock
            - Active focus session is gray, filling in red progressively from left
           ========================================================================= */}
        <div className="w-full mb-3 overflow-visible">
          <DailyTimelineBar
            selectedDateKey={now.toISOString().split('T')[0]}
            events={focusTimelineEvents}
            tasks={[]}
            activeFocusInterval={
              timerState !== 'idle' && activeSessionStartMinute !== null
                ? {
                    startMinute: activeSessionStartMinute,
                    durationMinutes: durationMinutes,
                    elapsedMinutes: elapsedMinutes,
                  }
                : null
            }
          />
        </div>

        {/* =========================================================================
            3. CIRCULAR DIAL: BALANCED SIZE, THICKER STROKE (14.5px), CLOSE NUMBERS
           ========================================================================= */}
        <div className="relative flex items-center justify-center my-2">
          <svg
            ref={dialRef}
            viewBox="0 0 280 280"
            className={`w-[272px] h-[272px] touch-none ${
              timerState === 'idle' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* 1. Neutral Background Track Ring */}
            <circle
              cx="140"
              cy="140"
              r={dialRadius}
              fill="none"
              stroke="var(--focus-track-neutral, rgba(140, 145, 160, 0.18))"
              strokeWidth={strokeWidth}
            />

            {/* 2. Solid Active Stroke */}
            <circle
              cx="140"
              cy="140"
              r={dialRadius}
              fill="none"
              stroke="var(--focus-dark-theme, #474c5d)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition duration-150 ease-out -rotate-90 origin-center"
            />

            {/* 3. Ticks inside active stroke */}
            {strokeTicks.map((t, idx) => (
              <line
                key={idx}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="white"
                strokeWidth="1.3"
                strokeLinecap="round"
                style={{ opacity: t.opacity }}
              />
            ))}

            {/* 4. Arrow at tip */}
            {arrowConfig && (
              <g
                transform={`translate(${arrowConfig.x}, ${arrowConfig.y}) rotate(${arrowConfig.rotation})`}
                className="text-white drop-shadow-xs"
              >
                <line
                  x1="0"
                  y1="-3.5"
                  x2="0"
                  y2="2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M -2.8 0 L 0 2.8 L 2.8 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {/* 5. Compass Numbers OUTSIDE & HUGGING THE CIRCLE (60, 15, 30, 45) */}
            <g className="select-none pointer-events-none fill-muted-foreground/75 font-sans font-medium text-[13px]">
              {/* 60 (top, closely hugging circle) */}
              <text x="140" y="16" textAnchor="middle" dominantBaseline="central">
                {toPersianDigits(60)}
              </text>
              {/* 15 (right, closely hugging circle) */}
              <text x="264" y="140" textAnchor="middle" dominantBaseline="central">
                {toPersianDigits(15)}
              </text>
              {/* 30 (bottom, closely hugging circle) */}
              <text x="140" y="264" textAnchor="middle" dominantBaseline="central">
                {toPersianDigits(30)}
              </text>
              {/* 45 (left, closely hugging circle) */}
              <text x="16" y="140" textAnchor="middle" dominantBaseline="central">
                {toPersianDigits(45)}
              </text>
            </g>
          </svg>

          {/* Center Info inside Dial: Less bold numbers */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {timerState === 'idle' ? (
              /* Idle: Bold duration number + Time range */
              <div className="flex flex-col items-center justify-center">
                <span className="text-6xl font-bold text-foreground tracking-tight font-sans">
                  {toPersianDigits(durationMinutes)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground/80 mt-1 font-sans tracking-normal">
                  {liveTimeRange}
                </span>
              </div>
            ) : (
              /* Active: Countdown timer + Red "در حال تمرکز" */
              <div className="flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-foreground tracking-tight font-sans">
                  {formatCountdown(remainingSeconds)}
                </span>
                <span
                  className={`text-xs font-semibold mt-1 font-sans ${
                    timerState === 'running'
                      ? 'text-rose-500 dark:text-rose-400'
                      : timerState === 'paused'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  }`}
                >
                  {timerState === 'running'
                    ? 'در حال تمرکز'
                    : timerState === 'paused'
                    ? 'متوقف شده'
                    : 'تمرکز تکمیل شد 🎉'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            4. ACTION CONTROLS ROW
            - Centered strictly under timer
            - Options (+1 min on right, reset & music on left) closely clustered to pill
           ========================================================================= */}
        <div className="w-full flex items-center justify-center mt-3 select-none font-sans">
          <div className="flex items-center justify-center gap-3.5">
            {/* Right child: +1 minute (tightly placed right of pill) */}
            <button
              type="button"
              onClick={handleAddOneMinute}
              className="text-xs font-semibold text-foreground/80 hover:text-foreground active:scale-95 transition-colors cursor-pointer bg-transparent border-0 py-2 px-1 select-none font-sans whitespace-nowrap"
            >
              +۱ دقیقه
            </button>

            {/* Center: Main Pill Button (Icon on RIGHT of text with tight gap-1.5) */}
            {timerState === 'idle' ? (
              <button
                type="button"
                onClick={handleStart}
                className="h-12 px-8 rounded-full flex items-center justify-center gap-1.5 text-sm font-bold bg-[#212228] text-white hover:bg-[#2c2e36] dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white shadow-xs transition active:scale-95 cursor-pointer font-sans"
              >
                {/* Icon first -> in RTL, renders on the RIGHT side of text */}
                <RiPlayLine className="w-4 h-4 stroke-[2.4]" />
                <span>شروع</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseResume}
                className="h-12 px-8 rounded-full flex items-center justify-center gap-1.5 text-sm font-bold bg-[#212228] text-white hover:bg-[#2c2e36] dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white shadow-xs transition active:scale-95 cursor-pointer font-sans"
              >
                {timerState === 'running' ? (
                  <>
                    {/* Icon on right */}
                    <span className="font-bold text-xs tracking-wider leading-none">||</span>
                    <span>توقف</span>
                  </>
                ) : (
                  <>
                    {/* Icon on right */}
                    <RiPlayLine className="w-4 h-4 stroke-[2.4]" />
                    <span>ادامه</span>
                  </>
                )}
              </button>
            )}

            {/* Left child: Reset + Music icons (tightly placed left of pill) */}
            <div className="flex items-center gap-2">
              {/* Reset Button (only active when non-idle) */}
              <button
                type="button"
                onClick={handleStopReset}
                disabled={timerState === 'idle'}
                className={`p-1.5 transition-colors bg-transparent border-0 active:scale-95 ${
                  timerState === 'idle'
                    ? 'opacity-0 pointer-events-none w-0 p-0 overflow-hidden'
                    : 'text-muted-foreground hover:text-foreground cursor-pointer'
                }`}
                title="ریست یا اتمام"
              >
                <RiRestartLine className="w-5 h-5" />
              </button>

              {/* Music Dropdown Button & Minimal Popover */}
              <div className="relative" ref={soundDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSoundDropdownOpen((prev) => !prev)}
                  className={`relative p-1.5 transition-colors cursor-pointer bg-transparent border-0 active:scale-95 rounded-lg ${
                    soundDropdownOpen || (isSoundPlaying && activeSoundId !== 'none')
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="صدای محیطی"
                >
                  <RiMusic2Line className="w-5 h-5" />
                  {isSoundPlaying && activeSoundId !== 'none' && (
                    <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </button>

                {/* Minimal, Small & Beautiful Dropdown */}
                {soundDropdownOpen && (
                  <div
                    className="absolute top-full mt-2 left-0 w-56 rounded-xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 select-none font-sans"
                    dir="rtl"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-medium text-muted-foreground/80 border-b border-border/40">
                      <span>صدای تمرکز</span>
                      {isSoundPlaying && activeSoundId !== 'none' && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                          در حال پخش
                        </span>
                      )}
                    </div>

                    {/* Sound list */}
                    <div className="flex flex-col gap-0.5">
                      {AMBIENT_SOUNDS.map((item) => {
                        const isSelected = activeSoundId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              selectSound(item.id);
                              if (item.id === 'none') {
                                setSoundDropdownOpen(false);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-right ${
                              isSelected
                                ? 'bg-foreground/5 text-foreground font-semibold'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.imageSrc ? (
                                <img
                                  src={item.imageSrc}
                                  alt={item.label}
                                  className="w-5 h-5 rounded-md object-cover border border-border/40 shrink-0"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                                  <RiVolumeMuteLine className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <span className="text-[12px]">{item.label}</span>
                            </div>

                            {isSelected && (
                              <RiCheckLine className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Volume Slider */}
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 px-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSoundPlay}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={isSoundPlaying ? 'توقف صدا' : 'پخش صدا'}
                      >
                        {isSoundPlaying ? (
                          <RiVolumeUpLine className="w-3.5 h-3.5" />
                        ) : (
                          <RiVolumeMuteLine className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={soundVolume}
                        onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                        className="w-full accent-neutral-800 dark:accent-neutral-200 h-1 bg-muted rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground w-6 text-center tabular-nums">
                        {toPersianDigits(Math.round(soundVolume * 100))}٪
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. TASK SELECTION DROPDOWN: FULL CONTAINER WIDTH (w-full)
           ========================================================================= */}
        <div className="relative w-full mt-6">
          <button
            type="button"
            onClick={() => setTaskPickerOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-border/80 bg-card/60 dark:bg-white/5 hover:bg-card hover:border-border transition cursor-pointer shadow-2xs text-xs font-sans"
          >
            <RiArrowDownSLine className="w-4 h-4 text-muted-foreground transition-transform duration-150" />
            <span className="font-semibold text-foreground truncate">
              {selectedTask ? selectedTask.title : 'تمرکز آزاد'}
            </span>
          </button>

          {/* Task Dropdown Popover */}
          {taskPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setTaskPickerOpen(false)}
              />
              <div
                className="absolute bottom-full mb-2 left-0 right-0 z-40 rounded-2xl bg-popover text-popover-foreground border border-border shadow-xl p-2 max-h-56 overflow-y-auto font-sans"
                dir="rtl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setTaskPickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors text-right mb-1 ${
                    selectedTaskId === null
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-muted text-foreground/85'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <RiSparklingFill className="w-3.5 h-3.5 text-primary" />
                    <span>تمرکز آزاد</span>
                  </span>
                  {selectedTaskId === null && <RiCheckLine className="w-4 h-4 text-primary" />}
                </button>

                <div className="h-[1px] bg-border/60 my-1" />

                {tasks.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    تسک فعالی یافت نشد
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setTaskPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors text-right ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground/85'
                        }`}
                      >
                        <span className="truncate flex-1 pl-2">{task.title}</span>
                        {isSelected && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};
