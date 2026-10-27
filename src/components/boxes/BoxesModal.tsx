import React, { useState, useEffect, useCallback } from 'react';
import type { Box, Tag } from '@/types/models';
import { boxRepo } from '@/repositories';
import { BoxThumbnail } from './BoxThumbnail';
import { BoxDetailView } from './BoxDetailView';
import { CreateBoxSheet } from './CreateBoxSheet';
import {
  RiCloseLine,
  RiAddLine,
  RiInboxLine,
} from '@remixicon/react';

interface BoxesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddForBox: (boxId: string) => void;
  tagsMap: Record<string, Tag>;
  initialBoxId?: string | null;
}

export const BoxesModal: React.FC<BoxesModalProps> = ({
  isOpen,
  onClose,
  onOpenAddForBox,
  tagsMap,
  initialBoxId,
}) => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [boxToEdit, setBoxToEdit] = useState<Box | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const loadBoxes = useCallback(async () => {
    try {
      const list = await boxRepo.list();
      setBoxes(list);
      if (initialBoxId) {
        const found = list.find((b) => b.id === initialBoxId);
        if (found) setSelectedBox(found);
      }
    } catch (err) {
      console.error('Failed to load boxes:', err);
    }
  }, [initialBoxId]);

  useEffect(() => {
    if (isOpen) {
      loadBoxes();
      setIsClosing(false);
    } else {
      setSelectedBox(null);
    }
  }, [isOpen, loadBoxes]);

  // Handle ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (createSheetOpen) {
          setCreateSheetOpen(false);
          return;
        }
        if (selectedBox) {
          setSelectedBox(null);
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, createSheetOpen, selectedBox]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  const handleBoxSaved = () => {
    loadBoxes();
    setCreateSheetOpen(false);
    setBoxToEdit(null);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col bg-card text-card-foreground font-sans text-right select-none overflow-hidden ${
        isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
      }`}
      dir="rtl"
    >
      {selectedBox ? (
        /* View Inside Selected Box - Full Screen within card */
        <div className="flex-1 flex flex-col min-h-0 p-5">
          <BoxDetailView
            box={selectedBox}
            onBack={() => setSelectedBox(null)}
            onEditBox={(b) => {
              setBoxToEdit(b);
              setCreateSheetOpen(true);
            }}
            onOpenAddForBox={(boxId) => {
              handleClose();
              onOpenAddForBox(boxId);
            }}
            tagsMap={tagsMap}
          />
        </div>
      ) : (
        /* Main Boxes Grid View - Full Screen within card (matching PNG design) */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top Header: Title on Right, Close on Left */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50 dark:border-white/10 shrink-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              باکس‌ها
            </h1>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="بستن (Esc)"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>

          {/* 3-Column Grid of 3D Boxes - Full Height Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-24 no-scrollbar">
            {boxes.length === 0 ? (
              <div className="py-24 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-muted/60 dark:bg-white/5 flex items-center justify-center mx-auto text-muted-foreground">
                  <RiInboxLine className="w-8 h-8" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  هنوز باکسی ایجاد نشده است.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-7 text-center">
                {boxes.map((box) => (
                  <button
                    key={box.id}
                    type="button"
                    onClick={() => setSelectedBox(box)}
                    className="group flex flex-col items-center justify-center p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer select-none active:scale-95"
                  >
                    {/* Box 3D Thumbnail */}
                    <BoxThumbnail
                      box={box}
                      size="md"
                      className="group-hover:scale-105 transition-transform duration-200"
                    />

                    {/* Box Title */}
                    <span className="text-xs sm:text-[13px] font-medium text-foreground mt-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {box.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Floating Action Button: + باکس جدید */}
          <div className="absolute bottom-6 left-6 z-20">
            <button
              type="button"
              onClick={() => {
                setBoxToEdit(null);
                setCreateSheetOpen(true);
              }}
              className="flex items-center gap-2 bg-[#1f2329] hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 px-5 py-3 rounded-full text-xs font-bold shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <RiAddLine className="w-4 h-4 stroke-[2]" />
              <span>باکس جدید</span>
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Box Bottom Sheet */}
      <CreateBoxSheet
        isOpen={createSheetOpen}
        onClose={() => {
          setCreateSheetOpen(false);
          setBoxToEdit(null);
        }}
        onSaved={handleBoxSaved}
        editBox={boxToEdit}
      />
    </div>
  );
};
