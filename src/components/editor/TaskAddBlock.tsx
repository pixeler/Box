import React, { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import { getTodayJalaliKey } from '@/lib/jalali';
import { QuickCaptureInput } from '@/components/capture/QuickCaptureInput';
import { RiAddLine } from '@remixicon/react';

interface TaskAddRowProps {
  dueDate: string;
  /** Called after the task exists, so the note can show it right above this row. */
  onCreated: (taskId: string) => void;
}

/**
 * The "add task" row under a task list in a note. It expands into the same
 * composer used by the calendar, so every task property is available in place.
 */
const TaskAddRow: React.FC<TaskAddRowProps> = ({ dueDate, onCreated }) => {
  const [expanded, setExpanded] = useState(false);
  const dateKey = dueDate || getTodayJalaliKey();

  if (expanded) {
    return (
      <div contentEditable={false} dir="rtl" className="my-1">
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
    <div contentEditable={false} dir="rtl" className="my-0.5">
      <button
        type="button"
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
  }
);
