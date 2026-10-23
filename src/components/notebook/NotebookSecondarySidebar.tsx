import React, { useEffect, useState } from 'react';
import type { Box, Note } from '@/types/models';
import { BoxThumbnail } from '@/components/boxes/BoxThumbnail';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiFileTextLine,
  RiFolderAddLine,
  RiFoldersLine,
  RiSideBarLine,
  RiStackLine,
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
  onCollapse?: () => void;
  onDropNoteOnBox: (noteId: string, targetBoxId: string | null) => void;
}

interface SidebarRowProps {
  label: string;
  count?: number;
  icon?: React.ReactNode;
  selected?: boolean;
  trailing?: React.ReactNode;
  indent?: number;
  onOpen: () => void;
  dragProps?: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  isDropTarget?: boolean;
}

/** One quiet navigation row, shared by smart views and folders. */
const SidebarRow: React.FC<SidebarRowProps> = ({
  label,
  count,
  icon,
  selected = false,
  trailing,
  indent = 0,
  onOpen,
  dragProps,
  isDropTarget = false,
}) => (
  <div
    {...dragProps}
    onClick={onOpen}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
    style={{ paddingInlineStart: `${indent + 4}px` }}
    aria-current={selected ? 'page' : undefined}
    className={`group/sidebar flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md pe-1.5 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
      selected
        ? 'bg-secondary/70 font-medium text-foreground'
        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
    } ${isDropTarget ? 'ring-2 ring-primary/30' : ''}`}
  >
    {trailing}

    <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>

    <span className="min-w-0 flex-1 truncate text-[11.5px] leading-5">{label}</span>

    {typeof count === 'number' && count > 0 && (
      <span
        className={`shrink-0 text-[9.5px] tabular-nums text-muted-foreground transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
        }`}
      >
        {toPersianDigits(count)}
      </span>
    )}
  </div>
);

