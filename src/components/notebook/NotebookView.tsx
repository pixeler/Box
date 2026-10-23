import React, { useEffect, useMemo, useState } from 'react';
import type { Box, Note } from '@/types/models';
import { useNotebook } from './NotebookContext';
import { NoteCard } from './NoteCard';
import { FolderTile } from './FolderTile';
import { MoveNoteModal } from './MoveNoteModal';
import { NoteEditModal } from './NoteEditModal';
import { NotebookSecondarySidebarConnected } from './NotebookSecondarySidebar';
import { CreateBoxSheet } from '@/components/boxes/CreateBoxSheet';
import { BoxThumbnail } from '@/components/boxes/BoxThumbnail';
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import { boxRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import { toPersianDigits } from '@/lib/jalali';
import { useIsDesktop, useIsMobile } from '@/lib/device';
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFolderAddLine,
  RiFolderLine,
  RiMoreLine,
  RiPaletteLine,
  RiFolderOpenLine,
  RiFolderTransferLine,
  RiFileCopyLine,
  RiPushpinLine,
  RiPushpinFill,
  RiSideBarLine,
  RiSortAsc,
} from '@remixicon/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { NOTE_COLOR_PRESETS } from './noteTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  noteMenuContentClass,
  noteMenuDangerClass,
  noteMenuItemClass,
  noteMenuSeparatorClass,
} from './noteMenu';

interface TrailItem {
  id: string | null | 'all_notes';
  title: string;
}

type NoteSort = 'newest' | 'oldest' | 'updated' | 'title';
type FolderSort = 'newest' | 'title' | 'count';

const NOTE_SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: 'newest', label: 'تازه‌ترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'updated', label: 'آخرین ویرایش' },
  { value: 'title', label: 'عنوان (الفبا)' },
];

const FOLDER_SORT_OPTIONS: { value: FolderSort; label: string }[] = [
  { value: 'newest', label: 'تازه‌ترین' },
  { value: 'title', label: 'عنوان (الفبا)' },
  { value: 'count', label: 'بیشترین یادداشت' },
];

const readStored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const ancestorTrail = (box: Box | null, boxesMap: Record<string, Box>): Box[] => {
  const chain: Box[] = [];
  const seen = new Set<string>();
  let cursor = box?.parent_id ? boxesMap[box.parent_id] : null;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parent_id ? boxesMap[cursor.parent_id] : null;
  }
  return chain;
};

/**
 * The path to the current folder, like a file manager. The current folder is a
 * plain heading and every ancestor is a link. On a phone the ancestors fold into
 * one menu so the current folder keeps a readable width; on desktop they show.
 */
