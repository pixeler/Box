import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import { RiDeleteBinLine, RiCloseLine } from '@remixicon/react';

interface DeleteConfirmSheetProps {
  isOpen: boolean;
  title?: string;
  itemTitle?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const DeleteConfirmSheet: React.FC<DeleteConfirmSheetProps> = ({
  isOpen,
  title = 'حذف مورد',
  itemTitle,
  description = 'آیا از حذف این مورد اطمینان دارید؟ این عملیات قابل بازگشت نیست.',
  confirmLabel = 'حذف',
  cancelLabel = 'انصراف',
  onConfirm,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
      handleClose();
    } catch (err) {
      console.error('Delete action failed:', err);
      setIsSubmitting(false);
    }
  };

  const portalTarget = getOverlayPortalTarget();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-[90] flex flex-col justify-end sm:items-center sm:justify-center bg-black/65 backdrop-blur-xs select-none transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        className={`w-full sm:max-w-sm bg-card text-card-foreground border-t sm:border border-border/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-2xl p-5 text-right flex flex-col gap-4 transform transition-transform duration-200 ease-out ${
          isClosing
            ? 'translate-y-full sm:scale-95 sm:translate-y-0 opacity-0'
            : 'translate-y-0 sm:scale-100 opacity-100'
        }`}
      >
        {/* Mobile handle indicator */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-2 text-rose-500">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <RiDeleteBinLine className="w-4 h-4 text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex flex-col gap-1.5">
          {itemTitle && (
            <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
              «{itemTitle}»
            </p>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {/* Delete Danger Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RiDeleteBinLine className="w-4 h-4" />
            <span>{isSubmitting ? 'در حال حذف...' : confirmLabel}</span>
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-secondary/80 hover:bg-secondary active:scale-98 text-foreground text-xs font-medium transition-colors text-center cursor-pointer"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
};
