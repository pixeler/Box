import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiCircleFill,
  RiSubtractLine,
  RiCheckLine,
  RiLayoutColumnLine,
  RiListUnordered,
} from '@remixicon/react';
import { TodoKanban } from './TodoKanban';
import type { Task, Tag } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import { syncManager } from '@/lib/sync';
import { getTodayJalaliKey, toPersianDigits } from '@/lib/jalali';
import { TaskItemRow } from '@/components/stream/TaskItemRow';

interface TodoViewProps {
  onBackToToday?: () => void;
  onTaskChanged?: () => void;
  /** Lets the shell free the content width while the board is on screen. */
  onViewModeChange?: (mode: 'list' | 'kanban') => void;
}

type PriorityCategory = 'urgent' | 'medium' | 'low' | 'none';

export const TodoView: React.FC<TodoViewProps> = ({
  onBackToToday: _onBackToToday,
  onTaskChanged,
  onViewModeChange,
}) => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() =>
    typeof window !== 'undefined' && localStorage.getItem('box:todo-view') === 'kanban'
      ? 'kanban'
      : 'list'
  );

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  const changeViewMode = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    try {
      localStorage.setItem('box:todo-view', mode);
    } catch {
      /* Storage disabled: the switch simply stops remembering. */
    }
  };

  // Collapsible section states (all open by default)
  const [openSections, setOpenSections] = useState<Record<PriorityCategory, boolean>>({
    urgent: true,
    medium: true,
    low: true,
    none: true,
  });
  const [completedOpen, setCompletedOpen] = useState(false);

  // Drag and drop priority reordering state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<PriorityCategory | null>(null);

  const todayKey = getTodayJalaliKey();

  // Load all tasks and tags from Dexie
  const loadTasks = useCallback(async () => {
    try {
      const [taskList, tagList] = await Promise.all([
        taskRepo.list(),
        tagRepo.listAll(),
      ]);
      setAllTasks(taskList);
      const tMap: Record<string, Tag> = {};
      tagList.forEach((tag) => {
        tMap[tag.id] = tag;
      });
      setTagsMap(tMap);
      onTaskChanged?.();
    } catch (err) {
      console.error('Failed to load tasks in TodoView:', err);
    }
  }, [onTaskChanged]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    return syncManager.onDataChange(() => {
      loadTasks();
    });
  }, [loadTasks]);

  // Separate open tasks into priority groups and completed
  const { urgentTasks, mediumTasks, lowTasks, noneTasks, completedTasks } = useMemo(() => {
    const urgent: Task[] = [];
    const medium: Task[] = [];
    const low: Task[] = [];
    const none: Task[] = [];
    const completed: Task[] = [];

    allTasks.forEach((t) => {
      if (t.status === 'done') {
        completed.push(t);
      } else if (t.status === 'open') {
        if (t.priority === 3) urgent.push(t);
        else if (t.priority === 2) medium.push(t);
        else if (t.priority === 1) low.push(t);
        else none.push(t);
      }
    });

    return {
      urgentTasks: urgent,
      mediumTasks: medium,
      lowTasks: low,
      noneTasks: none,
      completedTasks: completed,
    };
  }, [allTasks]);

  const toggleSection = (cat: PriorityCategory) => {
    setOpenSections((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Drag and Drop between categories
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.setData('application/x-task-id', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOverCategory = (e: React.DragEvent, cat: PriorityCategory) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCategory !== cat) {
      setDragOverCategory(cat);
    }
  };

  const handleDragLeaveCategory = (e: React.DragEvent, cat: PriorityCategory) => {
    e.preventDefault();
    if (dragOverCategory === cat) {
      setDragOverCategory(null);
    }
  };

  const handleDropOnCategory = async (e: React.DragEvent, cat: PriorityCategory) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId =
      e.dataTransfer.getData('application/x-task-id') ||
      e.dataTransfer.getData('text/plain') ||
      draggedTaskId;

    setDragOverCategory(null);
    setDraggedTaskId(null);

    if (!taskId) return;

    let newPriority: 1 | 2 | 3 | undefined = undefined;
    if (cat === 'urgent') newPriority = 3;
    else if (cat === 'medium') newPriority = 2;
    else if (cat === 'low') newPriority = 1;

    try {
      await taskRepo.update(taskId, { priority: newPriority });
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task priority via drop:', err);
    }
  };

  // Section Header: Pill badge wrapping ONLY the word/icon/count like Tiimo screenshot
  const renderSectionHeader = (
    cat: PriorityCategory,
    label: string,
    count: number,
    icon: React.ReactNode,
    pillBgClass: string
  ) => {
    const isOpen = openSections[cat];

    return (
      <div className="flex items-center justify-between px-1 pt-3 pb-2.5">
        <button
          type="button"
          onClick={() => toggleSection(cat)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer active:scale-95 select-none transition ${pillBgClass}`}
        >
          {icon}
          <span className="text-foreground tracking-tight">{label}</span>
          <span className="text-foreground/75 font-normal">({toPersianDigits(count)})</span>
          {isOpen ? (
            <RiArrowDownSLine className="w-3.5 h-3.5 text-foreground/60" />
          ) : (
            <RiArrowUpSLine className="w-3.5 h-3.5 text-foreground/60" />
          )}
        </button>
      </div>
    );
  };

  // Render task list seamlessly with dashed line separators between items (exactly like DayStream)
  const renderTaskList = (tasks: Task[]) => {
    if (tasks.length === 0) {
      return (
        <div className="py-2 px-6 text-xs text-muted-foreground/45 select-none">
          موردی وجود ندارد
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col">
        {tasks.map((task, idx) => (
          <TaskItemRow
            key={task.id}
            task={task}
            tagsMap={tagsMap}
            currentDateKey={todayKey}
            onStatusChanged={loadTasks}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={() => {
              setDraggedTaskId(null);
              setDragOverCategory(null);
            }}
            isLast={idx === tasks.length - 1}
          />
        ))}
      </div>
    );
  };

  return (
    <div dir="rtl" className="w-full flex-1 flex flex-col justify-between day-slide-transition pb-28 select-none">
      <div>
        <div className="w-full px-5 pt-10 sm:px-6 sm:pt-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="truncate font-darvish text-[22px] font-semibold leading-8 tracking-normal text-foreground sm:text-[24px]">
                همه کارها
              </h1>

              <div
                role="group"
                aria-label="نمای کارها"
                className="flex h-8 items-center gap-0.5 rounded-lg border border-border/60 p-0.5"
              >
                {[
                  { key: 'list' as const, label: 'لیست', Icon: RiListUnordered },
                  { key: 'kanban' as const, label: 'کانبان', Icon: RiLayoutColumnLine },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeViewMode(key)}
                    aria-pressed={viewMode === key}
                    className={`flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors ${
                      viewMode === key
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11.5px] leading-5 text-muted-foreground">
            <span>{toPersianDigits(allTasks.filter((task) => task.status === 'open').length)} کار باز</span>
            <span>·</span>
            <span>{toPersianDigits(completedTasks.length)} انجام‌شده</span>
          </div>
        </div>

        {/* 2. Priority Sections: Completely clean stream like DayStream, with pill badges for titles */}
        {viewMode === 'kanban' ? (
          <TodoKanban tasks={allTasks} onChanged={loadTasks} />
        ) : (
        <div className="w-full space-y-2 select-none">
          {/* -------------------------------------------------------------
              CATEGORY 1: فوری (Priority 3) -> فلش رو به بالا
             ------------------------------------------------------------- */}
          <div
            onDragOver={(e) => handleDragOverCategory(e, 'urgent')}
            onDragLeave={(e) => handleDragLeaveCategory(e, 'urgent')}
            onDrop={(e) => handleDropOnCategory(e, 'urgent')}
            className={`w-full transition-colors duration-150 ${
              dragOverCategory === 'urgent' ? 'bg-rose-500/5' : ''
            }`}
          >
            {renderSectionHeader(
              'urgent',
              'فوری',
              urgentTasks.length,
              <RiArrowUpLine className="w-3.5 h-3.5 text-rose-500 stroke-[2.5]" />,
              'bg-rose-500/15 dark:bg-rose-500/25 hover:bg-rose-500/20'
            )}

            {openSections.urgent && renderTaskList(urgentTasks)}
          </div>

          {/* -------------------------------------------------------------
              CATEGORY 2: متوسط (Priority 2) -> دایره
             ------------------------------------------------------------- */}
          <div
            onDragOver={(e) => handleDragOverCategory(e, 'medium')}
            onDragLeave={(e) => handleDragLeaveCategory(e, 'medium')}
            onDrop={(e) => handleDropOnCategory(e, 'medium')}
            className={`w-full transition-colors duration-150 ${
              dragOverCategory === 'medium' ? 'bg-amber-500/5' : ''
            }`}
          >
            {renderSectionHeader(
              'medium',
              'متوسط',
              mediumTasks.length,
              <RiCircleFill className="w-2 h-2 text-amber-500" />,
              'bg-amber-500/15 dark:bg-amber-500/25 hover:bg-amber-500/20'
            )}

            {openSections.medium && renderTaskList(mediumTasks)}
          </div>

          {/* -------------------------------------------------------------
              CATEGORY 3: کم (Priority 1) -> جهت پایین
             ------------------------------------------------------------- */}
          <div
            onDragOver={(e) => handleDragOverCategory(e, 'low')}
            onDragLeave={(e) => handleDragLeaveCategory(e, 'low')}
            onDrop={(e) => handleDropOnCategory(e, 'low')}
            className={`w-full transition-colors duration-150 ${
              dragOverCategory === 'low' ? 'bg-blue-500/5' : ''
            }`}
          >
            {renderSectionHeader(
              'low',
              'کم',
              lowTasks.length,
              <RiArrowDownLine className="w-3.5 h-3.5 text-blue-500 stroke-[2.5]" />,
              'bg-blue-500/15 dark:bg-blue-500/25 hover:bg-blue-500/20'
            )}

            {openSections.low && renderTaskList(lowTasks)}
          </div>

          {/* -------------------------------------------------------------
              CATEGORY 4: بدون اولویت (No Priority)
             ------------------------------------------------------------- */}
          <div
            onDragOver={(e) => handleDragOverCategory(e, 'none')}
            onDragLeave={(e) => handleDragLeaveCategory(e, 'none')}
            onDrop={(e) => handleDropOnCategory(e, 'none')}
            className={`w-full transition-colors duration-150 ${
              dragOverCategory === 'none' ? 'bg-muted/30' : ''
            }`}
          >
            {renderSectionHeader(
              'none',
              'بدون اولویت',
              noneTasks.length,
              <RiSubtractLine className="w-3.5 h-3.5 text-muted-foreground stroke-[2]" />,
              'bg-muted/80 dark:bg-white/10 hover:bg-muted'
            )}

            {openSections.none && renderTaskList(noneTasks)}
          </div>

          {/* -------------------------------------------------------------
              CATEGORY 5: انجام شده‌ها (Completed Tasks)
             ------------------------------------------------------------- */}
          {completedTasks.length > 0 && (
            <div className="w-full pt-1">
              <div className="flex items-center justify-between px-1 pt-3 pb-2.5">
                <button
                  type="button"
                  onClick={() => setCompletedOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer active:scale-95 select-none transition bg-emerald-500/15 dark:bg-emerald-500/25 hover:bg-emerald-500/20"
                >
                  <RiCheckLine className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                  <span className="text-foreground tracking-tight">انجام‌شده‌ها</span>
                  <span className="text-foreground/75 font-normal">({toPersianDigits(completedTasks.length)})</span>
                  {completedOpen ? (
                    <RiArrowDownSLine className="w-3.5 h-3.5 text-foreground/60" />
                  ) : (
                    <RiArrowUpSLine className="w-3.5 h-3.5 text-foreground/60" />
                  )}
                </button>
              </div>

              {completedOpen && (
                <div className="w-full flex flex-col opacity-75">
                  {completedTasks.map((task, idx) => (
                    <TaskItemRow
                      key={task.id}
                      task={task}
                      tagsMap={tagsMap}
                      currentDateKey={todayKey}
                      onStatusChanged={loadTasks}
                      isLast={idx === completedTasks.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