const Breadcrumbs: React.FC<{
  trail: TrailItem[];
  onNavigate: (id: string | null | 'all_notes') => void;
}> = ({ trail, onNavigate }) => {
  const isMobile = useIsMobile();
  const current = trail[trail.length - 1];

  let leading: TrailItem[] = [];
  let folded: TrailItem[] = [];

  if (!isMobile) {
    if (trail.length <= 4) {
      leading = trail.slice(0, -1);
    } else {
      leading = [trail[0]];
      folded = trail.slice(1, -1);
    }
  } else if (trail.length === 2) {
    leading = [trail[0]];
  } else if (trail.length > 2) {
    folded = trail.slice(0, -1);
  }

  const ancestorClass =
    'max-w-[92px] shrink truncate rounded px-1 py-0.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[150px]';

  const separator = (
    <RiArrowLeftSLine className="size-3.5 shrink-0 text-muted-foreground/40" />
  );

  return (
    <nav aria-label="مسیر پوشه" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-0.5" dir="rtl">
        {leading.map((item) => (
          <li key={item.id ?? 'root'} className="flex min-w-0 items-center gap-0.5">
            {separator}
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className={ancestorClass}
              title={item.title}
            >
              {item.title}
            </button>
          </li>
        ))}

        {folded.length > 0 && (
          <li className="flex min-w-0 items-center gap-0.5">
            {separator}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="پوشه‌های بالاتر"
                  title="پوشه‌های بالاتر"
                  className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RiMoreLine className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className={noteMenuContentClass}>
                {folded.map((item) => (
                  <DropdownMenuItem
                    key={item.id ?? 'root'}
                    className={noteMenuItemClass}
                    onClick={() => onNavigate(item.id)}
                  >
                    <RiFolderLine className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}

        <li className="flex min-w-0 items-center gap-0.5">
          {trail.length > 1 && separator}
          <h1 className="max-w-[150px] truncate px-1 text-[16px] font-semibold leading-tight text-foreground sm:max-w-[240px] sm:text-[17px]">
            {current.title}
          </h1>
        </li>
      </ol>
    </nav>
  );
};

const SectionHeading: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div className="flex items-baseline gap-1.5 px-0.5">
    <h2 className="text-[12.5px] font-semibold text-foreground">{title}</h2>
    {count > 0 && (
      <span className="text-[10.5px] text-muted-foreground">{toPersianDigits(count)}</span>
    )}
  </div>
);

/** The last tile in every notes grid: one tap starts a note in this folder. */
const NewNoteCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="یادداشت جدید"
    className="group flex aspect-[4/5] w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-border/50 bg-card p-3 text-center shadow-[0_4px_16px_rgba(15,15,13,0.05)] outline-none transition-shadow hover:shadow-[0_8px_24px_rgba(15,15,13,0.09)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-none dark:hover:shadow-none"
  >
    <span className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors group-hover:border-foreground/30 group-hover:text-foreground">
      <RiAddLine className="size-4" />
    </span>
    <span className="text-[12px] font-medium text-foreground">یادداشت جدید</span>
  </button>
);

export const NotebookView: React.FC = () => {
  const {
    notes,
    boxes,
    tagsMap,
    currentFolderId,
    setCurrentFolderId,
    boxNotesCountMap,
    editingNote,
    setEditingNote,
    noteEditModalOpen,
    setNoteEditModalOpen,
    createBoxOpen,
    setCreateBoxOpen,
    boxToEdit,
    setBoxToEdit,
    targetParentBoxId,
    setTargetParentBoxId,
    loadData,
    handleCreateNewNote,
    handleOpenCreateBox,
    handleDropOnBox,
  } = useNotebook();

  const [dragOverBoxId, setDragOverBoxId] = useState<string | null>(null);
  const [moveNoteModalOpen, setMoveNoteModalOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<Note | null>(null);
  const [boxToDelete, setBoxToDelete] = useState<Box | null>(null);
  const isDesktop = useIsDesktop();

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('notebook.sidebarOpen') === 'true';
    } catch {
      return false;
    }
  });

  const [noteSort, setNoteSort] = useState<NoteSort>(() =>
    readStored('notebook.noteSort', ['newest', 'oldest', 'updated', 'title'], 'newest')
  );

  const [folderSort, setFolderSort] = useState<FolderSort>(() =>
    readStored('notebook.folderSort', ['newest', 'title', 'count'], 'newest')
  );

  const changeNoteSort = (value: NoteSort) => {
    setNoteSort(value);
    try {
      window.localStorage.setItem('notebook.noteSort', value);
    } catch {
      // storage unavailable: sorting still works for this session
    }
  };

  const changeFolderSort = (value: FolderSort) => {
    setFolderSort(value);
    try {
      window.localStorage.setItem('notebook.folderSort', value);
    } catch {
      // storage unavailable: sorting still works for this session
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('notebook.sidebarOpen', String(next));
      } catch {
        // storage unavailable: the toggle still works for this session
      }
      return next;
    });
  };

  const boxesMap = useMemo(() => {
    const map: Record<string, Box> = {};
    boxes.forEach((b) => (map[b.id] = b));
    return map;
  }, [boxes]);

  const rootBoxes = useMemo(() => boxes.filter((b) => !b.parent_id), [boxes]);

  const currentBox = useMemo(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return null;
    return boxesMap[currentFolderId] || null;
  }, [currentFolderId, boxesMap]);

  const currentSubBoxes = useMemo(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return [];
    return boxes.filter((b) => b.parent_id === currentFolderId);
  }, [boxes, currentFolderId]);

  const folderBoxes = currentFolderId === null ? rootBoxes : currentSubBoxes;

  // A folder can disappear (deleted here or in another window); never stay in it.
  useEffect(() => {
    if (
      typeof currentFolderId === 'string' &&
      currentFolderId !== 'all_notes' &&
      !boxesMap[currentFolderId]
    ) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, boxesMap, setCurrentFolderId]);

  const trail = useMemo<TrailItem[]>(() => {
    if (currentFolderId === 'all_notes') {
      return [
        { id: null, title: 'یادداشت‌ها' },
        { id: 'all_notes', title: 'همه یادداشت‌ها' },
      ];
    }
    if (currentBox) {
      return [
        { id: null, title: 'یادداشت‌ها' },
        ...ancestorTrail(currentBox, boxesMap).map((b) => ({ id: b.id, title: b.title })),
        { id: currentBox.id, title: currentBox.title },
      ];
    }
    return [{ id: null, title: 'یادداشت‌ها' }];
  }, [currentFolderId, currentBox, boxesMap]);

  /**
   * Item count per folder: the notes directly inside it plus its subfolders,
   * so a folder that only holds other folders never reads as empty.
   */
  const boxItemCountMap = useMemo(() => {
    const childCount: Record<string, number> = {};
    boxes.forEach((b) => {
      if (b.parent_id) childCount[b.parent_id] = (childCount[b.parent_id] || 0) + 1;
    });
    const map: Record<string, number> = {};
    boxes.forEach((b) => {
      map[b.id] = (boxNotesCountMap[b.id] || 0) + (childCount[b.id] || 0);
    });
    return map;
  }, [boxes, boxNotesCountMap]);

  const sortedFolderBoxes = useMemo(() => {
    const list = [...folderBoxes];
    if (folderSort === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fa'));
    } else if (folderSort === 'count') {
      list.sort(
        (a, b) => (boxItemCountMap[b.id] || 0) - (boxItemCountMap[a.id] || 0)
      );
    } else {
      list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return list;
  }, [folderBoxes, folderSort, boxItemCountMap]);

  // Root (null): only notes without a folder. 'all_notes': every note.
  // Folder: only the notes inside it.
  const displayedNotes = useMemo(() => {
    let result: Note[] = [];
    if (currentFolderId === null) {
      result = notes.filter((n) => !n.box_id);
    } else if (currentFolderId === 'all_notes') {
      result = [...notes];
    } else {
      result = notes.filter((n) => n.box_id === currentFolderId);
    }

    const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0);

    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      switch (noteSort) {
        case 'oldest':
          return time(a.created_at) - time(b.created_at);
        case 'updated':
          return time(b.updated_at) - time(a.updated_at);
        case 'title':
          return (a.title || '').localeCompare(b.title || '', 'fa');
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
    return result;
  }, [notes, currentFolderId, noteSort]);

  /** The newest notes anywhere, for the overview on the first page. */
  const latestNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [notes]
  );

  const goUp = () => {
    if (currentFolderId === null) return;
    if (currentFolderId === 'all_notes') {
      setCurrentFolderId(null);
      return;
    }
    setCurrentFolderId(currentBox?.parent_id ?? null);
  };

  const folderTitleForCount = (id: string) => {
    const count = boxItemCountMap[id] || 0;
    return count === 0 ? 'خالی' : `${toPersianDigits(count)} مورد`;
  };

  const handleDropNoteOnBox = (e: React.DragEvent, boxId: string) => {
    e.preventDefault();
    setDragOverBoxId(null);
    const noteId =
      e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/note-id');
    if (noteId) handleDropOnBox(noteId, boxId);
  };

  // Note actions
  const handleTogglePin = async (note: Note) => {
    const { noteRepo } = await import('@/repositories');
    await noteRepo.update(note.id, { pinned: !note.pinned });
    loadData();
  };

  const handleDuplicateNote = async (note: Note) => {
    const { noteRepo } = await import('@/repositories');
    await noteRepo.duplicate(note.id);
    loadData();
  };

  const handleDeleteNote = async (note: Note) => {
    const { noteRepo } = await import('@/repositories');
    await noteRepo.softDelete(note.id);
    loadData();
  };

  const handleChangeNoteColor = async (note: Note, colorId: string) => {
    const { noteRepo } = await import('@/repositories');
    await noteRepo.update(note.id, { color: colorId });
    loadData();
  };

  /** A folder takes its subfolders with it; notes and tasks inside stay safe. */
  const collectSubtreeIds = (rootId: string): string[] => {
    const ids = [rootId];
    for (let i = 0; i < ids.length; i++) {
      boxes.filter((b) => b.parent_id === ids[i]).forEach((b) => ids.push(b.id));
    }
    return ids;
  };

  const handleConfirmDeleteBox = async () => {
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
      loadData();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      toast.show('خطا در حذف پوشه');
    }
  };

  const renderNoteCard = (note: Note, index: number) => {
    const noteBox = note.box_id ? boxesMap[note.box_id] : null;

    return (
      <ContextMenu key={note.id}>
        <ContextMenuTrigger asChild>
          <div className="min-w-0" onContextMenu={(e) => e.stopPropagation()}>
            <NoteCard
              note={note}
              index={index}
              box={noteBox}
              showBoxPath={!currentBox}
              tagsMap={tagsMap}
              onClick={() => {
                setEditingNote(note);
                setNoteEditModalOpen(true);
              }}
              onEdit={() => {
                setEditingNote(note);
                setNoteEditModalOpen(true);
              }}
              onDelete={() => handleDeleteNote(note)}
              onDuplicate={() => handleDuplicateNote(note)}
              onTogglePin={() => handleTogglePin(note)}
              onMoveToBox={() => {
                setNoteToMove(note);
                setMoveNoteModalOpen(true);
              }}
              onChangeColor={(colorId) => handleChangeNoteColor(note, colorId)}
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuItem
            className={noteMenuItemClass}
            onClick={() => {
              setEditingNote(note);
              setNoteEditModalOpen(true);
            }}
          >
            <RiEditLine className="size-3.5 text-muted-foreground" />
            <span>باز کردن</span>
          </ContextMenuItem>

          <ContextMenuItem className={noteMenuItemClass} onClick={() => handleTogglePin(note)}>
            {note.pinned ? (
              <RiPushpinFill className="size-3.5 text-muted-foreground" />
            ) : (
              <RiPushpinLine className="size-3.5 text-muted-foreground" />
            )}
            <span>{note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</span>
          </ContextMenuItem>

          <ContextMenuSub>
            <ContextMenuSubTrigger className={noteMenuItemClass}>
              <RiPaletteLine className="size-3.5 text-muted-foreground" />
              <span>رنگ کارت</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {NOTE_COLOR_PRESETS.map((preset) => (
                <ContextMenuItem
                  key={preset.id}
                  className={noteMenuItemClass}
                  onClick={() => handleChangeNoteColor(note, preset.id)}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: preset.dot }}
                  />
                  <span>{preset.name}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuItem
            className={noteMenuItemClass}
            onClick={() => {
              setNoteToMove(note);
              setMoveNoteModalOpen(true);
            }}
          >
            <RiFolderTransferLine className="size-3.5 text-muted-foreground" />
            <span>انتقال به پوشه</span>
          </ContextMenuItem>

          <ContextMenuItem
            className={noteMenuItemClass}
            onClick={() => handleDuplicateNote(note)}
          >
            <RiFileCopyLine className="size-3.5 text-muted-foreground" />
            <span>تکثیر</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
            onClick={() => handleDeleteNote(note)}
          >
            <RiDeleteBinLine className="size-3.5" />
            <span>حذف یادداشت</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div
      className="flex h-full w-full select-none overflow-hidden font-sans text-foreground"
      dir="rtl"
    >
      {isDesktop && (
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200 ease-out ${
            sidebarOpen ? 'w-[196px] opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <NotebookSecondarySidebarConnected onCollapse={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOOLBAR: back, breadcrumb, folder and note actions */}
      <header className="flex h-14 w-full shrink-0 items-center gap-1 border-b border-border/60 px-2.5 sm:px-4">
        {isDesktop && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'بستن سایدبار' : 'باز کردن سایدبار'}
            title={sidebarOpen ? 'بستن سایدبار' : 'باز کردن سایدبار'}
            aria-expanded={sidebarOpen}
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${
              sidebarOpen ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <RiSideBarLine className="size-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={goUp}
          disabled={currentFolderId === null}
          aria-label="بازگشت به پوشه بالاتر"
          title="بازگشت به پوشه بالاتر"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
        >
          <RiArrowRightLine className="size-[18px]" />
        </button>

        <Breadcrumbs trail={trail} onNavigate={setCurrentFolderId} />

        <div className="ms-1 flex shrink-0 items-center gap-1">
          {currentBox ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="گزینه‌های این پوشه"
                  title="گزینه‌های این پوشه"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RiMoreLine className="size-[18px]" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={6} className={noteMenuContentClass}>
                <DropdownMenuItem
                  className={noteMenuItemClass}
                  onClick={() => handleOpenCreateBox(currentBox.id)}
                >
                  <RiFolderAddLine className="size-3.5 text-muted-foreground" />
                  <span>زیرپوشه جدید</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className={noteMenuItemClass}
                  onClick={() => {
                    setBoxToEdit(currentBox);
                    setCreateBoxOpen(true);
                  }}
                >
                  <RiEditLine className="size-3.5 text-muted-foreground" />
                  <span>تغییر نام و ظاهر</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className={noteMenuSeparatorClass} />

                <DropdownMenuItem
                  className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
                  onClick={() => setBoxToDelete(currentBox)}
                >
                  <RiDeleteBinLine className="size-3.5" />
                  <span>حذف پوشه</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            currentFolderId !== 'all_notes' && (
              <button
                type="button"
                onClick={() => handleOpenCreateBox(null)}
                aria-label="پوشه جدید"
                title="پوشه جدید"
                className="flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-2"
              >
                <RiFolderAddLine className="size-[18px]" />
                <span className="hidden sm:inline">پوشه</span>
              </button>
            )
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="مرتب‌سازی"
                title="مرتب‌سازی"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RiSortAsc className="size-[18px]" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={6} className={noteMenuContentClass}>
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-medium text-muted-foreground">
                یادداشت‌ها
              </div>
              {NOTE_SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={noteMenuItemClass}
                  onClick={() => changeNoteSort(option.value)}
                >
                  <span className="flex-1">{option.label}</span>
                  {noteSort === option.value && (
                    <RiCheckLine className="size-3.5 text-foreground" />
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className={noteMenuSeparatorClass} />

              <div className="px-2 pb-1 pt-0.5 text-[10px] font-medium text-muted-foreground">
                پوشه‌ها
              </div>
              {FOLDER_SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={noteMenuItemClass}
                  onClick={() => changeFolderSort(option.value)}
                >
                  <span className="flex-1">{option.label}</span>
                  {folderSort === option.value && (
                    <RiCheckLine className="size-3.5 text-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={handleCreateNewNote}
            aria-label="یادداشت جدید"
            title="یادداشت جدید"
            className="flex h-8 items-center gap-1.5 rounded-full bg-foreground px-2.5 text-[11px] font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[11.5px]"
          >
            <RiAddLine className="size-4" />
            <span>یادداشت</span>
          </button>
        </div>
      </header>

      {/* BODY */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar" data-note-scroll>
        <div className="mx-auto flex w-full flex-col gap-6 px-3 pb-24 pt-4 sm:px-6 sm:pb-8 lg:px-8">
          {/* FOLDERS */}
          {currentFolderId !== 'all_notes' && (currentFolderId === null || folderBoxes.length > 0) && (
            <section className="flex flex-col gap-2">
              <SectionHeading title="پوشه‌ها" count={folderBoxes.length} />

              <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
                {sortedFolderBoxes.map((box) => (
                  <ContextMenu key={box.id}>
                    <ContextMenuTrigger asChild>
                      <div className="min-w-0" onContextMenu={(e) => e.stopPropagation()}>
                        <FolderTile
                          title={box.title}
                          meta={folderTitleForCount(box.id)}
                          thumbnail={<BoxThumbnail box={box} size="md" />}
                          onOpen={() => setCurrentFolderId(box.id)}
                          isDropTarget={dragOverBoxId === box.id}
                          onDragOverNote={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverBoxId(box.id);
                          }}
                          onDragLeaveNote={() => setDragOverBoxId(null)}
                          onDropNote={(e) => handleDropNoteOnBox(e, box.id)}
                        />
                      </div>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        className={noteMenuItemClass}
                        onClick={() => setCurrentFolderId(box.id)}
                      >
                        <RiFolderOpenLine className="size-3.5 text-muted-foreground" />
                        <span>باز کردن</span>
                      </ContextMenuItem>

                      <ContextMenuItem
                        className={noteMenuItemClass}
                        onClick={() => handleOpenCreateBox(box.id)}
                      >
                        <RiFolderAddLine className="size-3.5 text-muted-foreground" />
                        <span>زیرپوشه جدید</span>
                      </ContextMenuItem>

                      <ContextMenuItem
                        className={noteMenuItemClass}
                        onClick={() => {
                          setBoxToEdit(box);
                          setCreateBoxOpen(true);
                        }}
                      >
                        <RiEditLine className="size-3.5 text-muted-foreground" />
                        <span>تغییر نام و ظاهر</span>
                      </ContextMenuItem>

                      <ContextMenuSeparator />

                      <ContextMenuItem
                        className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
                        onClick={() => setBoxToDelete(box)}
                      >
                        <RiDeleteBinLine className="size-3.5" />
                        <span>حذف پوشه</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}

                <button
                  type="button"
                  onClick={() => handleOpenCreateBox(currentBox?.id ?? null)}
                  className="group flex min-h-[136px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-2 py-3 text-center outline-none transition-colors hover:border-border hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors group-hover:border-foreground/30 group-hover:text-foreground">
                    <RiAddLine className="size-5" />
                  </span>
                  <span className="block w-full truncate text-[12.5px] font-medium leading-5 text-foreground">
                    پوشه جدید
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* NOTES */}
          <section className="flex flex-col gap-2">
            <SectionHeading title="یادداشت‌ها" count={displayedNotes.length} />

            <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-3">
              {displayedNotes.map(renderNoteCard)}

              <NewNoteCard onClick={handleCreateNewNote} />
            </div>
          </section>

          {/* LATEST NOTES: only on the first page, folded or not */}
          {currentFolderId === null && latestNotes.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-[12.5px] font-semibold text-foreground">آخرین یادداشت‌ها</h2>
                <button
                  type="button"
                  onClick={() => setCurrentFolderId('all_notes')}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  دیدن همه
                </button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-3">
                {latestNotes.map(renderNoteCard)}
              </div>
            </section>
          )}
        </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuItem className={noteMenuItemClass} onClick={handleCreateNewNote}>
            <RiAddLine className="size-3.5 text-muted-foreground" />
            <span>یادداشت جدید</span>
          </ContextMenuItem>

          {currentFolderId !== 'all_notes' && (
            <ContextMenuItem
              className={noteMenuItemClass}
              onClick={() => handleOpenCreateBox(currentBox?.id ?? null)}
            >
              <RiFolderAddLine className="size-3.5 text-muted-foreground" />
              <span>{currentBox ? 'زیرپوشه جدید' : 'پوشه جدید'}</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger className={noteMenuItemClass}>
              <RiSortAsc className="size-3.5 text-muted-foreground" />
              <span>مرتب‌سازی یادداشت‌ها</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {NOTE_SORT_OPTIONS.map((option) => (
                <ContextMenuItem
                  key={option.value}
                  className={noteMenuItemClass}
                  onClick={() => changeNoteSort(option.value)}
                >
                  <span className="flex-1">{option.label}</span>
                  {noteSort === option.value && (
                    <span className="size-1.5 rounded-full bg-foreground" />
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      </div>

      {/* MODALS */}
      <CreateBoxSheet
        isOpen={createBoxOpen}
        onClose={() => {
          setCreateBoxOpen(false);
          setBoxToEdit(null);
          setTargetParentBoxId(null);
        }}
        onSaved={() => {
          loadData();
          setCreateBoxOpen(false);
          setBoxToEdit(null);
          setTargetParentBoxId(null);
        }}
        editBox={boxToEdit}
        parentId={targetParentBoxId}
        onRequestDelete={(box) => {
          setCreateBoxOpen(false);
          setBoxToEdit(null);
          setTargetParentBoxId(null);
          setBoxToDelete(box);
        }}
      />

      <NoteEditModal
        note={editingNote}
        isOpen={noteEditModalOpen}
        onClose={() => {
          setNoteEditModalOpen(false);
          setEditingNote(null);
        }}
        onSaved={loadData}
      />

      <MoveNoteModal
        isOpen={moveNoteModalOpen}
        note={noteToMove}
        boxes={boxes}
        boxNotesCountMap={boxNotesCountMap}
        onClose={() => {
          setMoveNoteModalOpen(false);
          setNoteToMove(null);
        }}
        onMoved={loadData}
      />

      <DeleteConfirmSheet
        isOpen={Boolean(boxToDelete)}
        title="حذف پوشه"
        itemTitle={boxToDelete?.title}
        description="زیرپوشه‌های این پوشه هم حذف می‌شوند. یادداشت‌های داخل آن‌ها پاک نمی‌شوند و به ریشه منتقل می‌شوند."
        confirmLabel="حذف پوشه"
        onConfirm={handleConfirmDeleteBox}
        onClose={() => setBoxToDelete(null)}
      />
    </div>
  );
};
