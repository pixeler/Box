import type React from 'react';

/**
 * Blocks that render buttons (task cards, the add-task row) sit inside the
 * editor's DOM. If one of those buttons happens to hold focus, a space bar
 * meant for text "clicks" it, and the caret jumps out of the paragraph. Notes
 * are typed in, so typing keys must never activate such a control.
 */
export const swallowTypingKeys = (event: React.KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  // Real text fields keep every key: the inline task composer lives in here too.
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
};