export const NotebookSecondarySidebar: React.FC<NotebookSecondarySidebarProps> = ({
  boxes,
  notes,
  boxNotesCountMap,
  currentFolderId,
  onSelectFolder,
  onOpenNote,
  onCreateBox,
  onCollapse,
  onDropNoteOnBox,
}) => {
  const [expandedBoxIds, setExpandedBoxIds] = useState<Set<string>>(new Set());
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Reveal the folder the main view is showing, even when it sits a few levels down.
  useEffect(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return;

    const ancestors: string[] = [];
    const seen = new Set<string>();
    let cursor = boxes.find((b) => b.id === currentFolderId)?.parent_id ?? null;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      ancestors.push(cursor);
      cursor = boxes.find((b) => b.id === cursor)?.parent_id ?? null;
    }
    if (ancestors.length === 0) return;

    setExpandedBoxIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      ancestors.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [currentFolderId, boxes]);

  const rootBoxes = boxes.filter((b) => !b.parent_id);

  const itemCountFor = (boxId: string) =>
    (boxNotesCountMap[boxId] || 0) + boxes.filter((b) => b.parent_id === boxId).length;

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

  const dragPropsFor = (targetId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverTargetId(targetId ?? 'root');
    },
    onDragLeave: () => setDragOverTargetId(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverTargetId(null);
      const noteId =
        e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/note-id');
      if (noteId) onDropNoteOnBox(noteId, targetId);
    },
  });

  const boxGlyph = (box: Box) => <BoxThumbnail box={box} size="xs" />;

  const renderTreeNode = (box: Box, depth = 0) => {
    const isSelected = currentFolderId === box.id;
    const isDragOver = dragOverTargetId === box.id;
    const isExpanded = expandedBoxIds.has(box.id);
    const subBoxes = boxes.filter((b) => b.parent_id === box.id);
    const boxNotes = notes.filter((n) => n.box_id === box.id);
    const hasChildren = subBoxes.length > 0 || boxNotes.length > 0;

    return (
      <div key={box.id} className="flex flex-col">
        <SidebarRow
          label={box.title}
          count={itemCountFor(box.id)}
          indent={depth * 11}
          selected={isSelected}
          isDropTarget={isDragOver}
          onOpen={() => onSelectFolder(box.id)}
          dragProps={dragPropsFor(box.id)}
          icon={boxGlyph(box)}
          trailing={
            <button
              type="button"
              tabIndex={-1}
              aria-label={hasChildren ? (isExpanded ? 'بستن پوشه' : 'باز کردن پوشه') : undefined}
              onClick={(e) => toggleBoxExpansion(box.id, e)}
              className={`flex size-4 shrink-0 items-center justify-center rounded transition-colors ${
                hasChildren
                  ? `text-muted-foreground/60 hover:text-foreground ${
                      isExpanded || isSelected ? '' : 'opacity-0 group-hover/sidebar:opacity-100'
                    }`
                  : 'pointer-events-none text-transparent'
              }`}
            >
              {isExpanded ? (
                <RiArrowDownSLine className="size-3.5" />
              ) : (
                <RiArrowLeftSLine className="size-3.5" />
              )}
            </button>
          }
        />

        {isExpanded && hasChildren && (
          <div className="flex flex-col">
            {subBoxes.map((sub) => renderTreeNode(sub, depth + 1))}
            {boxNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => onOpenNote(note)}
                style={{ paddingInlineStart: `${(depth + 1) * 11 + 26}px` }}
                title={note.title || 'بدون عنوان'}
                className="flex h-6 min-w-0 items-center gap-1.5 rounded-md pe-2 text-right text-[10.5px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                <RiFileTextLine className="size-3 shrink-0 text-muted-foreground/60" />
                <span className="truncate">{note.title || 'بدون عنوان'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="flex h-full w-[196px] shrink-0 flex-col overflow-hidden border-l border-border/40 px-1.5 py-2.5 text-foreground select-none"
      dir="rtl"
      aria-label="پوشه‌ها و یادداشت‌ها"
    >
      <div className="mb-1 flex h-7 shrink-0 items-center justify-between ps-1.5 pe-0">
        <span className="text-[10.5px] font-medium text-muted-foreground/80">کتابخانه</span>

        <div className="flex items-center gap-0.5">
          {onCreateBox && (
            <button
              type="button"
              onClick={() => onCreateBox(null)}
              aria-label="پوشه جدید"
              title="پوشه جدید"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/80 outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiFolderAddLine className="size-3.5" />
            </button>
          )}

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="بستن سایدبار"
              title="بستن سایدبار"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/80 outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiSideBarLine className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto no-scrollbar">
        <SidebarRow
          label="همه یادداشت‌ها"
          count={notes.length}
          icon={<RiStackLine className="size-4" />}
          selected={currentFolderId === 'all_notes'}
          onOpen={() => onSelectFolder('all_notes')}
        />

        <SidebarRow
          label="همه پوشه‌ها"
          count={rootBoxes.length}
          icon={<RiFoldersLine className="size-4" />}
          selected={currentFolderId === null}
          onOpen={() => onSelectFolder(null)}
          dragProps={dragPropsFor(null)}
          isDropTarget={dragOverTargetId === 'root'}
        />

        <div className="my-1.5 h-px shrink-0 bg-border/40" />

        {rootBoxes.map((box) => renderTreeNode(box, 0))}
      </div>
    </aside>
  );
};

export const NotebookSecondarySidebarConnected: React.FC<{ onCollapse?: () => void }> = ({
  onCollapse,
}) => {
  const {
    boxes,
    notes,
    boxNotesCountMap,
    currentFolderId,
    setCurrentFolderId,
    setEditingNote,
    setNoteEditModalOpen,
    handleOpenCreateBox,
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
      onCreateBox={handleOpenCreateBox}
      onCollapse={onCollapse}
      onDropNoteOnBox={handleDropOnBox}
    />
  );
};
