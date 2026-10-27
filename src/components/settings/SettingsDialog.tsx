import React from 'react';
import type { ProfileViewProps } from '@/components/profile/ProfileView';
import { ProfileView } from '@/components/profile/ProfileView';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RiCloseLine } from '@remixicon/react';

interface SettingsDialogProps extends Omit<ProfileViewProps, 'variant'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phase 1 keeps the existing settings content but moves it into one focused
 * window. Phase 2 will replace the inner ProfileView with the sidebar-and-
 * sections layout described in docs/claude-redesign.md.
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  ...profileProps
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[min(720px,calc(100dvh-32px))] w-[calc(100vw-24px)] max-w-[900px] flex-col gap-0 overflow-hidden p-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 [&>button]:hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-4">
        <div className="min-w-0">
          <DialogTitle className="text-[16px] font-semibold leading-tight text-foreground">
            تنظیمات
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[12px] leading-tight text-muted-foreground">
            حساب، ظاهر، همگام‌سازی و داده‌ها
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="بستن تنظیمات"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RiCloseLine className="size-5" />
          </button>
        </DialogClose>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProfileView {...profileProps} variant="panel" />
      </div>
    </DialogContent>
  </Dialog>
);
