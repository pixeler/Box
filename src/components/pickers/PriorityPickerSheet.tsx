import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import { PickerPopover, type PickerAnchor } from './PickerPopover';
import {
  RiFlagLine,
  RiFlagFill,
  RiCheckLine,
  RiCloseLine,
} from '@remixicon/react';

interface PriorityPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'sheet' | 'popover';
  anchorRect?: PickerAnchor | null;
  value?: 1 | 2 | 3 | undefined;
  onChange: (val: 1 | 2 | 3 | undefined) => void;
}

interface PriorityOption {
  level: 1 | 2 | 3 | undefined;
  label: string;
  subtitle: string;
  iconColor: string;
  badgeBg: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    level: 3,
    label: 'فوری (بالاترین اولویت)',
    subtitle: 'تسک‌های مهم، اضطراری و حساس به زمان',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  },
  {
    level: 2,
    label: 'متوسط (عادی)',
    subtitle: 'کارهای روتین و روزمره با اهمیت نرمال',
    iconColor: 'text-amber-500 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  },
  {
    level: 1,
    label: 'کم (فرعی)',
    subtitle: 'کارهای دارای انعطاف زمانی و اولویت پایین',
    iconColor: 'text-blue-500 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  },
  {
    level: undefined,
    label: 'بدون اولویت',
    subtitle: 'تسک‌های استاندارد بدون نشان فوریت',
    iconColor: 'text-muted-foreground',
    badgeBg: 'bg-muted/60 dark:bg-white/10 text-muted-foreground',
  },
];

export const PriorityPickerSheet: React.FC<PriorityPickerSheetProps> = ({
  isOpen,
  onClose,
  variant = 'sheet',
  anchorRect = null,
  value,
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
          {PRIORITY_OPTIONS.map((item) => {
            const isSelected = value === item.level;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onChange(item.level);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                }`}
              >
                {item.level ? (
                  <RiFlagFill className={`size-4 ${item.iconColor}`} />
                ) : (
                  <RiFlagLine className={`size-4 ${item.iconColor}`} />
                )}
                <span className="flex-1 text-right">{item.label.split(' (')[0]}</span>
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
          <h3 className="text-xs sm:text-sm font-bold text-foreground">تعیین اولویت تسک</h3>
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
          {PRIORITY_OPTIONS.map((item) => {
            const isSelected = value === item.level;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onChange(item.level);
                  handleClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer active:scale-[0.98] border ${
                  isSelected
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                    : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.badgeBg}`}>
                    {item.level ? (
                      <RiFlagFill className={`w-4 h-4 ${item.iconColor}`} />
                    ) : (
                      <RiFlagLine className={`w-4 h-4 ${item.iconColor}`} />
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-normal leading-normal mt-0.5">
                      {item.subtitle}
                    </div>
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

