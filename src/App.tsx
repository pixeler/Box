import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AppShell } from './components/shell/AppShell';
import { MobileScrollArea } from './components/layout/MobileScrollArea';
import { QuickCaptureInput } from './components/capture/QuickCaptureInput';
import { DayStream } from './components/stream/DayStream';
import { PinnedSection } from './components/stream/PinnedSection';
import { NotebookProvider } from './components/notebook/NotebookContext';
import type { SettingsSection } from './components/profile/ProfileView';
import type { ActiveTab } from './components/navigation/BottomDock';
import { ToastContainer } from './components/ui/Toast';

// Heavy, non-first-screen views are split out of the boot bundle. They are
// prefetched while the app is idle, so switching tabs still feels instant.
const NotebookView = lazy(() =>
  import('./components/notebook/NotebookView').then((m) => ({ default: m.NotebookView }))
);
const TodoView = lazy(() =>
  import('./components/todo/TodoView').then((m) => ({ default: m.TodoView }))
);
const FocusView = lazy(() =>
  import('./components/focus/FocusView').then((m) => ({ default: m.FocusView }))
);
const CalendarView = lazy(() =>
  import('./components/calendar/CalendarView').then((m) => ({ default: m.CalendarView }))
);

/**
 * Overlays carry a lot of weight (the settings screen, the MiniSearch index,
 * the auth forms) and none of it is needed for the first paint, so each one
 * loads the first time it is opened.
 */
const SettingsDialog = lazy(() =>
  import('./components/settings/SettingsDialog').then((m) => ({ default: m.SettingsDialog }))
);
const SearchModal = lazy(() =>
  import('./components/search/SearchModal').then((m) => ({ default: m.SearchModal }))
);
const LoginModal = lazy(() =>
  import('./components/auth/LoginModal').then((m) => ({ default: m.LoginModal }))
);

