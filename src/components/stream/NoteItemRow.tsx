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
import { stripMarkdownForPreview } from '@/lib/markdown';
import { useIsMobile } from '@/lib/device';
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
  isLast?: boolean;
}

export const NoteItemRow: React.FC<NoteItemRowProps> = React.memo(({

  note,
  tagsMap: _tagsMap,
  onStatusChanged,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isLast = false,
}) => {
  const isMobile = useIsMobile();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const isPinned = !!note.pinned;

  const noteTitle = note.title?.trim() || '';
  const noteDescription = (() => {
    if (note.description !== undefined && note.description !== null) {
      return note.description.trim();
    }
    if (note.body && noteTitle) {
      if (note.body.startsWith(noteTitle)) {
        return note.body.slice(noteTitle.length).trim();
      }
      if (note.body.trim() !== noteTitle) {
        return note.body.trim();
      }
    }
    return '';
  })();

  const displayTitle = noteTitle || note.body || '';
  const displayDescription =
    displayTitle === note.body?.trim() && !note.description ? '' : noteDescription;

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
      <ContextMenu
        open={isMobile ? false : contextMenuOpen}
        onOpenChange={(open) => {
          if (isMobile) {
            setContextMenuOpen(false);
            return;
          }
          setContextMenuOpen(open);
        }}
      >
        <ContextMenuTrigger disabled={isMobile} asChild>
          <div
            draggable={!isMobile && draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onContextMenu={(e) => {
              if (isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={() => setEditModalOpen(true)}
            className={`group relative w-full ${
              !isLast ? 'task-dashed-border' : ''
            } ${
              note.color ? note.color : isPinned ? 'bg-amber-100/40 dark:bg-amber-950/20' : ''
            } py-3.5 px-6 select-none transition-all duration-150 stream-row-hover ${
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            }`}
          >
            <div className="flex items-start justify-between w-full">
              {/* 1. RIGHT SIDE in RTL: Sticky Note Icon + Pin + Note Content */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Sticky Note Icon on the far right */}
                <div className="shrink-0 mt-0.5 flex items-center gap-1">
                  <RiStickyNoteLine className="w-5 h-5 text-muted-foreground" />
                </div>

                {/* Note Content: Title and Description */}
                <div className="flex flex-col flex-1 min-w-0 text-right">
                  <div className="flex items-start gap-1.5 min-w-0">
                    {isPinned && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin();
                        }}
                        title="برداشتن سنجاق"
                        className="shrink-0 flex items-center text-muted-foreground hover:text-foreground cursor-pointer p-0.5 mt-0.5"
                      >
                        <RiPushpin2Fill className="w-3.5 h-3.5 text-primary" />
                      </button>
                    )}

                    <p className="text-[13.5px] font-medium text-foreground leading-snug break-words">
                      {stripMarkdownForPreview(displayTitle)}
                    </p>
                  </div>

                  {displayDescription && (
                    <p className="text-[12px] text-muted-foreground font-normal leading-relaxed mt-2 select-none break-words line-clamp-2">
                      {stripMarkdownForPreview(displayDescription)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right Click Context Menu */}
        {!isMobile && (
          <ContextMenuContent
            className="w-48 p-1.5"
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
              <RiFileTextLine className="size-4 text-muted-foreground" />
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
                  <RiPushpin2Line className="size-4 text-primary" />
                  <span>برداشتن سنجاق</span>
                </>
              ) : (
                <>
                  <RiPushpin2Fill className="size-4 text-muted-foreground" />
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
              <RiFileCopyLine className="size-4 text-muted-foreground" />
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
              <RiDeleteBinLine className="size-4 text-destructive" />
              <span>حذف یادداشت</span>
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Edit Modal */}
      {editModalOpen && (
        <NoteEditModal
          note={note}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSaved={onStatusChanged}
        />
      )}
    </>
  );
});
