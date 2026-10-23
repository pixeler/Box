import { useState, useEffect, useCallback, useRef } from 'react';
import { AppContainer } from './components/layout/AppContainer';
import { MobileScrollArea } from './components/layout/MobileScrollArea';
import { QuickCaptureInput } from './components/capture/QuickCaptureInput';
import { DayStream } from './components/stream/DayStream';
import { PinnedSection } from './components/stream/PinnedSection';
import { NotebookView } from './components/notebook/NotebookView';
import { NotebookProvider } from './components/notebook/NotebookContext';
import { ProfileView } from './components/profile/ProfileView';
import { SettingsSidebar } from './components/profile/SettingsSidebar';
import { BottomDock, type ActiveTab } from './components/navigation/BottomDock';
import { DesktopSidebar } from './components/navigation/DesktopSidebar';
import { DesktopSearchButton } from './components/navigation/DesktopSearchButton';
import { SearchModal } from './components/search/SearchModal';
import { TodoView } from './components/todo/TodoView';
import { FocusView } from './components/focus/FocusView';
import { CalendarView } from './components/calendar/CalendarView';
// Archived: import { BoxesModal } from './components/boxes/BoxesModal';
import { ToastContainer } from './components/ui/Toast';
import { LoginModal } from './components/auth/LoginModal';
import { useAuth } from './lib/auth';
import { syncManager, type SyncState } from './lib/sync';
import { RiArrowLeftSLine, RiArrowRightSLine, RiArrowGoBackLine } from '@remixicon/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PartyIcon } from '@hugeicons/core-free-icons';
import { getDailyQuote } from './lib/quotes';

