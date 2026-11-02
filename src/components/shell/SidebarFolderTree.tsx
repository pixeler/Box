import React, { useEffect, useMemo, useState } from 'react';
import type { Box, Note } from '@/types/models';
import { useNotebook } from '@/components/notebook/NotebookContext';
import { boxRepo, noteRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import { CHROME_MENU_Z } from '@/lib/overlayLayer';
import { toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  FileText,
  Folder,
  FolderPlus,
  Layers,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { NoteGlyph } from '@/components/notebook/NoteGlyph';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';

interface SidebarFolderTreeProps {
  onNavigate: () => void;
  /** False when the parent "یادداشت‌ها" row already acts as "all notes". */
  showAll?: boolean;
}

interface FolderRowProps {
  box: Box;
  depth: number;
  count: number;
  active: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggle: () => void;
  /** The folder's own right-click actions. */
  menu: React.ReactNode;
  children?: React.ReactNode;
}

const FolderRow: React.FC<FolderRowProps> = ({
  box,
  depth,
  count,
  active,
  expanded,
  hasChildren,
  onSelect,
  onToggle,
  menu,
  children,
}) => (
  <div>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group/folder flex h-8 min-w-0 items-center gap-1.5 rounded-md pe-3 transition-colors',
            active
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
          )}
          style={{ paddingInlineStart: `${8 + depth * 12}px` }}
        >
      <button
        type="button"
        onClick={onToggle}
        aria-label={hasChildren ? (expanded ? 'بستن پوشه' : 'باز کردن پوشه') : undefined}
        tabIndex={hasChildren ? 0 : -1}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded text-subtle transition-colors',
          hasChildren
            ? 'hover:text-foreground'
            : 'pointer-events-none text-transparent'
        )}
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={onSelect}
        title={box.title}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-right outline-none"
      >
        <Folder className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-5">{box.title}</span>
        {count > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-subtle">
            {toPersianDigits(count)}
          </span>
        )}
      </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52 p-1" style={{ zIndex: CHROME_MENU_Z }}>
        {menu}
      </ContextMenuContent>
    </ContextMenu>

    {expanded && children}
  </div>
);

/**
 * The compact folder tree that lives inside the main sidebar. It is a
 * navigation surface, not a full file manager: selecting a folder filters the
 * notes view; opening a folder also reveals the notes inside it, and the note
 * that is open is highlighted here in both directions.
 */
