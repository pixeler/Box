import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Tag } from '@/types/models';
import { noteRepo, tagRepo } from '@/repositories';
import { TagPickerPopover } from '../tags/TagPickerPopover';
const BlockNoteEditor = React.lazy(() =>
  import('@/components/editor/BlockNoteEditor').then((m) => ({
    default: m.BlockNoteEditor,
  }))
);
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiPriceTag3Line,
  RiDeleteBinLine,
  RiFullscreenLine,
  RiWindowLine,
  RiLayoutRightLine,
} from '@remixicon/react';

export type NotionViewMode = 'side-peek' | 'center' | 'fullscreen';

interface NoteEditModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const extractNoteData = (n: Note | null) => {
  if (!n) return { title: '', description: '', isPinned: false, tagIds: [], boxId: null };
  const noteTitle = n.title?.trim() || '';
  let bodyText = '';
  if (n.description !== undefined && n.description !== null && n.description.trim() !== '') {
    bodyText = n.description.trim();
  } else if (n.body) {
    let body = n.body.trim();
    if (noteTitle && body.startsWith(noteTitle)) {
      bodyText = body.slice(noteTitle.length).trim();
    } else if (noteTitle && body.startsWith(`# ${noteTitle}`)) {
      bodyText = body.slice(`# ${noteTitle}`.length).trim();
    } else if (body !== noteTitle) {
      bodyText = body;
    }
  }
  return {
    title: noteTitle,
    description: bodyText,
    isPinned: !!n.pinned,
    tagIds: n.tag_ids || [],
    boxId: n.box_id || null,
  };
};

