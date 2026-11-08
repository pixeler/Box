import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task, Tag } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import { syncManager } from '@/lib/sync';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { TodoView } from '@/components/todo/TodoView';
import { MobileScrollArea } from '@/components/layout/MobileScrollArea';
import {
  PERSIAN_MONTH_NAMES,
  addJalaliDays,
  formatJalaliKey,
  getFullPersianWeekdayName,
  getJalaliMonthLength,
  jalaliToDate,
  parseJalaliKey,
  toPersianDigits,
} from '@/lib/jalali';
import { isTaskOccurringOnDate } from '@/lib/recurrence';
import { Plus, CalendarDays } from 'lucide-react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiLayoutColumnLine, RiListUnordered } from '@remixicon/react';

/** The one place tasks live: a period, or the whole list. */
export type TaskRange = 'today' | 'week' | 'month' | 'year' | 'all';

/** Periods the calendar can draw; «امروز» always uses the day stream. */
type CalendarMode = 'week' | 'month' | 'year';

interface TasksViewProps {
  range: TaskRange;
  onRangeChange: (range: TaskRange) => void;
  selectedDateKey: string;
  onSelectDate: (key: string) => void;
  onOpenAdd: () => void;
  /** Today keeps its own stream: pinned cards, events, notes and the quote. */
  todayContent: React.ReactNode;
  /** The Jalali calendar for this period, drawn full width. */
  renderCalendar: (mode: CalendarMode) => React.ReactNode;
  onTaskChanged?: () => void;
}

const RANGES: { id: TaskRange; label: string }[] = [
  { id: 'today', label: 'روز' },
  { id: 'week', label: 'هفته' },
  { id: 'month', label: 'ماه' },
  { id: 'year', label: 'سال' },
  { id: 'all', label: 'همه' },
];

interface TaskGroup {
  key: string;
  title: string;
  tasks: Task[];
}

const readStored = (key: string, allowed: string[], fallback: string): string => {
  try {
    const saved = localStorage.getItem(key);
    if (saved && allowed.includes(saved)) return saved;
  } catch {
    /* Storage disabled: the default applies. */
  }
  return fallback;
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage disabled: the choice simply stops remembering. */
  }
};

/** "۱۶ آبان" — a day without repeating the year on every row. */
const dayLabel = (key: string): string => {
  const j = parseJalaliKey(key);
  const weekday = getFullPersianWeekdayName(jalaliToDate(j.jy, j.jm, j.jd));
  return `${weekday} ${toPersianDigits(j.jd)} ${PERSIAN_MONTH_NAMES[j.jm - 1]}`;
};

/**
 * What the centred title says: the period itself, with one small line of
 * context underneath. The arrows live next to it, so the title keeps the same
 * anchor while the period and view switches change around the header.
 */
const periodHeading = (
  key: string,
  range: TaskRange,
  openCount: number
): { title: string; subtitle: string } => {
  const j = parseJalaliKey(key);

  if (range === 'today') {
    return {
      title: getFullPersianWeekdayName(jalaliToDate(j.jy, j.jm, j.jd)),
      subtitle: `${toPersianDigits(j.jd)} ${PERSIAN_MONTH_NAMES[j.jm - 1]} ${toPersianDigits(j.jy)}`,
    };
  }

  if (range === 'week') {
    const end = parseJalaliKey(addJalaliDays(key, 6));
    const startDay = toPersianDigits(j.jd);
    const endDay = toPersianDigits(end.jd);
    return {
      title:
        end.jm === j.jm
          ? `${startDay} تا ${endDay} ${PERSIAN_MONTH_NAMES[j.jm - 1]}`
          : `${startDay} ${PERSIAN_MONTH_NAMES[j.jm - 1]} تا ${endDay} ${PERSIAN_MONTH_NAMES[end.jm - 1]}`,
      subtitle: `${PERSIAN_MONTH_NAMES[j.jm - 1]} ${toPersianDigits(j.jy)}`,
    };
  }

  if (range === 'month') {
    return { title: PERSIAN_MONTH_NAMES[j.jm - 1], subtitle: toPersianDigits(j.jy) };
  }

  if (range === 'year') {
    return { title: toPersianDigits(j.jy), subtitle: '' };
  }

  return { title: 'همه کارها', subtitle: `${toPersianDigits(openCount)} باز` };
};

/** Moves the selected day by one page of the current range. */
const shiftPeriod = (key: string, range: TaskRange, direction: 1 | -1): string => {
  if (range === 'week') return addJalaliDays(key, 7 * direction);

  const j = parseJalaliKey(key);

  if (range === 'month') {
    let month = j.jm + direction;
    let year = j.jy;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }
    const day = Math.min(j.jd, getJalaliMonthLength(year, month));
    return formatJalaliKey({ jy: year, jm: month, jd: day });
  }

  if (range === 'year') {
    const year = j.jy + direction;
    const day = Math.min(j.jd, getJalaliMonthLength(year, j.jm));
    return formatJalaliKey({ jy: year, jm: j.jm, jd: day });
  }

  return addJalaliDays(key, direction);
};

