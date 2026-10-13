import React from 'react';
import type { Box, Note } from '@/types/models';
import { noteRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import {
  RiCloseLine,
  RiFolderTransferLine,
  RiInboxLine,
  RiCheckLine,
} from '@remixicon/react';
import { toPersianDigits } from '@/lib/jalali';

interface MoveNoteModalProps {
  isOpen: boolean;
  note: Note | null;
  boxes: Box[];
  boxNotesCountMap: Record<string, number>;
  onClose: () => void;
  onMoved: () => void;
}

export const MoveNoteModal: React.FC<MoveNoteModalProps> = ({
  isOpen,
  note,
  boxes,
  boxNotesCountMap,
  onClose,
  onMoved,
}) => {
  if (!isOpen || !note) return null;

  const currentBoxId = note.box_id || null;

  const handleSelectBox = async (targetBoxId: string | null) => {
    try {
      await noteRepo.update(note.id, { box_id: targetBoxId });
      const targetName = targetBoxId
        ? boxes.find((b) => b.id === targetBoxId)?.title || 'جعبه'
        : 'بدون جعبه';
      toast.show(`یادداشت به «${targetName}» منتقل شد`);
      onMoved();
      onClose();
    } catch (err) {
      console.error('Failed to move note:', err);
      toast.show('خطا در انتقال یادداشت');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card border border-border/80 text-card-foreground rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <RiFolderTransferLine className="size-5 text-primary" />
            <h3 className="font-darvish text-base font-bold">انتقال یادداشت به جعبه</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <RiCloseLine className="size-4.5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1">
          یادداشت: <span className="font-bold text-foreground">{note.title || 'بدون عنوان'}</span>
        </p>

        {/* Box List */}
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto no-scrollbar py-1">
          {/* Uncategorized option */}
          <button
            type="button"
            onClick={() => handleSelectBox(null)}
            className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${
              currentBoxId === null
                ? 'bg-primary/10 border border-primary/40 font-bold'
                : 'bg-secondary/40 hover:bg-secondary/80 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="size-7 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <RiInboxLine className="size-4" />
              </span>
              <span className="text-xs">بدون جعبه (عمومی)</span>
            </div>
            {currentBoxId === null && <RiCheckLine className="size-4 text-primary" />}
          </button>

          {/* Custom Boxes */}
          {boxes.map((box) => {
            const isSelected = currentBoxId === box.id;
            const count = boxNotesCountMap[box.id] || 0;
            return (
              <button
                key={box.id}
                type="button"
                onClick={() => handleSelectBox(box.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/40 font-bold'
                    : 'bg-secondary/40 hover:bg-secondary/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${box.color || '#8B5CF6'}22` }}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: box.color || '#8B5CF6' }}
                    />
                  </span>
                  <span className="text-xs truncate">{box.title}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {toPersianDigits(count)}
                  </span>
                  {isSelected && <RiCheckLine className="size-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
