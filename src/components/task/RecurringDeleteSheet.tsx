import React from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import { RiCalendarEventLine, RiDeleteBinLine, RiCloseLine } from '@remixicon/react';

interface RecurringDeleteSheetProps {
  isOpen: boolean;
  taskTitle: string;
  onDeleteSingle: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

export const RecurringDeleteSheet: React.FC<RecurringDeleteSheetProps> = ({
  isOpen,
  taskTitle,
  onDeleteSingle,
  onDeleteAll,
  onClose,
}) => {
  if (!isOpen) return null;

  const portalTarget = getOverlayPortalTarget();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card text-card-foreground border border-border/80 dark:border-white/10 rounded-2xl shadow-2xl p-5 text-right flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <h3 className="text-base font-bold text-foreground">حذف تسک تکرارشونده</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          تسک «<span className="font-semibold text-foreground">{taskTitle}</span>» یک تسک تکرارشونده است. چطور می‌خواهید آن را حذف کنید؟
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Option 1: Only this occurrence */}
          <button
            type="button"
            onClick={() => {
              onDeleteSingle();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-secondary/60 dark:hover:bg-white/5 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <RiCalendarEventLine className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                حذف فقط برای امروز
              </span>
              <span className="text-[11px] text-muted-foreground">
                تسک فقط از این روز حذف می‌شود و تکرارهای روزهای دیگر باقی می‌مانند
              </span>
            </div>
          </button>

          {/* Option 2: Delete entire series */}
          <button
            type="button"
            onClick={() => {
              onDeleteAll();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 transition-all text-right group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <RiDeleteBinLine className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                حذف کل این تسک تکرارشونده
              </span>
              <span className="text-[11px] text-muted-foreground">
                این تسک برای همیشه و از تمام روزها حذف خواهد شد
              </span>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium transition-colors text-center cursor-pointer mt-1"
        >
          انصراف
        </button>
      </div>
    </div>,
    portalTarget
  );
};
