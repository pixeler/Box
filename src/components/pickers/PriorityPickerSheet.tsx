import React, { useEffect } from 'react';
import {
  RiFlagLine,
  RiFlagFill,
  RiCheckLine,
  RiCloseLine,
} from '@remixicon/react';

interface PriorityPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
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
  value,
  onChange,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-60 flex flex-col justify-end bg-black/60 backdrop-blur-xs select-none animate-backdrop-in"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground rounded-t-3xl border-t border-border/80 dark:border-white/10 shadow-2xl p-4 pb-6 space-y-2.5 animate-sheet-up"
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-1.5" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60 dark:border-white/10">
          <h3 className="text-xs font-bold text-foreground">تعیین اولویت تسک</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
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
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer active:scale-[0.98] border ${
                  isSelected
                    ? 'bg-secondary border-border text-foreground font-bold shadow-xs dark:bg-white/10 dark:border-white/20'
                    : 'border-transparent hover:bg-muted/60 dark:hover:bg-white/5 text-foreground/85'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.badgeBg}`}>
                    {item.level ? (
                      <RiFlagFill className={`w-4 h-4 ${item.iconColor}`} />
                    ) : (
                      <RiFlagLine className={`w-4 h-4 ${item.iconColor}`} />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold leading-tight">{item.label}</div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">{item.subtitle}</div>
                  </div>
                </div>
                {isSelected && (
                  <RiCheckLine className="w-4 h-4 text-primary dark:text-white shrink-0 mr-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
