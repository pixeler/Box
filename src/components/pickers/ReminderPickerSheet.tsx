import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import {
  RiTimeLine,
  RiCheckLine,
  RiCloseLine,
  RiAddLine,
  RiAlarmLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { toPersianDigits } from '@/lib/jalali';

interface ReminderPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string | null;
  onChange: (val: string | null) => void;
  dueTime?: string | null;
}

const PRESET_REMINDERS = [
  {
    id: 'at_time',
    label: 'سر موعد تسک',
    subtitle: 'دقیقاً در ساعت یا روز مشخص‌شده برای تسک',
  },
  {
    id: '10_before',
    label: '۱۰ دقیقه قبل',
    subtitle: 'یادآوری سریع برای آماده شدن و شروع کار',
  },
  {
    id: '30_before',
    label: '۳۰ دقیقه قبل',
    subtitle: 'فرصت کافی برای اتمام کارهای قبلی',
  },
  {
    id: '1_hour_before',
    label: '۱ ساعت قبل',
    subtitle: 'هشدار زودهنگام یک ساعته قبل از موعد',
  },
  {
    id: 'morning_9',
    label: 'صبح روز موعد (۰۹:۰۰)',
    subtitle: 'برنامه‌ریزی و مرور کار در ابتدای روز کاری',
  },
];

export const ReminderPickerSheet: React.FC<ReminderPickerSheetProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
}) => {
  const [selectedReminder, setSelectedReminder] = useState<string | null>(value || null);
  const [customTime, setCustomTime] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setSelectedReminder(value || null);
      setShowCustomInput(false);
    }
  }, [value, isOpen]);

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

  if (!isOpen && !isClosing) return null;

  const handleSelect = (val: string) => {
    setSelectedReminder(val);
    onChange(val);
    handleClose();
  };

  const handleRemove = () => {
    setSelectedReminder(null);
    onChange(null);
    handleClose();
  };

  const handleApplyCustom = () => {
    if (!customTime.trim()) return;
    const formatted = `ساعت ${toPersianDigits(customTime)}`;
    setSelectedReminder(formatted);
    onChange(formatted);
    setShowCustomInput(false);
    handleClose();
  };

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
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-6 font-sans text-right flex flex-col max-h-[85%] relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 dark:border-white/10 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold text-foreground">تنظیم یادآور</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-1 min-h-0">
          {/* Preset Options */}
          {PRESET_REMINDERS.map((preset) => {
            const isSelected = selectedReminder === preset.label;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset.label)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] text-right group ${
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
                    <RiAlarmLine className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-bold leading-tight ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {preset.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal leading-normal mt-0.5">
                      {preset.subtitle}
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

          {/* Custom Time Option */}
          {showCustomInput ? (
            <div className="p-3 bg-secondary/50 dark:bg-white/5 rounded-2xl border border-border/80 dark:border-white/15 space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <RiTimeLine className="w-4 h-4 text-primary" />
                  <span>انتخاب ساعت دلخواه</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1 bg-card dark:bg-zinc-800 px-3 py-2 rounded-xl border border-border text-sm text-foreground outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!customTime}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground disabled:opacity-40 cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  ثبت
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-dashed border-border/80 dark:border-white/15 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer text-right group mt-1"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted/40 dark:bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0">
                  <RiAddLine className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">زمان دلخواه دیگر...</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">مشخص کردن دقیق ساعت یادآوری</span>
                </div>
              </div>
            </button>
          )}

          {/* Remove reminder button if active */}
          {selectedReminder && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRemove}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <RiDeleteBinLine className="w-4 h-4" />
                <span>حذف یادآور تسک</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
};
