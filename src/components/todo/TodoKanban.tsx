import React, { useMemo, useState } from 'react';
import type { Task } from '@/types/models';
import { taskRepo } from '@/repositories';
import { cn } from '@/lib/utils';
import { formatTaskDateDisplay, toPersianDigits } from '@/lib/jalali';
import { TaskEditModal } from '@/components/task/LazyTaskEditModal';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCalendarEventLine,
  RiCircleFill,
  RiSubtractLine,
} from '@remixicon/react';

type PriorityCategory = 'urgent' | 'medium' | 'low' | 'none';

const COLUMNS: Array<{
  key: PriorityCategory;
  title: string;
  badge: string;
  accent: string;
  icon: React.ReactNode;
  priority?: 1 | 2 | 3;
}> = [
  {
    key: 'urgent',
    title: 'فوری',
    badge: 'bg-rose-500/15 dark:bg-rose-500/25',
    accent: 'text-rose-500',
    icon: <RiArrowUpLine className="size-3.5 stroke-[2.5]" />,
    priority: 3,
  },
  {
    key: 'medium',
    title: 'متوسط',
    badge: 'bg-amber-500/15 dark:bg-amber-500/25',
    accent: 'text-amber-500',
    icon: <RiCircleFill className="size-2" />,
    priority: 2,
  },
  {
    key: 'low',
    title: 'کم',
    badge: 'bg-blue-500/15 dark:bg-blue-500/25',
    accent: 'text-blue-500',
    icon: <RiArrowDownLine className="size-3.5 stroke-[2.5]" />,
    priority: 1,
  },
  {
    key: 'none',
    title: 'بدون اولویت',
    badge: 'bg-muted/80 dark:bg-white/10',
    accent: 'text-muted-foreground',
    icon: <RiSubtractLine className="size-3.5" />,
  },
];

interface TodoKanbanProps {
  tasks: Task[];
  onChanged: () => void | Promise<void>;
}

/**
 * The board view of "همه کارها": one column per priority, cards dragged between
 * columns to change the priority of the task behind them.
 */
export const TodoKanban: React.FC<TodoKanbanProps> = ({ tasks, onChanged }) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<PriorityCategory | null>(null);

  const grouped = useMemo(() => {
    const map: Record<PriorityCategory, Task[]> = {
      urgent: [],
      medium: [],
      low: [],
      none: [],
    };

    tasks.forEach((task) => {
      if (task.status !== 'open') return;
      if (task.priority === 3) map.urgent.push(task);
      else if (task.priority === 2) map.medium.push(task);
      else if (task.priority === 1) map.low.push(task);
      else map.none.push(task);
    });

    return map;
  }, [tasks]);

  const handleDrop = async (key: PriorityCategory, event: React.DragEvent) => {
    event.preventDefault();
    setOverColumn(null);

    const taskId =
      event.dataTransfer.getData('application/x-task-id') ||
      event.dataTransfer.getData('text/plain') ||
      draggingId;

    setDraggingId(null);
    if (!taskId) return;

    const column = COLUMNS.find((item) => item.key === key);
    const task = tasks.find((item) => item.id === taskId);
    if (!column || !task) return;
    if ((task.priority ?? undefined) === column.priority) return;

    try {
      await taskRepo.update(taskId, { priority: column.priority });
      await onChanged();
    } catch (error) {
      console.error('Failed to move a task on the board:', error);
    }
  };

  return (
    <div className="w-full overflow-x-auto px-5 pb-6 pt-6 no-scrollbar sm:px-6">
      <div className="grid min-w-[760px] grid-cols-4 items-start gap-3">
        {COLUMNS.map((column) => {
          const list = grouped[column.key];

          return (
            <div
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (overColumn !== column.key) setOverColumn(column.key);
              }}
              onDragLeave={() =>
                setOverColumn((current) => (current === column.key ? null : current))
              }
              onDrop={(event) => void handleDrop(column.key, event)}
              className={cn(
                'flex min-h-[160px] flex-col rounded-xl border border-border/40 bg-muted/25 p-2 transition-colors',
                overColumn === column.key && 'border-primary/40 bg-primary/[0.07]'
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    column.badge
                  )}
                >
                  <span className={column.accent}>{column.icon}</span>
                  <span className="text-foreground">{column.title}</span>
                  <span className="font-normal text-foreground/70">
                    ({toPersianDigits(list.length)})
                  </span>
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {list.map((task) => {
                  const meta = formatTaskDateDisplay(
                    task.due_date,
                    undefined,
                    false,
                    task.due_time
                  );

                  return (
                    <button
                      key={task.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', task.id);
                        event.dataTransfer.setData('application/x-task-id', task.id);
                        setDraggingId(task.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setActiveTask(task)}
                      className={cn(
                        'group/card w-full cursor-grab rounded-lg border border-border/50 bg-card p-2.5 text-right shadow-xs transition-colors hover:border-border hover:bg-card active:cursor-grabbing',
                        draggingId === task.id && 'opacity-50'
                      )}
                    >
                      <p className="break-words text-[12.5px] font-medium leading-6 text-foreground">
                        {task.title}
                      </p>

                      {meta && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <RiCalendarEventLine className="size-3" />
                          {meta}
                        </span>
                      )}
                    </button>
                  );
                })}

                {list.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border/50 px-2 py-6 text-center text-[11px] text-subtle">
                    کاری نیست
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeTask && (
        <TaskEditModal
          task={activeTask}
          isOpen={Boolean(activeTask)}
          onClose={() => setActiveTask(null)}
          onSaved={() => {
            void onChanged();
          }}
        />
      )}
    </div>
  );
};
