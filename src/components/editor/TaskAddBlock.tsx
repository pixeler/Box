import React, { useCallback, useEffect, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import type { Task } from '@/types/models';
import { taskRepo } from '@/repositories';
import { buildTaskGroups } from '@/lib/taskGroups';
import { getTodayJalaliKey } from '@/lib/jalali';
import { TaskItemRow } from '@/components/stream/TaskItemRow';
import { QuickCaptureInput } from '@/components/capture/QuickCaptureInput';
import { RiAddLine } from '@remixicon/react';
import { keepKeyboardInTheNote, swallowTypingKeys } from './keyGuards';

export interface TaskAddRowProps {
  dueDate: string;
  /** Called after the task exists, so the note can show it right above this row. */
  onCreated: (taskId: string) => void;
}

/**
 * The "add task" row under a task list in a note. It expands into the same
 * composer used by the calendar, so every task property is available in place.
 */
export const TaskAddRow: React.FC<TaskAddRowProps> = ({ dueDate, onCreated }) => {
  const [expanded, setExpanded] = useState(false);
  const dateKey = dueDate || getTodayJalaliKey();

  if (expanded) {
    return (
      <div
        contentEditable={false}
        dir="rtl"
        className="my-1"
        onKeyDownCapture={swallowTypingKeys}
        onMouseDownCapture={keepKeyboardInTheNote}
      >
        <QuickCaptureInput
          variant="inline"
          currentSelectedDateKey={dateKey}
          onItemCreated={(taskId) => {
            if (taskId) onCreated(taskId);
          }}
          onClose={() => setExpanded(false)}
        />
      </div>
    );
  }

  return (
    <div
      contentEditable={false}
      dir="rtl"
      className="my-0.5"
      onKeyDownCapture={swallowTypingKeys}
      onMouseDownCapture={keepKeyboardInTheNote}
    >
      <button
        type="button"
        // Never reachable by tabbing: a space typed in the note must stay text.
        tabIndex={-1}
        onKeyDown={swallowTypingKeys}
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-secondary/20 px-2 py-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-secondary/35 hover:text-foreground cursor-pointer"
      >
        <RiAddLine className="size-3.5 shrink-0" />
        <span className="text-[12px]">افزودن تسک</span>
        <span className="mr-auto text-[10px] text-muted-foreground/60">
          تاریخ، اولویت، برچسب و بیشتر
        </span>
      </button>
    </div>
  );
};

export const TaskAddBlock = createReactBlockSpec(
  {
    type: 'taskAdd',
    propSchema: {
      /** Jalali key the new task is scheduled for; empty means no date. */
      dueDate: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      // The block's own editor type only knows this block; the note schema has the rest.
      const noteEditor = editor as unknown as BlockNoteEditor<any, any, any>;

      return (
        <TaskAddRow
          dueDate={block.props.dueDate}
          onCreated={(taskId) => {
            try {
              const target = noteEditor.getBlock(block.id) ?? block;
              noteEditor.insertBlocks(
                [{ type: 'taskRef', props: { taskId } }],
                target,
                'before'
              );
            } catch (err) {
              console.error('Failed to insert the created task block:', err);
            }
          }}
        />
      );
    },
    /** Editor chrome, not note text: never write it into the saved markdown. */
    toExternalHTML: () => <p dir="rtl" />,
  }
);

const TASK_LIST_TITLES: Record<string, string> = {
  today: 'تسک‌های امروز',
  overdue: 'تسک‌های عقب‌افتاده',
};

/** The template marker each scope is written back as, so templates stay reusable. */
const TASK_LIST_TOKENS: Record<string, string> = {
  today: '{{today_tasks}}',
  overdue: '{{overdue_tasks}}',
};

/**
 * A list of the app's own tasks inside a note: a title, then the same cards the
 * today view renders (flush, dashed separators), then the add-task row. Every
 * change made here is a change on the real task, everywhere.
 */
const NoteTaskList: React.FC<{ scope: string }> = ({ scope }) => {
  const overdue = scope === 'overdue';
  const [tasks, setTasks] = useState<Task[] | null>(null);

  const load = useCallback(async () => {
    try {
      const groups = buildTaskGroups(await taskRepo.list());
      setTasks(overdue ? groups.overdue : groups.today);
    } catch (err) {
      console.error('Failed to read tasks for the note list block:', err);
      setTasks([]);
    }
  }, [overdue]);

  useEffect(() => {
    setTasks(null);
    void load();
  }, [load]);

  // Checking a task anywhere in the app updates this list too.
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [load]);

  return (
    <div
      contentEditable={false}
      dir="rtl"
      className="my-2 w-full"
      onKeyDownCapture={swallowTypingKeys}
      onMouseDownCapture={keepKeyboardInTheNote}
    >
      <p className="mb-1 px-1 text-[11.5px] font-medium text-muted-foreground">
        {TASK_LIST_TITLES[scope] ?? TASK_LIST_TITLES.today}
      </p>

      {tasks === null ? (
        <p className="px-2 py-2 text-[11.5px] text-muted-foreground/45">
          در حال بارگذاری تسک‌ها...
        </p>
      ) : tasks.length === 0 ? (
        <p className="px-2 py-2 text-[11.5px] text-muted-foreground/45">
          {overdue ? 'تسک عقب‌افتاده‌ای نداری.' : 'برای امروز تسکی ثبت نشده.'}
        </p>
      ) : (
        <div className="flex w-full flex-col">
          {tasks.map((task, index) => (
            <TaskItemRow
              key={task.id}
              task={task}
              currentDateKey={getTodayJalaliKey()}
              onStatusChanged={load}
              isLast={index === tasks.length - 1}
              hideNoteLink
            />
          ))}
        </div>
      )}

      <TaskAddRow
        dueDate={overdue ? '' : getTodayJalaliKey()}
        onCreated={() => void load()}
      />
    </div>
  );
};

/**
 * One block that holds a live list of the app's tasks. It is the block the
 * journal template's markers expand into and a slash-menu entry of its own.
 */
export const TaskListBlock = createReactBlockSpec(
  {
    type: 'taskList',
    propSchema: {
      /** Which bucket of the app's tasks the list shows. */
      scope: { default: 'today' },
    },
    content: 'none',
  },
  {
    render: ({ block }) => <NoteTaskList scope={block.props.scope} />,
    /**
     * Markdown keeps the template marker instead of the cards' UI text, so a
     * journal template written this way still works for every next day.
     */
    toExternalHTML: ({ block }) => (
      <p dir="rtl">{TASK_LIST_TOKENS[block.props.scope] ?? TASK_LIST_TOKENS.today}</p>
    ),
  }
);
