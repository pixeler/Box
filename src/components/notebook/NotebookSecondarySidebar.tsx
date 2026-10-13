import React, { useState } from 'react';
import type { Box, Note } from '@/types/models';
import { BoxThumbnail } from '@/components/boxes/BoxThumbnail';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiInboxLine,
  RiFoldersLine,
  RiFileTextLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
} from '@remixicon/react';
import { useNotebook } from './NotebookContext';

interface NotebookSecondarySidebarProps {
  boxes: Box[];
  notes: Note[];
  boxNotesCountMap: Record<string, number>;
  currentFolderId: string | null | 'all_notes';
  onSelectFolder: (folderId: string | null | 'all_notes') => void;
  onOpenNote: (note: Note) => void;
  onCreateNote?: () => void;
  onCreateBox?: (parentId?: string | null) => void;
  onDropNoteOnBox: (noteId: string, targetBoxId: string | null) => void;
}

export const NotebookSecondarySidebar: React.FC<NotebookSecondarySidebarProps> = ({
  boxes,
  notes,
  boxNotesCountMap,
  currentFolderId,
  onSelectFolder,
  onOpenNote,
  onDropNoteOnBox,
}) => {
  const [expandedBoxIds, setExpandedBoxIds] = useState<Set<string>>(new Set());
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  const rootBoxes = boxes.filter((b) => !b.parent_id);
  const rootNotesCount = notes.filter((n) => !n.box_id).length;

  const toggleBoxExpansion = (boxId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedBoxIds((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) {
        next.delete(boxId);
      } else {
        next.add(boxId);
      }
      return next;
    });
  };

  const renderTreeNode = (box: Box, depth = 0) => {
    const isSelected = currentFolderId === box.id;
    const isDragOver = dragOverTargetId === box.id;
    const isExpanded = expandedBoxIds.has(box.id);
    const subBoxes = boxes.filter((b) => b.parent_id === box.id);
    const boxNotes = notes.filter((n) => n.box_id === box.id);
    const hasChildren = subBoxes.length > 0 || boxNotes.length > 0;

    return (
      <div key={box.id} className="flex flex-col select-none">
        <div
          onClick={() => onSelectFolder(box.id)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverTargetId(box.id);
          }}
          onDragLeave={() => setDragOverTargetId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverTargetId(null);
            const noteId =
              e.dataTransfer.getData('text/plain') ||
              e.dataTransfer.getData('text/note-id');
            if (noteId) onDropNoteOnBox(noteId, box.id);
          }}
          style={{ paddingRight: `${depth * 14 + 4}px` }}
          className={`group flex items-center justify-between py-1.5 pl-2 rounded-xl text-xs transition-all cursor-pointer text-right ${
            isSelected
              ? 'bg-primary/10 text-primary font-bold shadow-2xs'
              : 'text-foreground/80 hover:bg-secondary/70 hover:text-foreground font-medium'
          } ${
            isDragOver
              ? 'ring-2 ring-primary ring-offset-2 scale-[1.02] bg-primary/25'
              : ''
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => toggleBoxExpansion(box.id, e)}
              className={`p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors ${
                !hasChildren ? 'opacity-20 cursor-default' : 'cursor-pointer'
              }`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <RiArrowDownSLine className="w-3.5 h-3.5" />
                ) : (
                  <RiArrowLeftSLine className="w-3.5 h-3.5" />
                )
              ) : (
                <span className="w-3.5 h-3.5 inline-block text-center text-muted-foreground/30">•</span>
              )}
            </button>

            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <BoxThumbnail box={box} size="xs" className="w-5 h-5" />
            </div>

            <span className="truncate text-[12px]">{box.title}</span>
          </div>

          <span className="text-[11px] font-dana font-medium text-muted-foreground shrink-0 px-1">
            {toPersianDigits(boxNotesCountMap[box.id] || 0)}
          </span>
        </div>

        {isExpanded && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {subBoxes.map((sub) => renderTreeNode(sub, depth + 1))}
            {boxNotes.map((n) => (
              <div
                key={n.id}
                onClick={() => onOpenNote(n)}
                style={{ paddingRight: `${(depth + 1) * 14 + 18}px` }}
                className="flex items-center gap-2 py-1 pl-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer transition-colors group font-dana"
                title={n.title || 'بدون عنوان'}
              >
                <RiFileTextLine className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                <span className="truncate">{n.title || 'بدون عنوان'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="desktop-secondary-sidebar w-[240px] h-full shrink-0 flex flex-col py-4 px-3 text-foreground border-l border-border/40 bg-card/60 dark:bg-[#18191B]/80 backdrop-blur-xl select-none z-15 overflow-hidden transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] font-dana"
      dir="rtl"
      aria-label="منوی ساختار باکس‌ها و یادداشت‌ها"
    >
      <div className="flex flex-col gap-1 min-h-0 overflow-y-auto no-scrollbar w-full min-w-[206px]">
        {/* TOP ROOT OPTION: «باکس‌ها» */}
        {/* Represents Root / Main branch (currentFolderId === null). Selected by default. */}
        <div
          onClick={() => onSelectFolder(null)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverTargetId('root');
          }}
          onDragLeave={() => setDragOverTargetId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverTargetId(null);
            const noteId =
              e.dataTransfer.getData('text/plain') ||
              e.dataTransfer.getData('text/note-id');
            if (noteId) onDropNoteOnBox(noteId, null);
          }}
          className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer text-right ${
            currentFolderId === null
              ? 'bg-primary/10 text-primary font-bold shadow-2xs'
              : 'text-foreground/85 hover:bg-secondary/70 hover:text-foreground font-medium'
          } ${
            dragOverTargetId === 'root'
              ? 'ring-2 ring-primary ring-offset-2 scale-[1.02] bg-primary/20'
              : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <RiInboxLine className="w-5 h-5 shrink-0 text-primary" />
            <span className="text-[13px] font-bold">باکس‌ها</span>
          </div>

          {rootNotesCount > 0 && (
            <span className="text-[11px] font-dana font-medium text-muted-foreground shrink-0 px-1">
              {toPersianDigits(rootNotesCount)}
            </span>
          )}
        </div>

        {/* LIST OF BOXES (ROW OF BOXES) */}
        <div className="flex flex-col gap-0.5 pr-1 pt-1">
          {/* 1. FIRST BOX: «همه یادداشت‌ها» */}
          <div
            onClick={() => onSelectFolder('all_notes')}
            className={`group flex items-center justify-between py-1.5 pl-2 pr-1 rounded-xl text-xs transition-all cursor-pointer text-right ${
              currentFolderId === 'all_notes'
                ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                : 'text-foreground/80 hover:bg-secondary/70 hover:text-foreground font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="w-3.5 h-3.5 inline-block text-center text-muted-foreground/30">•</span>

              <div className="w-5 h-5 shrink-0 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <RiFoldersLine className="w-4.5 h-4.5" />
              </div>

              <span className="truncate text-[12px]">همه یادداشت‌ها</span>
            </div>

            <span className="text-[11px] font-dana font-medium text-muted-foreground shrink-0 px-1">
              {toPersianDigits(notes.length)}
            </span>
          </div>

          {/* 2. USER ROOT BOXES */}
          {rootBoxes.map((b) => renderTreeNode(b, 0))}
        </div>
      </div>
    </aside>
  );
};

export const NotebookSecondarySidebarConnected: React.FC = () => {
  const {
    boxes,
    notes,
    boxNotesCountMap,
    currentFolderId,
    setCurrentFolderId,
    setEditingNote,
    setNoteEditModalOpen,
    handleDropOnBox,
  } = useNotebook();

  return (
    <NotebookSecondarySidebar
      boxes={boxes}
      notes={notes}
      boxNotesCountMap={boxNotesCountMap}
      currentFolderId={currentFolderId}
      onSelectFolder={setCurrentFolderId}
      onOpenNote={(note) => {
        setEditingNote(note);
        setNoteEditModalOpen(true);
      }}
      onDropNoteOnBox={handleDropOnBox}
    />
  );
};
