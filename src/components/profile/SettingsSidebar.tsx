import React, { useEffect } from 'react';
import { RiCloseLine } from '@remixicon/react';

interface SettingsSidebarProps {
  onClose: () => void;
  children: React.ReactNode;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  onClose,
  children,
}) => {
  useEffect(() => {
    return () => {
      document.getElementById('desktop-settings-trigger')?.focus();
    };
  }, []);

  return (
    <aside
      id="desktop-settings-panel"
      aria-label="تنظیمات"
      dir="rtl"
      className="flex h-full w-[300px] shrink-0 animate-in fade-in slide-in-from-right-4 flex-col overflow-hidden border-e border-border/50 bg-background duration-200"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <h2 className="font-darvish text-base font-bold leading-tight text-foreground">
          تنظیمات
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer active:scale-95"
          aria-label="بستن تنظیمات"
          title="بستن"
        >
          <RiCloseLine className="size-5" />
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </aside>
  );
};