export const NoteEditModal: React.FC<NoteEditModalProps> = ({
  note,
  isOpen,
  onClose,
  onSaved,
}) => {
  const initialData = extractNoteData(note);
  const [isClosing, setIsClosing] = useState(false);
  const [viewMode, setViewMode] = useState<NotionViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notion_note_view_mode') as NotionViewMode;
      if (saved === 'side-peek' || saved === 'center' || saved === 'fullscreen') {
        return saved;
      }
    }
    return 'side-peek';
  });

  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description);
  const [isPinned, setIsPinned] = useState(initialData.isPinned);
  const [tagIds, setTagIds] = useState<string[]>(initialData.tagIds);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [selectedBox, setSelectedBox] = useState<string>(initialData.boxId || '');

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevNoteIdRef = useRef(note?.id);
  const prevIsOpenRef = useRef(isOpen);

  const lastSavedRef = useRef<{
    title: string;
    description: string;
    isPinned: boolean;
    tagIds: string[];
    boxId: string | null;
  }>({
    title: initialData.title,
    description: initialData.description,
    isPinned: initialData.isPinned,
    tagIds: initialData.tagIds,
    boxId: initialData.boxId,
  });

  const handleSetViewMode = (mode: NotionViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notion_note_view_mode', mode);
    }
  };

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
  }, []);

  // Sync only on opening or note ID change
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const noteChanged = note?.id !== prevNoteIdRef.current;

    if (note && isOpen && (justOpened || noteChanged)) {
      const data = extractNoteData(note);
      setTitle(data.title);
      setDescription(data.description);
      setIsPinned(data.isPinned);
      setTagIds(data.tagIds);
      setSelectedBox(data.boxId || '');
      setIsClosing(false);
      lastSavedRef.current = {
        title: data.title,
        description: data.description,
        isPinned: data.isPinned,
        tagIds: [...data.tagIds],
        boxId: data.boxId,
      };

      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.style.height = 'auto';
          titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
          titleInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    prevNoteIdRef.current = note?.id;
    prevIsOpenRef.current = isOpen;
  }, [note?.id, isOpen]);

  // Auto-resize title textarea as user types
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title, isOpen]);

  const performSave = useCallback(
    async (overrides?: {
      title?: string;
      description?: string;
      isPinned?: boolean;
      tagIds?: string[];
      boxId?: string | null;
    }) => {
      if (!note) return;

      const currentTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      const currentDesc = (overrides?.description !== undefined ? overrides.description : description).trim();
      const currentPinned = overrides?.isPinned !== undefined ? overrides.isPinned : isPinned;
      const currentTags = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;
      const currentBoxId = overrides?.boxId !== undefined ? overrides.boxId : selectedBox;

      if (!currentTitle && !currentDesc) return;

      const last = lastSavedRef.current;
      const tagsUnchanged =
        last.tagIds.length === currentTags.length &&
        last.tagIds.every((id, idx) => id === currentTags[idx]);

      if (
        last.title === currentTitle &&
        last.description === currentDesc &&
        last.isPinned === currentPinned &&
        last.boxId === (currentBoxId || null) &&
        tagsUnchanged
      ) {
        return;
      }

      lastSavedRef.current = {
        title: currentTitle,
        description: currentDesc,
        isPinned: currentPinned,
        tagIds: [...currentTags],
        boxId: currentBoxId || null,
      };

      try {
        await noteRepo.update(note.id, {
          title: currentTitle,
          description: currentDesc,
          body: currentDesc,
          pinned: currentPinned,
          tag_ids: currentTags,
          box_id: currentBoxId || null,
        });
        onSaved();
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      }
    },
    [note, title, description, isPinned, tagIds, selectedBox, onSaved]
  );

  const scheduleSave = useCallback(
    (delay = 400, overrides?: Parameters<typeof performSave>[0]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        performSave(overrides);
      }, delay);
    },
    [performSave]
  );

  const handleClose = () => {
    if (isClosing) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    performSave();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (tagPickerOpen) {
          setTagPickerOpen(false);
          return;
        }
        if (deleteConfirmOpen) {
          setDeleteConfirmOpen(false);
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tagPickerOpen, deleteConfirmOpen]);

  const handleTogglePin = () => {
    const nextVal = !isPinned;
    setIsPinned(nextVal);
    scheduleSave(0, { isPinned: nextVal });
  };

  const handleToggleTag = (tagId: string) => {
    const nextTags = tagIds.includes(tagId)
      ? tagIds.filter((id) => id !== tagId)
      : [...tagIds, tagId];
    setTagIds(nextTags);
    scheduleSave(0, { tagIds: nextTags });
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!note) return;
    try {
      await noteRepo.softDelete(note.id);
      setDeleteConfirmOpen(false);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  if (!isOpen && !isClosing) return null;
  if (!note) return null;

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  // Compute outer backdrop and inner container classes based on Notion view mode
  let backdropClasses = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs select-none transition-all duration-200';
  let containerClasses = 'bg-card text-card-foreground font-sans text-right flex flex-col transition-all duration-200 overflow-hidden';

  if (viewMode === 'fullscreen') {
    containerClasses += ' fixed inset-0 z-[101] w-screen h-screen p-6 md:px-16 md:py-8 flex flex-col bg-card rounded-none';
  } else if (viewMode === 'center') {
    backdropClasses += ' flex items-center justify-center p-4 sm:p-6';
    containerClasses += ' relative w-full sm:max-w-2xl md:max-w-3xl h-[88vh] sm:h-[84vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-border p-5 sm:p-7';
  } else {
    // side-peek (slides in from the edge)
    backdropClasses += ' flex justify-start';
    containerClasses += ' fixed inset-y-0 left-0 z-[101] w-full sm:w-[580px] md:w-[640px] h-full shadow-2xl border-r border-border bg-card p-5 sm:p-8 animate-in slide-in-from-left duration-200';
  }

  return createPortal(
    <div className={backdropClasses} onClick={handleClose} dir="rtl">
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={containerClasses}
        dir="rtl"
      >
        {/* Top Header: Notion view switchers + Delete + Close */}
        <div className="flex items-center justify-between pb-3 border-b border-border/50 shrink-0 mb-3">
          {/* Right side (RTL start): Mode Switcher (Desktop only) */}
          <div className="hidden sm:flex items-center gap-1 bg-secondary/80 p-0.5 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => handleSetViewMode('side-peek')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'side-peek'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="نیم‌پنجره کناری (Side Peek)"
            >
              <RiLayoutRightLine className="w-4 h-4" />
              <span className="hidden md:inline text-[11px]">کناری</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('center')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'center'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="پنجره مرکزی (Center)"
            >
              <RiWindowLine className="w-4 h-4" />
              <span className="hidden md:inline text-[11px]">مرکزی</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('fullscreen')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'fullscreen'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="تمام صفحه (Full Screen)"
            >
              <RiFullscreenLine className="w-4 h-4" />
              <span className="hidden md:inline text-[11px]">تمام‌صفحه</span>
            </button>
          </div>

          {/* Left side (RTL end): Action buttons (Delete & Close) */}
          <div className="flex items-center gap-1.5 mr-auto">
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="حذف یادداشت"
            >
              <RiDeleteBinLine className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="بستن (Esc)"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Note Form & Content */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleClose();
          }}
          className={`flex-1 flex flex-col justify-between min-h-0 ${
            viewMode === 'fullscreen' ? 'max-w-4xl mx-auto w-full' : ''
          }`}
        >
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-1 min-h-0">
            {/* Title Textarea: auto-expanding */}
            <textarea
              ref={titleInputRef}
              rows={1}
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
                scheduleSave(400, { title: val });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleClose();
                }
              }}
              placeholder="عنوان یادداشت..."
              className="w-full font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition-all resize-none overflow-y-auto max-h-[140px] leading-snug break-words [overflow-wrap:anywhere] text-xl sm:text-2xl"
              dir="rtl"
            />

            {/* Note Property Chips Row */}
            <div className="flex items-center gap-2.5 mt-3 flex-wrap">
              {/* پین‌کردن */}
              <button
                type="button"
                onClick={handleTogglePin}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  isPinned
                    ? 'bg-secondary border-border text-foreground font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                {isPinned ? (
                  <RiPushpinFill className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <RiPushpinLine className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>سنجاق</span>
              </button>

              {/* برچسب */}
              <button
                type="button"
                onClick={() => setTagPickerOpen(!tagPickerOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  selectedTags.length > 0
                    ? 'border-border bg-secondary/50 text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                <RiPriceTag3Line className="w-3.5 h-3.5" />
                <span>
                  {selectedTags.length > 0
                    ? selectedTags.map((t) => `#${t.name}`).join(' ')
                    : 'برچسب'}
                </span>
              </button>
            </div>

            {/* BlockNote Body Editor */}
            <div className="flex-1 overflow-y-auto mt-4 border-t border-border/60 pt-3 min-h-[220px]">
              <React.Suspense
                fallback={
                  <div className="p-3 text-xs text-muted-foreground/60 animate-pulse">
                    در حال بارگذاری ادیتور...
                  </div>
                }
              >
                <BlockNoteEditor
                  key={`${note.id}-${isOpen ? 'open' : 'closed'}`}
                  initialContent={description}
                  onChange={(md) => {
                    setDescription(md);
                    scheduleSave(400, { description: md });
                  }}
                  placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                  minHeight="220px"
                />
              </React.Suspense>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Sheet */}
      <DeleteConfirmSheet
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="حذف یادداشت"
        description="آیا از انتقال این یادداشت به سطل زباله مطمئن هستید؟"
      />

      {/* Tag Picker Popover */}
      {tagPickerOpen && (
        <TagPickerPopover
          selectedTagIds={tagIds}
          onToggleTag={handleToggleTag}
          onClose={() => setTagPickerOpen(false)}
        />
      )}
    </div>,
    document.body
  );
};
