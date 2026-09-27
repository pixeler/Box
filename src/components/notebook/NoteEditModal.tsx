import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Tag, Box } from '@/types/models';
import { noteRepo, tagRepo, boxRepo } from '@/repositories';
import { TagPickerPopover } from '../tags/TagPickerPopover';
const BlockNoteEditor = React.lazy(() => import('@/components/editor/BlockNoteEditor').then(m => ({ default: m.BlockNoteEditor })));
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiPriceTag3Line,
  RiDeleteBinLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
} from '@remixicon/react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description);
  const [isPinned, setIsPinned] = useState(initialData.isPinned);
  const [tagIds, setTagIds] = useState<string[]>(initialData.tagIds);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string>(initialData.boxId || '');

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
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

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    boxRepo.list().then(setBoxes);
  }, []);

  // Sync only on opening or note ID change (prevents re-syncing while typing)
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

  // Auto-resize title textarea as user types or changes content
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
        currentTags.length === last.tagIds.length &&
        currentTags.every((id, idx) => id === last.tagIds[idx]);

      if (
        currentTitle === last.title &&
        currentDesc === last.description &&
        currentPinned === last.isPinned &&
        currentBoxId === last.boxId &&
        tagsUnchanged
      ) {
        return; // Nothing changed
      }

      try {
        const finalTitle = currentTitle || currentDesc.slice(0, 40);
        const finalBody = currentDesc
          ? currentDesc.includes(finalTitle)
            ? currentDesc
            : `${finalTitle}\n${currentDesc}`
          : finalTitle;

        await noteRepo.update(note.id, {
          title: finalTitle,
          body: finalBody,
          description: currentDesc || undefined,
          pinned: currentPinned,
          tag_ids: currentTags,
          box_id: currentBoxId || null,
        });

        lastSavedRef.current = {
          title: currentTitle,
          description: currentDesc,
          isPinned: currentPinned,
          tagIds: [...currentTags],
          boxId: currentBoxId || null,
        };
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
    setIsFullscreen(false);
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
        if (boxPickerOpen) {
          setBoxPickerOpen(false);
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tagPickerOpen, boxPickerOpen]);

  const handleToggleTag = (tagId: string) => {
    const nextTags = tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
    setTagIds(nextTags);
    performSave({ tagIds: nextTags });
  };

  const handleTogglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    performSave({ isPinned: nextPinned });
  };

  const handleDelete = () => {
    if (!note) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!note) return;
    await noteRepo.softDelete(note.id);
    onSaved();
    handleClose();
  };

  if (!isOpen && !isClosing) return null;
  if (!note) return null;

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  const portalTarget = typeof document !== 'undefined'
    ? (isFullscreen ? document.body : (document.getElementById('app-main') || document.body))
    : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[100] w-screen h-screen flex flex-col bg-black/65 backdrop-blur-xs select-none'
          : `absolute inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs select-none ${
              isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
            }`
      }
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground font-sans text-right flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen
            ? 'fixed inset-0 z-[101] w-screen h-screen p-6 md:px-14 md:py-8 flex flex-col bg-card'
            : `relative w-full rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 min-h-[440px] max-h-[92%] border-t border-border/80 dark:border-white/10 ${
                isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
              }`
        }`}
        dir="rtl"
      >
        {/* Top Left Action Buttons */}
        <div className={`absolute ${isFullscreen ? 'left-6 md:left-14 top-6 md:top-8' : 'left-6 top-6'} flex items-center gap-1 z-20`}>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={isFullscreen ? 'کوچک کردن' : 'تمام‌صفحه'}
          >
            {isFullscreen ? (
              <RiFullscreenExitLine className="w-5 h-5" />
            ) : (
              <RiFullscreenLine className="w-5 h-5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="حذف یادداشت"
          >
            <RiDeleteBinLine className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleClose(); }} className={`flex-1 flex flex-col justify-between ${isFullscreen ? 'max-w-4xl mx-auto w-full h-full' : ''}`}>
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3 min-h-0">
            {/* Title Textarea: auto-expanding to multiple lines with word wrap */}
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
              className={`w-full font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal transition-all resize-none overflow-y-auto max-h-[140px] leading-snug break-words [overflow-wrap:anywhere] ${
                isFullscreen ? 'text-2xl md:text-3xl pl-28' : 'text-xl pl-28'
              }`}
              dir="rtl"
            />

            {/* Note Property Chips Row */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {/* پین‌کردن */}
              <button
                type="button"
                onClick={handleTogglePin}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  isPinned
                    ? 'bg-secondary border-border text-foreground font-bold dark:bg-white/15 dark:border-white/20'
                    : 'border-transparent text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                {isPinned ? (
                  <RiPushpinFill className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <RiPushpinLine className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>پین‌کردن</span>
              </button>

              {/* برچسب */}
              <button
                type="button"
                onClick={() => setTagPickerOpen(!tagPickerOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                  selectedTags.length > 0
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                <RiPriceTag3Line
                  className={`w-3.5 h-3.5 ${
                    selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
                <span>
                  {selectedTags.length > 0
                    ? selectedTags.map((t) => `#${t.name}`).join(' ')
                    : 'برچسب'}
                </span>
              </button>

              {/* جعبه (آرشیو شده موقت) */}
              {/* <button
                type="button"
                onClick={() => setBoxPickerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                  selectedBox
                    ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <RiInboxArchiveLine
                  className={`w-3.5 h-3.5 ${selectedBox ? 'text-foreground' : 'text-muted-foreground'}`}
                />
                <span>{selectedBoxObj?.title || 'جعبه'}</span>
              </button> */}
            </div>

            {/* BlockNote Body Editor */}
            <div
              className={`flex-1 overflow-y-auto mt-3 border-t border-border/70 dark:border-white/10 pt-2 ${
                isFullscreen ? 'min-h-[60vh]' : 'min-h-[160px] max-h-[46vh]'
              }`}
            >
              <React.Suspense fallback={<div className="p-3 text-xs text-muted-foreground/60 animate-pulse">در حال بارگذاری ادیتور...</div>}>
                <BlockNoteEditor
                  key={`${note.id}-${isOpen ? 'open' : 'closed'}`}
                  initialContent={description}
                  onChange={(md) => {
                    setDescription(md);
                    scheduleSave(400, { description: md });
                  }}
                  placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                  minHeight={isFullscreen ? '60vh' : '160px'}
                />
              </React.Suspense>
            </div>
          </div>

          {/* Common Bottom Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-border/70 dark:border-white/10">
            {/* Right side in RTL: Auto-save status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>ذخیره خودکار</span>
            </div>

            {/* Left side in RTL: Mode label pill */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-muted/60 dark:bg-white/10 text-foreground border border-border/70 dark:border-white/10">
                <span>ویرایش یادداشت</span>
              </span>
            </div>
          </div>
        </form>

        {/* Tag Picker Modal */}
        {tagPickerOpen && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
            onClick={() => setTagPickerOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <TagPickerPopover
                selectedTagIds={tagIds}
                onToggleTag={handleToggleTag}
                onClose={() => setTagPickerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Box Picker Sheet */}
        <BoxPickerSheet
          isOpen={boxPickerOpen}
          onClose={() => setBoxPickerOpen(false)}
          boxes={boxes}
          selectedBoxId={selectedBox}
          onSelectBox={(bId) => {
            setSelectedBox(bId || '');
            performSave({ boxId: bId || null });
          }}
        />

        {/* Delete Confirm Sheet */}
        <DeleteConfirmSheet
          isOpen={deleteConfirmOpen}
          title="حذف یادداشت"
          itemTitle={title || note?.title || ''}
          description="آیا از حذف این یادداشت اطمینان دارید؟ این عملیات قابل بازگشت نیست."
          confirmLabel="حذف یادداشت"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteConfirmOpen(false)}
        />
      </div>
    </div>,
    portalTarget
  );
};
