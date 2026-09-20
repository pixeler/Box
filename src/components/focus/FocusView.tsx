import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RiPlayFill,
  RiPauseFill,
  RiMusic2Line,
  RiArrowDownSLine,
  RiCheckLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiFlagFill,
  RiSparklingFill,
  RiRestartLine,
} from '@remixicon/react';
import { taskRepo } from '@/repositories';
import type { Task } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';
import { playTaskDoneSound } from '@/lib/sound';
import { useAmbientAudio, AMBIENT_SOUND_OPTIONS } from './useAmbientAudio';

export const FocusView: React.FC = () => {
  // Timer State (minutes 1 to 60) - Default 30 minutes
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');

  // Interactive Dragging on Circle State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dialRef = useRef<SVGSVGElement | null>(null);

  // Task selection state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState<boolean>(false);

  // Audio state
  const { currentSound, isPlaying, volume, setVolume, startSound } = useAmbientAudio();
  const [audioPickerOpen, setAudioPickerOpen] = useState<boolean>(false);

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

  // Countdown timer loop
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerState === 'running') {
      timerIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            setTimerState('completed');
            playTaskDoneSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerState]);

  // =========================================================================
  // INTERACTIVE CIRCULAR DIAL DRAG LOGIC
  // =========================================================================
  const updateMinutesFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle in radians (-PI to PI), where 0 is 3 o'clock
    const rad = Math.atan2(dy, dx);

    // Convert so that 12 o'clock is 0 radians and clockwise is positive
    let angleFromTop = rad + Math.PI / 2;
    if (angleFromTop < 0) {
      angleFromTop += 2 * Math.PI;
    }

    // Fraction of circle (0 to 1)
    const fraction = angleFromTop / (2 * Math.PI);

    // Calculate minutes: 1 to 60
    let mins = Math.round(fraction * 60);
    if (mins <= 0) mins = fraction > 0.5 ? 60 : 1;
    if (mins > 60) mins = 60;

    setDurationMinutes(mins);
    setRemainingSeconds(mins * 60);
  }, []);

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

  // Timer Controls
  const handleStart = () => {
    setRemainingSeconds(durationMinutes * 60);
    setTimerState('running');
  };

  const handlePauseResume = () => {
    if (timerState === 'running') {
      setTimerState('paused');
    } else if (timerState === 'paused') {
      setTimerState('running');
    }
  };

  const handleAddOneMinute = () => {
    setRemainingSeconds((prev) => prev + 60);
    setDurationMinutes((prev) => prev + 1);
  };

  const handleStopReset = () => {
    setTimerState('idle');
    setRemainingSeconds(durationMinutes * 60);
  };

  // Mark task as done
  const handleCompleteTask = async () => {
    if (!selectedTaskId) return;
    try {
      playTaskDoneSound();
      await taskRepo.toggleDone(selectedTaskId);
      setSelectedTaskId(null);
      await loadTasks();
    } catch (err) {
      console.error('Failed to complete task from focus view:', err);
    }
  };

  // Format MM:SS with Persian digits
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return `${toPersianDigits(mm)}:${toPersianDigits(ss)}`;
  };

  // Format dynamic projected time span (e.g. ۹:۵۳ ب.ظ ← ۱۰:۲۳ ب.ظ)
  const timeSpanText = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + remainingSeconds * 1000);

    const formatHourMinute = (d: Date) => {
      let hours = d.getHours();
      const mins = d.getMinutes();
      const ampm = hours >= 12 ? 'ب.ظ' : 'ق.ظ';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
      return `${toPersianDigits(hours)}:${toPersianDigits(minsStr)} ${ampm}`;
    };

    return `${formatHourMinute(now)} ← ${formatHourMinute(end)}`;
  }, [remainingSeconds]);

  // SVG Dial Dimensions: slightly enlarged for spacious inner room
  const dialRadius = 102;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * dialRadius;

  // Active stroke fraction on the 60-minute circle
  const activeFraction =
    timerState === 'idle'
      ? durationMinutes / 60
      : Math.max(0, remainingSeconds / 3600);

  const strokeDashoffset = circumference * (1 - activeFraction);

  // Calculate ticks (خطوط) inside active stroke:
  // Visible in BOTH idle and running mode, smoothly fading out towards the tail
  const strokeTicks = useMemo(() => {
    const totalDegrees = activeFraction * 360;
    if (totalDegrees < 10) return [];

    const span = Math.min(105, Math.max(14, totalDegrees - 8));
    const endDeg = totalDegrees - 5.5;
    const startDeg = endDeg - span;

    const ticksArr: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    const step = 2.4;
    const count = Math.floor((endDeg - startDeg) / step);

    for (let i = 0; i < count; i++) {
      const deg = startDeg + i * step;
      const rad = (deg - 90) * (Math.PI / 180);

      const rIn = dialRadius - 6.5;
      const rOut = dialRadius + 6.5;

      const progress = i / Math.max(1, count - 1);
      const opacity = Math.pow(progress, 1.25) * 0.72;

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

  // Calculate position & tangent rotation for the arrow:
  // In idle: points clockwise (drag direction to increase)
  // When running/paused: points inward (counter-clockwise towards decreasing 0)
  const arrowConfig = useMemo(() => {
    const totalDegrees = activeFraction * 360;
    if (totalDegrees < 8) return null;

    const arrowDeg = totalDegrees - 4.2;
    const rad = (arrowDeg - 90) * (Math.PI / 180);
    const x = 140 + dialRadius * Math.cos(rad);
    const y = 140 + dialRadius * Math.sin(rad);

    // Tangent angle: clockwise in idle; points inward into the stroke when playing/running
    const baseRotation = arrowDeg - 90;
    const rotation = timerState === 'idle' ? baseRotation : baseRotation + 180;

    return { x, y, rotation };
  }, [activeFraction, timerState, dialRadius]);

  return (
    <div
      dir="rtl"
      className="w-full flex flex-col items-center px-4 pt-1 pb-16 select-none font-sans"
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* =========================================================================
            1. TOP BAR: Tune in (صداها) + Preset Pill
           ========================================================================= */}
        <div className="w-full flex items-center justify-between relative mb-2">
          {/* Sound picker pill (Right child in RTL) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAudioPickerOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all shadow-2xs border ${
                isPlaying && currentSound !== 'none'
                  ? 'bg-primary/15 text-primary border-primary/30 ring-2 ring-primary/20'
                  : 'bg-card dark:bg-white/5 text-foreground/85 border-border/70 hover:bg-muted'
              }`}
            >
              <RiMusic2Line className="w-3.5 h-3.5" />
              <span>
                {isPlaying && currentSound !== 'none'
                  ? AMBIENT_SOUND_OPTIONS.find((s) => s.id === currentSound)?.label
                  : 'پخش صدا'}
              </span>
              {isPlaying && currentSound !== 'none' && (
                <span className="flex items-center gap-0.5 mr-1">
                  <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" />
                  <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse delay-75" />
                  <span className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse delay-150" />
                </span>
              )}
              <RiArrowDownSLine className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* Audio Dropdown Popover */}
            {audioPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setAudioPickerOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-popover/95 backdrop-blur-xl text-popover-foreground border border-border/80 rounded-2xl shadow-xl z-40 p-2 text-xs animate-in fade-in zoom-in-95 duration-150 font-sans">
                  <div className="px-3 py-1.5 font-semibold text-muted-foreground text-[11px] border-b border-border/50 mb-1 flex items-center justify-between">
                    <span>صداهای طبیعت و وایت‌نویز</span>
                    <span className="text-[10px] text-primary">آفلاین</span>
                  </div>

                  <div className="space-y-0.5">
                    {AMBIENT_SOUND_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          startSound(opt.id);
                          if (opt.id === 'none') {
                            setAudioPickerOpen(false);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                          currentSound === opt.id
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <div>
                            <p className="text-xs">{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground font-normal">{opt.description}</p>
                          </div>
                        </div>
                        {currentSound === opt.id && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {/* Volume Slider */}
                  {currentSound !== 'none' && (
                    <div className="pt-2.5 mt-1.5 border-t border-border/50 px-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {volume === 0 ? (
                          <RiVolumeMuteLine className="w-3.5 h-3.5" />
                        ) : (
                          <RiVolumeUpLine className="w-3.5 h-3.5 text-primary" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1 bg-muted rounded cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Preset quick button (Left child in RTL) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card dark:bg-white/5 text-foreground/80 border border-border/70 shadow-2xs">
            <span>{toPersianDigits(durationMinutes)} دقیقه</span>
          </div>
        </div>

        {/* =========================================================================
            2. TITLE & SUBTITLE
           ========================================================================= */}
        <div className="flex flex-col items-center text-center mb-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
            تمرکز
          </h1>
          <div className="flex items-center gap-2 mt-0.5 font-sans">
            <span className="text-xs text-muted-foreground/45 font-medium tracking-wide">
              {timeSpanText}
            </span>
          </div>
        </div>

        {/* =========================================================================
            3. CIRCULAR DIAL
            - Active stroke with EXACT Add-Button gradient & depth specification
            - Neutral background track coordinated with the active theme
           ========================================================================= */}
        <div className="relative w-76 h-76 sm:w-80 sm:h-80 flex items-center justify-center my-0 select-none">
          {/* Interactive SVG Circle Dial (viewBox 280x280) */}
          <svg
            ref={dialRef}
            viewBox="0 0 280 280"
            className={`w-full h-full transform ${
              timerState === 'idle' ? 'cursor-grab active:cursor-grabbing touch-none' : ''
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              {/* Very subtle stroke shadow */}
              <filter id="subtleStrokeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="rgba(0, 0, 0, 0.18)" />
              </filter>
            </defs>

            {/* 1. Background Track Ring: Neutral, coordinating with theme */}
            <circle
              cx="140"
              cy="140"
              r={dialRadius}
              fill="none"
              stroke="var(--focus-track-neutral, rgba(140, 145, 160, 0.18))"
              strokeWidth={strokeWidth}
            />

            {/* 2. Solid Dark Active Stroke with subtle shadow */}
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
              filter="url(#subtleStrokeShadow)"
              className="transition-all duration-150 ease-out -rotate-90 origin-center"
            />

            {/* 3. Ticks (خطوط) inside active stroke: active during idle AND running mode */}
            {strokeTicks.map((t, idx) => (
              <line
                key={idx}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ opacity: t.opacity }}
              />
            ))}

            {/* 4. Arrow at tip: points clockwise in idle, points inward into stroke when playing */}
            {arrowConfig && (
              <g
                transform={`translate(${arrowConfig.x}, ${arrowConfig.y}) rotate(${arrowConfig.rotation})`}
                className="text-white drop-shadow-xs"
              >
                <line
                  x1="0"
                  y1="-4"
                  x2="0"
                  y2="2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M -3 0 L 0 3 L 3 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {/* 5. Compass minute numbers: shown in idle mode, brought close to ring (radius 78) */}
            {timerState === 'idle' && (
              <g className="select-none pointer-events-none fill-muted-foreground/75 font-sans font-medium text-[13px]">
                {/* 60 (top, close to ring) */}
                <text x="140" y="62" textAnchor="middle" dominantBaseline="central">
                  {toPersianDigits(60)}
                </text>
                {/* 15 (right, close to ring) */}
                <text x="218" y="140" textAnchor="middle" dominantBaseline="central">
                  {toPersianDigits(15)}
                </text>
                {/* 30 (bottom, close to ring) */}
                <text x="140" y="218" textAnchor="middle" dominantBaseline="central">
                  {toPersianDigits(30)}
                </text>
                {/* 45 (left, close to ring) */}
                <text x="62" y="140" textAnchor="middle" dominantBaseline="central">
                  {toPersianDigits(45)}
                </text>
              </g>
            )}
          </svg>

          {/* Center Content inside Dial */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {timerState === 'idle' ? (
              /* Setup Mode: Large Persian digits with default Estedad font */
              <div className="flex flex-col items-center justify-center -mt-0.5">
                <span className="text-6xl sm:text-7xl font-bold text-foreground font-sans tracking-normal leading-none">
                  {toPersianDigits(durationMinutes)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground mt-2 font-sans">
                  دقیقه
                </span>
              </div>
            ) : (
              /* Active Focus Mode: Clean, spacious Persian timer countdown in center */
              <div className="flex flex-col items-center justify-center -mt-0.5">
                <span className="text-4xl sm:text-5xl font-bold text-foreground font-sans tracking-tight leading-none">
                  {formatTime(remainingSeconds)}
                </span>
                <span className="text-xs font-medium text-muted-foreground/75 mt-2 font-sans">
                  {timerState === 'paused'
                    ? 'متوقف شده'
                    : timerState === 'completed'
                    ? 'تمرکز تکمیل شد 🎉'
                    : 'زمان تمرکز'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            4. ACTION CONTROLS
            - Outline Start/Stop/Resume buttons with icon on the right
            - Centered and perfectly aligned under circle
            - Flat borderless +1 min and Reset actions
           ========================================================================= */}
        <div className="w-full flex items-center justify-center mt-3">
          {timerState === 'idle' ? (
            /* Setup Mode: Outline Start Button with Play icon on the right */
            <button
              type="button"
              onClick={handleStart}
              className="h-12 px-10 rounded-full flex items-center justify-center gap-2.5 text-sm font-semibold border-2 border-foreground/30 hover:border-foreground/60 text-foreground bg-transparent hover:bg-foreground/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/5 transition-all active:scale-95 cursor-pointer font-sans shadow-2xs"
            >
              <RiPlayFill className="w-4 h-4 fill-current" />
              <span>شروع</span>
            </button>
          ) : (
            /* Active Mode: Reset + Main Outline Action Pill (توقف/ادامه) + +1 min perfectly centered */
            <div className="flex items-center justify-center gap-4">
              {/* Reset Button (Flat borderless) */}
              <button
                type="button"
                onClick={handleStopReset}
                className="p-2 text-muted-foreground hover:text-foreground active:scale-95 transition-colors cursor-pointer bg-transparent border-0"
                title="ریست یا اتمام"
              >
                <RiRestartLine className="w-5 h-5" />
              </button>

              {/* Main Action Pill: Outline button with icon on the right */}
              <button
                type="button"
                onClick={handlePauseResume}
                className="h-12 px-9 rounded-full flex items-center justify-center gap-2.5 text-sm font-semibold border-2 border-foreground/30 hover:border-foreground/60 text-foreground bg-transparent hover:bg-foreground/5 dark:border-white/25 dark:hover:border-white/50 dark:hover:bg-white/5 transition-all active:scale-95 cursor-pointer font-sans shadow-2xs"
              >
                {timerState === 'running' ? (
                  <>
                    <RiPauseFill className="w-4 h-4 fill-current" />
                    <span>توقف</span>
                  </>
                ) : (
                  <>
                    <RiPlayFill className="w-4 h-4 fill-current" />
                    <span>ادامه</span>
                  </>
                )}
              </button>

              {/* +1 min Text (Flat borderless) */}
              <button
                type="button"
                onClick={handleAddOneMinute}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-colors cursor-pointer bg-transparent border-0 py-2 px-1 select-none font-sans"
              >
                +۱ دقیقه
              </button>
            </div>
          )}
        </div>

        {/* =========================================================================
            5. TASK SELECTION DROPDOWN
           ========================================================================= */}
        <div className="relative w-full max-w-[280px] mt-4">
          <button
            type="button"
            onClick={() => setTaskPickerOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-border/70 bg-card/80 dark:bg-white/5 hover:bg-card hover:border-border transition-all cursor-pointer shadow-2xs text-right text-xs font-sans"
          >
            <div className="flex items-center gap-2 truncate">
              {selectedTask ? (
                <>
                  <RiFlagFill
                    className={`w-3.5 h-3.5 shrink-0 ${
                      selectedTask.priority === 3
                        ? 'text-rose-500'
                        : selectedTask.priority === 2
                        ? 'text-amber-500'
                        : selectedTask.priority === 1
                        ? 'text-blue-500'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <span className="font-medium text-foreground truncate">{selectedTask.title}</span>
                </>
              ) : (
                <>
                  <RiSparklingFill className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                  <span className="text-muted-foreground font-normal">تمرکز آزاد (بدون تسک)</span>
                </>
              )}
            </div>
            <RiArrowDownSLine className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {/* Task Picker Dropdown Popover */}
          {taskPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setTaskPickerOpen(false)}
              />
              <div className="absolute top-full right-0 left-0 mt-1.5 max-h-56 overflow-y-auto bg-popover/95 backdrop-blur-xl text-popover-foreground border border-border rounded-2xl shadow-xl z-40 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-150 font-sans">
                {/* Default: Free Focus (No Task) */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setTaskPickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                    selectedTaskId === null
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RiSparklingFill className="w-3.5 h-3.5 text-primary" />
                    <span>تمرکز آزاد (بدون تسک)</span>
                  </div>
                  {selectedTaskId === null && <RiCheckLine className="w-4 h-4 text-primary shrink-0" />}
                </button>

                {/* Tasks List */}
                {tasks.length > 0 && (
                  <div className="border-t border-border/50 my-1 pt-1">
                    <div className="px-3 py-1 text-[10.5px] font-semibold text-muted-foreground">
                      کارهای باز شما
                    </div>
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setTaskPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                          selectedTaskId === task.id
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <RiFlagFill
                            className={`w-3.5 h-3.5 shrink-0 ${
                              task.priority === 3
                                ? 'text-rose-500'
                                : task.priority === 2
                                ? 'text-amber-500'
                                : task.priority === 1
                                ? 'text-blue-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                          <span className="truncate">{task.title}</span>
                        </div>
                        {selectedTaskId === task.id && (
                          <RiCheckLine className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick Completion Button when a task is selected and timer is running */}
          {selectedTask && timerState !== 'idle' && (
            <div className="mt-2 flex items-center justify-between px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs font-sans">
              <span className="truncate text-primary font-medium">{selectedTask.title}</span>
              <button
                type="button"
                onClick={handleCompleteTask}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer shrink-0 mr-2"
              >
                <RiCheckLine className="w-3.5 h-3.5" />
                <span>انجام شد</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