export const SidebarFolderTree: React.FC<SidebarFolderTreeProps> = ({
  onNavigate,
  showAll = true,
}) => {
  const {
    boxes,
    notes,
    currentFolderId,
    setCurrentFolderId,
    editingNote,
    noteEditModalOpen,
    setEditingNote,
    setNoteEditModalOpen,
    setNoteViewModeOverride,
    loadData,
    handleOpenCreateBox,
    setBoxToEdit,
    setCreateBoxOpen,
  } = useNotebook();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [boxToDelete, setBoxToDelete] = useState<Box | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach((note) => {
      if (!note.box_id) return;
      map[note.box_id] = (map[note.box_id] || 0) + 1;
    });
    return map;
  }, [notes]);

  const notesByBox = useMemo(() => {
    const map: Record<string, Note[]> = {};
    notes.forEach((note) => {
      if (!note.box_id) return;
      if (!map[note.box_id]) map[note.box_id] = [];
      map[note.box_id].push(note);
    });
    Object.values(map).forEach((list) =>
      list.sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          (a.title || '').localeCompare(b.title || '', 'fa')
      )
    );
    return map;
  }, [notes]);

  const byParent = useMemo(() => {
    const map: Record<string, Box[]> = {};
    boxes.forEach((box) => {
      const key = box.parent_id || 'root';
      if (!map[key]) map[key] = [];
      map[key].push(box);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'fa'))
    );
    return map;
  }, [boxes]);

  // Reveal the active folder's ancestors when the user arrives from a note.
  useEffect(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return;

    const ancestors: string[] = [];
    const seen = new Set<string>();
    let cursor = boxes.find((box) => box.id === currentFolderId)?.parent_id ?? null;

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      ancestors.push(cursor);
      cursor = boxes.find((box) => box.id === cursor)?.parent_id ?? null;
    }

    if (!ancestors.length) return;
    setExpandedIds((previous) => {
      const next = new Set(previous);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [boxes, currentFolderId]);

  // A note opened from anywhere keeps its folder open here.
  useEffect(() => {
    const boxId = noteEditModalOpen && editingNote?.box_id;
    if (!boxId) return;
    setExpandedIds((previous) => {
      if (previous.has(boxId)) return previous;
      const next = new Set(previous);
      next.add(boxId);
      return next;
    });
  }, [noteEditModalOpen, editingNote?.box_id]);

  const selectFolder = (id: string | null | 'all_notes') => {
    setCurrentFolderId(id);
    onNavigate();
  };

  const openNote = (note: Note) => {
    // Show the note's own folder behind it, so closing the note lands on the
    // folder the note lives in, and open the note in its full view.
    setCurrentFolderId(note.box_id ?? null);
    setEditingNote(note);
    setNoteEditModalOpen(true);
    setNoteViewModeOverride('fullscreen');
    onNavigate();
  };

  const togglePin = async (note: Note) => {
    try {
      await noteRepo.update(note.id, { pinned: !note.pinned });
      toast.show(note.pinned ? 'از سنجاق خارج شد' : 'سنجاق شد');
      await loadData();
    } catch (error) {
      console.error('Failed to toggle the note pin:', error);
      toast.show('تغییر وضعیت سنجاق انجام نشد');
    }
  };

  const duplicateNote = async (note: Note) => {
    try {
      await noteRepo.duplicate(note.id);
      toast.show('یادداشت تکثیر شد');
      await loadData();
    } catch (error) {
      console.error('Failed to duplicate the note:', error);
      toast.show('تکثیر یادداشت انجام نشد');
    }
  };

  const deleteNote = async (note: Note) => {
    try {
      await noteRepo.softDelete(note.id);
      if (editingNote?.id === note.id) {
        setNoteEditModalOpen(false);
        setEditingNote(null);
      }
      toast.show('یادداشت حذف شد');
      await loadData();
    } catch (error) {
      console.error('Failed to delete the note:', error);
      toast.show('حذف یادداشت انجام نشد');
    }
  };

  const copyNoteTitle = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.title?.trim() || 'بدون عنوان');
      toast.show('عنوان کپی شد');
    } catch {
      toast.show('کپی عنوان انجام نشد');
    }
  };

  /** A folder takes its subfolders with it; its notes move to the root. */
  const collectSubtreeIds = (rootId: string): string[] => {
    const ids = [rootId];
    for (let i = 0; i < ids.length; i++) {
      boxes.filter((box) => box.parent_id === ids[i]).forEach((box) => ids.push(box.id));
    }
    return ids;
  };

  const confirmDeleteBox = async () => {
    if (!boxToDelete) return;
    const removedIds = collectSubtreeIds(boxToDelete.id);
    try {
      for (const id of removedIds) {
        await boxRepo.delete(id);
      }
      if (currentFolderId && removedIds.includes(currentFolderId)) {
        setCurrentFolderId(boxToDelete.parent_id ?? null);
      }
      toast.show('پوشه حذف شد، یادداشت‌هایش به ریشه منتقل شدند');
      await loadData();
    } catch (error) {
      console.error('Failed to delete the folder:', error);
      toast.show('حذف پوشه انجام نشد');
    } finally {
      setBoxToDelete(null);
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderBox = (box: Box, depth = 0): React.ReactNode => {
    const children = byParent[box.id] || [];
    const folderNotes = notesByBox[box.id] || [];
    const hasChildren = children.length > 0 || folderNotes.length > 0;
    const expanded = expandedIds.has(box.id);
    const activeNoteId = noteEditModalOpen ? editingNote?.id : null;

    return (
      <FolderRow
        key={box.id}
        box={box}
        depth={depth}
        count={counts[box.id] || 0}
        active={currentFolderId === box.id && !activeNoteId}
        expanded={expanded}
        hasChildren={hasChildren}
        onSelect={() => selectFolder(box.id)}
        onToggle={() => toggleFolder(box.id)}
        menu={
          <>
            <ContextMenuItem onSelect={() => selectFolder(box.id)}>
              <Folder className="size-3.5 text-subtle" />
              <span>باز کردن</span>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => handleOpenCreateBox(box.id)}>
              <FolderPlus className="size-3.5 text-subtle" />
              <span>زیرپوشه جدید</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                setBoxToEdit(box);
                setCreateBoxOpen(true);
              }}
            >
              <Pencil className="size-3.5 text-subtle" />
              <span>تغییر نام و ظاهر</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => setBoxToDelete(box)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="size-3.5" />
              <span>حذف پوشه</span>
            </ContextMenuItem>
          </>
        }
      >
        {children.map((child) => renderBox(child, depth + 1))}

        {folderNotes.map((note) => {
          const active = activeNoteId === note.id;
          return (
            <ContextMenu key={note.id}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  onClick={() => openNote(note)}
                  title={note.title?.trim() || 'بدون عنوان'}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md pe-3 text-right transition-colors',
                    active
                      ? 'bg-foreground/[0.06] text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                  )}
                  style={{ paddingInlineStart: `${28 + depth * 12}px` }}
                >
                  {note.icon ? (
                    <NoteGlyph
                      icon={note.icon}
                      className="size-3.5 shrink-0"
                      emojiClassName="text-[12px]"
                    />
                  ) : (
                    <FileText className="size-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] leading-5">
                    {note.title?.trim() || 'بدون عنوان'}
                  </span>
                </button>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-52 p-1" style={{ zIndex: CHROME_MENU_Z }}>
                <ContextMenuItem onSelect={() => openNote(note)}>
                  <FileText className="size-3.5 text-subtle" />
                  <span>باز کردن</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void togglePin(note)}>
                  {note.pinned ? (
                    <PinOff className="size-3.5 text-subtle" />
                  ) : (
                    <Pin className="size-3.5 text-subtle" />
                  )}
                  <span>{note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void duplicateNote(note)}>
                  <Layers className="size-3.5 text-subtle" />
                  <span>تکثیر</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void copyNoteTitle(note)}>
                  <Copy className="size-3.5 text-subtle" />
                  <span>کپی عنوان</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => void deleteNote(note)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  <span>حذف یادداشت</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </FolderRow>
    );
  };

  const roots = byParent.root || [];

  return (
    <>
    <div className="flex flex-col gap-0.5">
      {showAll && (
        <button
          type="button"
          onClick={() => selectFolder('all_notes')}
          className={cn(
            'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[13px] transition-colors',
            currentFolderId === 'all_notes'
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
          )}
        >
          <Layers className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-right">همه یادداشت‌ها</span>
          <span className="shrink-0 text-[11px] tabular-nums text-subtle">
            {toPersianDigits(notes.length)}
          </span>
        </button>
      )}

      {roots.length === 0 ? (
        <p className="px-2 py-1.5 text-[12px] leading-5 text-subtle">هنوز پوشه‌ای نساخته‌ای.</p>
      ) : (
        roots.map((box) => renderBox(box))
      )}
    </div>

    <DeleteConfirmSheet
      isOpen={Boolean(boxToDelete)}
      title="حذف پوشه"
      itemTitle={boxToDelete?.title}
      description="زیرپوشه‌های این پوشه هم حذف می‌شوند. یادداشت‌های داخل آن‌ها پاک نمی‌شوند و به ریشه منتقل می‌شوند."
      confirmLabel="حذف پوشه"
      onConfirm={confirmDeleteBox}
      onClose={() => setBoxToDelete(null)}
    />
    </>
  );
};
