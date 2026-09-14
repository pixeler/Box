import React, { useEffect } from 'react';
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
        className="bg-card text-card-foreground rounded-t-3xl border-t border-border/80 dark:border-white/10 shadow-2xl p-4 pb-6 space-y-2.5 animate-sheet-up max-h-[75%] flex flex-col"
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-1.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60 dark:border-white/10 shrink-0">
          <h3 className="text-xs font-bold text-foreground">انتخاب باکس (جعبه)</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Box Items List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-1">
          {/* بدون جعبه */}
          <button
            type="button"
            onClick={() => {
              onSelectBox(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer active:scale-[0.98] border ${
              !selectedBoxId
                ? 'bg-secondary border-border text-foreground font-bold shadow-xs dark:bg-white/10 dark:border-white/20'
                : 'border-transparent hover:bg-muted/60 dark:hover:bg-white/5 text-foreground/85'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/60 dark:bg-white/5 flex items-center justify-center text-muted-foreground shrink-0">
                <RiInboxArchiveLine className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs font-bold">بدون جعبه</div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5">عمومی و بدون دسته‌بندی</div>
              </div>
            </div>
            {!selectedBoxId && (
              <RiCheckLine className="w-4 h-4 text-primary dark:text-white shrink-0 mr-2" />
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
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer active:scale-[0.98] border ${
                  isSelected
                    ? 'bg-secondary border-border text-foreground font-bold shadow-xs dark:bg-white/10 dark:border-white/20'
                    : 'border-transparent hover:bg-muted/60 dark:hover:bg-white/5 text-foreground/85'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 shrink-0 flex items-center justify-center">
                    <BoxThumbnail box={box} size="sm" />
                  </div>
                  <div className="text-right truncate">
                    <div className="text-xs font-bold truncate">{box.title}</div>
                    {box.description ? (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{box.description}</div>
                    ) : (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">باکس اختصاصی</div>
                    )}
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
