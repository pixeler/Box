import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Task } from '@/types/models';
import { noteRepo, taskRepo } from '@/repositories';
const BlockNoteEditor = React.lazy(() =>
  import('@/components/editor/BlockNoteEditor').then((m) => ({
    default: m.BlockNoteEditor,
  }))
);
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { noteMenuContentClass, noteMenuDangerClass, noteMenuItemClass, noteMenuSeparatorClass } from './noteMenu';
import { NOTE_COLOR_PRESETS } from './noteTheme';
import { BOX_ICONS_LIST } from '@/components/boxes/BoxIconRenderer';
import { toast } from '@/lib/toast';
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiDeleteBinLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
  RiLayoutLine,
  RiLayoutRightLine,
  RiWindowLine,
  RiLockLine,
  RiLink,
  RiMoreLine,
  RiFileCopyLine,
  RiUpload2Line,
  RiImageAddLine,
  RiEmotionLine,
} from '@remixicon/react';

export type NotionViewMode = 'side-peek' | 'center' | 'fullscreen';

export const NOTE_EMOJIS = [
  '📝', '✨', '💡', '📌', '📚', '🎯', '🌱', '☕',
  '🎬', '🎵', '💻', '🧠', '❤️', '🏡', '✈️', '🍜',
  '🌙', '☀️', '🔥', '🧊', '🎨', '📷', '🛠️', '🧪',
  '📈', '💰', '🧾', '🗓️', '✅', '🧘', '🚀', '🕯️',
];

