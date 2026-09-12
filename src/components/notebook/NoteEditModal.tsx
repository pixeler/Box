import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Tag } from '@/types/models';
import { noteRepo, tagRepo } from '@/repositories';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { BlockNoteEditor } from '@/components/editor/BlockNoteEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiPriceTag3Line,
  RiInboxArchiveLine,
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
  if (!n) return { title: '', description: '', isPinned: false, tagIds: [] };
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
  const [selectedBox, setSelectedBox] = useState<string>('');

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevNoteIdRef = useRef(note?.id);
  const prevIsOpenRef = useRef(isOpen);

  const lastSavedRef = useRef<{
    title: string;
    description: string;
    isPinned: boolean;
    tagIds: string[];
  }>({
    title: initialData.title,
    description: initialData.description,
    isPinned: initialData.isPinned,
    tagIds: initialData.tagIds,
  });

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
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
      setIsClosing(false);
      lastSavedRef.current = {
        title: data.title,
        description: data.description,
        isPinned: data.isPinned,
        tagIds: [...data.tagIds],
      };

      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    prevNoteIdRef.current = note?.id;
    prevIsOpenRef.current = isOpen;
  }, [note?.id, isOpen]);

  const performSave = useCallback(
    async (overrides?: {
      title?: string;
      description?: string;
      isPinned?: boolean;
      tagIds?: string[];
    }) => {
      if (!note) return;

      const currentTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      const currentDesc = (overrides?.description !== undefined ? overrides.description : description).trim();
      const currentPinned = overrides?.isPinned !== undefined ? overrides.isPinned : isPinned;
      const currentTags = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;

      if (!currentTitle && !currentDesc) return;

      const last = lastSavedRef.current;
      const tagsUnchanged =
        currentTags.length === last.tagIds.length &&
        currentTags.every((id, idx) => id === last.tagIds[idx]);

      if (
        currentTitle === last.title &&
        currentDesc === last.description &&
        currentPinned === last.isPinned &&
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
        });

        lastSavedRef.current = {
          title: currentTitle,
          description: currentDesc,
          isPinned: currentPinned,
          tagIds: [...currentTags],
        };
        onSaved();
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      }
    },
    [note, title, description, isPinned, tagIds, onSaved]
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

  const handleDelete = async () => {
    if (!note) return;
    if (window.confirm('آیا از حذف این یادداشت اطمینان دارید؟')) {
      await noteRepo.softDelete(note.id);
      onSaved();
      handleClose();
    }
  };

  if (!isOpen && !isClosing) return null;
  if (!note) return null;

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  const portalTarget = typeof document !== 'undefined' ? (document.getElementById('app-main') || document.body) : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground border-t border-border font-sans text-right flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen
            ? 'fixed inset-0 z-50 w-full h-full pb-5 px-6 pt-6 md:px-16 lg:px-24'
            : `relative w-full rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 min-h-[440px] max-h-[92%] ${
                isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
              }`
        }`}
        dir="rtl"
      >
        {/* Top Action Buttons: Fullscreen, Delete and Close */}
        <div className="absolute left-6 top-6 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
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
            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
            title="حذف یادداشت"
          >
            <RiDeleteBinLine className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleClose(); }} className={`flex-1 flex flex-col justify-between ${isFullscreen ? 'max-w-4xl mx-auto w-full h-full' : ''}`}>
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3 min-h-0">
            {/* Title Input */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                scheduleSave(400, { title: val });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleClose();
                }
              }}
              placeholder="چی تو ذهنته؟"
              className={`w-full font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground placeholder:font-normal transition-all ${
                isFullscreen ? 'text-2xl md:text-3xl pl-32' : 'text-xl pl-24'
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
                    ? 'bg-gray-100 border-gray-300 text-gray-900 font-bold'
                    : 'border-transparent text-gray-400 hover:text-gray-600 font-normal'
                }`}
              >
                {isPinned ? (
                  <RiPushpinFill className="w-3.5 h-3.5 text-gray-800" />
                ) : (
                  <RiPushpinLine className="w-3.5 h-3.5 text-gray-400" />
                )}
                <span>پین‌کردن</span>
              </button>

              {/* برچسب */}
              <button
                type="button"
                onClick={() => setTagPickerOpen(!tagPickerOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                  selectedTags.length > 0
                    ? 'text-gray-900 font-semibold'
                    : 'text-gray-400 hover:text-gray-600 font-normal'
                }`}
              >
                <RiPriceTag3Line
                  className={`w-3.5 h-3.5 ${
                    selectedTags.length > 0 ? 'text-gray-900' : 'text-gray-400'
                  }`}
                />
                <span>
                  {selectedTags.length > 0
                    ? selectedTags.map((t) => `#${t.name}`).join(' ')
                    : 'برچسب'}
                </span>
              </button>

              {/* جعبه */}
              <DropdownMenu open={boxPickerOpen} onOpenChange={setBoxPickerOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                      selectedBox
                        ? 'text-gray-900 font-semibold'
                        : 'text-gray-400 hover:text-gray-600 font-normal'
                    }`}
                  >
                    <RiInboxArchiveLine
                      className={`w-3.5 h-3.5 ${
                        selectedBox ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    />
                    <span>{selectedBox || 'جعبه'}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-36 p-1 text-xs" dir="rtl">
                  <DropdownMenuItem onClick={() => setSelectedBox('کار')}>کار</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedBox('شخصی')}>شخصی</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedBox('ایده‌ها')}>ایده‌ها</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedBox('')} className="text-gray-400">
                    بدون جعبه
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* BlockNote Notion-like Editor */}
            <div className={`flex-1 overflow-y-auto mt-4 border-t border-border/70 pt-3 ${
              isFullscreen ? 'min-h-[300px]' : 'min-h-[180px] max-h-[46vh]'
            }`}>
              <BlockNoteEditor
                key={`${note.id}-${isOpen ? 'open' : 'closed'}`}
                initialContent={description}
                onChange={(md) => {
                  setDescription(md);
                  scheduleSave(400, { description: md });
                }}
                placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                minHeight={isFullscreen ? '350px' : '180px'}
              />
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="w-full">
            {/* Common Bottom Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {/* Right side in RTL: Auto-save status indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-normal">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>ذخیره خودکار</span>
              </div>

              {/* Left side in RTL: Mode label pill */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/80">
                  <span>ویرایش یادداشت</span>
                </span>
              </div>
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
      </div>
    </div>,
    portalTarget
  );
};
