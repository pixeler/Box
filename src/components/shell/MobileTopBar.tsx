import React from 'react';
import { RiAddLine, RiMenuLine } from '@remixicon/react';

interface MobileTopBarProps {
  onOpenMenu: () => void;
  onOpenAdd: () => void;
}

/**
 * The mobile chrome. It deliberately carries no page title: each page keeps
 * its own heading, so the top bar stays quiet and only exposes global actions.
 */
export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  onOpenMenu,
  onOpenAdd,
}) => (
  <header className="flex h-[calc(var(--topbar-h)+env(safe-area-inset-top,0px))] shrink-0 items-center justify-between border-b border-border/70 bg-background px-3 pt-[env(safe-area-inset-top,0px)]">
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="باز کردن منو"
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RiMenuLine className="size-5" />
      </button>

      <div className="flex items-center gap-2">
        <img src="/Boxs/Box 2.png" alt="" className="size-6 rounded-md object-contain" />
        <span className="text-[15px] font-semibold leading-none text-foreground">جعبه</span>
      </div>
    </div>

    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpenAdd}
        aria-label="جدید"
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RiAddLine className="size-5" />
      </button>
    </div>
  </header>
);