export interface NoteEditModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** One-shot mode used when a note is opened from the sidebar. */
  initialViewMode?: NotionViewMode;
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
  initialViewMode,
}) => {
  const initialData = extractNoteData(note);
  const [isClosing, setIsClosing] = useState(false);
  const [viewMode, setViewMode] = useState<NotionViewMode>(() => {
    if (initialViewMode) return initialViewMode;
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
  const [bodyJson, setBodyJson] = useState(note?.body_json || '');
  const [isPinned, setIsPinned] = useState(initialData.isPinned);
  const [tagIds, setTagIds] = useState<string[]>(initialData.tagIds);
  const [selectedBox, setSelectedBox] = useState<string>(initialData.boxId || '');
  const [noteIcon, setNoteIcon] = useState<string>(note?.icon || '');
  const [noteCover, setNoteCover] = useState<string>(note?.cover || '');
  const [noteColor, setNoteColor] = useState<string>(note?.color || '');
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconTab, setIconTab] = useState<'emoji' | 'icons'>('emoji');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevNoteIdRef = useRef(note?.id);
  const prevIsOpenRef = useRef(isOpen);

  const lastSavedRef = useRef<{
    title: string;
    description: string;
    isPinned: boolean;
    tagIds: string[];
    boxId: string | null;
    icon: string;
    cover: string;
    color: string;
    bodyJson: string;
  }>({
    title: initialData.title,
    description: initialData.description,
    isPinned: initialData.isPinned,
    tagIds: initialData.tagIds,
    boxId: initialData.boxId,
    icon: note?.icon || '',
    cover: note?.cover || '',
    color: note?.color || '',
    bodyJson: note?.body_json || '',
  });

  const handleSetViewMode = (mode: NotionViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notion_note_view_mode', mode);
    }
  };

  // Sync only on opening or note ID change
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const noteChanged = note?.id !== prevNoteIdRef.current;

    if (note && isOpen && (justOpened || noteChanged)) {
      const data = extractNoteData(note);
      setTitle(data.title);
      setDescription(data.description);
      setBodyJson(note.body_json || '');
      setIsPinned(data.isPinned);
      setTagIds(data.tagIds);
      setSelectedBox(data.boxId || '');
      setNoteIcon(note.icon || '');
      setNoteCover(note.cover || '');
      setNoteColor(note.color || '');
      setIsClosing(false);
      lastSavedRef.current = {
        title: data.title,
        description: data.description,
        isPinned: data.isPinned,
        tagIds: [...data.tagIds],
        boxId: data.boxId,
        icon: note.icon || '',
        cover: note.cover || '',
        color: note.color || '',
        bodyJson: note.body_json || '',
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

  // Which tasks point at this note. Local read only, so it costs one query.
  useEffect(() => {
    if (!isOpen || !note) {
      setLinkedTasks([]);
      return;
    }
    let cancelled = false;
    taskRepo
      .list()
      .then((all) => {
        if (cancelled) return;
        setLinkedTasks(
          all.filter(
            (task) => task.status !== 'dropped' && (task.linked_note_ids ?? []).includes(note.id)
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, note?.id]);

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
      icon?: string;
      cover?: string;
      color?: string;
      bodyJson?: string;
    }) => {
      if (!note) return;

      const currentTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      const currentDesc = (overrides?.description !== undefined ? overrides.description : description).trim();
      const currentPinned = overrides?.isPinned !== undefined ? overrides.isPinned : isPinned;
      const currentTags = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;
      const currentBoxId = overrides?.boxId !== undefined ? overrides.boxId : selectedBox;
      const currentIcon = overrides?.icon !== undefined ? overrides.icon : noteIcon;
      const currentCover = overrides?.cover !== undefined ? overrides.cover : noteCover;
      const currentColor = overrides?.color !== undefined ? overrides.color : noteColor;
      const currentBodyJson = overrides?.bodyJson !== undefined ? overrides.bodyJson : bodyJson;

      const last = lastSavedRef.current;
      const tagsUnchanged =
        last.tagIds.length === currentTags.length &&
        last.tagIds.every((id, idx) => id === currentTags[idx]);

      if (
        last.title === currentTitle &&
        last.description === currentDesc &&
        last.isPinned === currentPinned &&
        last.boxId === (currentBoxId || null) &&
        last.icon === currentIcon &&
        last.cover === currentCover &&
        last.color === currentColor &&
        last.bodyJson === currentBodyJson &&
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
        icon: currentIcon,
        cover: currentCover,
        color: currentColor,
        bodyJson: currentBodyJson,
      };

      try {
        await noteRepo.update(note.id, {
          title: currentTitle,
          description: currentDesc,
          body: currentDesc,
          pinned: currentPinned,
          tag_ids: currentTags,
          box_id: currentBoxId || null,
          icon: currentIcon || undefined,
          cover: currentCover || undefined,
          color: currentColor || undefined,
          body_json: currentBodyJson || undefined,
        });
        onSaved();
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      }
    },
    [note, title, description, isPinned, tagIds, selectedBox, noteIcon, noteCover, noteColor, bodyJson, onSaved]
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

    // A note that was never written in is not worth keeping: drop it instead
    // of saving an empty row. An embedded task block counts as content.
    const hasBlocks = (() => {
      if (!bodyJson) return false;
      try {
        const blocks = JSON.parse(bodyJson) as { type?: string; content?: unknown[] }[];
        return blocks.some(
          (block) => block.type === 'taskRef' || (Array.isArray(block.content) && block.content.length > 0)
        );
      } catch {
        return false;
      }
    })();
    const isBlankNote =
      !title.trim() && !description.trim() && !noteIcon && !noteCover && !hasBlocks;
    if (isBlankNote && note) {
      noteRepo
        .softDelete(note.id)
        .then(() => onSaved())
        .catch((err) => console.error('Failed to discard empty note:', err));
    } else {
      performSave();
    }

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
        if (iconPickerOpen) {
          setIconPickerOpen(false);
          return;
        }
        if (coverPickerOpen) {
          setCoverPickerOpen(false);
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
  }, [isOpen, iconPickerOpen, coverPickerOpen, deleteConfirmOpen]);

  const handleTogglePin = () => {
    const nextVal = !isPinned;
    setIsPinned(nextVal);
    scheduleSave(0, { isPinned: nextVal });
  };

  const handlePickIcon = (emoji: string) => {
    setNoteIcon(emoji);
    setIconPickerOpen(false);
    scheduleSave(0, { icon: emoji });
  };

  const handleRemoveIcon = () => {
    setNoteIcon('');
    setIconPickerOpen(false);
    scheduleSave(0, { icon: '' });
  };

  const handlePickCover = (coverId: string) => {
    setNoteCover(coverId);
    setNoteColor(coverId);
    setCoverPickerOpen(false);
    scheduleSave(0, { cover: coverId, color: coverId });
  };

  const handleRemoveCover = () => {
    setNoteCover('');
    setCoverPickerOpen(false);
    scheduleSave(0, { cover: '' });
  };

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.show('فقط فایل تصویری مجاز است');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.show('حجم تصویر باید کمتر از ۳ مگابایت باشد');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      setNoteCover(dataUrl);
      setCoverPickerOpen(false);
      scheduleSave(0, { cover: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleDuplicate = async () => {
    if (!note) return;
    try {
      await performSave();
      await noteRepo.duplicate(note.id);
      toast.show('یادداشت تکثیر شد');
      onSaved();
      handleClose();
    } catch (err) {
      console.error('Failed to duplicate note:', err);
      toast.show('خطا در تکثیر یادداشت');
    }
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

  const isImageCover = /^(data:|https?:|blob:)/.test(noteCover);
  const coverPreset =
    !isImageCover && noteCover
      ? NOTE_COLOR_PRESETS.find((preset) => preset.id === noteCover) || null
      : null;
  const hasCover = isImageCover || Boolean(coverPreset);
  const coverClassName = coverPreset ? `${coverPreset.lightBg} ${coverPreset.darkBg}` : '';
  const coverStyle = isImageCover
    ? {
        backgroundImage: `url("${noteCover}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  const coverPickerContent = (
    <PopoverContent
      align="start"
      sideOffset={8}
      className="!z-[190] w-[248px] rounded-xl border border-border/70 bg-popover p-2.5 shadow-xl"
    >
      <div className="grid grid-cols-4 gap-1.5">
        {NOTE_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            onClick={() => handlePickCover(preset.id)}
            className={`h-9 rounded-md border transition-transform hover:scale-[1.05] ${preset.lightBg} ${preset.darkBg} ${
              noteCover === preset.id
                ? 'border-foreground/60 ring-2 ring-foreground/30'
                : 'border-border/50'
            }`}
          />
        ))}
      </div>

      <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
        <button
          type="button"
          onClick={() => coverUploadRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RiUpload2Line className="size-3.5" />
          آپلود تصویر
        </button>

        {hasCover && (
          <button
            type="button"
            onClick={handleRemoveCover}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RiCloseLine className="size-3.5" />
            حذف کاور
          </button>
        )}
      </div>

      <input
        ref={coverUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />
    </PopoverContent>
  );

  const NoteIconComponent =
    BOX_ICONS_LIST.find((item) => item.id === noteIcon)?.Icon || null;

  const iconPickerContent = (
    <PopoverContent
      align="start"
      sideOffset={8}
      className="!z-[190] w-[268px] rounded-xl border border-border/70 bg-popover p-2 shadow-xl"
    >
      <div className="mb-1.5 flex items-center gap-0.5 border-b border-border/60 pb-1.5">
        <button
          type="button"
          onClick={() => setIconTab('emoji')}
          className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
            iconTab === 'emoji'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ایموجی
        </button>
        <button
          type="button"
          onClick={() => setIconTab('icons')}
          className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
            iconTab === 'icons'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          آیکون‌ها
        </button>
      </div>

      {iconTab === 'emoji' ? (
        <div className="grid grid-cols-8 gap-0.5">
          {NOTE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePickIcon(emoji)}
              className={`flex size-7 items-center justify-center rounded-md text-[15px] leading-none transition-colors hover:bg-secondary ${
                noteIcon === emoji ? 'bg-secondary' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-0.5">
          {BOX_ICONS_LIST.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => handlePickIcon(id)}
              className={`flex size-7 items-center justify-center rounded-md transition-colors hover:bg-secondary ${
                noteIcon === id ? 'bg-secondary text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      )}

      {noteIcon && (
        <button
          type="button"
          onClick={handleRemoveIcon}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RiCloseLine className="size-3.5" />
          حذف آیکون
        </button>
      )}
    </PopoverContent>
  );

  // Shared column for the title and the editor body: centred and a little
  // wider in full screen, plain padded content in the windowed modes.
  const contentColumnClass =
    viewMode === 'fullscreen'
      ? 'mx-auto w-full max-w-[900px] px-5 sm:px-12'
      : 'px-5 sm:px-12';

  // Compute outer backdrop and inner container classes based on Notion view mode
  let backdropClasses = 'fixed inset-0 z-[180] bg-black/60 backdrop-blur-xs select-none transition duration-200';
  let containerClasses = 'bg-card text-card-foreground font-sans text-right flex flex-col transition duration-200 overflow-hidden';

  if (viewMode === 'fullscreen') {
    containerClasses += ' fixed inset-0 z-[181] h-screen w-screen flex flex-col rounded-none bg-card';
  } else if (viewMode === 'center') {
    backdropClasses += ' flex items-center justify-center p-4 sm:p-6';
    containerClasses += ' relative w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[88vh] sm:h-[86vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-border';
  } else {
    // side-peek (slides in from the right edge of the screen)
    backdropClasses += ' flex justify-end';
    containerClasses += ' fixed inset-y-0 right-0 z-[181] w-full sm:w-[620px] md:w-[720px] lg:w-[780px] h-full shadow-2xl border-l border-border bg-card sm:rounded-l-2xl animate-in slide-in-from-right duration-200';
  }

  return createPortal(
    <div className={backdropClasses} onClick={handleClose} dir="rtl">
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={containerClasses}
        dir="rtl"
        data-overlay-root=""
      >
        {/* TOP BAR: fullscreen + layout, and document actions */}
        <div className="group/topbar flex h-11 shrink-0 items-center justify-between gap-2 px-2 sm:px-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() =>
                handleSetViewMode(viewMode === 'fullscreen' ? 'center' : 'fullscreen')
              }
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={viewMode === 'fullscreen' ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
              aria-label={viewMode === 'fullscreen' ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
            >
              {viewMode === 'fullscreen' ? (
                <RiFullscreenExitLine className="size-4" />
              ) : (
                <RiFullscreenLine className="size-4" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="چیدمان پنجره"
                  aria-label="چیدمان پنجره"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-60 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover/topbar:opacity-100"
                >
                  <RiLayoutLine className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className={`${noteMenuContentClass} !z-[190]`}>
                {(
                  [
                    { mode: 'side-peek', label: 'نیم‌پنجره کناری', Icon: RiLayoutRightLine },
                    { mode: 'center', label: 'پنجره مرکزی', Icon: RiWindowLine },
                    { mode: 'fullscreen', label: 'تمام‌صفحه', Icon: RiFullscreenLine },
                  ] as {
                    mode: NotionViewMode;
                    label: string;
                    Icon: React.ComponentType<{ className?: string }>;
                  }[]
                ).map(({ mode, label, Icon }) => (
                  <DropdownMenuItem
                    key={mode}
                    className={noteMenuItemClass}
                    onClick={() => handleSetViewMode(mode)}
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    {viewMode === mode && (
                      <span className="size-1.5 rounded-full bg-foreground" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => toast.show('اشتراک‌گذاری به‌زودی اضافه می‌شود')}
              className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="اشتراک‌گذاری"
            >
              <RiLockLine className="size-3.5" />
              <span className="hidden sm:inline">اشتراک</span>
            </button>

            <button
              type="button"
              onClick={() => toast.show('کپی لینک به‌زودی اضافه می‌شود')}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="کپی لینک"
              aria-label="کپی لینک"
            >
              <RiLink className="size-4" />
            </button>

            <button
              type="button"
              onClick={handleTogglePin}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
              aria-label={isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
              aria-pressed={isPinned}
            >
              {isPinned ? (
                <RiPushpinFill className="size-4" />
              ) : (
                <RiPushpinLine className="size-4" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="کارهای سند"
                  aria-label="کارهای سند"
                >
                  <RiMoreLine className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className={`${noteMenuContentClass} !z-[190]`}>
                <DropdownMenuItem className={noteMenuItemClass} onClick={handleTogglePin}>
                  {isPinned ? (
                    <RiPushpinFill className="size-3.5" />
                  ) : (
                    <RiPushpinLine className="size-3.5 text-muted-foreground" />
                  )}
                  <span>{isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</span>
                </DropdownMenuItem>

                <DropdownMenuItem className={noteMenuItemClass} onClick={handleDuplicate}>
                  <RiFileCopyLine className="size-3.5 text-muted-foreground" />
                  <span>تکثیر یادداشت</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className={noteMenuItemClass}
                  onClick={() => toast.show('کپی لینک به‌زودی اضافه می‌شود')}
                >
                  <RiLink className="size-3.5 text-muted-foreground" />
                  <span>کپی لینک</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className={noteMenuSeparatorClass} />

                <DropdownMenuItem
                  className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
                  onClick={handleDelete}
                >
                  <RiDeleteBinLine className="size-3.5" />
                  <span>حذف یادداشت</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={handleClose}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="بستن (Esc)"
              aria-label="بستن"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>
        </div>

        {/* COVER */}
        {hasCover && (
          <div
            className={`group/cover relative h-28 shrink-0 sm:h-36 ${coverClassName}`}
            style={coverStyle}
          >
            <div className="absolute end-2 bottom-2 flex items-center gap-1 rounded-lg bg-black/30 p-0.5 opacity-0 backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100">
              <Popover open={coverPickerOpen} onOpenChange={setCoverPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] text-white/90 transition-colors hover:bg-white/15"
                  >
                    تغییر کاور
                  </button>
                </PopoverTrigger>
                {coverPickerContent}
              </Popover>
              <button
                type="button"
                onClick={handleRemoveCover}
                className="rounded-md px-2 py-1 text-[11px] text-white/90 transition-colors hover:bg-white/15"
              >
                حذف
              </button>
            </div>
          </div>
        )}

        {/* NOTE CONTENT */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleClose();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Title block */}
            <div className={`shrink-0 ${contentColumnClass}`}>
              {(!noteIcon || !hasCover) && (
                <div className="-ms-1.5 mb-1 flex flex-wrap items-center gap-0.5">
                  {!noteIcon && (
                    <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <RiEmotionLine className="size-3.5" />
                          افزودن آیکون
                        </button>
                      </PopoverTrigger>
                      {iconPickerContent}
                    </Popover>
                  )}

                  {!hasCover && (
                    <Popover open={coverPickerOpen} onOpenChange={setCoverPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <RiImageAddLine className="size-3.5" />
                          افزودن کاور
                        </button>
                      </PopoverTrigger>
                      {coverPickerContent}
                    </Popover>
                  )}
                </div>
              )}

              {noteIcon && (
                <div className={`relative z-10 ${hasCover ? '-mt-8 mb-0.5' : 'mt-0.5'}`}>
                  <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        title="تغییر آیکون"
                        className="flex size-14 items-center justify-center rounded-xl text-[40px] leading-none transition-colors hover:bg-secondary/70"
                      >
                        {NoteIconComponent ? (
                          <NoteIconComponent className="size-10" />
                        ) : (
                          noteIcon
                        )}
                      </button>
                    </PopoverTrigger>
                    {iconPickerContent}
                  </Popover>
                </div>
              )}

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
                placeholder="بدون عنوان"
                className={`w-full resize-none overflow-y-auto break-words bg-transparent text-[26px] font-bold leading-[1.25] text-foreground outline-none transition placeholder:font-semibold placeholder:text-muted-foreground/35 sm:text-[30px] max-h-[160px] [overflow-wrap:anywhere] ${
                  noteIcon ? 'mt-1.5' : 'mt-2'
                }`}
                dir="rtl"
              />

              {linkedTasks.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 pb-1">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <RiLink className="size-3" />
                    کارهای مرتبط
                  </span>
                  {linkedTasks.map((task) => (
                    <span
                      key={task.id}
                      className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-border/60 bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                    >
                      <span className="truncate">{task.title?.trim() || 'بدون عنوان'}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* BlockNote body.
                In full screen the scroller spans the whole window and only its
                contents are narrowed/centred, so the scrollbar sits at the far
                left edge of the browser instead of beside the text. */}
            <div className="mt-1 min-h-[200px] flex-1 overflow-y-auto pb-8">
              <div className={contentColumnClass}>
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
                  initialContentJson={bodyJson || undefined}
                  onChange={(md) => {
                    setDescription(md);
                    scheduleSave(400, { description: md });
                  }}
                  onChangeJson={(json) => {
                    setBodyJson(json);
                    scheduleSave(400, { bodyJson: json });
                  }}
                  placeholder="متن یادداشت را بنویسید یا / را برای دستورات تایپ کنید..."
                  minHeight="220px"
                />
              </React.Suspense>
              </div>
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
    </div>,
    document.body
  );
};
