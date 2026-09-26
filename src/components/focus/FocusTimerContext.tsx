import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { focusSessionRepo } from '@/repositories';
import type { FocusSession } from '@/types/models';
import { getTodayJalaliKey, toPersianDigits } from '@/lib/jalali';
import { playTaskDoneSound } from '@/lib/sound';
import { AMBIENT_SOUNDS, type AmbientSoundId } from './ambientSounds';
import { NotificationService } from '@/lib/notifications';
import { triggerHaptic } from '@/lib/capacitor';
import { syncWidgetData } from '@/lib/widget';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';

interface FocusTimerContextValue {
  durationMinutes: number;
  remainingSeconds: number;
  timerState: TimerState;
  selectedTaskId: string | null;
  activeSessionStartMinute: number | null;
  todayFocusSessions: FocusSession[];
  elapsedMinutes: number;
  remainingMinutes: number;
  // Ambient Sound
  activeSoundId: AmbientSoundId;
  soundVolume: number;
  isSoundPlaying: boolean;
  selectSound: (id: AmbientSoundId) => void;
  setSoundVolume: (volume: number) => void;
  toggleSoundPlay: () => void;
  // Timer Actions
  setDurationMinutes: (mins: number) => void;
  setRemainingSeconds: (secs: number) => void;
  setSelectedTaskId: (id: string | null) => void;
  handleStart: () => void;
  handlePauseResume: () => void;
  handleAddOneMinute: () => void;
  handleStopReset: () => void;
  loadTodayFocusSessions: () => Promise<void>;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

const STORAGE_KEY = 'second_brain_focus_timer';

export const FocusTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayDateKey = useMemo(() => getTodayJalaliKey(), []);

