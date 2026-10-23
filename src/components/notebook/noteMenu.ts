/** Shared classes for the small menus inside the notebook, so every row and card opens the same panel. */

export const noteMenuContentClass =
  'z-50 min-w-48 rounded-xl border border-border/70 bg-popover p-1 text-popover-foreground shadow-xl';

export const noteMenuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-secondary focus:bg-secondary';

export const noteMenuDangerClass =
  'text-rose-500 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-500 hover:text-rose-500';

export const noteMenuSeparatorClass = '-mx-1 my-1 h-px bg-border/60';
