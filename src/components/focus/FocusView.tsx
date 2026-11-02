import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiMusic2Line,
  RiPauseLine,
  RiPlayLine,
  RiRestartLine,
  RiSparklingFill,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from '@remixicon/react';
import { taskRepo } from '@/repositories';
import type { Task } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { useFocusTimer } from './FocusTimerContext';
import { AMBIENT_SOUNDS } from './ambientSounds';
import { FocusHistory } from './FocusHistory';
import { formatCountdown, formatFocusDuration } from './format';

const PRESET_MINUTES = [15, 25, 45, 60];

const formatClock = (date: Date): string =>
  `${toPersianDigits(date.getHours())}:${toPersianDigits(String(date.getMinutes()).padStart(2, '0'))}`;

/**
 * Focus / time tracking.
 *
 * Left: one pomodoro timer that can be pointed at any open task.
 * Right: the week's focus minutes and the individual sessions, so the section
 * works as a time tracker as well as a timer.
 */
export const FocusView: React.FC = () => {
  const {
    durationMinutes,
    remainingSeconds,
    timerState,
    selectedTaskId,
    selectedTaskTitle,
    todayFocusSessions,
    recentSessions,
    elapsedMinutes,
    activeSoundId,
    soundVolume,
    isSoundPlaying,
    selectSound,
    setSoundVolume,
    toggleSoundPlay,
    setDurationMinutes,
    setRemainingSeconds,
    selectTask,
    handleStart,
    handlePauseResume,
    handleAddOneMinute,
    handleStopReset,
  } = useFocusTimer();

  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef<SVGSVGElement | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [openMenu, setOpenMenu] = useState<'task' | 'sound' | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  const isActive = timerState === 'running' || timerState === 'paused';

  useEffect(() => {
    taskRepo
      .list()
      .then((all) => setTasks(all.filter((task) => task.status === 'open')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenu]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );
  const taskLabel = selectedTask?.title ?? (selectedTaskId ? selectedTaskTitle || 'کار انتخاب‌شده' : 'تمرکز آزاد');

  const todayMinutes = useMemo(
    () => todayFocusSessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0),
    [todayFocusSessions]
  );

  const endLabel = useMemo(
    () => formatClock(new Date(Date.now() + remainingSeconds * 1000)),
    [remainingSeconds]
  );

  // Interactive dial drag (idle only): map the pointer angle to minutes.
  const updateMinutesFromPointer = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);

    let angleFromTop = Math.atan2(dy, dx) + Math.PI / 2;
    if (angleFromTop < 0) angleFromTop += 2 * Math.PI;

    let minutes = Math.round((angleFromTop / (2 * Math.PI)) * 60);
    if (minutes <= 0) minutes = angleFromTop > Math.PI ? 60 : 1;
    if (minutes > 60) minutes = 60;

    setDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (timerState !== 'idle') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    updateMinutesFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || timerState !== 'idle') return;
    updateMinutesFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  // Dial geometry
  const dialRadius = 104;
  const strokeWidth = 14.5;
  const circumference = 2 * Math.PI * dialRadius;
  const fraction =
    timerState === 'idle'
      ? Math.min(1, Math.max(0, durationMinutes / 60))
      : Math.min(1, Math.max(0, remainingSeconds / 3600));
  const strokeDashoffset = circumference * (1 - fraction);

  const strokeTicks = useMemo(() => {
    const totalDegrees = fraction * 360;
    if (totalDegrees < 8) return [];

    const span = Math.min(100, Math.max(14, totalDegrees - 8));
    const endDeg = totalDegrees - 4.5;
    const startDeg = endDeg - span;
    const step = 2.4;
    const count = Math.floor((endDeg - startDeg) / step);

    const ticks: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    for (let index = 0; index < count; index += 1) {
      const radians = ((startDeg + index * step - 90) * Math.PI) / 180;
      const progress = index / Math.max(1, count - 1);
      ticks.push({
        x1: 140 + (dialRadius - 4.6) * Math.cos(radians),
        y1: 140 + (dialRadius - 4.6) * Math.sin(radians),
        x2: 140 + (dialRadius + 4.6) * Math.cos(radians),
        y2: 140 + (dialRadius + 4.6) * Math.sin(radians),
        opacity: Math.pow(progress, 1.2) * 0.78,
      });
    }
    return ticks;
  }, [fraction]);

  const arrow = useMemo(() => {
    const totalDegrees = fraction * 360;
    if (totalDegrees < 6) return null;
    const degrees = totalDegrees - 3.4;
    const radians = ((degrees - 90) * Math.PI) / 180;
    return {
      x: 140 + dialRadius * Math.cos(radians),
      y: 140 + dialRadius * Math.sin(radians),
      rotation: degrees - 90 + (timerState === 'idle' ? 0 : 180),
    };
  }, [fraction, timerState]);

  const activeStroke =
    timerState === 'running'
      ? 'hsl(var(--primary))'
      : timerState === 'paused'
      ? '#f59e0b'
      : timerState === 'completed'
      ? '#10b981'
      : 'var(--focus-dark-theme, #474c5d)';

  const statusLabel =
    timerState === 'running'
      ? 'در حال تمرکز'
      : timerState === 'paused'
      ? 'متوقف شده'
      : timerState === 'completed'
      ? 'تمام شد'
      : null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[1000px] px-4 pb-28 pt-3 font-sans sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">تمرکز</h1>
          <span
            className={cn(
              'size-1.5 rounded-full transition-colors duration-300',
              timerState === 'running'
                ? 'animate-pulse bg-rose-500'
                : timerState === 'paused'
                ? 'bg-amber-500'
                : timerState === 'completed'
                ? 'bg-emerald-500'
                : 'bg-foreground/20'
            )}
          />
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          امروز <span className="font-semibold text-foreground">{formatFocusDuration(todayMinutes)}</span>
        </p>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:items-start">
        {/* ── Timer ─────────────────────────────────────────────── */}
        <section
          ref={menuRef}
          className="rounded-[26px] border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-muted-foreground">
                {isActive ? `تا ${endLabel}` : 'تایمر تمرکز'}
              </p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-foreground">
                {timerState === 'completed' ? 'جلسه کامل شد 🎉' : formatFocusDuration(durationMinutes)}
              </p>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'sound' ? null : 'sound')}
                aria-label="صدای محیطی"
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-full transition-colors',
                  openMenu === 'sound' || (isSoundPlaying && activeSoundId !== 'none')
                    ? 'bg-foreground/[0.07] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground'
                )}
              >
                <RiMusic2Line className="size-[18px]" />
                {isSoundPlaying && activeSoundId !== 'none' && (
                  <span className="absolute bottom-1 end-1 size-1.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
              </button>

              {openMenu === 'sound' && (
                <div className="absolute end-0 top-full z-[126] mt-2 w-56 rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-xl">
                  <div className="mb-1 flex items-center justify-between border-b border-border/50 px-2 pb-1.5 text-[11px] text-muted-foreground">
                    <span>صدای تمرکز</span>
                    {isSoundPlaying && activeSoundId !== 'none' && (
                      <span className="text-emerald-600 dark:text-emerald-400">در حال پخش</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    {AMBIENT_SOUNDS.map((sound) => {
                      const isSelected = activeSoundId === sound.id;
                      return (
                        <button
                          key={sound.id}
                          type="button"
                          onClick={() => {
                            selectSound(sound.id);
                            if (sound.id === 'none') setOpenMenu(null);
                          }}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors',
                            isSelected
                              ? 'bg-foreground/[0.06] font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {sound.imageSrc ? (
                              <img
                                src={sound.imageSrc}
                                alt=""
                                className="size-5 shrink-0 rounded-md border border-border/40 object-cover"
                              />
                            ) : (
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06]">
                                <RiVolumeMuteLine className="size-3.5" />
                              </span>
                            )}
                            {sound.label}
                          </span>
                          {isSelected && <RiCheckLine className="size-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 border-t border-border/50 px-2 pt-1.5">
                    <button
                      type="button"
                      onClick={toggleSoundPlay}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title={isSoundPlaying ? 'توقف صدا' : 'پخش صدا'}
                    >
                      {isSoundPlaying ? (
                        <RiVolumeUpLine className="size-3.5" />
                      ) : (
                        <RiVolumeMuteLine className="size-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundVolume}
                      onChange={(event) => setSoundVolume(parseFloat(event.target.value))}
                      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-foreground/10 accent-foreground"
                      aria-label="بلندی صدا"
                    />
                    <span className="w-7 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
                      {toPersianDigits(Math.round(soundVolume * 100))}٪
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Task the session is tracked against */}
          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'task' ? null : 'task')}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-foreground/[0.04] px-3 py-2 text-right transition-colors hover:bg-foreground/[0.06]"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-foreground">
                {selectedTaskId ? (
                  <RiCheckLine className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <RiSparklingFill className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{taskLabel}</span>
              </span>
              <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {openMenu === 'task' && (
              <div className="absolute inset-x-0 top-full z-[126] mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    selectTask(null);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-right text-[12px] transition-colors',
                    !selectedTaskId
                      ? 'bg-foreground/[0.06] font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <RiSparklingFill className="size-3.5" />
                    تمرکز آزاد
                  </span>
                  {!selectedTaskId && <RiCheckLine className="size-3.5" />}
                </button>

                <div className="my-1 h-px bg-border/60" />

                {tasks.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">
                    کار بازی وجود ندارد
                  </p>
                ) : (
                  tasks.map((task) => {
                    const isSelected = task.id === selectedTaskId;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          selectTask({ id: task.id, title: task.title });
                          setOpenMenu(null);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right text-[12px] transition-colors',
                          isSelected
                            ? 'bg-foreground/[0.06] font-medium text-foreground'
                            : 'text-foreground/85 hover:bg-foreground/[0.04]'
                        )}
                      >
                        <span className="truncate">{task.title}</span>
                        {isSelected && <RiCheckLine className="size-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Dial */}
          <div className="relative mt-2 flex items-center justify-center">
            <svg
              ref={dialRef}
              viewBox="0 0 280 280"
              className={cn(
                'size-[248px] touch-none',
                timerState === 'idle' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              )}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <circle
                cx="140"
                cy="140"
                r={dialRadius}
                fill="none"
                stroke="var(--focus-track-neutral, rgba(140, 145, 160, 0.18))"
                strokeWidth={strokeWidth}
              />
              <circle
                cx="140"
                cy="140"
                r={dialRadius}
                fill="none"
                stroke={activeStroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="origin-center -rotate-90 transition-[stroke-dashoffset,stroke] duration-200 ease-out"
              />

              {strokeTicks.map((tick, index) => (
                <line
                  key={index}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke="white"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  style={{ opacity: tick.opacity }}
                />
              ))}

              {arrow && (
                <g
                  transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.rotation})`}
                  className="text-white"
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

              {timerState === 'idle' && (
                <g className="pointer-events-none select-none fill-muted-foreground/60 font-sans text-[11px] font-medium">
                  <text x="140" y="22" textAnchor="middle" dominantBaseline="central">
                    {toPersianDigits(60)}
                  </text>
                  <text x="258" y="140" textAnchor="middle" dominantBaseline="central">
                    {toPersianDigits(15)}
                  </text>
                  <text x="140" y="258" textAnchor="middle" dominantBaseline="central">
                    {toPersianDigits(30)}
                  </text>
                  <text x="22" y="140" textAnchor="middle" dominantBaseline="central">
                    {toPersianDigits(45)}
                  </text>
                </g>
              )}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center">
              {timerState === 'idle' ? (
                <>
                  <span className="text-[52px] font-semibold leading-none tracking-tight text-foreground">
                    {toPersianDigits(durationMinutes)}
                  </span>
                  <span className="mt-1.5 text-[11px] text-muted-foreground">دقیقه</span>
                  <span className="mt-1 text-[10.5px] tabular-nums text-muted-foreground/70">
                    تا {endLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[42px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                    {formatCountdown(remainingSeconds)}
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 text-[11px] font-medium',
                      timerState === 'running'
                        ? 'text-rose-500 dark:text-rose-400'
                        : timerState === 'paused'
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    )}
                  >
                    {statusLabel}
                  </span>
                  <span className="mt-1 text-[10.5px] tabular-nums text-muted-foreground/70">
                    تا {endLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Duration presets (idle) */}
          {timerState === 'idle' && (
            <div className="mt-1 flex items-center justify-center gap-1.5">
              {PRESET_MINUTES.map((minutes) => {
                const isSelected = durationMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      setDurationMinutes(minutes);
                      setRemainingSeconds(minutes * 60);
                    }}
                    className={cn(
                      'h-8 flex-1 rounded-full text-[11.5px] font-medium tabular-nums transition-colors',
                      isSelected
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground'
                    )}
                  >
                    {toPersianDigits(minutes)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Controls */}
          <div className="mt-3">
            {isActive ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAddOneMinute}
                    className="flex h-11 items-center justify-center gap-1 rounded-full bg-foreground/[0.06] text-[12.5px] font-medium text-foreground transition-colors hover:bg-foreground/[0.1]"
                  >
                    +۱ دقیقه
                  </button>
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-foreground text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    {timerState === 'running' ? (
                      <>
                        <RiPauseLine className="size-4" />
                        توقف
                      </>
                    ) : (
                      <>
                        <RiPlayLine className="size-4" />
                        ادامه
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleStopReset}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RiRestartLine className="size-3.5" />
                  پایان جلسه
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                <RiPlayLine className="size-4" />
                {timerState === 'completed'
                  ? 'شروع دوباره'
                  : `شروع ${toPersianDigits(durationMinutes)} دقیقه‌ای`}
              </button>
            )}
          </div>

          {isActive && (
            <p className="mt-2 text-center text-[10.5px] text-muted-foreground/80">
              {formatFocusDuration(elapsedMinutes)} از این جلسه گذشته است
            </p>
          )}
        </section>

        {/* ── History / time tracker ───────────────────────────── */}
        <FocusHistory sessions={recentSessions} />
      </div>
    </div>
  );
};
