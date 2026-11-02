import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { taskRepo } from '@/repositories';
import type { Task } from '@/types/models';
import {
  addJalaliDays,
  formatTaskDateDisplay,
  toPersianDigits,
} from '@/lib/jalali';
import { buildTaskGroups } from '@/lib/taskGroups';
import {
  RiAlarmWarningLine,
  RiCalendarEventLine,
  RiCalendarLine,
  RiCalendarScheduleLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxCircleFill,
  RiCloseLine,
  RiLoader4Line,
  RiPlayListAddLine,
  RiSearchLine,
  RiSunLine,
  RiTaskLine,
} from '@remixicon/react';

/** Caret position (viewport coordinates) where the slash menu was opened. */
export interface TaskPickerAnchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TaskPickerPanelProps {
  anchor: TaskPickerAnchor;
  /** Adds the chosen tasks (one, or a whole group) to the note. */
  onSelectTasks: (tasks: Task[], options?: { title?: string; addDueDate?: string }) => void;
  /** Starts a new, named task list inside the note. */
  onCreateList: () => void;
  onClose: () => void;
}

const PANEL_WIDTH = 304;
const PANEL_MAX_HEIGHT = 420;
const EDGE_MARGIN = 10;

const matchesQuery = (task: Task, query: string) =>
  !query ||
  task.title.toLowerCase().includes(query) ||
  (task.description || '').toLowerCase().includes(query);

interface TaskGroupPreset {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tasks: Task[];
  /** Due date for tasks added inline under the inserted list. */
  addDueDate?: string;
}

type PickerOption =
  | { kind: 'group'; group: TaskGroupPreset }
  | { kind: 'newList' }
  | { kind: 'task'; task: Task };

/**
 * The task submenu of the slash menu: all tasks in one searchable panel, plus
 * one-click groups (today, tomorrow, overdue, later) that drop a whole list in.
 */
