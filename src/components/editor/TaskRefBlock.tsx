import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import type { Task } from '@/types/models';
import { taskRepo } from '@/repositories';
import { extractDateOnly, getTodayJalaliKey } from '@/lib/jalali';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { RiLoader4Line } from '@remixicon/react';
import { keepKeyboardInTheNote, swallowTypingKeys } from './keyGuards';
import {
  getDraggedNoteTaskId,
  hasNoteTaskDrag,
  moveTaskIntoNote,
  startNoteTaskDrag,
} from '@/lib/noteTaskDrag';

/**
 * A task from the app, embedded in a note. The block stores only the task id and
 * renders the very same card the today and calendar views use, so checking,
 * editing, the right-click menu and drag-and-drop behave identically in both
 * places.
 */
const TaskRefView: React.FC<{
  taskId: string;
  blockId: string;
  editor: BlockNoteEditor<any, any, any>;
}> = ({ taskId, blockId, editor }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }
    try {
      const found = await taskRepo.getById(taskId);
      setTask(found);
    } catch (err) {
      console.error('Failed to load task for note block:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [load]);

  // A recurring task keeps `status: open` and records per-day completions, so the
  // card needs today's state merged in to show (and keep) the crossed-out style.
  const displayTask = useMemo(() => {
    if (!task) return null;
    const isRecurring = !!task.recurrence_rule && task.recurrence_rule !== 'none';
    if (!isRecurring) return task;

    const today = getTodayJalaliKey();
    const doneToday = (task.done_dates || [])
      .map((date) => extractDateOnly(date))
      .includes(today);

    return doneToday ? { ...task, status: 'done' as const } : task;
  }, [task]);

  if (!taskId) {
    return (
      <div
        contentEditable={false}
        className="my-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-[11.5px] text-muted-foreground"
      >
        تسکی انتخاب نشده است
      </div>
    );
  }

  if (loading) {
    return (
      <div
        contentEditable={false}
        className="my-1 flex w-full items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-[11.5px] text-muted-foreground"
      >
        <RiLoader4Line className="size-3.5 animate-spin" />
        در حال بارگذاری تسک...
      </div>
    );
  }

  if (!task || task.status === 'dropped') {
    return (
      <div
        contentEditable={false}
        className="my-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2 text-[11.5px] text-muted-foreground"
      >
        این تسک دیگر وجود ندارد
      </div>
    );
  }

  // Cards in a note sit flush against each other instead of being spaced apart
  // like standalone rows in the day stream.
  return (
    <div
      contentEditable={false}
      className="my-0 w-full"
      onKeyDownCapture={swallowTypingKeys}
      onMouseDownCapture={keepKeyboardInTheNote}
      // The editor owns right-click on its own; the card's menu needs it first.
      onContextMenu={(event) => event.stopPropagation()}
    >
      <TaskItemRow
        task={displayTask ?? task}
        currentDateKey={getTodayJalaliKey()}
        onStatusChanged={load}
        className="px-2 py-1.5"
        hideNoteLink
        showSubtasks
        draggable
        onDragStart={(event) => startNoteTaskDrag(event, displayTask ?? task)}
        onDragOver={(event) => {
          if (!hasNoteTaskDrag(event)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => {
          const draggedId = getDraggedNoteTaskId(event);
          if (!draggedId) return;
          event.preventDefault();
          event.stopPropagation();
          if (draggedId === taskId) return;
          void moveTaskIntoNote(editor, draggedId, blockId).then(() => load());
        }}
        onDragEnd={() => {}}
      />
    </div>
  );
};

export const TaskRefBlock = createReactBlockSpec(
  {
    type: 'taskRef',
    propSchema: {
      taskId: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <TaskRefView
        taskId={block.props.taskId}
        blockId={block.id}
        editor={editor as unknown as BlockNoteEditor<any, any, any>}
      />
    ),
    /** Markdown/HTML export must never scrape this component: its loading state
     *  would be written into the note body as text. */
    toExternalHTML: () => (
      <p dir="rtl" contentEditable={false}>
        ☐ تسک
      </p>
    ),
  }
);
