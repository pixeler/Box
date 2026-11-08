import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Task, DocumentVersion } from '@/types/models';
import { boxRepo, documentVersionRepo, noteRepo, taskRepo } from '@/repositories';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { noteMenuContentClass, noteMenuDangerClass, noteMenuItemClass, noteMenuSeparatorClass } from './noteMenu';
import { NOTE_BACKGROUND_PRESETS, NOTE_COLOR_PRESETS } from './noteTheme';
import {
  NOTE_EMOJI_CATEGORIES,
  NOTE_ICON_BY_ID,
  NOTE_ICON_GROUPS,
  NOTE_ICON_LIST,
  searchNoteEmojis,
} from './noteIconData';
import { toast } from '@/lib/toast';
import { desktop } from '@/lib/desktop';
import { useOverlayLayer } from '@/lib/overlayLayer';
import { TaskEditModal } from '@/components/task/LazyTaskEditModal';
import { useAuth } from '@/lib/auth';
import { downloadNote, printNoteAsPdf, type NoteExportFormat } from '@/lib/documentExport';
import {
  DEFAULT_JOURNAL_TEMPLATE,
  folderUsage,
  JOURNAL_TEMPLATE_ID,
  loadNoteTemplates,
  resetJournalTemplate,
  saveNoteTemplates,
  setTemplateUsage,
  type NoteTemplate,
} from '@/lib/noteTemplates';
import { NoteHistoryPanel } from './NoteHistoryPanel';
import { buildNoteOutline, type OutlineEntry } from '@/lib/noteOutline';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiCloseLine,
  RiPushpinLine,
  RiPushpinFill,
  RiDeleteBinLine,
  RiLockLine,
  RiLink,
  RiFileCopyLine,
  RiUpload2Line,
  RiImageAddLine,
  RiEmotionLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiDownload2Line,
  RiHistoryLine,
  RiPrinterLine,
  RiFileTextLine,
  RiRestartLine,
  RiCheckLine,
  RiZoomInLine,
  RiListUnordered,
  RiRefreshLine,
} from '@remixicon/react';

export type NotionViewMode = 'side-peek' | 'center' | 'fullscreen';

export interface NoteEditModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** One-shot mode used when a note is opened from the sidebar. */
  initialViewMode?: NotionViewMode;
  /** Ancestor folders of the note, root first, for the breadcrumb. */
  folderTrail?: { id: string; title: string }[];
  onOpenFolder?: (folderId: string | null) => void;
  /** A reusable template opens in this same window instead of a note. */
  template?: NoteTemplate | null;
  onTemplateSaved?: () => void;
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

/** Task ids embedded as blocks in a note's block JSON, depth first. */
const collectTaskIds = (json: string): string[] => {
  const ids = new Set<string>();
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const block = node as { type?: string; props?: { taskId?: string }; children?: unknown[] };
      if (block.type === 'taskRef' && block.props?.taskId) ids.add(block.props.taskId);
      walk(block.children);
    }
  };
  try {
    walk(JSON.parse(json));
  } catch {
    /* A partially written save is retried on the next change. */
  }
  return [...ids];
};

/**
 * A task embedded in a note points back at it, so the link works from both
 * sides: the task card shows the note, the note shows the task.
 */
const linkTasksToNote = async (noteId: string, bodyJson: string) => {
  for (const taskId of collectTaskIds(bodyJson)) {
    try {
      const task = await taskRepo.getById(taskId);
      if (!task) continue;
      const linked = task.linked_note_ids ?? [];
      if (linked.includes(noteId)) continue;
      await taskRepo.update(taskId, { linked_note_ids: [...linked, noteId] });
    } catch (err) {
      console.error('Failed to link a note task:', err);
    }
  }
};

/** Blocks that make a note worth keeping: text, or an embedded task. */
const noteHasBlocks = (json: string): boolean => {
  if (!json) return false;
  try {
    const blocks = JSON.parse(json) as { type?: string; content?: unknown[] }[];
    return blocks.some(
      (block) => block.type === 'taskRef' || (Array.isArray(block.content) && block.content.length > 0)
    );
  } catch {
    return false;
  }
};

