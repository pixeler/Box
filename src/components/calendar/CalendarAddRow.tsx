import React from 'react';
import { RiAddLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface CalendarAddRowProps {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}

export const CalendarAddRow: React.FC<CalendarAddRowProps> = ({
  onClick,
  label = 'افزودن کار',
  ariaLabel,
  compact = false,
  className,
}) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    aria-label={ariaLabel ?? label}
    title={ariaLabel ?? label}
    className={cn(
      'flex w-full items-center rounded-lg border border-dashed border-border/60 font-medium text-muted-foreground/80 transition-colors hover:border-foreground/20 hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background cursor-pointer active:scale-[0.99]',
      compact
        ? 'h-6 justify-center gap-0.5 text-[9.5px]'
        : 'h-10 justify-center gap-1.5 px-3 text-xs',
      className
    )}
  >
    <RiAddLine className={cn('shrink-0', compact ? 'size-3' : 'size-3.5')} />
    {label ? <span className="truncate">{label}</span> : null}
  </button>
);
