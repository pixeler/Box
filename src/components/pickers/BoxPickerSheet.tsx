import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Box } from '@/types/models';
import { BoxThumbnail } from '../boxes/BoxThumbnail';
import {
  RiInboxArchiveLine,
  RiCheckLine,
  RiCloseLine,
} from '@remixicon/react';

interface BoxPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  selectedBoxId?: string | null;
  onSelectBox: (boxId: string | null) => void;
}

export const BoxPickerSheet: React.FC<BoxPickerSheetProps> = ({
  isOpen,
  onClose,
  boxes,
  selectedBoxId,
  onSelectBox,
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

  if (!isOpen && !isClosing) return null;

  const portalTarget =
    typeof document !== 'undefined'
      ? document.getElementById('app-main') || document.body
      : null;

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
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-6 font-sans text-right flex flex-col max-h-[75%] relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 dark:border-white/10 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold text-foreground">انتخاب باکس (جعبه)</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Box Items List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-1 min-h-0">
          {/* بدون جعبه */}
          <button
            type="button"
            onClick={() => {
              onSelectBox(null);
              handleClose();
            }}
            className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer active:scale-[0.98] border ${
              !selectedBoxId
                ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/60 dark:bg-white/5 flex items-center justify-center text-muted-foreground shrink-0">
                <RiInboxArchiveLine className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold ${!selectedBoxId ? 'text-primary' : 'text-foreground'}`}>بدون جعبه</div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5">عمومی و بدون دسته‌بندی</div>
              </div>
            </div>
            {!selectedBoxId && (
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <RiCheckLine className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            )}
          </button>

          {/* Real Boxes List */}
          {boxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            return (
              <button
                key={box.id}
                type="button"
                onClick={() => {
                  onSelectBox(box.id);
                  handleClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer active:scale-[0.98] border ${
                  isSelected
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                    : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                    <BoxThumbnail box={box} size="sm" />
                  </div>
                  <div className="text-right truncate">
                    <div className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>{box.title}</div>
                    {box.description ? (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{box.description}</div>
                    ) : (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">باکس اختصاصی</div>
                    )}
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

