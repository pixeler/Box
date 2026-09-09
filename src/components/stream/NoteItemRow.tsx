import React, { useState } from 'react';
import type { Note, Tag } from '@/types/models';
import { noteRepo } from '@/repositories';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { NoteEditModal } from '@/components/notebook/NoteEditModal';
import {
  RiDeleteBinLine,
  RiFileTextLine,
  RiStickyNoteLine,
  RiPushpin2Line,
  RiPushpin2Fill,
  RiFileCopyLine,
} from '@remixicon/react';

interface NoteItemRowProps {
  note: Note;
  tagsMap: Record<string, Tag>;
  onStatusChanged: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const NoteItemRow: React.FC<NoteItemRowProps> = ({
  note,
  tagsMap: _tagsMap,
  onStatusChanged,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const isPinned = !!note.pinned;

  const handleDelete = async () => {
    await noteRepo.softDelete(note.id);
    onStatusChanged();
  };

  const handleTogglePin = async () => {
    await noteRepo.update(note.id, { pinned: !isPinned });
    onStatusChanged();
  };

  const handleDuplicate = async () => {
    await noteRepo.duplicate(note.id);
    onStatusChanged();
  };

  return (
    <>
      <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onClick={() => setEditModalOpen(true)}
            className={`group relative w-full border-b border-dotted border-gray-200 py-3 px-1 select-none transition-all duration-150 ${
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            } hover:bg-black/[0.015]`}
          >
            <div className="flex items-start justify-between w-full">
              {/* 1. RIGHT SIDE in RTL: Sticky Note Icon + Pin + Note text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Sticky Note Icon on the far right */}
                <div className="shrink-0 mt-0.5 flex items-center gap-1">
                  <RiStickyNoteLine className="w-5 h-5 text-gray-400" />
                </div>

                {/* Note Text and Pin Badge */}
                <div className="flex-1 min-w-0 text-right flex items-center gap-1.5">
                  {isPinned && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin();
                      }}
                      title="برداشتن سنجاق"
                      className="shrink-0 flex items-center text-gray-700 hover:text-black cursor-pointer p-0.5"
                    >
                      <RiPushpin2Fill className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <p className="text-[13.5px] font-bold text-gray-900 leading-relaxed truncate">
                    {note.body || note.title}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right Click Context Menu */}
        <ContextMenuContent
          className="w-48 p-1"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            onClick={() => {
              setContextMenuOpen(false);
              setEditModalOpen(true);
            }}
            className="gap-2 cursor-pointer"
          >
            <RiFileTextLine className="size-4 text-gray-500" />
            <span>باز کردن یادداشت</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              setContextMenuOpen(false);
              handleTogglePin();
            }}
            className="gap-2 cursor-pointer"
          >
            {isPinned ? (
              <>
                <RiPushpin2Line className="size-4 text-gray-500" />
                <span>برداشتن سنجاق</span>
              </>
            ) : (
              <>
                <RiPushpin2Fill className="size-4 text-gray-700" />
                <span>سنجاق کردن</span>
              </>
            )}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => {
              setContextMenuOpen(false);
              handleDuplicate();
            }}
            className="gap-2 cursor-pointer"
          >
            <RiFileCopyLine className="size-4 text-gray-500" />
            <span>تکثیر کردن (کپی)</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              setContextMenuOpen(false);
              handleDelete();
            }}
            className="gap-2 cursor-pointer"
          >
            <RiDeleteBinLine className="size-4 text-gray-600" />
            <span>حذف یادداشت</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit Modal */}
      <NoteEditModal
        note={note}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={onStatusChanged}
      />
    </>
  );
};