/**
 * «کارها»: today, a week, a month, a year, or every task. The header is a
 * three-slot grid — the title sits in the middle and never moves, while the
 * period and the view switches change around it. Lists and the board share one
 * reading width; only the calendar takes the whole window, the way the old
 * calendar screen did.
 */
export const TasksView: React.FC<TasksViewProps> = ({
  range,
  onRangeChange,
  selectedDateKey,
  onSelectDate,
  onOpenAdd,
  todayContent,
  renderCalendar,
  onTaskChanged,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [view, setView] = useState<'list' | 'board'>(() =>
    readStored('box:tasks-all-view-mode', ['list', 'board'], 'board') as 'list' | 'board'
  );
  const [periodView, setPeriodView] = useState<'list' | 'calendar'>(() =>
    readStored('box:tasks-period-view-mode', ['list', 'calendar'], 'calendar') as 'list' | 'calendar'
  );

  const load = useCallback(async () => {
    try {
      const [taskList, tagList] = await Promise.all([taskRepo.list(), tagRepo.listAll()]);
      setTasks(taskList);
      const next: Record<string, Tag> = {};
      tagList.forEach((tag) => (next[tag.id] = tag));
      setTagsMap(next);
    } catch (err) {
      console.error('Failed to load tasks for the tasks view:', err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => syncManager.onDataChange(() => void load()), [load]);

  const changeView = (next: 'list' | 'board') => {
    setView(next);
    writeStored('box:tasks-all-view-mode', next);
  };

  const changePeriodView = (next: 'list' | 'calendar') => {
    setPeriodView(next);
    writeStored('box:tasks-period-view-mode', next);
  };

  const refresh = useCallback(() => {
    void load();
    onTaskChanged?.();
  }, [load, onTaskChanged]);

  const groups = useMemo<TaskGroup[]>(() => {
    const active = tasks.filter((task) => task.status !== 'dropped');

    if (range === 'week') {
      return Array.from({ length: 7 }, (_, index) => addJalaliDays(selectedDateKey, index)).map(
        (key) => ({
          key,
          title: dayLabel(key),
          tasks: active.filter((task) => isTaskOccurringOnDate(task, key)),
        })
      );
    }

    if (range === 'month') {
      const j = parseJalaliKey(selectedDateKey);
      const length = getJalaliMonthLength(j.jy, j.jm);
      const out: TaskGroup[] = [];
      for (let day = 1; day <= length; day += 1) {
        const key = formatJalaliKey({ jy: j.jy, jm: j.jm, jd: day });
        const list = active.filter((task) => isTaskOccurringOnDate(task, key));
        if (list.length) out.push({ key, title: dayLabel(key), tasks: list });
      }
      return out;
    }

    if (range === 'year') {
      const j = parseJalaliKey(selectedDateKey);
      const out: TaskGroup[] = [];
      for (let month = 1; month <= 12; month += 1) {
        const length = getJalaliMonthLength(j.jy, month);
        const list: Task[] = [];
        const seen = new Set<string>();
        for (let day = 1; day <= length; day += 1) {
          const key = formatJalaliKey({ jy: j.jy, jm: month, jd: day });
          active.forEach((task) => {
            if (seen.has(task.id)) return;
            if (isTaskOccurringOnDate(task, key)) {
              seen.add(task.id);
              list.push(task);
            }
          });
        }
        if (list.length) {
          out.push({
            key: `m-${month}`,
            title: `${PERSIAN_MONTH_NAMES[month - 1]} ${toPersianDigits(j.jy)}`,
            tasks: list,
          });
        }
      }
      return out;
    }

    return [];
  }, [tasks, range, selectedDateKey]);

  const openCount = useMemo(() => tasks.filter((task) => task.status === 'open').length, [tasks]);

  const { title: periodTitle, subtitle: periodSubtitle } = periodHeading(
    selectedDateKey,
    range,
    openCount
  );

  const calendarRange = range === 'week' || range === 'month' || range === 'year';
  const showingCalendar = calendarRange && periodView === 'calendar';

  const switchButton = (active: boolean) =>
    `flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors ${
      active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`;

  const switcher = calendarRange ? (
    <div
      role="group"
      aria-label="نمای دوره"
      className="flex h-8 items-center gap-0.5 rounded-lg border border-border/60 p-0.5"
    >
      <button
        type="button"
        onClick={() => changePeriodView('list')}
        aria-pressed={periodView === 'list'}
        className={switchButton(periodView === 'list')}
      >
        <RiListUnordered className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">فهرست</span>
      </button>
      <button
        type="button"
        onClick={() => changePeriodView('calendar')}
        aria-pressed={periodView === 'calendar'}
        className={switchButton(periodView === 'calendar')}
      >
        <CalendarDays className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">تقویم</span>
      </button>
    </div>
  ) : range === 'all' ? (
    <div
      role="group"
      aria-label="نمای کارها"
      className="flex h-8 items-center gap-0.5 rounded-lg border border-border/60 p-0.5"
    >
      <button
        type="button"
        onClick={() => changeView('list')}
        aria-pressed={view === 'list'}
        className={switchButton(view === 'list')}
      >
        <RiListUnordered className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">لیست</span>
      </button>
      <button
        type="button"
        onClick={() => changeView('board')}
        aria-pressed={view === 'board'}
        className={switchButton(view === 'board')}
      >
        <RiLayoutColumnLine className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">تخته</span>
      </button>
    </div>
  ) : null;

  return (
    <div dir="rtl" className="flex min-h-0 w-full flex-1 flex-col">
      {/* Fixed three-slot header: the title is in the same place in every view,
          so switching period or view never shifts the page's anchor. */}
      <header className="w-full shrink-0 px-5 pt-8 sm:px-6 sm:pt-10">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Right (start in RTL): the period switch. */}
          <div className="no-scrollbar flex min-w-0 items-center gap-[2px] overflow-x-auto">
            {RANGES.map((item) => {
              const active = item.id === range;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRangeChange(item.id)}
                  aria-pressed={active}
                  className={`h-8 min-w-[52px] shrink-0 rounded-full px-2.5 text-center text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Centre: the period itself. The arrows hug the title, so the title
              keeps the same anchor while the sides change. */}
          <div className="flex min-w-0 items-center gap-0.5">
            {range !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectDate(shiftPeriod(selectedDateKey, range, -1))}
                title="قبلی"
                aria-label="قبلی"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <RiArrowRightSLine className="size-4" />
              </button>
            )}

            <div className="min-w-0 px-1 text-center">
              <h1 className="truncate whitespace-nowrap font-darvish text-[22px] font-semibold leading-7 tracking-normal text-foreground sm:text-[24px] sm:leading-8">
                {periodTitle}
              </h1>
              {periodSubtitle ? (
                <p className="truncate text-[11px] leading-4 text-muted-foreground">
                  {periodSubtitle}
                </p>
              ) : null}
            </div>

            {range !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectDate(shiftPeriod(selectedDateKey, range, 1))}
                title="بعدی"
                aria-label="بعدی"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <RiArrowLeftSLine className="size-4" />
              </button>
            )}
          </div>

          {/* Left (end): how this period is shown, and the way in to add. */}
          <div className="flex items-center justify-end gap-1.5">
            {switcher}
            <button
              type="button"
              onClick={onOpenAdd}
              title="افزودن کار (T)"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <Plus className="size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {showingCalendar ? (
        <div key={`calendar-${range}`} className="tab-pane min-h-0 w-full flex-1 overflow-hidden">
          {renderCalendar(range as CalendarMode)}
        </div>
      ) : (
        <MobileScrollArea
          className="flex-1"
          contentClassName="mx-auto w-full max-w-[1000px] pb-0 pt-0 flex min-h-full flex-col"
        >
          <div key={`${range}-${view}`} className="tab-pane flex w-full flex-1 flex-col pt-3">
            {range === 'all' ? (
              <TodoView
                chromeless
                viewMode={view === 'board' ? 'kanban' : 'list'}
                onViewModeChange={(mode) => changeView(mode === 'kanban' ? 'board' : 'list')}
                onTaskChanged={refresh}
              />
            ) : range === 'today' ? (
              todayContent
            ) : groups.length === 0 ? (
              <p className="px-1 py-10 text-center text-[12.5px] text-muted-foreground">
                {range === 'year' ? 'امسال کاری ثبت نشده' : 'در این دوره کاری ثبت نشده'}
              </p>
            ) : (
              <div className="w-full px-5 pb-28 sm:px-6">
                {groups.map((group) => (
                  <section key={group.key} className="w-full pt-3 first:pt-0">
                    <div className="flex items-baseline gap-2 px-1 pb-1">
                      <h2 className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                        {group.title}
                      </h2>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {toPersianDigits(group.tasks.length)}
                      </span>
                    </div>

                    {group.tasks.length === 0 ? (
                      <p className="px-1 pb-1 text-[11.5px] text-muted-foreground/50">خالی</p>
                    ) : (
                      <div className="flex w-full flex-col">
                        {group.tasks.map((task, index) => (
                          <TaskItemRow
                            key={`${group.key}-${task.id}`}
                            task={task}
                            tagsMap={tagsMap}
                            currentDateKey={group.key}
                            onStatusChanged={refresh}
                            isLast={index === group.tasks.length - 1}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        </MobileScrollArea>
      )}
    </div>
  );
};
