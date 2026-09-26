import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RiTimeLine,
  RiCheckLine,
  RiCloseLine,
  RiAddLine,
  RiAlarmLine,
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
  { id: 'at_time', label: 'سر موعد تسک' },
  { id: '10_before', label: '۱۰ دقیقه قبل' },
  { id: '30_before', label: '۳۰ دقیقه قبل' },
  { id: '1_hour_before', label: '۱ ساعت قبل' },
  { id: 'morning_9', label: 'صبح روز موعد (۰۹:۰۰)' },
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
    setSelectedReminder(value || null);
    setShowCustomInput(false);
  }, [value, isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 350);
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
    setShowCustomInput(false);
  };

  const handleRemove = () => {
    setSelectedReminder(null);
    onChange(null);
  };

  const handleApplyCustom = () => {
    if (!customTime.trim()) return;
    const formatted = `ساعت ${toPersianDigits(customTime)}`;
    setSelectedReminder(formatted);
    onChange(formatted);
    setShowCustomInput(false);
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? document.getElementById('app-main') || document.body
      : null;

  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-end bg-black/80 sm:backdrop-blur-xs select-none ${
        isClosing ? 'animate-panel-backdrop-out' : 'animate-panel-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-open={isClosing ? 'false' : 'true'}
        className={`t-panel-slide relative w-full max-w-lg mx-auto bg-card dark:bg-[#18191c] text-card-foreground rounded-t-[32px] sm:rounded-t-[32px] border-t border-border/80 dark:border-white/10 shadow-2xl p-5 sm:p-6 pb-8 space-y-4 max-h-[90%] overflow-y-auto ${
          isClosing ? 'animate-panel-out' : 'animate-panel-in'
        }`}
        dir="rtl"
      >
        {/* Pull handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />

        {/* Header: Title in center, close and confirm buttons */}
        <div className="flex items-center justify-between pb-1">
          {/* Circular close button on the right in RTL */}
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary dark:bg-white/10 text-foreground flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="انصراف"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>

          <h3 className="text-base font-bold text-foreground">
            تنظیم یادآور
          </h3>

          {/* Confirm checkmark button on the left in RTL */}
          <button
            type="button"
            onClick={() => {
              onChange(selectedReminder);
              handleClose();
            }}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
            title="تایید و ذخیره"
          >
            <RiCheckLine className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Section: Reminder Options */}
        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-semibold text-muted-foreground block pr-1">
            موعد یادآوری
          </span>

          {/* Solid Container for Presets */}
          <div className="w-full bg-secondary/30 dark:bg-white/5 rounded-2xl border border-border/60 dark:border-white/10 overflow-hidden divide-y divide-border/50 dark:divide-white/5">
            {/* Active Reminder Row (if any) */}
            {selectedReminder ? (
              <div className="flex items-center justify-between p-3.5 sm:p-4 bg-primary/10 dark:bg-primary/15">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <RiAlarmLine className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-foreground block">
                      {selectedReminder}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      ارسال اعلان در موعد مشخص‌شده
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="w-7 h-7 rounded-full text-rose-500 hover:bg-rose-500/15 flex items-center justify-center transition-colors cursor-pointer"
                  title="حذف یادآور"
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
            ) : null}

            {/* Presets List */}
            <div className="p-2 space-y-1">
              {PRESET_REMINDERS.map((preset) => {
                const isCurrent = selectedReminder === preset.label;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelect(preset.label)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-primary/20 text-primary font-bold shadow-2xs'
                        : 'text-foreground/85 hover:bg-muted/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <RiTimeLine className={`w-4 h-4 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{preset.label}</span>
                    </div>
                    {isCurrent && <RiCheckLine className="w-4 h-4 text-primary stroke-[2]" />}
                  </button>
                );
              })}

              {/* Custom Time Row */}
              {showCustomInput ? (
                <div className="flex items-center gap-2 p-2.5 bg-card dark:bg-[#18191c] rounded-xl border border-border/80 mt-1 shadow-sm">
                  <RiTimeLine className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    placeholder="انتخاب زمان"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={!customTime}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground disabled:opacity-40 cursor-pointer transition-opacity active:scale-95"
                  >
                    ثبت
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <RiAddLine className="w-4 h-4" />
                  <span>زمان دلخواه دیگر...</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tip at bottom */}
        <p className="text-[11px] text-muted-foreground/80 pr-1 leading-relaxed">
          نکته: با تنظیم یادآور، اعلان در موعد تعیین‌شده برای یادآوری تسک به شما نمایش داده می‌شود.
        </p>
      </div>
    </div>,
    portalTarget
  );
};

