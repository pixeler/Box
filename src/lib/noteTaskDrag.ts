import type React from 'react';
import type { BlockNoteEditor } from '@blocknote/core';
import type { Task } from '@/types/models';
import { setupDragCardGhost } from '@/lib/drag';
import { taskRepo } from '@/repositories';
import { getTodayJalaliKey } from '@/lib/jalali';

/** Marks a drag that started on a task card inside a note. */
export const NOTE_TASK_MIME = 'application/x-note-task-id';

/** The same payload the today view sends, so a card can travel between views. */
export function startNoteTaskDrag(event: React.DragEvent, task: Task): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', task.id);
  event.dataTransfer.setData('application/x-task-id', task.id);
  event.dataTransfer.setData(NOTE_TASK_MIME, task.id);
  try {
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'task',
        taskId: task.id,
        title: task.title,
        durationMinutes: task.duration_minutes || 60,
      })
    );
  } catch {}
  setupDragCardGhost(event);
}

/**
 * Browsers keep payload data unreadable while a drag is only hovering, so the
 * dragover handlers have to recognise the drag from its types instead.
 */
export function hasNoteTaskDrag(event: React.DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes(NOTE_TASK_MIME) || types.includes('application/x-task-id');
}

export function getDraggedNoteTaskId(event: React.DragEvent): string | null {
  const id =
    event.dataTransfer.getData(NOTE_TASK_MIME) ||
    event.dataTransfer.getData('application/x-task-id');
  return id || null;
}

interface AnyBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/** Which task-list block a card currently sits in, if any. */
function scopeAt(blocks: AnyBlock[], blockId: string): string | null {
  let scope: string | null = null;
  for (const block of blocks) {
    if (block.type === 'taskList') scope = String(block.props.scope ?? 'today');
    if (block.id === blockId) return scope;
  }
  return null;
}

/**
 * Drops a task card somewhere in the note: an existing card block is moved to
 * the target position (the same reorder gesture as the today view), or a new
 * card block is created when the task is not in this note yet.
 *
 * Landing inside the "today" list also schedules the task for today, which is
 * what dragging a card out of the overdue list means.
 */
export async function moveTaskIntoNote(
  editor: BlockNoteEditor<any, any, any>,
  taskId: string,
  targetBlockId: string
): Promise<void> {
  const blocks = editor.document as unknown as AnyBlock[];
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);
  const target = blocks[targetIndex] ?? blocks[blocks.length - 1];
  if (!target) return;

  const source = blocks.find(
    (block) => block.type === 'taskRef' && block.props.taskId === taskId
  );

  if (!source) {
    editor.insertBlocks(
      [{ type: 'taskRef', props: { taskId } } as any],
      editor.getBlock(target.id) as any,
      'after'
    );
    return;
  }
  if (source.id === target.id) return;

  const sourceIndex = blocks.findIndex((block) => block.id === source.id);
  // Moving down the page means landing after the target, moving up before it.
  const placement = sourceIndex < targetIndex ? 'after' : 'before';
  // BlockNote 0.54 has no "move to this block" call: the card is re-inserted
  // at the target position and the old one removed. Dropping the id keeps the
  // document free of duplicate block ids.
  const { id: sourceId, ...payload } = source as any;
  editor.insertBlocks([payload], editor.getBlock(target.id) as any, placement);
  editor.removeBlocks([sourceId]);

  if (scopeAt(blocks, target.id) === 'today') {
    await taskRepo.update(taskId, { due_date: getTodayJalaliKey() });
  }
}
