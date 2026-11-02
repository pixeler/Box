import React, { useEffect, useRef, useState } from 'react';
import {
  RiCloseLine,
  RiMusic2Line,
  RiPauseLine,
  RiPlayLine,
  RiVolumeMuteLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useFocusTimer } from './FocusTimerContext';
import { formatCountdown } from './format';
import { onFocusTaskRequest } from './focusBus';

/**
 * A glassy, always-visible timer for when the user is anywhere but the focus
 * section. It mirrors the focus view's state, sits above every overlay, and
 * opens the focus view on click.
 */
export const FocusMiniBar: React.FC<{ hidden?: boolean; onOpen: () => void }> = ({
  hidden = false,
  onOpen,
}) => {
  const {
    timerState,
    remainingSeconds,
    durationMinutes,
    selectedTaskTitle,
    isSoundPlaying,
    activeSoundId,
    toggleSoundPlay,
    handlePauseResume,
    handleAddOneMinute,
  } = useFocusTimer();
  // Dismissing the pill hides it; the session itself keeps running.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (timerState !== 'running' && timerState !== 'paused') setDismissed(false);
  }, [timerState]);

  if (hidden || dismissed) return null;
  if (timerState !== 'running' && timerState !== 'paused') return null;

  const total = Math.max(1, durationMinutes * 60);
  const progress = Math.min(1, Math.max(0, remainingSeconds / total));
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const soundOn = isSoundPlaying && activeSoundId !== 'none';
  const running = timerState === 'running';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[400] flex justify-center px-4 md:bottom-6">
      <div
        dir="rtl"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/30 p-1 ps-2.5 shadow-[0_16px_44px_-14px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.05] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-900/25 dark:ring-white/[0.07]"
      >
        {/* Close sits at the far right (start of the RTL row); it only hides the pill. */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="بستن توست (تمرکز ادامه دارد)"
          aria-label="بستن توست (تمرکز ادامه دارد)"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
        >
          <RiCloseLine className="size-4" />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 items-center gap-2 py-1"
          title="رفتن به بخش تمرکز"
        >
          <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">
            {selectedTaskTitle || 'تمرکز آزاد'}
          </span>
          <span className="shrink-0 text-[15px] font-semibold leading-none tabular-nums text-foreground">
            {formatCountdown(remainingSeconds)}
          </span>
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-foreground/10" />

        <button
          type="button"
          onClick={handleAddOneMinute}
          title="یک دقیقه بیشتر"
          aria-label="یک دقیقه بیشتر"
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-[10px] font-semibold leading-none tabular-nums text-foreground transition-colors hover:bg-white/35 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
        >
          +۱
        </button>

        <button
          type="button"
          onClick={toggleSoundPlay}
          title={soundOn ? 'قطع صدای تمرکز' : 'پخش صدای تمرکز'}
          aria-label={soundOn ? 'قطع صدای تمرکز' : 'پخش صدای تمرکز'}
          className={cn(
            'relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.08]',
            soundOn ? 'text-success' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {soundOn ? (
            <RiMusic2Line className="size-4" />
          ) : (
            <RiVolumeMuteLine className="size-4" />
          )}
          {soundOn && (
            <span className="absolute -top-0.5 -end-0.5 size-1.5 rounded-full bg-success" />
          )}
        </button>

        <div className="relative flex size-10 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 size-10 -rotate-90">
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              strokeWidth="2"
              className="stroke-foreground/10"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className={cn(
                'transition-[stroke-dashoffset] duration-500 ease-linear',
                running ? 'stroke-success' : 'stroke-warning'
              )}
            />
          </svg>
          <button
            type="button"
            onClick={handlePauseResume}
            title={running ? 'توقف تمرکز' : 'ادامه تمرکز'}
            aria-label={running ? 'توقف تمرکز' : 'ادامه تمرکز'}
            className="relative z-10 flex size-8 items-center justify-center rounded-full border border-white/40 bg-white/25 text-foreground shadow-sm backdrop-blur-xl transition-colors hover:bg-white/40 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20"
          >
            {running ? (
              <RiPauseLine className="size-3.5" />
            ) : (
              <RiPlayLine className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Listens for "start focusing on this task" requests from task cards, starts the
 * session and takes the user to the focus view.
 */
export const FocusTaskListener: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const { startFocusTask } = useFocusTimer();
  const startRef = useRef(startFocusTask);
  const navigateRef = useRef(onNavigate);
  startRef.current = startFocusTask;
  navigateRef.current = onNavigate;

  useEffect(
    () =>
      onFocusTaskRequest((task) => {
        void startRef.current(task);
        navigateRef.current();
      }),
    []
  );

  return null;
};
