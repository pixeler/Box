import { useState, useEffect, useCallback } from 'react';
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
import { ToastContainer } from './components/ui/Toast';
import { taskRepo, noteRepo, eventRepo, tagRepo } from './repositories';
import { RiCalendarEventLine, RiArrowLeftSLine } from '@remixicon/react';
import {
  getTodayJalaliKey,
  formatJalaliKey,
  getJalaliDate,
  parseJalaliKey,
  jalaliToDate,
  getFullPersianWeekdayName,
  getRelativeDayPrefix,
  extractDateOnly,
} from './lib/jalali';
import { checkAndSeedDesignDemoData } from './lib/seed';
import { type ThemeId, getStoredTheme, applyTheme } from './lib/theme';
import type { Task, EventItem, Note, Tag } from './types/models';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('day');
  // Initialize dynamically to today's actual Shamsi date
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getTodayJalaliKey());
  const [displayedDateKey, setDisplayedDateKey] = useState<string>(() => getTodayJalaliKey());
  const [wallpaper, setWallpaper] = useState<string>(() => {
    return localStorage.getItem('second_brain_wallpaper') || WALLPAPER_LIST[0].id;
  });
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

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
        if (!quickCaptureOpen && !searchOpen && !settingsOpen) {
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
        if (!quickCaptureOpen && !searchOpen && !settingsOpen) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [quickCaptureOpen, searchOpen, settingsOpen]);

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

      const dayTasks = allTasksList.filter(
        (t) => extractDateOnly(t.due_date) === targetDateKey && t.status !== 'dropped' && !t.pinned
      );

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
        const dp = extractDateOnly(t.due_date);
        if (dp && t.status !== 'dropped') dSet.add(dp);
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

  const todayKey = getTodayJalaliKey();
  const selectedJalali = parseJalaliKey(selectedDateKey);
  const selectedGregorianDate = jalaliToDate(selectedJalali.jy, selectedJalali.jm, selectedJalali.jd);
  const currentWeekdayName = getFullPersianWeekdayName(selectedGregorianDate);
  const relativePrefix = getRelativeDayPrefix(selectedDateKey, todayKey);
  const isSelectedOtherThanToday = selectedDateKey !== todayKey;

  return (
    <AppContainer wallpaper={wallpaper}>
      {/* Floating dynamic toast notification */}
      <ToastContainer />

      {/* Scrollable Content Area with auto-hiding flush scrollbar */}
      <MobileScrollArea contentClassName="pt-6 pb-24 flex flex-col min-h-full">
        {activeTab === 'day' && (
          <>
            {/* Top Greeting Header */}
            <div className="w-full pb-2 px-6 select-none">
              <div className="flex items-center justify-between min-h-[36px]">
                {/* Right side: Relative Prefix + Chevron + Weekday Name + Teal Dot */}
                <div className="flex items-center gap-1.5">
                  {relativePrefix && (
                    <>
                      <span className="text-xl md:text-2xl font-normal text-muted-foreground">
                        {relativePrefix}
                      </span>
                      <RiArrowLeftSLine className="w-5 h-5 text-muted-foreground -mx-0.5" />
                    </>
                  )}
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {currentWeekdayName}
                  </h1>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0" />
                </div>

                {/* Left side: Capsule "بازگشت به امروز" button (visible when viewing any other day) */}
                {isSelectedOtherThanToday && (
                  <button
                    onClick={() => setSelectedDateKey(todayKey)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-foreground text-[12px] font-medium border border-border shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-150"
                    title="بازگشت به امروز"
                  >
                    <span>بازگشت به امروز</span>
                    <RiCalendarEventLine className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground font-normal mt-1 text-right">
                هر روزی که شروع میشه یک فرصت تازه است!
              </p>
            </div>

            {/* Weekly ribbon calendar */}
            <WeeklyStrip
              selectedDateKey={selectedDateKey}
              onSelectDate={setSelectedDateKey}
              datesWithItems={datesWithItems}
            />

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
            />
          </>
        )}

        {activeTab === 'notebook' && <NotebookView />}
      </MobileScrollArea>

      {/* Floating Bottom Navigation Dock in Liquid Glass Apple style */}
      <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
        <BottomDock
          activeTab={settingsOpen ? 'profile' : activeTab}
          onTabChange={(tab) => {
            if (tab === 'profile') {
              setSettingsOpen((prev) => !prev);
            } else {
              setSettingsOpen(false);
              setActiveTab(tab);
            }
          }}
          onOpenAdd={() => setQuickCaptureOpen(true)}
        />
      </div>

      {/* Settings / Profile Modal Sheet over bottom navigation */}
      <ProfileView
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentWallpaper={wallpaper}
        onWallpaperChange={handleWallpaperChange}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        onOpenSearch={() => {
          setSettingsOpen(false);
          setSearchOpen(true);
        }}
      />

      {/* Quick Capture Modal */}
      <QuickCaptureInput
        currentSelectedDateKey={selectedDateKey}
        onItemCreated={loadDayData}
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onOpen={() => setQuickCaptureOpen(true)}
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
    </AppContainer>
  );
}

export default App;