import { useAuth } from './lib/auth';
import { syncManager, type SyncState } from './lib/sync';
import { ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { getDailyQuote } from './lib/quotes';
import { useMediaQuery } from './lib/device';
import { runWhenIdle } from './lib/idle';
import { ResurfacingSection } from './components/stream/ResurfacingSection';

import { taskRepo, noteRepo, eventRepo, tagRepo } from './repositories';
import { syncWidgetData } from './lib/widget';
import {
  getTodayJalaliKey,
  formatJalaliKey,
  formatJalaliDisplay,
  getJalaliDate,
  parseJalaliKey,
  jalaliToDate,
  getFullPersianWeekdayName,
  extractDateOnly,
  addJalaliDays,
  toPersianDigits,
} from './lib/jalali';
import { isTaskOccurringOnDate } from './lib/recurrence';
import { checkAndSeedDesignDemoData } from './lib/seed';
import { type ThemeId, getStoredTheme, applyTheme } from './lib/theme';
import type { Task, EventItem, Note, Tag, TimeOfDay } from './types/models';
import { DailyGoalCelebration } from './components/common/DailyGoalCelebration';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('day');
  // Initialize dynamically to today's actual Shamsi date
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getTodayJalaliKey());
  const [displayedDateKey, setDisplayedDateKey] = useState<string>(() => getTodayJalaliKey());
  const [wallpaper, setWallpaper] = useState<string>(() => {
    const saved = localStorage.getItem('second_brain_wallpaper');
    if (!saved || saved === 'clean-snow') return 'wafer-sky';
    return saved;
  });
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [glassBackground, setGlassBackground] = useState<boolean>(() => {
    return localStorage.getItem('second_brain_glass_background') === 'true';
  });
  const [glassOpacity, setGlassOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('second_brain_glass_opacity');
    return saved !== null ? Number(saved) : 0.18;
  });

  const handleGlassOpacityChange = (opacity: number) => {
    setGlassOpacity(opacity);
    localStorage.setItem('second_brain_glass_opacity', String(opacity));
  };
  const [enableDaySections, setEnableDaySections] = useState<boolean>(() => {
    return localStorage.getItem('second_brain_enable_day_sections') === 'true';
  });

  const handleEnableDaySectionsChange = (enabled: boolean) => {
    setEnableDaySections(enabled);
    localStorage.setItem('second_brain_enable_day_sections', String(enabled));
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pinnedTasks, setPinnedTasks] = useState<Task[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [futureTasks, setFutureTasks] = useState<Task[]>([]);
  const [futureEvents, setFutureEvents] = useState<EventItem[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [_datesWithItems, setDatesWithItems] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('main');
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  /**
   * Overlays are mounted on first use and then kept mounted, so their exit
   * animations still play while their code stays out of the boot bundle.
   */
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const [authMounted, setAuthMounted] = useState(false);

  useEffect(() => {
    if (settingsOpen) setSettingsMounted(true);
  }, [settingsOpen]);
  useEffect(() => {
    if (searchOpen) setSearchMounted(true);
  }, [searchOpen]);

  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (authModalOpen) setAuthMounted(true);
  }, [authModalOpen]);
  const [_syncState, setSyncState] = useState<SyncState>('idle');
  const [defaultBoxForAdd, setDefaultBoxForAdd] = useState<string | null>(null);
  const [quickCaptureTimeOfDay, setQuickCaptureTimeOfDay] = useState<TimeOfDay | undefined>(undefined);
  const [newlyAddedTaskId, setNewlyAddedTaskId] = useState<string | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState<number>(0);

  // Always-current date key, so deferred (idle) work never reads a stale value.
  const selectedDateKeyRef = useRef(selectedDateKey);
  useEffect(() => {
    selectedDateKeyRef.current = selectedDateKey;
  }, [selectedDateKey]);

  // Daily Tasks Target state (Karma / Goal celebration)
  const [dailyTaskGoal, setDailyTaskGoal] = useState<number>(() => {
    const saved = localStorage.getItem('second_brain_daily_task_goal');
    return saved !== null ? Math.max(1, parseInt(saved, 10) || 5) : 5;
  });
  const dailyTaskGoalRef = useRef(dailyTaskGoal);
  useEffect(() => {
    dailyTaskGoalRef.current = dailyTaskGoal;
  }, [dailyTaskGoal]);

  const handleDailyTaskGoalChange = (newGoal: number) => {
    const validGoal = Math.max(1, newGoal);
    setDailyTaskGoal(validGoal);
    localStorage.setItem('second_brain_daily_task_goal', String(validGoal));
  };

  const [todayDoneCount, setTodayDoneCount] = useState<number>(0);
  const [celebrationCoords, setCelebrationCoords] = useState<{ x: number; y: number } | null>(null);
  const goalPillRef = useRef<HTMLParagraphElement | null>(null);
  const isInitialLoadRef = useRef(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Two-column "today + overdue" layout only where both columns have room.
  const isWideDayLayout = useMediaQuery('(min-width: 1200px)');

  // Listen to cloud sync state
  useEffect(() => {
    return syncManager.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  // Auto trigger sync on user login or mount
  useEffect(() => {
    if (user) {
      syncManager.performSync();
    }
  }, [user]);

  // Apply active theme on mount and change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme: ThemeId) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Wallpaper change with persistence
  const handleWallpaperChange = (wpId: string) => {
    setWallpaper(wpId);
    localStorage.setItem('second_brain_wallpaper', wpId.startsWith('custom-image') ? 'custom-image' : wpId);
  };

  // Glass background toggle with persistence
  const handleGlassBackgroundChange = (enabled: boolean) => {
    setGlassBackground(enabled);
    localStorage.setItem('second_brain_glass_background', String(enabled));
  };

  // Desktop window position state with persistence ('right' | 'center' | 'left')
  const [desktopPosition, setDesktopPosition] = useState<'right' | 'center' | 'left'>(() => {
    return (localStorage.getItem('second_brain_desktop_position') as 'right' | 'center' | 'left') || 'center';
  });

  const handleDesktopPositionChange = (pos: 'right' | 'center' | 'left') => {
    setDesktopPosition(pos);
    localStorage.setItem('second_brain_desktop_position', pos);
  };

  // Global keyboard shortcuts (supports both English and Persian layouts)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')));

      // Settings: Ctrl/Cmd + comma, the desktop convention.
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsSection('main');
        setSettingsOpen(true);
        return;
      }

      // 1. Search shortcut: Ctrl+P / Cmd+P / Persian Ctrl+ح (supports English and Persian layout)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.code === 'KeyP' ||
          e.key === 'p' ||
          e.key === 'P' ||
          e.key === 'ح' ||
          e.code === 'KeyK' ||
          e.key === 'k' ||
          e.key === 'K' ||
          e.key === 'ن')
      ) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      // If user is inside an input field, do not trigger single-key navigation shortcuts
      if (isInput) return;

      // 2. Add / Quick Capture shortcut: 'N' or Persian 'د' (KeyN)
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'n' || e.key === 'N' || e.key === 'د' || e.code === 'KeyN')
      ) {
        if (!quickCaptureOpen && !searchOpen) {
          e.preventDefault();
          setQuickCaptureOpen(true);
        }
      }

      // 3. Search '/' shortcut when not in input
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === '/' || e.key === 'م' || e.code === 'Slash')
      ) {
        if (!quickCaptureOpen && !searchOpen) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }

      // 4. To-do shortcut: 'T' or Persian 'ف' (KeyT)
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 't' || e.key === 'T' || e.key === 'ف' || e.code === 'KeyT')
      ) {
        if (!quickCaptureOpen && !searchOpen) {
          e.preventDefault();
          setActiveTab((prev) => (prev === 'todo' ? 'day' : 'todo'));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [quickCaptureOpen, searchOpen]);


  // High-performance parallelized fetch for day data (only 4 consolidated IndexedDB queries)
  const fetchDayData = useCallback(async (targetDateKey: string) => {
    try {
      const [allTags, allTasksList, allEventsList, allNotes] =
        await Promise.all([
          tagRepo.listAll(),
          taskRepo.list(),
          eventRepo.list(),
          noteRepo.list(),
        ]);

      const tMap: Record<string, Tag> = {};
      allTags.forEach((t) => (tMap[t.id] = t));

      const normTarget = extractDateOnly(targetDateKey);

      // In-memory filtering instead of hitting IndexedDB multiple times
      const dayEvents = allEventsList.filter((e) => extractDateOnly(e.start_at) === normTarget);

      const overdue: Task[] = [];
      const futureT: Task[] = [];
      const pinnedT: Task[] = [];

      allTasksList.forEach((t) => {
        if (t.status === 'dropped') return;
        if (t.pinned) pinnedT.push(t);

        const isRecurring = Boolean(t.recurrence_rule && t.recurrence_rule !== 'none');
        if (!isRecurring && t.due_date) {
          const taskDate = extractDateOnly(t.due_date);
          const isDone = t.status === 'done';

          if (taskDate && !isDone) {
            if (taskDate < normTarget) overdue.push(t);
            else if (taskDate > normTarget) futureT.push(t);
          }
        }
      });

      overdue.sort((a, b) => {
        const pA = a.priority || 0;
        const pB = b.priority || 0;
        if (pA !== pB) return pB - pA;
        const dateA = extractDateOnly(a.due_date || '');
        const dateB = extractDateOnly(b.due_date || '');
        const dateCmp = dateB.localeCompare(dateA);
        if (dateCmp !== 0) return dateCmp;
        return (new Date(b.created_at || 0).getTime() || 0) - (new Date(a.created_at || 0).getTime() || 0);
      });
      futureT.sort((a, b) => extractDateOnly(a.due_date).localeCompare(extractDateOnly(b.due_date)));

      const pinnedN = allNotes.filter((n) => n.pinned);

      const dayTasks = allTasksList
        .filter(
          (t) => isTaskOccurringOnDate(t, targetDateKey) && t.status !== 'dropped' && !t.pinned
        )
        .map((t) => {
          if (t.recurrence_rule && t.recurrence_rule !== 'none') {
            const isDoneOnDate = (t.done_dates || []).map(extractDateOnly).includes(normTarget);
            return {
              ...t,
              status: isDoneOnDate ? ('done' as const) : ('open' as const),
            };
          }
          return t;
        });

      const dayNotes = allNotes.filter((n) => {
        if (n.pinned) return false;
        if (n.date_key) {
          return extractDateOnly(n.date_key) === targetDateKey;
        }
        if (n.created_at) {
          try {
            const noteJalali = formatJalaliKey(getJalaliDate(new Date(n.created_at)));
            return noteJalali === targetDateKey;
          } catch {
            return false;
          }
        }
        return false;
      });

      // Pre-compute window date strings ONCE instead of re-computing inside every task iteration
      const recurringTasks = allTasksList.filter(
        (t) => t.status !== 'dropped' && t.recurrence_rule && t.recurrence_rule !== 'none'
      );
      const dSet = new Set<string>();

      if (recurringTasks.length > 0) {
        const offsetDates: string[] = [];
        for (let offset = -30; offset <= 45; offset++) {
          offsetDates.push(addJalaliDays(targetDateKey, offset));
        }
        for (const t of recurringTasks) {
          for (const dateStr of offsetDates) {
            if (isTaskOccurringOnDate(t, dateStr)) {
              dSet.add(dateStr);
            }
          }
        }
      }

      allTasksList.forEach((t) => {
        if (t.status === 'dropped' || (t.recurrence_rule && t.recurrence_rule !== 'none')) return;
        const dp = extractDateOnly(t.due_date);
        if (dp) dSet.add(dp);
      });
      allNotes.forEach((n) => {
        if (n.date_key) dSet.add(extractDateOnly(n.date_key));
        else if (n.created_at) {
          try {
            dSet.add(formatJalaliKey(getJalaliDate(new Date(n.created_at))));
          } catch {}
        }
      });
      allEventsList.forEach((e) => {
        const ep = extractDateOnly(e.start_at);
        if (ep) dSet.add(ep);
      });

      // Count all tasks marked done today (regardless of due date or overdue status)
      const todayISO = new Date().toISOString().slice(0, 10);
      const doneToday = allTasksList.filter(
        (t) => t.status === 'done' && t.updated_at && t.updated_at.slice(0, 10) === todayISO
      ).length;

      const celebrationStorageKey = `daily_goal_celebrated_${todayISO}`;
      const alreadyCelebratedToday = localStorage.getItem(celebrationStorageKey) === 'true';

      setTodayDoneCount((prev) => {
        // Only trigger celebratory burst if this is NOT initial mount AND user crossed the daily task threshold AND hasn't celebrated today yet
        const targetGoal = dailyTaskGoalRef.current;
        if (!isInitialLoadRef.current && prev < targetGoal && doneToday >= targetGoal && !alreadyCelebratedToday) {
          localStorage.setItem(celebrationStorageKey, 'true');
          if (goalPillRef.current) {
            const rect = goalPillRef.current.getBoundingClientRect();
            setCelebrationCoords({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          } else {
            setCelebrationCoords({ x: 80, y: 50 });
          }
        }
        return doneToday;
      });

      isInitialLoadRef.current = false;

      const futureEv = allEventsList.filter((e) => {
        const ep = extractDateOnly(e.start_at);
        return ep !== '' && ep > targetDateKey;
      });

      // Batch all updates together with displayedDateKey
      setTagsMap(tMap);
      setTasks(dayTasks);
      setEvents(dayEvents);
      setNotes(dayNotes);
      setPinnedTasks(pinnedT);
      setPinnedNotes(pinnedN);
      setDatesWithItems(dSet);
      setOverdueTasks(overdue);
      setFutureTasks(futureT);
      setFutureEvents(futureEv);
      setDisplayedDateKey(targetDateKey);

      // Sync summary to native Android home screen widget
      const openDayTasks = dayTasks.filter((t) => t.status === 'open');
      syncWidgetData({
        todayTaskCount: openDayTasks.length,
        doneTaskCount: doneToday,
        nextTaskTitle: openDayTasks[0]?.title || (dayTasks.length > 0 ? 'همه کارهای امروز انجام شد ✨' : 'کاری برای امروز ثبت نشده'),
      });
      setIsInitialLoading(false);
    } catch (err) {
      console.error('Failed loading day data:', err);
      setIsInitialLoading(false);
    }
  }, []);

  const loadDayData = useCallback(async () => {
    await fetchDayData(selectedDateKey);
  }, [fetchDayData, selectedDateKey]);

  useEffect(() => {
    if (activeTab === 'day') {
      fetchDayData(selectedDateKey);
    }
  }, [activeTab, selectedDateKey, fetchDayData]);

  // Auto-refresh when cloud sync updates local database in background or via Realtime
  useEffect(() => {
    return syncManager.onDataChange(() => {
      fetchDayData(selectedDateKey);
    });
  }, [fetchDayData, selectedDateKey]);

  // One-off demo bootstrap + maintenance. This used to run *before* the first
  // database read and awaited a Supabase auth round-trip, which is why a cold
  // start showed a loading state for seconds. It now runs only when idle.
  useEffect(() => {
    runWhenIdle(async () => {
      try {
        const changed = await checkAndSeedDesignDemoData();
        // Only re-read when the bootstrap actually touched the database.
        if (changed) fetchDayData(selectedDateKeyRef.current);
      } catch (err) {
        console.warn('Deferred bootstrap failed:', err);
      }
    }, 2000);
  }, [fetchDayData]);

  // Migrate task to current selected date
  const handleMigrateTask = async (taskId: string, targetDate?: string) => {
    const destinationDate = targetDate || selectedDateKey;
    await taskRepo.migrate(taskId, destinationDate);
    loadDayData();
  };

  const handleItemCreated = async (createdId?: string) => {
    if (createdId) {
      setNewlyAddedTaskId(createdId);
      setTimeout(() => {
        setNewlyAddedTaskId((prev) => (prev === createdId ? null : prev));
      }, 1500);
    }
    setCalendarRefreshKey((k) => k + 1);
    await loadDayData();
  };

  const displayedJalali = parseJalaliKey(displayedDateKey);
  const currentWeekdayName = getFullPersianWeekdayName(
    jalaliToDate(displayedJalali.jy, displayedJalali.jm, displayedJalali.jd)
  );
  const isSelectedToday = displayedDateKey === getTodayJalaliKey();

  const profileBaseProps = {
    currentWallpaper: wallpaper,
    onWallpaperChange: handleWallpaperChange,
    currentTheme: theme,
    onThemeChange: handleThemeChange,
    glassBackground,
    onGlassBackgroundChange: handleGlassBackgroundChange,
    glassOpacity,
    onGlassOpacityChange: handleGlassOpacityChange,
    desktopPosition,
    onDesktopPositionChange: handleDesktopPositionChange,
    enableDaySections,
    onEnableDaySectionsChange: handleEnableDaySectionsChange,
    dailyTaskGoal,
    onDailyTaskGoalChange: handleDailyTaskGoalChange,
  };

  const handleOpenRecentTask = (task: Task) => {
    const dateKey = extractDateOnly(task.due_date || '');
    if (dateKey) setSelectedDateKey(dateKey);
    setActiveTab('day');
  };

  const contentPane = (
    <div key={activeTab} className="tab-pane flex min-h-0 w-full flex-1 flex-col">
      {activeTab === 'calendar' ? (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          <CalendarView
            selectedDateKey={selectedDateKey}
            enableDaySections={enableDaySections}
            refreshTrigger={calendarRefreshKey}
            onSelectDate={(newDate) => {
              setSelectedDateKey(newDate);
            }}
            onOpenAddForDate={(dateKey) => {
              setSelectedDateKey(dateKey);
              setQuickCaptureOpen(true);
            }}
            onExitCalendar={() => setActiveTab('day')}
            onTaskChanged={loadDayData}
          />
        </div>
      ) : activeTab === 'notebook' ? (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1000px] flex-1 flex-col overflow-hidden">
          <NotebookView />
        </div>
      ) : (
        <MobileScrollArea
          className="flex-1 min-h-0"
          contentClassName={`mx-auto w-full ${
            activeTab === 'day' ? 'max-w-[1000px]' : 'max-w-[var(--content-max)]'
          } pb-0 pt-0 flex min-h-full flex-col`}
        >
          {activeTab === 'day' && (
            <div
              key={displayedDateKey}
              className="w-full flex-1 flex flex-col day-pane-enter"
            >
              {/* Page row: the day title, then the daily quote with the page actions beside it */}
              <div className="w-full px-5 pt-10 sm:px-6 sm:pt-12">
                <h1 className="font-darvish text-[26px] font-bold tracking-normal text-foreground sm:text-[30px]">
                  امروز
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 select-none">
                  <p
                    ref={goalPillRef}
                    className="min-w-[12rem] flex-1 text-[12.5px] leading-6 text-subtle"
                  >
                    {getDailyQuote(displayedDateKey)}
                  </p>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isSelectedToday && (
                      <button
                        type="button"
                        onClick={() => setSelectedDateKey(getTodayJalaliKey())}
                        title="بازگشت به امروز"
                        className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground sm:flex"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>امروز</span>
                      </button>
                    )}

                    <div className="flex items-center rounded-md border border-border/60">
                      <button
                        type="button"
                        onClick={() => setSelectedDateKey(addJalaliDays(selectedDateKey, -1))}
                        title="روز قبل"
                        aria-label="روز قبل"
                        className="flex size-8 items-center justify-center rounded-s-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                      <span className="h-4 w-px bg-border/70" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setSelectedDateKey(addJalaliDays(selectedDateKey, 1))}
                        title="روز بعد"
                        aria-label="روز بعد"
                        className="flex size-8 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setQuickCaptureTimeOfDay('anytime');
                        setQuickCaptureOpen(true);
                      }}
                      title="افزودن کار (N)"
                      className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Plus className="size-4" />
                      <span>افزودن کار</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid w-full items-start gap-x-10 px-5 pb-24 pt-6 sm:px-6 sm:pt-7 min-[1200px]:grid-cols-[minmax(0,498px)_minmax(0,1fr)]">
                {/* Today column */}
                <div className="flex w-full min-w-0 flex-col">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pb-2 select-none">
                    <h2 className="text-[14.5px] font-semibold tracking-tight text-foreground">
                      {formatJalaliDisplay(parseJalaliKey(displayedDateKey))}
                    </h2>
                    <span className="text-[11.5px] leading-5 text-muted-foreground">
                      {currentWeekdayName} · {toPersianDigits(tasks.length)} کار
                    </span>
                  </div>

                  {/* Stream Content Area */}
                  <div className="w-full flex-1 pt-1">
                    {/* Pinned Items Section (سنجاق شده) */}
                    {(pinnedTasks.length > 0 || pinnedNotes.length > 0) && (
                      <PinnedSection
                        pinnedTasks={pinnedTasks}
                        pinnedNotes={pinnedNotes}
                        tagsMap={tagsMap}
                        currentDateKey={displayedDateKey}
                        onStatusChanged={loadDayData}
                      />
                    )}

                    {/* Day stream */}
                    <DayStream
                      key={displayedDateKey}
                      selectedDateKey={displayedDateKey}
                      tasks={tasks}
                      notes={notes}
                      events={events}
                      overdueTasks={overdueTasks}
                      futureTasks={futureTasks}
                      futureEvents={futureEvents}
                      tagsMap={tagsMap}
                      onStatusChanged={loadDayData}
                      onMigrateTask={handleMigrateTask}
                      onGoToToday={() => setSelectedDateKey(getTodayJalaliKey())}
                      onOpenAdd={(tod) => {
                        setQuickCaptureTimeOfDay(tod || 'anytime');
                        setQuickCaptureOpen(true);
                      }}
                      newlyAddedTaskId={newlyAddedTaskId}
                      isLoading={isInitialLoading}
                      todayDoneCount={todayDoneCount}
                      dailyTaskGoal={dailyTaskGoal}
                      enableDaySections={enableDaySections}
                      goalPillRef={goalPillRef}
                      hideOverdue={isWideDayLayout}
                    />
                  </div>
                </div>

                {/* Overdue column (desktop only) */}
                {isWideDayLayout && (
                  <aside className="w-full min-w-0">
                    <ResurfacingSection
                      overdueTasks={overdueTasks}
                      futureTasks={[]}
                      futureEvents={[]}
                      tagsMap={tagsMap}
                      selectedDateKey={displayedDateKey}
                      onMigrateToCurrentDate={(id) => handleMigrateTask(id, displayedDateKey)}
                      onStatusChanged={loadDayData}
                      variant="overdue"
                      overdueTitle="عقب‌افتاده"
                    />
                  </aside>
                )}
              </div>
            </div>
          )}

          {activeTab === 'todo' && (
            <TodoView
              onBackToToday={() => setActiveTab('day')}
              onTaskChanged={loadDayData}
            />
          )}
          {activeTab === 'focus' && <FocusView />}
        </MobileScrollArea>
      )}
    </div>
  );

  return (
    <NotebookProvider>
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenAdd={() => setQuickCaptureOpen(true)}
        onOpenSettings={(section = 'main') => {
          setSettingsSection(section);
          setSettingsOpen(true);
        }}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenTask={handleOpenRecentTask}
      >
        <Suspense fallback={null}>{contentPane}</Suspense>
      </AppShell>

      {/* Floating dynamic toast notification */}
      <ToastContainer />

      {/* Settings is a focused window; the legacy side panel is no longer rendered. */}
      <Suspense fallback={null}>
        {settingsMounted && (
          <SettingsDialog
            {...profileBaseProps}
            initialSection={settingsSection}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onOpenAuthModal={() => {
              setSettingsOpen(false);
              setAuthModalOpen(true);
            }}
            onOpenSearch={() => {
              setSettingsOpen(false);
              setSearchOpen(true);
            }}
          />
        )}
      </Suspense>

      {/* Supabase Login / Auth Modal */}
      <Suspense fallback={null}>
        {authMounted && (
          <LoginModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </Suspense>

      {/* Quick Capture Modal */}
      <QuickCaptureInput
        currentSelectedDateKey={selectedDateKey}
        onItemCreated={handleItemCreated}
        isOpen={quickCaptureOpen}
        onClose={() => {
          setQuickCaptureOpen(false);
          setDefaultBoxForAdd(null);
          setQuickCaptureTimeOfDay(undefined);
        }}
        onOpen={() => setQuickCaptureOpen(true)}
        defaultBoxId={defaultBoxForAdd}
        initialTimeOfDay={quickCaptureTimeOfDay}
      />

      {/* Search Modal */}
      <Suspense fallback={null}>
        {searchMounted && (
          <SearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelectDate={(date) => {
              setSelectedDateKey(date);
              setActiveTab('day');
            }}
          />
        )}
      </Suspense>

      {/* Celebration particle burst when reaching 5 daily tasks */}
      {celebrationCoords && (
        <DailyGoalCelebration
          originX={celebrationCoords.x}
          originY={celebrationCoords.y}
          theme={theme}
          onComplete={() => setCelebrationCoords(null)}
        />
      )}
    </NotebookProvider>
  );
}

export default App;