  // Initialize state from localStorage if available
  const [durationMinutes, setDurationMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.durationMinutes) return parsed.durationMinutes;
      }
    } catch {}
    return 30;
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeSessionStartMinute, setActiveSessionStartMinute] = useState<number | null>(null);
  const activeSessionStartTimeRef = useRef<Date | null>(null);
  const targetEndTimeRef = useRef<number | null>(null);

  const [todayFocusSessions, setTodayFocusSessions] = useState<FocusSession[]>([]);

  // Persistent Ambient Audio (stays alive across app tabs & window changes)
  const [activeSoundId, setActiveSoundId] = useState<AmbientSoundId>('none');
  const [soundVolume, setSoundVolumeState] = useState<number>(0.5);
  const [isSoundPlaying, setIsSoundPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const selectSound = useCallback((id: AmbientSoundId) => {
    setActiveSoundId(id);
    const audio = audioRef.current;
    if (!audio) return;

    if (id === 'none') {
      audio.pause();
      setIsSoundPlaying(false);
      return;
    }

    const sound = AMBIENT_SOUNDS.find((s) => s.id === id);
    if (sound && sound.audioSrc) {
      if (!audio.src.endsWith(sound.audioSrc)) {
        audio.src = sound.audioSrc;
      }
      audio.volume = soundVolume;
      audio
        .play()
        .then(() => {
          setIsSoundPlaying(true);
        })
        .catch((err) => {
          console.warn('Ambient audio play blocked or error:', err);
          setIsSoundPlaying(false);
        });
    }
  }, [soundVolume]);

  const setSoundVolume = useCallback((vol: number) => {
    setSoundVolumeState(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, []);

  const toggleSoundPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isSoundPlaying) {
      audio.pause();
      setIsSoundPlaying(false);
    } else {
      if (activeSoundId !== 'none') {
        audio
          .play()
          .then(() => {
            setIsSoundPlaying(true);
          })
          .catch((err) => {
            console.warn('Playback error:', err);
          });
      } else {
        selectSound('rain');
      }
    }
  }, [isSoundPlaying, activeSoundId, selectSound]);

  // Load today's focus sessions
  const loadTodayFocusSessions = useCallback(async () => {
    try {
      const sessions = await focusSessionRepo.listByDate(todayDateKey);
      setTodayFocusSessions(sessions);
      const focusMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      syncWidgetData({ focusMinutesToday: focusMinutes });
    } catch (err) {
      console.error('Failed to load focus sessions:', err);
    }
  }, [todayDateKey]);

  useEffect(() => {
    loadTodayFocusSessions();
  }, [loadTodayFocusSessions]);

  // Save completed/stopped session
  const saveSession = useCallback(
    async (completed: boolean, elapsedSecs: number) => {
      if (!activeSessionStartTimeRef.current) return;
      const startTime = activeSessionStartTimeRef.current;
      const endTime = new Date();

      const elapsedMins = Math.max(1, Math.round(elapsedSecs / 60));

      const formatHM = (d: Date) => {
        const h = d.getHours();
        const m = d.getMinutes();
        return `${toPersianDigits(h)}:${toPersianDigits(String(m).padStart(2, '0'))}`;
      };

      try {
        await focusSessionRepo.create({
          task_id: selectedTaskId,
          task_title: selectedTaskId ? undefined : 'تمرکز آزاد',
          date_key: todayDateKey,
          start_at: formatHM(startTime),
          end_at: formatHM(endTime),
          duration_minutes: elapsedMins,
          completed,
        });
        await loadTodayFocusSessions();
      } catch (err) {
        console.error('Failed to save focus session:', err);
      } finally {
        activeSessionStartTimeRef.current = null;
        targetEndTimeRef.current = null;
        setActiveSessionStartMinute(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [selectedTaskId, todayDateKey, loadTodayFocusSessions]
  );

  // Restore active timer from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);

      if (data.timerState === 'running' && data.targetEndTime) {
        const now = Date.now();
        const left = Math.max(0, Math.ceil((data.targetEndTime - now) / 1000));
        if (left > 0) {
          setDurationMinutes(data.durationMinutes || 30);
          setRemainingSeconds(left);
          setTimerState('running');
          setSelectedTaskId(data.selectedTaskId || null);
          setActiveSessionStartMinute(data.activeSessionStartMinute || null);
          activeSessionStartTimeRef.current = data.activeSessionStartTime
            ? new Date(data.activeSessionStartTime)
            : new Date();
          targetEndTimeRef.current = data.targetEndTime;
        } else {
          // Session expired while user was away
          setDurationMinutes(data.durationMinutes || 30);
          setRemainingSeconds(0);
          setTimerState('completed');
          localStorage.removeItem(STORAGE_KEY);
        }
      } else if (data.timerState === 'paused') {
        setDurationMinutes(data.durationMinutes || 30);
        setRemainingSeconds(data.remainingSeconds || 30 * 60);
        setTimerState('paused');
        setSelectedTaskId(data.selectedTaskId || null);
        setActiveSessionStartMinute(data.activeSessionStartMinute || null);
        if (data.activeSessionStartTime) {
          activeSessionStartTimeRef.current = new Date(data.activeSessionStartTime);
        }
      }
    } catch {}
  }, []);

  // Save active timer to localStorage whenever relevant state changes
  useEffect(() => {
    if (timerState === 'running' || timerState === 'paused') {
      const payload = {
        timerState,
        durationMinutes,
        remainingSeconds,
        targetEndTime: targetEndTimeRef.current,
        activeSessionStartMinute,
        activeSessionStartTime: activeSessionStartTimeRef.current?.toISOString(),
        selectedTaskId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else if (timerState === 'idle' || timerState === 'completed') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [timerState, durationMinutes, remainingSeconds, activeSessionStartMinute, selectedTaskId]);

  // Main countdown ticker based on physical timestamp (handles tab switching & window throttling)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (timerState === 'running' && targetEndTimeRef.current) {
      const tick = () => {
        if (!targetEndTimeRef.current) return;
        const now = Date.now();
        const diffSecs = Math.ceil((targetEndTimeRef.current - now) / 1000);

        if (diffSecs <= 0) {
          setRemainingSeconds(0);
          setTimerState('completed');
          playTaskDoneSound();
          triggerHaptic('heavy');
          saveSession(true, durationMinutes * 60);
        } else {
          setRemainingSeconds(diffSecs);
        }
      };

      // Tick immediately
      tick();
      interval = setInterval(tick, 500);

      // Handle visibility change (instantly update when user switches back to browser tab)
      const handleVisibilityChange = () => {
        if (!document.hidden && timerState === 'running') {
          tick();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);

      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleVisibilityChange);
      };
    }
  }, [timerState, durationMinutes, saveSession]);

  // Controls
  const handleStart = useCallback(() => {
    const startDate = new Date();
    activeSessionStartTimeRef.current = startDate;
    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    setActiveSessionStartMinute(startMin);

    const totalSecs = durationMinutes * 60;
    setRemainingSeconds(totalSecs);
    targetEndTimeRef.current = Date.now() + totalSecs * 1000;
    setTimerState('running');

    // Trigger haptic feedback and schedule native notification
    triggerHaptic('medium');
    NotificationService.requestPermission().then((granted) => {
      if (granted) {
        NotificationService.scheduleFocusCompletion(durationMinutes);
      }
    });
  }, [durationMinutes]);

  const handlePauseResume = useCallback(() => {
    triggerHaptic('light');
    if (timerState === 'running') {
      // Pause
      setTimerState('paused');
      targetEndTimeRef.current = null;
      NotificationService.cancelFocusCompletion();
    } else if (timerState === 'paused') {
      // Resume
      targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
      setTimerState('running');
      NotificationService.scheduleFocusCompletion(Math.ceil(remainingSeconds / 60));
    }
  }, [timerState, remainingSeconds]);

  const handleAddOneMinute = useCallback(() => {
    triggerHaptic('light');
    setRemainingSeconds((prev) => prev + 60);
    setDurationMinutes((prev) => prev + 1);
    if (targetEndTimeRef.current) {
      targetEndTimeRef.current += 60000;
      NotificationService.scheduleFocusCompletion(Math.ceil((remainingSeconds + 60) / 60));
    }
  }, [remainingSeconds]);

  const handleStopReset = useCallback(() => {
    triggerHaptic('light');
    NotificationService.cancelFocusCompletion();
    if (activeSessionStartTimeRef.current) {
      const elapsed = durationMinutes * 60 - remainingSeconds;
      if (elapsed >= 45) {
        saveSession(false, elapsed);
      }
    }
    setTimerState('idle');
    setRemainingSeconds(durationMinutes * 60);
    activeSessionStartTimeRef.current = null;
    targetEndTimeRef.current = null;
    setActiveSessionStartMinute(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [durationMinutes, remainingSeconds, saveSession]);

  const elapsedMinutes = useMemo(() => {
    if (timerState === 'idle') return 0;
    const elapsedSec = durationMinutes * 60 - remainingSeconds;
    return Math.max(0, elapsedSec / 60);
  }, [timerState, durationMinutes, remainingSeconds]);

  const remainingMinutes = useMemo(() => {
    return Math.max(1, Math.ceil(remainingSeconds / 60));
  }, [remainingSeconds]);

  const value = useMemo(
    () => ({
      durationMinutes,
      remainingSeconds,
      timerState,
      selectedTaskId,
      activeSessionStartMinute,
      todayFocusSessions,
      elapsedMinutes,
      remainingMinutes,
      // Ambient Sound
      activeSoundId,
      soundVolume,
      isSoundPlaying,
      selectSound,
      setSoundVolume,
      toggleSoundPlay,
      // Timer Actions
      setDurationMinutes,
      setRemainingSeconds,
      setSelectedTaskId,
      handleStart,
      handlePauseResume,
      handleAddOneMinute,
      handleStopReset,
      loadTodayFocusSessions,
    }),
    [
      durationMinutes,
      remainingSeconds,
      timerState,
      selectedTaskId,
      activeSessionStartMinute,
      todayFocusSessions,
      elapsedMinutes,
      remainingMinutes,
      activeSoundId,
      soundVolume,
      isSoundPlaying,
      selectSound,
      setSoundVolume,
      toggleSoundPlay,
      handleStart,
      handlePauseResume,
      handleAddOneMinute,
      handleStopReset,
      loadTodayFocusSessions,
    ]
  );

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
};

export function useFocusTimer() {
  const context = useContext(FocusTimerContext);
  if (!context) {
    throw new Error('useFocusTimer must be used within a FocusTimerProvider');
  }
  return context;
}