export const TaskPickerPanel: React.FC<TaskPickerPanelProps> = ({
  anchor,
  onSelectTasks,
  onCreateList,
  onClose,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await taskRepo.list();
        if (alive) setTasks(all);
      } catch (err) {
        console.error('Failed to load tasks for the task picker:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo<TaskGroupPreset[]>(() => {
    const buckets = buildTaskGroups(tasks);

    const presets: TaskGroupPreset[] = [
      {
        key: 'today',
        label: 'تسک‌های امروز',
        Icon: RiSunLine,
        tasks: buckets.today,
        addDueDate: buckets.todayKey,
      },
      {
        key: 'tomorrow',
        label: 'تسک‌های فردا',
        Icon: RiCalendarEventLine,
        tasks: buckets.tomorrow,
      },
      {
        key: 'overdue',
        label: 'تسک‌های عقب‌افتاده',
        Icon: RiAlarmWarningLine,
        tasks: buckets.overdue,
      },
      {
        key: 'future',
        label: 'تسک‌های آینده',
        Icon: RiCalendarScheduleLine,
        tasks: buckets.future,
        addDueDate: addJalaliDays(buckets.todayKey, 7),
      },
    ];

    return presets.filter((preset) => preset.tasks.length > 0);
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => matchesQuery(task, q));
  }, [tasks, query]);

  // Group rows step aside while the user searches, so arrows stay predictable.
  const options = useMemo<PickerOption[]>(() => {
    const taskOptions = filtered.map((task) => ({ kind: 'task', task }) as PickerOption);
    if (query.trim()) return taskOptions;

    return [
      { kind: 'newList' } as PickerOption,
      ...groups.map((group) => ({ kind: 'group', group }) as PickerOption),
      ...taskOptions,
    ];
  }, [groups, filtered, query]);

  // Position of each task in the filtered list (drives the "done" divider).
  const filteredIndexById = useMemo(() => {
    const index = new Map<string, number>();
    filtered.forEach((task, position) => index.set(task.id, position));
    return index;
  }, [filtered]);

  const firstDoneIndex = useMemo(
    () => filtered.findIndex((task) => task.status === 'done'),
    [filtered]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the highlighted row inside the scroll area.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, options.length]);

  // Close on an outside click or when the editor/page moves under the panel.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onReflow = () => onClose();

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [onClose]);

  const style = useMemo<React.CSSProperties>(() => {
    // The note window is a stacked overlay above z=200, so a fixed 160 would
    // hide this panel behind it in the desktop shell.
    const noteLayer = document.querySelector('[data-overlay-root]');
    const noteZ = noteLayer ? Number(getComputedStyle(noteLayer).zIndex) : 0;
    const zIndex = Number.isFinite(noteZ) && noteZ > 0 ? noteZ + 30 : 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - anchor.bottom;
    const spaceAbove = anchor.top;
    const placeAbove = spaceBelow < 300 && spaceAbove > spaceBelow;

    // RTL: the panel's right edge lines up with the caret.
    const right = Math.min(
      Math.max(EDGE_MARGIN, vw - anchor.right),
      Math.max(EDGE_MARGIN, vw - PANEL_WIDTH - EDGE_MARGIN)
    );
    const maxHeight = Math.max(
      200,
      Math.min(PANEL_MAX_HEIGHT, (placeAbove ? spaceAbove : spaceBelow) - 16)
    );

    return placeAbove
      ? {
          position: 'fixed',
          right,
          bottom: Math.max(EDGE_MARGIN, vh - anchor.top + 6),
          width: PANEL_WIDTH,
          maxHeight,
          zIndex,
        }
      : {
          position: 'fixed',
          right,
          top: Math.max(EDGE_MARGIN, anchor.bottom + 6),
          width: PANEL_WIDTH,
          maxHeight,
          zIndex,
        };
  }, [anchor]);

  const choose = (option: PickerOption | undefined) => {
    if (!option) return;

    if (option.kind === 'newList') {
      onCreateList();
      return;
    }

    if (option.kind === 'group') {
      onSelectTasks(option.group.tasks, {
        title: option.group.label,
        addDueDate: option.group.addDueDate,
      });
      return;
    }

    onSelectTasks([option.task]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      setActiveIndex((current) => {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        return (current + step + options.length) % options.length;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      choose(options[activeIndex]);
    }
  };

  const firstGroupIndex = options.findIndex((option) => option.kind === 'group');

  return createPortal(
    <div
      ref={panelRef}
      dir="rtl"
      data-task-picker=""
      onKeyDown={handleKeyDown}
      style={style}
      className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
          <RiTaskLine className="size-4 shrink-0" />
          <span className="truncate">افزودن تسک به یادداشت</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="بستن"
          aria-label="بستن"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RiCloseLine className="size-4" />
        </button>
      </div>

      <div className="px-2.5 pt-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 px-2">
          <RiSearchLine className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی تسک…"
            className="w-full bg-transparent py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-muted-foreground">
            <RiLoader4Line className="size-3.5 animate-spin" />
            در حال بارگذاری تسک‌ها...
          </div>
        )}


        {!loading && tasks.length === 0 && (
          <div className="px-2 py-6 text-center text-[11.5px] leading-6 text-muted-foreground">
            هنوز تسکی نساخته‌اید
          </div>
        )}

        {!loading && tasks.length > 0 && filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-[11.5px] leading-6 text-muted-foreground">
            تسکی با این عنوان پیدا نشد
          </div>
        )}

        {!loading &&
          options.map((option, index) => {
            const isActive = index === activeIndex;
            const rowClass = `flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-right transition-colors ${
              isActive ? 'bg-secondary' : ''
            }`;
            const groupHeading =
              index === firstGroupIndex ? (
                <div className="px-2 pb-1 pt-2 text-[10px] font-semibold text-muted-foreground">
                  افزودن گروهی
                </div>
              ) : null;

            if (option.kind === 'newList') {
              return (
                <React.Fragment key="new-list">
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                    className={rowClass}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                      <RiPlayListAddLine className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                      لیست تسک جدید
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">داخل یادداشت</span>
                  </button>
                </React.Fragment>
              );
            }

            if (option.kind === 'group') {
              const { key, label, Icon, tasks: groupTasks } = option.group;
              return (
                <React.Fragment key={`group-${key}`}>
                  {groupHeading}
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                    className={rowClass}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                      {label}
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {toPersianDigits(groupTasks.length)}
                    </span>
                  </button>
                </React.Fragment>
              );
            }

            const task = option.task;
            const taskIndex = filteredIndexById.get(task.id) ?? -1;
            const isDone = task.status === 'done';
            const showDoneLabel = isDone && taskIndex === firstDoneIndex;
            const meta = formatTaskDateDisplay(
              task.due_date,
              undefined,
              true,
              task.due_time,
              task.duration_minutes
            );

            return (
              <React.Fragment key={task.id}>
                {showDoneLabel && (
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold text-muted-foreground">
                    انجام‌شده
                  </div>
                )}
                <button
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={rowClass}
                >
                  {isDone ? (
                    <RiCheckboxCircleFill className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <RiCheckboxBlankCircleLine className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[12px] ${
                        isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {task.title || 'بدون عنوان'}
                    </span>
                    {meta && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <RiCalendarLine className="size-3 shrink-0" />
                        <span className="truncate">{meta}</span>
                      </span>
                    )}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
      </div>

      <div className="border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground/80">
        Enter افزودن · Esc بستن
      </div>
    </div>,
    document.body
  );
};