import { taskRepo, noteRepo, eventRepo, tagRepo } from './repositories';
import { syncWidgetData } from './lib/widget';
import {
  getTodayJalaliKey,
  formatJalaliKey,
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
import { type ThemeId, getStoredTheme, applyTheme, isDarkMode } from './lib/theme';
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
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !quickCaptureOpen && !searchOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [settingsOpen, quickCaptureOpen, searchOpen]);
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [_syncState, setSyncState] = useState<SyncState>('idle');
  const [defaultBoxForAdd, setDefaultBoxForAdd] = useState<string | null>(null);
  const [quickCaptureTimeOfDay, setQuickCaptureTimeOfDay] = useState<TimeOfDay | undefined>(undefined);
  const [newlyAddedTaskId, setNewlyAddedTaskId] = useState<string | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState<number>(0);

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
  const goalPillRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoadRef = useRef(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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

  // Desktop sidebar collapsed state with persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('second_brain_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('second_brain_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

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

      // Toggle desktop sidebar: Ctrl+B / Cmd+B (Persian layout: ذ)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyB' || e.key === 'b' || e.key === 'B' || e.key === 'ذ')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

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
  }, [quickCaptureOpen, searchOpen, toggleSidebar]);


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

  useEffect(() => {
    const init = async () => {
      try {
        await checkAndSeedDesignDemoData();
        await fetchDayData(selectedDateKey);
      } finally {
        setIsInitialLoading(false);
      }
    };
    init();
  }, []);

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

  const selectedJalali = parseJalaliKey(selectedDateKey);
  const selectedGregorianDate = jalaliToDate(selectedJalali.jy, selectedJalali.jm, selectedJalali.jd);
  const currentWeekdayName = getFullPersianWeekdayName(selectedGregorianDate);

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
  return (
    <NotebookProvider>
      <AppContainer
        wallpaper={wallpaper}
        glassBackground={glassBackground}
        glassOpacity={glassOpacity}
        desktopPosition={desktopPosition}
        isCalendarExpanded={activeTab === 'calendar'}
        isNotebookExpanded={activeTab === 'notebook'}
        desktopSidebar={
          <DesktopSidebar
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
            onOpenAdd={() => setQuickCaptureOpen(true)}
            onOpenSettings={() => setSettingsOpen((prev) => !prev)}
            settingsOpen={settingsOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebar}
          />
        }
        secondarySidebar={
          settingsOpen ? (
            <SettingsSidebar onClose={() => setSettingsOpen(false)}>
              <ProfileView
                {...profileBaseProps}
                variant="panel"
                onOpenAuthModal={() => {
                  setSettingsOpen(false);
                  setAuthModalOpen(true);
                }}
                onOpenSearch={() => {
                  setSettingsOpen(false);
                  setSearchOpen(true);
                }}
              />
            </SettingsSidebar>
          ) : undefined
        }
        desktopCorner={<DesktopSearchButton onClick={() => setSearchOpen(true)} />}
      isDark={isDarkMode(theme)}
      bottomDock={
        <BottomDock
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAdd={() => setQuickCaptureOpen(true)}
          glassOpacity={glassOpacity}
        />
      }
    >
      {/* Floating dynamic toast notification */}
      <ToastContainer />

      {/* Content Area: CalendarView and NotebookView have their own fixed header & internal scroller, other tabs use MobileScrollArea */}
      {activeTab === 'calendar' ? (
        <div className="flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
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
        <div className="flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
          <NotebookView />
        </div>
      ) : (
        <MobileScrollArea
          className="flex-1 min-h-0"
          contentClassName="pt-0 pb-0 flex flex-col min-h-full"
        >
        {activeTab === 'day' && (
          <div
            key={displayedDateKey}
            className="w-full flex-1 flex flex-col animate-in fade-in duration-300"
          >
            {/* Top Greeting Header (Centered with arrows & Darvish font, WeeklyStrip removed) */}
            <div
              data-no-drag-scroll="true"
              className="w-full shrink-0 select-none pb-1.5 pt-9 sm:pt-11 overflow-hidden"
            >
              {/* Row with < Weekday Name > and optional Return-to-Today button */}
              <div className="w-full px-6 flex items-center justify-between select-none relative" dir="rtl">
                {/* Arrow Right (>) for Previous Day in RTL */}
                <button
                  type="button"
                  onClick={() => setSelectedDateKey(addJalaliDays(selectedDateKey, -1))}
                  className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer active:scale-95"
                  title="روز قبل"
                >
                  <RiArrowRightSLine className="size-6" />
                </button>

                {/* Weekday Name in Darvish Font */}
                <h1 className="font-darvish text-lg sm:text-xl font-bold text-foreground tracking-normal select-none leading-snug">
                  {currentWeekdayName}
                </h1>

                {/* Arrow Left (<) for Next Day in RTL */}
                <button
                  type="button"
                  onClick={() => setSelectedDateKey(addJalaliDays(selectedDateKey, 1))}
                  className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer active:scale-95"
                  title="روز بعد"
                >
                  <RiArrowLeftSLine className="size-6" />
                </button>
              </div>

              {/* Motivational quote in Darvish Font (dynamic per day) */}
              <p className="font-darvish text-xs sm:text-sm text-muted-foreground font-normal mt-2 text-center select-none px-4">
                {getDailyQuote(selectedDateKey)}
              </p>

              {/* Daily Tasks Progress Bar with generous top and bottom spacing */}
              <div
                ref={goalPillRef}
                className="w-full px-6 mt-6 sm:mt-7 mb-4 sm:mb-5 flex items-center gap-3 select-none"
                dir="rtl"
              >
                {/* Counter + Popper icon on the FAR RIGHT */}
                <div
                  className="flex items-center gap-1.5 shrink-0 text-muted-foreground select-none"
                  title={`هدف روزانه: ${toPersianDigits(dailyTaskGoal)} تسک (${toPersianDigits(todayDoneCount)} از ${toPersianDigits(dailyTaskGoal)} انجام شد)`}
                >
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {toPersianDigits(todayDoneCount)}/{toPersianDigits(dailyTaskGoal)}
                  </span>
                  <HugeiconsIcon icon={PartyIcon} size={15} strokeWidth={1.8} className="text-muted-foreground/80 shrink-0" />
                </div>

                {/* Progress Bar Track on the LEFT */}
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden flex items-center" dir="ltr">
                  <div
                    className="h-full bg-neutral-600 dark:bg-neutral-300 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((todayDoneCount / dailyTaskGoal) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Return to today button: directly below progress bar and above tasks list */}
              {selectedDateKey !== getTodayJalaliKey() && (
                <div className="w-full flex justify-center mt-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDateKey(getTodayJalaliKey())}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-xs font-semibold text-foreground border border-border/40 shadow-xs transition-all cursor-pointer active:scale-95"
                    title="بازگشت به امروز"
                  >
                    <RiArrowGoBackLine className="size-3.5 text-muted-foreground" />
                    <span>بازگشت به امروز</span>
                  </button>
                </div>
              )}
            </div>


            {/* Stream Content Area sitting flush on the app container with full-width rows */}
            <div className="w-full flex-1 px-0 pt-3.5 sm:pt-4 pb-24 bg-transparent">

              {/* Pinned Items Section (سنجاق شده) - Below WeeklyStrip and above DayStream */}
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
              />
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
        {activeTab === 'profile' && (
          <ProfileView
            {...profileBaseProps}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onBackToToday={() => setActiveTab('day')}
          />
        )}
      </MobileScrollArea>
      )}


      {/* Archived: Boxes Modal Sheet */}
      {/* <BoxesModal
        isOpen={boxesOpen}
        onClose={() => setBoxesOpen(false)}
        onOpenAddForBox={(boxId) => {
          setDefaultBoxForAdd(boxId);
          setQuickCaptureOpen(true);
        }}
        tagsMap={tagsMap}
      /> */}

      {/* Supabase Login / Auth Modal */}
      <LoginModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

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
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectDate={(date) => {
          setSelectedDateKey(date);
          setActiveTab('day');
        }}
      />

      {/* Celebration particle burst when reaching 5 daily tasks */}
      {celebrationCoords && (
        <DailyGoalCelebration
          originX={celebrationCoords.x}
          originY={celebrationCoords.y}
          theme={theme}
          onComplete={() => setCelebrationCoords(null)}
        />
      )}
      </AppContainer>
    </NotebookProvider>
  );
}

export default App;
