import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import { PickerPopover, type PickerAnchor } from './PickerPopover';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  EggFriedIcon,
  Sun01Icon,
  MoonStarIcon,
} from '@hugeicons/core-free-icons';
import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import type { TimeOfDay } from '@/types/models';

interface TimeOfDayPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'sheet' | 'popover';
  anchorRect?: PickerAnchor | null;
  value?: TimeOfDay;
  onChange: (val: TimeOfDay) => void;
}

interface TimeOfDayOption {
  key: TimeOfDay;
  label: string;
  subtitle: string;
  icon: typeof Clock01Icon;
}

const TIME_OF_DAY_OPTIONS: TimeOfDayOption[] = [
  {
    key: 'anytime',
    label: 'هر زمان',
    subtitle: 'کارهای عمومی بدون ساعت یا بازه زمانی خاص',
    icon: Clock01Icon,
  },
  {
    key: 'morning',
    label: 'صبح',
    subtitle: 'شروع روز، روتین‌های اولیه و کارهای صبحگاهی',
    icon: EggFriedIcon,
  },
  {
    key: 'day',
    label: 'ظهر',
    subtitle: 'اواسط روز، کارهای نیمروزی و بعد از ظهر',
    icon: Sun01Icon,
  },
  {
    key: 'evening',
    label: 'عصر و شب',
    subtitle: 'پایان روز، روتین‌های شبانه و استراحت',
    icon: MoonStarIcon,
  },
];

export const TimeOfDayPickerSheet: React.FC<TimeOfDayPickerSheetProps> = ({
  isOpen,
  onClose,
  variant = 'sheet',
  anchorRect = null,
  value = 'anytime',
  onChange,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (variant === 'popover') {
    if (!isOpen) return null;
    return (
      <PickerPopover anchorRect={anchorRect} onClose={onClose} width={290}>
        <div className="p-1.5" dir="rtl">
          {TIME_OF_DAY_OPTIONS.map((item) => {
            const isSelected = (value || 'anytime') === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                }`}
              >
                <HugeiconsIcon icon={item.icon} size={16} />
                <span className="flex-1 text-right">{item.label}</span>
                {isSelected && <RiCheckLine className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PickerPopover>
    );
  }

  if (!isOpen && !isClosing) return null;

  const portalTarget = getOverlayPortalTarget();

  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-[80] flex flex-col justify-end bg-black/65 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-6 font-sans text-right flex flex-col relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 dark:border-white/10 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold text-foreground">بخش زمانی روز</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-1.5 pt-1">
          {TIME_OF_DAY_OPTIONS.map((item) => {
            const isSelected = (value || 'anytime') === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key);
                  handleClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer text-right group ${
                  isSelected
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                    : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 dark:bg-white/10 text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-bold leading-tight ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal leading-normal mt-0.5">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <RiCheckLine className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    portalTarget
  );
};

