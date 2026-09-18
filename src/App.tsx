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
import { BoxesModal } from './components/boxes/BoxesModal';
import { ToastContainer } from './components/ui/Toast';
import { DailyTimelineBar } from './components/calendar/DailyTimelineBar';
import { EventDetailModal } from './components/calendar/EventDetailModal';
import { TaskEditModal } from './components/task/TaskEditModal';

import { taskRepo, noteRepo, eventRepo, tagRepo } from './repositories';
import { RiCalendarEventLine, RiArrowLeftSLine, RiMedal2Line } from '@remixicon/react';
import {
  getTodayJalaliKey,
  formatJalaliKey,
  getJalaliDate,
  parseJalaliKey,
  jalaliToDate,
  getFullPersianWeekdayName,
  getRelativeDayPrefix,
  extractDateOnly,
  toPersianDigits,
  addJalaliDays,
} from './lib/jalali';
import { isOfficialHoliday } from './lib/holidays';
import { isTaskOccurringOnDate } from './lib/recurrence';
import { checkAndSeedDesignDemoData } from './lib/seed';
import { type ThemeId, getStoredTheme, applyTheme } from './lib/theme';
import type { Task, EventItem, Note, Tag } from './types/models';
import { DailyGoalCelebration } from './components/common/DailyGoalCelebration';
import { getDailyQuote } from './lib/quotes';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boxesOpen, setBoxesOpen] = useState(false);
  const [defaultBoxForAdd, setDefaultBoxForAdd] = useState<string | null>(null);
  const [newlyAddedTaskId, setNewlyAddedTaskId] = useState<string | null>(null);
  const [timelineEditingTask, setTimelineEditingTask] = useState<Task | null>(null);
  const [timelineSelectedEvent, setTimelineSelectedEvent] = useState<EventItem | null>(null);

  // Daily 5 Tasks Target state
  const [todayDoneCount, setTodayDoneCount] = useState<number>(0);
  const [celebrationCoords, setCelebrationCoords] = useState<{ x: number; y: number } | null>(null);
  const goalPillRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoadRef = useRef(true);

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
    localStorage.setItem('second_brain_wallpaper', wpId);
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
        if (!quickCaptureOpen && !searchOpen && !settingsOpen && !boxesOpen) {
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
        if (!quickCaptureOpen && !searchOpen && !settingsOpen && !boxesOpen) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }

      // 4. Boxes shortcut: 'B' or Persian 'ذ' (KeyB)
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === 'b' || e.key === 'B' || e.key === 'ذ' || e.code === 'KeyB')
      ) {
        if (!quickCaptureOpen && !searchOpen && !settingsOpen) {
          e.preventDefault();
          setBoxesOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [quickCaptureOpen, searchOpen, settingsOpen, boxesOpen]);


  // Parallelized fetch for day data
  const fetchDayData = useCallback(async (targetDateKey: string) => {
    try {
      const [allTags, allTasksList, allEventsList, dayEvents, allNotes, overdue, futureT] =
        await Promise.all([
          tagRepo.listAll(),
          taskRepo.list(),
          eventRepo.list(),
          eventRepo.list({ dateStr: targetDateKey }),
          noteRepo.list(),
          taskRepo.getOverdueOpen(targetDateKey),
          taskRepo.getFutureOpen(targetDateKey),
        ]);

      const tMap: Record<string, Tag> = {};
      allTags.forEach((t) => (tMap[t.id] = t));

      const pinnedT = allTasksList.filter((t) => t.pinned && t.status !== 'dropped');
      const pinnedN = allNotes.filter((n) => n.pinned);

      const dayTasks = allTasksList
        .filter(
          (t) => isTaskOccurringOnDate(t, targetDateKey) && t.status !== 'dropped' && !t.pinned
        )
        .map((t) => {
          if (t.recurrence_rule && t.recurrence_rule !== 'none') {
            const isDoneOnDate = (t.done_dates || []).includes(targetDateKey);
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

      const dSet = new Set<string>();
      allTasksList.forEach((t) => {
        if (t.status === 'dropped') return;
        if (t.recurrence_rule && t.recurrence_rule !== 'none') {
          for (let offset = -35; offset <= 65; offset++) {
            const dateStr = addJalaliDays(targetDateKey, offset);
            if (isTaskOccurringOnDate(t, dateStr)) {
              dSet.add(dateStr);
            }
          }
        } else {
          const dp = extractDateOnly(t.due_date);
          if (dp) dSet.add(dp);
        }
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
        // Only trigger celebratory burst if this is NOT initial mount AND user crossed the 5-task threshold AND hasn't celebrated today yet
        if (!isInitialLoadRef.current && prev < 5 && doneToday >= 5 && !alreadyCelebratedToday) {
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
    } catch (err) {
      console.error('Failed loading day data:', err);
    }
  }, []);

  const loadDayData = useCallback(async () => {
    await fetchDayData(selectedDateKey);
  }, [fetchDayData, selectedDateKey]);

  useEffect(() => {
    fetchDayData(selectedDateKey);
  }, [selectedDateKey, fetchDayData]);

  useEffect(() => {
    const init = async () => {
      await checkAndSeedDesignDemoData();
      await fetchDayData(selectedDateKey);
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

  const todayKey = getTodayJalaliKey();
  const selectedJalali = parseJalaliKey(selectedDateKey);
  const selectedGregorianDate = jalaliToDate(selectedJalali.jy, selectedJalali.jm, selectedJalali.jd);
  const currentWeekdayName = getFullPersianWeekdayName(selectedGregorianDate);
  const relativePrefix = getRelativeDayPrefix(selectedDateKey, todayKey);
  const isSelectedOtherThanToday = selectedDateKey !== todayKey;
  const isFriday = selectedGregorianDate.getDay() === 5;
  const isSelectedHoliday = isFriday || isOfficialHoliday(selectedDateKey);

  return (
    <AppContainer
      wallpaper={wallpaper}
      glassBackground={glassBackground}
      desktopPosition={desktopPosition}
    >
      {/* Floating dynamic toast notification */}
      <ToastContainer />

      {/* Scrollable Content Area with auto-hiding flush scrollbar */}
      <MobileScrollArea
        className="flex-1 min-h-0"
        contentClassName="pt-6 pb-24 flex flex-col min-h-full"
      >
        {activeTab === 'day' && (
          <>
            {/* Top Greeting Header & Weekly Strip (scrolls together with content) */}
            <div className="w-full shrink-0 select-none">
              {/* Top Greeting Header */}
              <div className="w-full pb-2 px-6">
                <div className="flex items-center justify-between min-h-[36px]">
                  {/* Right side: Relative Prefix + Chevron + Weekday Name + Teal/Red Dot */}
                  <div className="flex items-center gap-1.5">
                    {relativePrefix && (
                      <>
                        <span className="text-2xl font-normal text-muted-foreground/90 tracking-tight">
                          {relativePrefix}
                        </span>
                        <RiArrowLeftSLine className="w-5 h-5 text-muted-foreground/60 -mx-0.5" />
                      </>
                    )}
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                      {currentWeekdayName}
                    </h1>
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 transition-colors duration-200 ${
                        isSelectedHoliday
                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]'
                          : 'bg-primary'
                      }`}
                    />
                  </div>

                  {/* Left side: Daily goal counter pill + Capsule "بازگشت به امروز" button */}
                  <div className="flex items-center gap-1.5">
                    {/* Daily Goal Counter Pill (Smaller size, celebratory only at 5 tasks) */}
                    <div
                      ref={goalPillRef}
                      dir="ltr"
                      onClick={() => {
                        // Only celebrate if user has completed 5 tasks
                        if (todayDoneCount < 5) return;
                        if (goalPillRef.current) {
                          const rect = goalPillRef.current.getBoundingClientRect();
                          setCelebrationCoords({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                        } else {
                          setCelebrationCoords({ x: 80, y: 50 });
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 h-[25px] rounded-full transition-all select-none border ${
                        todayDoneCount >= 5
                          ? 'bg-primary/15 dark:bg-primary/20 text-primary border-primary/40 shadow-xs cursor-pointer hover:scale-105 active:scale-95'
                          : 'bg-muted/70 dark:bg-white/10 text-muted-foreground/85 border-transparent cursor-default'
                      }`}
                      title={
                        todayDoneCount >= 5
                          ? `تبریک! هدف روزانه تکمیل شد (${toPersianDigits(todayDoneCount)} از ۵)`
                          : `هدف روزانه: ۵ تسک (${toPersianDigits(todayDoneCount)} از ۵ تسک امروز انجام شد)`
                      }
                    >
                      <RiMedal2Line
                        className={`w-3.5 h-3.5 shrink-0 ${
                          todayDoneCount >= 5 ? 'text-primary' : 'text-muted-foreground/75'
                        }`}
                      />
                      <span className="font-semibold text-[11.5px] leading-none pt-0.5">
                        {toPersianDigits(todayDoneCount)}/۵
                      </span>
                    </div>

                    {/* Back to Today Button (visible when viewing any other day) */}
                    {isSelectedOtherThanToday && (
                      <button
                        onClick={() => setSelectedDateKey(todayKey)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-foreground text-[12px] font-normal border border-border shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-150"
                        title="بازگشت به امروز"
                      >
                        <span>امروز</span>
                        <RiCalendarEventLine className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground font-normal mt-1 text-right truncate" title={getDailyQuote(selectedDateKey)}>
                  {getDailyQuote(selectedDateKey)}
                </p>
              </div>

              {/* Weekly ribbon calendar */}
              <WeeklyStrip
                selectedDateKey={selectedDateKey}
                onSelectDate={setSelectedDateKey}
                datesWithItems={datesWithItems}
              />
            </div>

            {/* Daily 24-Hour Timeline Bar under WeeklyStrip */}
            <div className="w-full mb-3 overflow-visible">
              <DailyTimelineBar
                selectedDateKey={displayedDateKey}
                events={events}
                tasks={tasks}
                onSelectEvent={(ev) => setTimelineSelectedEvent(ev)}
                onSelectTask={(t) => setTimelineEditingTask(t)}
              />
            </div>

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
              onOpenAdd={() => setQuickCaptureOpen(true)}
              newlyAddedTaskId={newlyAddedTaskId}
            />
          </>
        )}

        {activeTab === 'notebook' && <NotebookView />}
      </MobileScrollArea>

      {/* Floating Bottom Navigation Dock in Liquid Glass Apple style */}
      <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
        <BottomDock
          activeTab={settingsOpen ? 'profile' : boxesOpen ? 'boxes' : activeTab}
          isBoxesOpen={boxesOpen}
          onTabChange={(tab) => {
            if (tab === 'profile') {
              setSettingsOpen((prev) => !prev);
              setBoxesOpen(false);
            } else if (tab === 'boxes') {
              setBoxesOpen((prev) => !prev);
              setSettingsOpen(false);
            } else {
              setSettingsOpen(false);
              setBoxesOpen(false);
              setActiveTab(tab);
            }
          }}
          onOpenAdd={() => setQuickCaptureOpen(true)}
        />
      </div>

      {/* Boxes Modal Sheet (matching design) */}
      <BoxesModal
        isOpen={boxesOpen}
        onClose={() => setBoxesOpen(false)}
        onOpenAddForBox={(boxId) => {
          setDefaultBoxForAdd(boxId);
          setQuickCaptureOpen(true);
        }}
        tagsMap={tagsMap}
      />

      {/* Settings / Profile Modal Sheet over bottom navigation */}
      <ProfileView
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentWallpaper={wallpaper}
        onWallpaperChange={handleWallpaperChange}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        glassBackground={glassBackground}
        onGlassBackgroundChange={handleGlassBackgroundChange}
        desktopPosition={desktopPosition}
        onDesktopPositionChange={handleDesktopPositionChange}
        onOpenSearch={() => {
          setSettingsOpen(false);
          setSearchOpen(true);
        }}
      />

      {/* Quick Capture Modal */}
      <QuickCaptureInput
        currentSelectedDateKey={selectedDateKey}
        onItemCreated={handleItemCreated}
        isOpen={quickCaptureOpen}
        onClose={() => {
          setQuickCaptureOpen(false);
          setDefaultBoxForAdd(null);
        }}
        onOpen={() => setQuickCaptureOpen(true)}
        defaultBoxId={defaultBoxForAdd}
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

      {/* Modals for Timeline Event / Task */}
      <EventDetailModal
        event={timelineSelectedEvent}
        isOpen={!!timelineSelectedEvent}
        onClose={() => setTimelineSelectedEvent(null)}
        onSaved={loadDayData}
      />

      {timelineEditingTask && (
        <TaskEditModal
          task={timelineEditingTask}
          isOpen={!!timelineEditingTask}
          onClose={() => setTimelineEditingTask(null)}
          onSaved={loadDayData}
        />
      )}

    </AppContainer>
  );
}

export default App;