export const NoteEditModal: React.FC<NoteEditModalProps> = ({
  note: noteProp,
  isOpen,
  onClose,
  onSaved,
  initialViewMode,
  folderTrail = [],
  onOpenFolder,
  template = null,
  onTemplateSaved,
}) => {
  const isTemplateMode = Boolean(template);
  /** The built-in journal template belongs to the app; it is copied, not edited. */
  const isDefaultTemplate = isTemplateMode && template?.id === JOURNAL_TEMPLATE_ID;
  // A template borrows a throwaway note shape so the editor, the title and the
  // toolbar work exactly as they do for a note; nothing is written to notes.
  const note: Note | null =
    noteProp ??
    (template
      ? {
          id: template.id,
          entry_id: null,
          box_id: null,
          type: 'note',
          title: template.name,
          body: template.body,
          description: template.body,
          icon: template.icon,
          cover: template.cover,
          tag_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null);
  const initialData = extractNoteData(note);
  const [isClosing, setIsClosing] = useState(false);
  // A note made a moment ago enters softly, so creating one reads as something
  // new appearing instead of a window swapping its contents.
  const [enteredAsNew] = useState(() => {
    if (!note?.created_at || isTemplateMode) return false;
    return Date.now() - new Date(note.created_at).getTime() < 60_000;
  });
  const [viewMode] = useState<NotionViewMode>(() => {
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // A task opened from this note stacks on top of it, and vice versa.
  const { zIndex: overlayZ, isTop: isTopOverlay } = useOverlayLayer(isOpen);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconTab, setIconTab] = useState<'emoji' | 'icons'>('emoji');
  const [iconQuery, setIconQuery] = useState('');
  const [iconCategory, setIconCategory] = useState<string>('recent');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('box:recent-note-emojis');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string").slice(0, 24)
        : [];
    } catch {
      return [];
    }
  });

  const emojiPickerCategories = [
    { id: 'recent', label: 'اخیر' },
    ...NOTE_EMOJI_CATEGORIES.map(({ id, label }) => ({ id, label })),
  ];
  const pickerCategories = iconTab === 'emoji' ? emojiPickerCategories : NOTE_ICON_GROUPS;
  const visibleEmojis = iconQuery.trim()
    ? searchNoteEmojis(iconQuery)
    : iconCategory === 'recent'
      ? recentEmojis.length
        ? recentEmojis
        : NOTE_EMOJI_CATEGORIES[0].items.slice(0, 24).map((item) => item.e)
      : NOTE_EMOJI_CATEGORIES.find((category) => category.id === iconCategory)?.items.map(
          (item) => item.e
        ) ?? [];
  const visibleIcons = NOTE_ICON_LIST.filter((definition) => {
    const query = iconQuery.trim().toLocaleLowerCase('fa');
    if (query) {
      return `${definition.label} ${definition.keywords}`
        .toLocaleLowerCase('fa')
        .includes(query);
    }
    return definition.group === iconCategory;
  });
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionTick, setVersionTick] = useState(0);
  const [templatesForPick, setTemplatesForPick] = useState<NoteTemplate[] | null>(null);
  /** Where the template in the editor is used by default. */
  const [templateUsage, setTemplateUsageState] = useState<string>(template?.usage || '');
  const [templateFolders, setTemplateFolders] = useState<{ id: string; title: string }[]>([]);
  /** Bumped to remount the editor when a template replaces its content. */
  const [editorKey, setEditorKey] = useState(0);
  const [restoreTick, setRestoreTick] = useState(0);
  // Text size of the document, remembered across notes and sessions.
  const [noteZoom, setNoteZoom] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('box:note-zoom'));
      if (Number.isFinite(saved) && saved >= 70 && saved <= 160) return saved;
    } catch {
      /* Storage disabled: the window opens at 100%. */
    }
    return 100;
  });
  const [zoomOpen, setZoomOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  /** One-shot settle animation when the text size changes. */
  const [zoomBump, setZoomBump] = useState(false);
  const zoomBumpTimer = useRef<number | null>(null);

  // A click anywhere outside the size panel closes it, even when it lands on
  // the note itself (the note's own overlay is what usually swallows this).
  useEffect(() => {
    if (!zoomOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-zoom-popover]')) return;
      setZoomOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [zoomOpen]);
  const { user } = useAuth();

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const coverUploadRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevNoteIdRef = useRef(note?.id);
  const prevNoteRef = useRef<Note | null>(note);
  const prevIsOpenRef = useRef(isOpen);
  /** Latest fields, for the close effect that must not read a stale render. */
  const liveFieldsRef = useRef({ title, description, bodyJson, noteIcon, noteCover });
  liveFieldsRef.current = { title, description, bodyJson, noteIcon, noteCover };
  /**
   * Switching notes keeps this component mounted: the fields above are refilled
   * in an effect, so the commit that shows the incoming note still holds the
   * one being left. A fresh editor mounts in that very commit, and its content
   * has to come from the incoming note — otherwise the previous note's body is
   * loaded into the new one and autosaved over it.
   */
  const switchedNoteIdRef = useRef<string | null>(note?.id ?? null);
  const noteSwitching = (note?.id ?? null) !== switchedNoteIdRef.current;
  const shownTitle = noteSwitching ? initialData.title : title;
  const shownDescription = noteSwitching ? initialData.description : description;
  const shownBodyJson = noteSwitching ? note?.body_json || '' : bodyJson;

  // The desktop shell owns the top row; the note only fills its slot.
  useEffect(() => {
    if (!desktop) return;
    setHeaderSlot(document.getElementById('app-header-slot'));
  }, []);

  // The template banner names the folders a template can be the default for.
  useEffect(() => {
    if (!isTemplateMode) return;
    let cancelled = false;
    void boxRepo
      .list()
      .then((list) => {
        if (!cancelled) setTemplateFolders(list.map((box) => ({ id: box.id, title: box.title })));
      })
      .catch((err) =>
        console.error('Failed to read folders for the template picker:', err)
      );
    return () => {
      cancelled = true;
    };
  }, [isTemplateMode]);

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

  // Sync only on opening or note ID change
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const noteChanged = note?.id !== prevNoteIdRef.current;
    prevIsOpenRef.current = isOpen;

    if (note && isOpen && (justOpened || noteChanged)) {
      // A change queued a moment ago belongs to the note being left. Without
      // this it fires after the switch and writes its body into the new note.
      if (noteChanged) {
        const queued = pendingSaveRef.current ?? {};
        pendingSaveRef.current = {};
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const leaving = prevNoteRef.current;
        if (leaving && leaving.id !== note.id && Object.keys(queued).length > 0) {
          void performSaveRef.current(queued, leaving);
        }
      }
      prevNoteIdRef.current = note.id;
      prevNoteRef.current = note;
      switchedNoteIdRef.current = note.id;

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
      setEditorKey((key) => key + 1);
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
    prevNoteRef.current = note;
    switchedNoteIdRef.current = note?.id ?? null;
  }, [note?.id, isOpen]);

  // Flush any pending auto-saves when unmounting
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const queued = pendingSaveRef.current ?? {};
      pendingSaveRef.current = {};
      const target = prevNoteRef.current || note;
      if (target && !isTemplateMode && Object.keys(queued).length > 0) {
        void performSaveRef.current(queued, target);
      }
    };
  }, []);

  // Which tasks point at this note. Local read only, so it costs one query.
  const refreshLinkedTasks = useCallback(async () => {
    const noteId = note?.id;
    if (!noteId) {
      setLinkedTasks([]);
      return;
    }
    try {
      const all = await taskRepo.list();
      setLinkedTasks(
        all.filter(
          (task) => task.status !== 'dropped' && (task.linked_note_ids ?? []).includes(noteId)
        )
      );
    } catch {
      /* A failed read only hides the chips. */
    }
  }, [note?.id]);

  useEffect(() => {
    if (!isOpen) {
      setLinkedTasks([]);
      return;
    }
    refreshLinkedTasks();
    // Notes saved before embedded tasks linked themselves heal on open.
    if (note) void linkTasksToNote(note.id, note.body_json || '').then(refreshLinkedTasks);
  }, [isOpen, note?.id, refreshLinkedTasks]);

  // Auto-resize title textarea as user types
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title, isOpen]);

  const performSave = useCallback(
    async (
      overrides?: {
        title?: string;
        description?: string;
        isPinned?: boolean;
        tagIds?: string[];
        boxId?: string | null;
        icon?: string;
        cover?: string;
        color?: string;
        bodyJson?: string;
      },
      /** A queued save carries the note it belongs to, never the one on screen. */
      target?: Note | null
    ) => {
      const saveTarget = target ?? note;
      if (!saveTarget) return;

      if (isTemplateMode && template) {
        const currentName = (overrides?.title !== undefined ? overrides.title : title).trim() || 'بدون نام';
        const currentBody =
          overrides?.description !== undefined ? overrides.description : description;
        // The look is part of the template: a note it creates starts with it.
        const currentIcon = overrides?.icon !== undefined ? overrides.icon : noteIcon;
        const currentCover = overrides?.cover !== undefined ? overrides.cover : noteCover;
        const stored = await loadNoteTemplates();
        const next = stored.some((item) => item.id === template.id)
          ? stored.map((item) =>
              item.id === template.id
                ? {
                    ...item,
                    name: currentName,
                    body: currentBody,
                    usage: item.usage ?? template.usage,
                    icon: currentIcon || undefined,
                    cover: currentCover || undefined,
                  }
                : item
            )
          : [
              ...stored,
              {
                id: template.id,
                name: currentName,
                body: currentBody,
                usage: template.usage,
                icon: currentIcon || undefined,
                cover: currentCover || undefined,
              },
            ];
        await saveNoteTemplates(next);
        lastSavedRef.current = {
          ...lastSavedRef.current,
          title: currentName,
          description: currentBody,
          icon: currentIcon,
          cover: currentCover,
        };
        onTemplateSaved?.();
        return;
      }

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
      const bodyChanged = last.bodyJson !== currentBodyJson;

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

      try {
        await noteRepo.update(saveTarget.id, {
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
        // Only after a successful write: a failed save must be retried, not skipped.
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
        if (bodyChanged) {
          await linkTasksToNote(saveTarget.id, currentBodyJson);
          refreshLinkedTasks();
        }
        await documentVersionRepo
          .snapshot({
            entity_type: 'note',
            entity_id: saveTarget.id,
            title: currentTitle,
            body: currentDesc,
            body_json: currentBodyJson,
            actor_id: user?.id ?? null,
            actor_name: user?.email ?? null,
            cause: 'autosave',
          })
          .then(() => setVersionTick((tick) => tick + 1))
          .catch(() => {});
        onSaved();
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      }
    },
    [
      note,
      isTemplateMode,
      template,
      onTemplateSaved,
      title,
      description,
      isPinned,
      tagIds,
      selectedBox,
      noteIcon,
      noteCover,
      noteColor,
      bodyJson,
      onSaved,
      refreshLinkedTasks,
      user,
    ]
  );

  // BlockNote reports markdown and block JSON in two calls of the same tick, and
  // each used to cancel the other's override, so the block JSON was never saved
  // at all. One save now carries both, and it reads the newest state through a
  // ref instead of the render the timer was scheduled in.
  const performSaveRef = useRef(performSave);
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);
  const pendingSaveRef = useRef<Parameters<typeof performSave>[0]>({});

  const scheduleSave = useCallback(
    (delay = 400, overrides?: Parameters<typeof performSave>[0]) => {
      if (overrides) {
        pendingSaveRef.current = { ...pendingSaveRef.current, ...overrides };
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        const merged = pendingSaveRef.current;
        pendingSaveRef.current = {};
        void performSaveRef.current(merged);
      }, delay);
    },
    []
  );

  const handleClose = () => {
    if (isClosing) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    // A save queued a moment ago carries the newest text, so close with it
    // instead of writing the state the last render happened to hold.
    const queued = pendingSaveRef.current ?? {};
    pendingSaveRef.current = {};
    const closingTitle = queued.title !== undefined ? queued.title : title;
    const closingBody = queued.description !== undefined ? queued.description : description;
    const closingBodyJson = queued.bodyJson !== undefined ? queued.bodyJson : bodyJson;
    const closingIcon = queued.icon !== undefined ? queued.icon : noteIcon;
    const closingCover = queued.cover !== undefined ? queued.cover : noteCover;

    // Only a note nobody wrote in at all is dropped. Any title, text, icon,
    // cover or block means the person did something worth keeping.
    const isBlankNote =
      !closingTitle.trim() &&
      !closingBody.trim() &&
      !closingIcon &&
      !closingCover &&
      !noteHasBlocks(closingBodyJson);
    if (isBlankNote && note && !isTemplateMode) {
      noteRepo
        .softDelete(note.id)
        .then(() => onSaved())
        .catch((err) => console.error('Failed to discard empty note:', err));
    } else {
      performSave(queued);
    }

    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  // A note nobody wrote in leaves nothing behind, however the window was left:
  // the close button, Escape, or the browser Back button.
  useEffect(() => {
    if (isOpen || isTemplateMode || !note) return;
    const live = liveFieldsRef.current;
    const last = lastSavedRef.current;
    const blank =
      !live.title.trim() &&
      !live.description.trim() &&
      !live.noteIcon &&
      !live.noteCover &&
      !noteHasBlocks(live.bodyJson) &&
      // A note with something already written must never be swept away here.
      !last.title.trim() &&
      !last.description.trim() &&
      !last.icon &&
      !last.cover &&
      !noteHasBlocks(last.bodyJson);
    if (!blank) return;
    noteRepo
      .softDelete(note.id)
      .then(() => onSaved())
      .catch((err) => console.error('Failed to discard empty note:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Another modal is above this note: Escape belongs to that one.
      if (!isTopOverlay) return;
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
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
  }, [isOpen, isTopOverlay, iconPickerOpen, coverPickerOpen, deleteConfirmOpen, historyOpen]);

  const handleTogglePin = () => {
    const nextVal = !isPinned;
    setIsPinned(nextVal);
    scheduleSave(0, { isPinned: nextVal });
  };

  const handlePickIcon = (icon: string) => {
    setNoteIcon(icon);
    setIconPickerOpen(false);
    scheduleSave(0, { icon });

    if (NOTE_ICON_BY_ID[icon]) return;
    const next = [icon, ...recentEmojis.filter((item) => item !== icon)].slice(0, 24);
    setRecentEmojis(next);
    try {
      localStorage.setItem('box:recent-note-emojis', JSON.stringify(next));
    } catch {
      /* Storage disabled: the recent row simply stops growing. */
    }
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

  const handleExport = (format: NoteExportFormat) => {
    if (!note) return;
    if (format === 'pdf') void printNoteAsPdf(note);
    else downloadNote(note, format);
  };

  const handleManualSnapshot = async () => {
    if (!note) return;
    await performSave();
    const created = await documentVersionRepo.snapshot({
      entity_type: 'note',
      entity_id: note.id,
      title: title.trim(),
      body: description.trim(),
      body_json: bodyJson,
      actor_id: user?.id ?? null,
      actor_name: user?.email ?? null,
      cause: 'manual',
      force: true,
    });
    setVersionTick((tick) => tick + 1);
    toast.show(created ? 'نسخه ثبت شد' : 'محتوا نسبت به نسخه قبل تغییری نکرده');
  };

  const handleRestoreVersion = async (version: DocumentVersion) => {
    if (!note) return;
    const nextTitle = version.title || '';
    const nextBody = version.body || '';
    const nextJson = version.body_json || '';

    setTitle(nextTitle);
    setDescription(nextBody);
    setBodyJson(nextJson);
    setRestoreTick((tick) => tick + 1);
    setHistoryOpen(false);

    try {
      await noteRepo.update(note.id, {
        title: nextTitle,
        description: nextBody,
        body: nextBody,
        body_json: nextJson || undefined,
      });
      lastSavedRef.current = {
        ...lastSavedRef.current,
        title: nextTitle,
        description: nextBody,
        bodyJson: nextJson,
      };
      await documentVersionRepo.snapshot({
        entity_type: 'note',
        entity_id: note.id,
        title: nextTitle,
        body: nextBody,
        body_json: nextJson,
        actor_id: user?.id ?? null,
        actor_name: user?.email ?? null,
        cause: 'restore',
        force: true,
      });
      setVersionTick((tick) => tick + 1);
      onSaved();
      toast.show('نسخه بازگردانی شد');
    } catch (err) {
      console.error('Failed to restore note version:', err);
      toast.show('بازگردانی نسخه انجام نشد');
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

  /** "Used for…" choices in the template banner. */
  const templateUsageOptions = [
    { value: '', label: 'بدون پیش‌فرض' },
    { value: 'new-note', label: 'یادداشت جدید' },
    { value: 'journal', label: 'روزنوشت' },
    ...templateFolders.map((folder) => ({
      value: folderUsage(folder.id),
      label: `پوشهٔ ${folder.title}`,
    })),
  ];
  const templateUsageLabel =
    templateUsageOptions.find((option) => option.value === templateUsage)?.label ||
    'بدون پیش‌فرض';

  const handleTemplateUsagePick = async (value: string) => {
    if (!template) return;
    try {
      const stored = await setTemplateUsage(template.id, value || null);
      setTemplateUsageState(stored.find((item) => item.id === template.id)?.usage || '');
      onTemplateSaved?.();
      toast.show(value ? 'محل استفادهٔ تمپلیت ذخیره شد' : 'پیش‌فرض تمپلیت برداشته شد');
    } catch (err) {
      console.error('Failed to set the template usage:', err);
      toast.show('ذخیرهٔ محل استفاده انجام نشد');
    }
  };

  /** Puts the journal template back to the body the app ships with. */
  const handleResetJournalTemplate = async () => {
    // A queued autosave still holds the text being replaced.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = {};
    try {
      await resetJournalTemplate();
      setTitle(DEFAULT_JOURNAL_TEMPLATE.name);
      setDescription(DEFAULT_JOURNAL_TEMPLATE.body);
      setBodyJson('');
      setTemplateUsageState(DEFAULT_JOURNAL_TEMPLATE.usage || '');
      setEditorKey((key) => key + 1);
      lastSavedRef.current = {
        ...lastSavedRef.current,
        title: DEFAULT_JOURNAL_TEMPLATE.name,
        description: DEFAULT_JOURNAL_TEMPLATE.body,
        bodyJson: '',
      };
      onTemplateSaved?.();
      toast.show('متن روزنوشت به نسخهٔ اصلی برگشت');
    } catch (err) {
      console.error('Failed to reset the journal template:', err);
      toast.show('ریست تمپلیت انجام نشد');
    }
  };

  if (!isOpen && !isClosing) return null;
  if (!note) return null;

  const isImageCover = /^(data:|https?:|blob:)/.test(noteCover);
  const coverPreset =
    !isImageCover && noteCover
      ? NOTE_COLOR_PRESETS.find((preset) => preset.id === noteCover) || null
      : null;
  const backgroundPreset =
    !isImageCover && noteCover
      ? NOTE_BACKGROUND_PRESETS.find((preset) => preset.id === noteCover) || null
      : null;
  const hasCover = isImageCover || Boolean(coverPreset) || Boolean(backgroundPreset);
  const coverClassName = coverPreset ? `${coverPreset.lightBg} ${coverPreset.darkBg}` : '';
  const coverStyle: React.CSSProperties | undefined = isImageCover
    ? {
        backgroundImage: `url("${noteCover}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : backgroundPreset?.style;

  const backgroundGradients = NOTE_BACKGROUND_PRESETS.filter((preset) => preset.kind === "gradient");
  const backgroundPatterns = NOTE_BACKGROUND_PRESETS.filter((preset) => preset.kind === "pattern");

  const coverPickerContent = (
    <PopoverContent
      align="start"
      sideOffset={8}
      className="w-[286px] rounded-xl border border-border/70 bg-popover p-2.5 shadow-xl"
      style={{ zIndex: overlayZ + 6 }}
    >
      <p className="mb-1.5 px-0.5 text-[10.5px] font-medium text-subtle">رنگ آرام</p>
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

      <p className="mb-1.5 mt-2.5 border-t border-border/60 px-0.5 pt-2 text-[10.5px] font-medium text-subtle">
        گرادیانت
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {backgroundGradients.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            onClick={() => handlePickCover(preset.id)}
            style={preset.style}
            className={`h-9 rounded-md border transition-transform hover:scale-[1.05] ${
              noteCover === preset.id ? 'border-foreground/60 ring-2 ring-foreground/30' : 'border-border/50'
            }`}
          />
        ))}
      </div>

      <p className="mb-1.5 mt-2.5 border-t border-border/60 px-0.5 pt-2 text-[10.5px] font-medium text-subtle">
        پترن کاغذ
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {backgroundPatterns.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.name}
            aria-label={preset.name}
            onClick={() => handlePickCover(preset.id)}
            style={preset.style}
            className={`h-9 rounded-md border transition-transform hover:scale-[1.05] ${
              noteCover === preset.id ? 'border-foreground/60 ring-2 ring-foreground/30' : 'border-border/50'
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
  const NoteIconComponent = NOTE_ICON_BY_ID[noteIcon]?.Icon || null;

  const iconPickerContent = (
    <PopoverContent
      align="start"
      sideOffset={8}
      className="w-[320px] rounded-xl border border-border/70 bg-popover p-2 shadow-xl"
      style={{ zIndex: overlayZ + 6 }}
    >
      <div className="mb-1.5 flex items-center gap-0.5 border-b border-border/60 pb-1.5">
        <button
          type="button"
          onClick={() => {
            setIconTab('emoji');
            setIconCategory('recent');
            setIconQuery('');
          }}
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
          onClick={() => {
            setIconTab('icons');
            setIconCategory('work');
            setIconQuery('');
          }}
          className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
            iconTab === 'icons'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          آیکون‌ها
        </button>
        <input
          value={iconQuery}
          onChange={(event) => setIconQuery(event.target.value)}
          placeholder="جستجو…"
          aria-label={iconTab === 'emoji' ? 'جستجوی ایموجی' : 'جستجوی آیکون'}
          className="ms-auto h-6 w-[92px] rounded-md bg-secondary/60 px-2 text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:bg-secondary"
        />
      </div>

      {!iconQuery.trim() && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {pickerCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setIconCategory(category.id)}
              className={`rounded-full px-2 py-0.5 text-[10.5px] transition-colors ${
                iconCategory === category.id
                  ? 'bg-foreground text-background'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-[168px] grid-cols-8 content-start gap-0.5 overflow-y-auto pe-0.5">
        {iconTab === 'emoji'
          ? visibleEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePickIcon(emoji)}
                className={`flex size-8 items-center justify-center rounded-md text-[16px] leading-none transition-colors hover:bg-secondary ${
                  noteIcon === emoji ? 'bg-secondary' : ''
                }`}
              >
                {emoji}
              </button>
            ))
          : visibleIcons.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => handlePickIcon(id)}
                className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-secondary ${
                  noteIcon === id ? 'bg-secondary text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-4" />
              </button>
            ))}
      </div>

      {iconTab === 'emoji' && visibleEmojis.length === 0 && (
        <p className="py-6 text-center text-[11px] text-subtle">ایموجی‌ای با این نام پیدا نشد</p>
      )}
      {iconTab === 'icons' && visibleIcons.length === 0 && (
        <p className="py-6 text-center text-[11px] text-subtle">آیکونی با این نام پیدا نشد</p>
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
  // The outline follows the note on screen, including while a switch from
  // another note is still settling.
  const outline = buildNoteOutline(shownBodyJson, shownDescription);

  const changeZoom = (next: number) => {
    const value = Math.min(160, Math.max(70, Math.round(next)));
    setNoteZoom(value);
    try {
      localStorage.setItem('box:note-zoom', String(value));
    } catch {
      /* Storage disabled: the zoom simply stops remembering. */
    }

    setZoomBump(true);
    if (zoomBumpTimer.current) window.clearTimeout(zoomBumpTimer.current);
    zoomBumpTimer.current = window.setTimeout(() => setZoomBump(false), 200);
  };

  const jumpToOutline = (entry: OutlineEntry) => {
    setOutlineOpen(false);
    const root = containerRef.current;
    if (!root) return;
    const block = entry.id ? root.querySelector<HTMLElement>(`[data-id="${entry.id}"]`) : null;
    if (block) {
      block.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Notes saved before block ids existed: match the heading's own text.
    const headings = Array.from(root.querySelectorAll<HTMLElement>('.bn-block-content'));
    headings
      .find((node) => node.textContent?.trim() === entry.text)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Shared column for the title and the editor body: centred and a little
  // wider in full screen, plain padded content in the windowed modes.
  const contentColumnClass =
    viewMode === 'fullscreen'
      ? 'mx-auto w-full max-w-[900px] px-5 pt-6 sm:px-12 sm:pt-8'
      : 'px-5 sm:px-12';

  // Compute outer backdrop and inner container classes based on Notion view mode
  // The desktop window draws its own 40px titlebar. Starting the overlay below
  // it keeps minimise/maximise/close reachable while a note is open.
  const overlayTop = desktop ? 'top-10' : 'top-0';
  let backdropClasses = `fixed inset-x-0 bottom-0 ${overlayTop} bg-black/60 backdrop-blur-xs select-none transition duration-200`;
  let containerClasses = 'bg-card text-card-foreground font-sans text-right flex flex-col transition duration-200 overflow-hidden';

  if (viewMode === 'fullscreen') {
    if (desktop) {
      backdropClasses = 'fixed inset-0 z-0 pointer-events-none select-none';
      containerClasses +=' pointer-events-auto fixed bottom-2.5 left-2.5 top-[50px] z-[181] flex flex-col overflow-hidden rounded-[22px] bg-background';
    } else {
      containerClasses += ` pointer-events-auto fixed inset-x-0 bottom-0 ${overlayTop} z-[181] w-screen flex flex-col bg-background`;
    }
  } else if (viewMode === 'center') {
    backdropClasses += ' flex items-center justify-center p-4 sm:p-6';
    containerClasses += ' relative w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[min(88vh,calc(100dvh-5rem))] sm:h-[min(86vh,calc(100dvh-5rem))] rounded-2xl sm:rounded-3xl shadow-2xl border border-border bg-background';
  } else {
    // side-peek (slides in from the right edge of the screen)
    backdropClasses += ' flex justify-end';
    containerClasses += ` fixed ${overlayTop} bottom-0 right-0 z-[181] w-full sm:w-[620px] md:w-[720px] lg:w-[780px] h-full shadow-2xl border-l border-border bg-background sm:rounded-l-2xl animate-in slide-in-from-right duration-200`;
  }

  // Breadcrumb, the three-dot menu and the document actions. On desktop this
  // fills the window titlebar row; everywhere else it stays in the note.
  const documentHeader = (
    <div className="flex min-w-0 flex-1 items-center gap-1" dir="rtl">
      <nav
        aria-label="مسیر سند"
        className="flex min-w-0 items-center gap-0.5 text-[12px] text-muted-foreground"
      >
        <button
          type="button"
          onClick={() => onOpenFolder?.(null)}
          className="shrink-0 rounded px-1 py-0.5 transition-colors hover:text-foreground"
        >
          یادداشت‌ها
        </button>
        {folderTrail.map((folder) => (
          <React.Fragment key={folder.id}>
            <span aria-hidden="true" className="shrink-0 text-muted-foreground/30">
              ‹
            </span>
            <button
              type="button"
              onClick={() => onOpenFolder?.(folder.id)}
              title={folder.title}
              className="max-w-[150px] shrink-0 truncate rounded px-1 py-0.5 transition-colors hover:text-foreground"
            >
              {folder.title}
            </button>
          </React.Fragment>
        ))}
        <span aria-hidden="true" className="shrink-0 text-muted-foreground/30">
          ‹
        </span>
        <span className="truncate px-1 py-0.5 text-foreground">
          {shownTitle.trim() || 'بدون عنوان'}
        </span>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="کارها و خروجی سند"
            aria-label="کارها و خروجی سند"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <RiArrowDownSLine className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className={noteMenuContentClass}
          style={{ zIndex: overlayZ + 6 }}
        >
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

          {!isTemplateMode && (
            <DropdownMenuItem className={noteMenuItemClass} onClick={() => setHistoryOpen(true)}>
              <RiHistoryLine className="size-3.5 text-muted-foreground" />
              <span>تاریخچه نسخه‌ها</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className={noteMenuSeparatorClass} />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={noteMenuItemClass}>
              <RiDownload2Line className="size-3.5 text-muted-foreground" />
              <span>خروجی</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="min-w-44 rounded-xl border border-border/70 bg-popover p-1"
              style={{ zIndex: overlayZ + 8 }}
            >
              {(
                [
                  ['md', 'Markdown (.md)'],
                  ['html', 'HTML (.html)'],
                  ['pdf', 'PDF'],
                  ['txt', 'متن ساده (.txt)'],
                  ['json', 'JSON (.json)'],
                ] as [NoteExportFormat, string][]
              ).map(([format, label]) => (
                <DropdownMenuItem
                  key={format}
                  className={noteMenuItemClass}
                  onClick={() => handleExport(format)}
                >
                  <RiDownload2Line className="size-3.5 text-muted-foreground" />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

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

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-0.5">
        <Popover open={zoomOpen} onOpenChange={setZoomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="اندازه متن"
              aria-label="اندازه متن"
            >
              <RiZoomInLine className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            data-zoom-popover=""
            className="w-56 rounded-xl border border-border/70 bg-popover p-3 font-sans text-foreground"
            style={{ zIndex: overlayZ + 6 }}
          >
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>اندازه متن</span>
              <span className="font-medium text-foreground">
                {toPersianDigits(noteZoom)}٪
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={160}
              step={5}
              value={noteZoom}
              onChange={(event) => changeZoom(Number(event.target.value))}
              aria-label="اندازه متن یادداشت"
              className="mt-2 w-full accent-foreground"
            />
            <div className="mt-1.5 flex items-center justify-between">
              {/* Reset only exists while there is something to reset. */}
              {noteZoom === 100 ? (
                <span className="text-[11px] text-muted-foreground/60">۱۰۰٪</span>
              ) : (
                <button
                  type="button"
                  onClick={() => changeZoom(100)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <RiRefreshLine className="size-3" />
                  بازنشانی
                </button>
              )}
              <div className="flex items-center gap-0.5">
                {(
                  [
                    ['کوچک‌تر', -10, '−'],
                    ['بزرگ‌تر', 10, '+'],
                  ] as [string, number, string][]
                ).map(([label, step, glyph]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => changeZoom(noteZoom + step)}
                    title={label}
                    aria-label={label}
                    className="flex size-6 items-center justify-center rounded border border-border/60 text-[12px] leading-none text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {glyph}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Nothing to list means no button: an empty outline is not a thing. */}
        {outline.length > 0 && (
          <Popover open={outlineOpen} onOpenChange={setOutlineOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="فهرست مطالب"
                aria-label="فهرست مطالب"
              >
                <RiListUnordered className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-64 rounded-xl border border-border/70 bg-popover p-1.5 font-sans text-foreground"
              style={{ zIndex: overlayZ + 6 }}
            >
              <p className="px-1.5 pb-1 text-[10.5px] text-muted-foreground">در این سند</p>
              <div className="max-h-[46vh] overflow-y-auto">
                {outline.map((entry, index) => (
                  <button
                    key={`${entry.id}-${index}`}
                    type="button"
                    onClick={() => jumpToOutline(entry)}
                    className="flex w-full items-center rounded-md py-1 pe-1.5 text-right text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    style={{ paddingInlineStart: `${4 + (entry.level - 1) * 12}px` }}
                  >
                    <span className="truncate">{entry.text}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {!isTemplateMode && (
          <>
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

            <button
              type="button"
              onClick={() => toast.show('اشتراک‌گذاری به‌زودی اضافه می‌شود')}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="اشتراک‌گذاری"
              aria-label="اشتراک‌گذاری"
            >
              <RiLockLine className="size-4" />
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
          </>
        )}

        {isTemplateMode ? (
          <button
            type="button"
            onClick={handleClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="بستن (Esc)"
            aria-label="بستن"
          >
            <RiCloseLine className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void printNoteAsPdf(note)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="خروجی PDF"
            aria-label="خروجی PDF"
          >
            <RiPrinterLine className="size-4" />
          </button>
        )}
        {!isTemplateMode && !desktop && (
          <button
            type="button"
            onClick={handleClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="بستن (Esc)"
            aria-label="بستن"
          >
            <RiCloseLine className="size-4" />
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className={backdropClasses} style={{ zIndex: overlayZ }} onClick={handleClose} dir="rtl">
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={containerClasses}
        style={viewMode === 'fullscreen' && desktop ? { right: 'var(--app-sidebar-width, 280px)' } : undefined}
        dir="rtl"
        data-overlay-root=""
      >
        {/* The header lives in the window titlebar on desktop. */}
        {!(desktop && headerSlot) && (
          <div className="group/topbar flex h-11 shrink-0 items-center gap-1 px-2 sm:px-3">
            <button
              type="button"
              onClick={handleClose}
              title="بستن یادداشت"
              aria-label="بستن یادداشت"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RiArrowRightSLine className="size-[18px]" />
            </button>
            {documentHeader}
          </div>
        )}
        {desktop && headerSlot && createPortal(documentHeader, headerSlot)}
        {isTemplateMode && template && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-y border-amber-500/25 bg-amber-500/12 px-3 py-1.5 text-[11.5px] font-medium text-amber-700 dark:text-amber-300">
            <span className="max-w-[46%] truncate">
              در حال ویرایش تمپلیت «{title.trim() || 'بدون نام'}»
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="این تمپلیت کجا خودکار استفاده شود؟"
                  className="flex h-6 max-w-[190px] items-center gap-1 rounded-md border border-amber-500/35 px-1.5 text-[11px] transition-colors hover:bg-amber-500/15"
                >
                  <span className="truncate">{templateUsageLabel}</span>
                  <RiArrowDownSLine className="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                sideOffset={6}
                className="w-56 p-1"
                style={{ zIndex: overlayZ + 20 }}
              >
                <div className="px-2 pb-1 pt-0.5 text-[10px] text-muted-foreground">
                  این تمپلیت برای چه منظوری است؟
                </div>
                {templateUsageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value || 'none'}
                    onClick={() => void handleTemplateUsagePick(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {templateUsage === option.value && <RiCheckLine className="size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isDefaultTemplate && (
              <button
                type="button"
                onClick={() => void handleResetJournalTemplate()}
                title="برگرداندن متن پیش‌فرض روزنوشت"
                className="flex h-6 items-center gap-1 rounded-md border border-amber-500/35 px-1.5 text-[11px] transition-colors hover:bg-amber-500/15"
              >
                <RiRestartLine className="size-3" />
                ریست
              </button>
            )}

            <span className="text-[10.5px] opacity-70">تغییرات خودکار ذخیره می‌شود</span>
          </div>
        )}
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
          <div
            className={`flex min-h-0 flex-1 flex-col ${enteredAsNew ? 'note-create-enter' : ''} ${
              zoomBump ? 'note-zoom-bump' : ''
            }`}
            style={{ zoom: noteZoom / 100 }}
          >
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
                value={shownTitle}
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
                className={`focus-quiet w-full resize-none overflow-y-auto break-words bg-transparent text-[26px] font-bold leading-[1.25] text-foreground outline-none transition placeholder:font-semibold placeholder:text-muted-foreground/35 sm:text-[30px] max-h-[160px] [overflow-wrap:anywhere] ${
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
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => setActiveTask(task)}
                      title="باز کردن این کار"
                      className="inline-flex max-w-[220px] cursor-pointer items-center gap-1 truncate rounded-full border border-border/60 bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"
                    >
                      <span className="truncate">{task.title?.trim() || 'بدون عنوان'}</span>
                    </button>
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
              {/* A new note starts empty; the template is offered here, inside
                  the note, instead of in a dialog before it opens. */}
              {!isTemplateMode && !shownTitle.trim() && !shownDescription.trim() && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pb-1 text-[11.5px] text-muted-foreground">
                  <DropdownMenu
                    onOpenChange={(open) => {
                      if (open && !templatesForPick) {
                        void loadNoteTemplates().then(setTemplatesForPick);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border/70 px-2 font-medium transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                      >
                        <RiFileTextLine className="size-3.5 shrink-0" />
                        <span>بارگذاری تمپلیت</span>
                      </button>
                    </DropdownMenuTrigger>
                    {/* Above the note window: the menu is portalled to the body
                        while the note sits on a dynamic, much higher layer. */}
                    <DropdownMenuContent
                      align="start"
                      className="w-56 p-1"
                      style={{ zIndex: overlayZ + 20 }}
                    >
                      {(templatesForPick ?? []).map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onSelect={() => {
                            setDescription(template.body);
                            setBodyJson('');
                            setEditorKey((key) => key + 1);
                            scheduleSave(150, { description: template.body, bodyJson: '' });
                            toast.show(`تمپلیت «${template.name || 'بدون نام'}» بارگذاری شد`);
                          }}
                        >
                          <RiFileTextLine className="size-3.5 shrink-0 text-subtle" />
                          <span className="truncate">{template.name || 'بدون نام'}</span>
                        </DropdownMenuItem>
                      ))}
                      {templatesForPick?.length === 0 && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          هنوز تمپلیتی نساخته‌اید
                        </p>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span>یا از همین‌جا شروع کن — «/» دستورات را نشان می‌دهد.</span>
                </div>
              )}
              <React.Suspense
                fallback={
                  <div className="p-3 text-xs text-muted-foreground/60 animate-pulse">
                    در حال بارگذاری ادیتور...
                  </div>
                }
              >
                <BlockNoteEditor
                  key={`${note.id}-${isOpen ? 'open' : 'closed'}-${restoreTick}-${editorKey}`}
                  initialContent={shownDescription}
                  initialContentJson={shownBodyJson || undefined}
                  onChange={(md) => {
                    setDescription(md);
                    scheduleSave(400, { description: md });
                  }}
                  onChangeJson={(json) => {
                    setBodyJson(json);
                    scheduleSave(400, { bodyJson: json });
                  }}
                  placeholder="متن یادداشت را بنویسید یا / را برای دستورات تایپ کنید..."
                  editable
                  minHeight="220px"
                />
              </React.Suspense>
              </div>
            </div>
          </div>
        </form>

        {historyOpen && (
          <NoteHistoryPanel
            noteId={note.id}
            refreshKey={versionTick}
            onRestore={handleRestoreVersion}
            onSnapshot={handleManualSnapshot}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>

      {activeTask && (
        <TaskEditModal
          task={activeTask}
          isOpen
          onClose={() => setActiveTask(null)}
          onSaved={refreshLinkedTasks}
        />
      )}

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
