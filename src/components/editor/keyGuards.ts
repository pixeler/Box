import type React from 'react';

/**
 * Blocks that render buttons (task cards, the add-task row) sit inside the
 * editor's DOM. If one of those buttons holds focus, a space bar meant for text
 * "clicks" it, and the caret jumps out of the paragraph into the task list.
 *
 * The editable root carries `contenteditable="true"` as well, so the check has
 * to look at the *nearest* editing host: only a real text field keeps every key.
 */
const isEditingHost = (target: HTMLElement): boolean =>
  target.closest('[contenteditable]')?.getAttribute('contenteditable') === 'true';

/**
 * Typing keys belong to the note. Space and Enter are swallowed for anything
 * that is not a text field, and kept away from the editor's own handlers so a
 * half-selected block can never be the result of a space.
 */
export const swallowTypingKeys = (event: React.KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  // Real text fields keep every key: the inline task composer lives in here too.
  if (target.closest('input, textarea, select') || isEditingHost(target)) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
  }
};

/**
 * Note chrome never takes the keyboard. Preventing the default of a mousedown
 * stops the browser from focusing the control, so the caret stays in the note;
 * the click itself still fires, so every button keeps working.
 */
export const keepKeyboardInTheNote = (event: React.MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('input, textarea, select') || isEditingHost(target)) return;
  const control = target.closest('button, a, [role="button"], [role="link"], label, summary');
  if (!control) return;
  event.preventDefault();
};
