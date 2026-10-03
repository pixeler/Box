import { useState, useEffect, useCallback, useRef } from 'react';
import { AppContainer } from './components/layout/AppContainer';
import { MobileScrollArea } from './components/layout/MobileScrollArea';
import { WeeklyStrip } from './components/calendar/WeeklyStrip';
import { QuickCaptureInput } from './components/capture/QuickCaptureInput';
import { DayStream } from './components/stream/DayStream';
import { PinnedSection } from './components/stream/PinnedSection';
import { NotebookView } from './components/notebook/NotebookView';
import { ProfileView, WALLPAPER_LIST } from './components/profile/ProfileView';
import { BottomDock, type ActiveTab } from './components/navigation/BottomDock';
import { SearchModal } from './components/search/SearchModal';
import { TodoView } from './components/todo/TodoView';
import { FocusView } from './components/focus/FocusView';
// Archived: import { BoxesModal } from './components/boxes/BoxesModal';
import { ToastContainer } from './components/ui/Toast';
import { LoginModal } from './components/auth/LoginModal';
import { useAuth } from './lib/auth';
import { syncManager, type SyncState } from './lib/sync';

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
} from './lib/jalali';
import { isOfficialHoliday } from './lib/holidays';
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
    return localStorage.getItem('second_brain_wallpaper') || WALLPAPER_LIST[0].id;
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
  const [datesWithItems, setDatesWithItems] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [_syncState, setSyncState] = useState<SyncState>('idle');
  const [defaultBoxForAdd, setDefaultBoxForAdd] = useState<string | null>(null);
  const [quickCaptureTimeOfDay, setQuickCaptureTimeOfDay] = useState<TimeOfDay | undefined>(undefined);
  const [newlyAddedTaskId, setNewlyAddedTaskId] = useState<string | null>(null);

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

      // 1. Search shortcut: Ctrl+K / Cmd+K / Ctrl+ن (supports English and Persian layout)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'k' || e.key === 'K' || e.key === 'ن' || e.code === 'KeyK')
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
    await loadDayData();
  };

  const selectedJalali = parseJalaliKey(selectedDateKey);
  const selectedGregorianDate = jalaliToDate(selectedJalali.jy, selectedJalali.jm, selectedJalali.jd);
  const currentWeekdayName = getFullPersianWeekdayName(selectedGregorianDate);
  const isFriday = selectedGregorianDate.getDay() === 5;
  const isSelectedHoliday = isFriday || isOfficialHoliday(selectedDateKey);

  return (
    <AppContainer
      wallpaper={wallpaper}
      glassBackground={glassBackground}
      glassOpacity={glassOpacity}
      desktopPosition={desktopPosition}
      bottomDock={
        <BottomDock
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onOpenAdd={() => setQuickCaptureOpen(true)}
          glassOpacity={glassOpacity}
        />
      }
    >
      {/* Floating dynamic toast notification */}
      <ToastContainer />

      {/* Scrollable       {/* Scrollable Content Area with auto-hiding flush scrollbar */}
      <MobileScrollArea
        className="flex-1 min-h-0"
        contentClassName="pt-0 pb-0 flex flex-col min-h-full"
      >
        {activeTab === 'day' && (
          <>
            {/* Top Greeting Header & Weekly Strip */}
            <div
              data-no-drag-scroll="true"
              className="w-full shrink-0 select-none pb-0 pt-3 overflow-hidden"
            >
              {/* Top Greeting Header */}
              <div className="w-full pb-2 px-6 flex flex-col items-start justify-center min-h-[44px]">
                {/* Weekday Name + Dot (Right Aligned) */}
                <div className="flex items-center gap-1.5 select-none">
                  <h1 className="text-[21px] font-bold text-foreground tracking-tight leading-snug">
                    {currentWeekdayName}
                  </h1>
                  <span
                    className={`w-2 h-2 rounded-full inline-block shrink-0 transition-colors duration-200 ${
                      isSelectedHoliday
                        ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]'
                        : 'bg-foreground'
                    }`}
                  />
                </div>
                <p className="text-[12px] text-muted-foreground font-normal mt-0.5 select-none">
                  هر روزی که شروع میشه یک فرصت تازه است!
                </p>
              </div>

              {/* Weekly ribbon calendar */}
              <WeeklyStrip
                selectedDateKey={selectedDateKey}
                onSelectDate={setSelectedDateKey}
                datesWithItems={datesWithItems}
              />
            </div>

            {/* Stream Content Area sitting flush on the app container with full-width rows */}
            <div className="w-full flex-1 px-0 pt-3 pb-24 bg-transparent">

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
          </>
        )}

        {activeTab === 'notebook' && <NotebookView />}
        {activeTab === 'todo' && (
          <TodoView
            onBackToToday={() => setActiveTab('day')}
            onTaskChanged={loadDayData}
          />
        )}
        {activeTab === 'focus' && <FocusView />}
        {activeTab === 'profile' && (
          <ProfileView
            currentWallpaper={wallpaper}
            onWallpaperChange={handleWallpaperChange}
            currentTheme={theme}
            onThemeChange={handleThemeChange}
            glassBackground={glassBackground}
            onGlassBackgroundChange={handleGlassBackgroundChange}
            glassOpacity={glassOpacity}
            onGlassOpacityChange={handleGlassOpacityChange}
            desktopPosition={desktopPosition}
            onDesktopPositionChange={handleDesktopPositionChange}
            enableDaySections={enableDaySections}
            onEnableDaySectionsChange={handleEnableDaySectionsChange}
            dailyTaskGoal={dailyTaskGoal}
            onDailyTaskGoalChange={handleDailyTaskGoalChange}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onBackToToday={() => setActiveTab('day')}
          />
        )}
      </MobileScrollArea>


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
  );
}

export default App;
