import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Note, Tag, Box } from '@/types/models';
import type { NotionViewMode } from './NoteEditModal';
import { noteRepo, tagRepo, boxRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import { navigate, parseHash, useRoute } from '@/lib/router';
import { loadNoteTemplates, pickTemplateFor, type NoteTemplate } from '@/lib/noteTemplates';

interface NotebookContextType {
  notes: Note[];
  boxes: Box[];
  tagsMap: Record<string, Tag>;
  currentFolderId: string | null | 'all_notes';
  setCurrentFolderId: (id: string | null | 'all_notes') => void;
  boxNotesCountMap: Record<string, number>;
  editingNote: Note | null;
  setEditingNote: (note: Note | null) => void;
  noteEditModalOpen: boolean;
  setNoteEditModalOpen: (open: boolean) => void;
  noteViewModeOverride: NotionViewMode | null;
  setNoteViewModeOverride: (mode: NotionViewMode | null) => void;
  createBoxOpen: boolean;
  setCreateBoxOpen: (open: boolean) => void;
  boxToEdit: Box | null;
  setBoxToEdit: (box: Box | null) => void;
  targetParentBoxId: string | null;
  setTargetParentBoxId: (id: string | null) => void;
  loadData: () => Promise<void>;
  /** Starts a new note (from its automatic template, if one is assigned) and opens it. */
  handleCreateNewNote: () => void;
  /** Creates a note in the current folder with the given starting body. */
  createNoteWithBody: (body: string, title?: string) => Promise<void>;
  editingTemplate: NoteTemplate | null;
  setEditingTemplate: (template: NoteTemplate | null) => void;
  templateEditorOpen: boolean;
  setTemplateEditorOpen: (open: boolean) => void;
  handleOpenCreateBox: (parentId?: string | null) => void;
  handleDropOnBox: (noteId: string, targetBoxId: string | null) => Promise<void>;
}

const NotebookContext = createContext<NotebookContextType | null>(null);

export const NotebookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  // The address is the source of truth for "which folder" and "which note", so
  // back/forward and the sidebar highlight never drift apart.
  const { route } = useRoute();
  const [currentFolderId, setFolderIdState] = useState<string | null | 'all_notes'>(
    () => parseHash(window.location.hash).folderId
  );

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteEditModalOpen, setNoteEditModalOpen] = useState(false);
  const [noteViewModeOverride, setNoteViewModeOverride] = useState<NotionViewMode | null>(null);

  const [createBoxOpen, setCreateBoxOpen] = useState(false);
  const [boxToEdit, setBoxToEdit] = useState<Box | null>(null);
  const [targetParentBoxId, setTargetParentBoxId] = useState<string | null>(null);

  // A template opens in the real note editor, app-wide: "new note" exists in
  // the notebook, the sidebar and the dock, and all of them reach this state.
  const [editingTemplate, setEditingTemplate] = useState<NoteTemplate | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allNotes, allBoxes, allTags] = await Promise.all([
        noteRepo.list(),
        boxRepo.list(),
        tagRepo.listAll(),
      ]);

      // Heal existing boxes in database: fix typo 'Bix 2.png' and remove badge_icon
      for (const b of allBoxes) {
        let changed = false;
        const patch: Partial<Box> = {};

        if (!b.image || b.image === 'Bix 2.png') {
          patch.image = b.image === 'Bix 2.png' ? 'Box 2.png' : 'Box 1.png';
          b.image = patch.image;
          changed = true;
        }

        if (b.badge_icon) {
          patch.badge_icon = undefined;
          b.badge_icon = undefined;
          changed = true;
        }

        if (changed) {
          await boxRepo.update(b.id, patch);
        }
      }

      const tMap: Record<string, Tag> = {};
      allTags.forEach((t) => (tMap[t.id] = t));

      setNotes(allNotes);
      setBoxes(allBoxes);
      setTagsMap(tMap);
    } catch (err) {
      console.error('Failed to load notebook data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setCurrentFolderId = useCallback((id: string | null | 'all_notes') => {
    setFolderIdState(id);
    navigate({ tab: 'notebook', folderId: id, noteId: null });
  }, []);

  /** Set by a local open, so the URL sync below does not close it again. */
  const pendingOpenRef = useRef<string | null>(null);
  /** The note id the address showed last: a close must not reopen itself. */
  const routeNoteIdRef = useRef<string | null | undefined>(undefined);
  /** Where the note was opened from, so closing it lands back there. */
  const returnHashRef = useRef<string | null>(null);

  // Address → folder.
  useEffect(() => {
    if (route.tab !== 'notebook' || route.noteId) return;
    setFolderIdState((previous) => (previous === route.folderId ? previous : route.folderId));
  }, [route.tab, route.folderId, route.noteId]);

  // An opened note → address.
  useEffect(() => {
    if (!noteEditModalOpen || !editingNote) return;
    const current = parseHash(window.location.hash);
    if (current.noteId === editingNote.id) {
      pendingOpenRef.current = null;
      return;
    }
    pendingOpenRef.current = editingNote.id;
    // The address of the note being left is not where the new one came from:
    // keeping the older target means closing lands where the person started.
    if (!current.noteId) returnHashRef.current = window.location.hash || '#/day';
    setFolderIdState(editingNote.box_id ?? null);
    navigate({
      tab: 'notebook',
      folderId: editingNote.box_id ?? null,
      noteId: editingNote.id,
    });
  }, [noteEditModalOpen, editingNote]);

  // Address → an opened note. This is what makes the browser Back button close
  // the note and land on the folder (or day) the person came from.
  useEffect(() => {
    // A local open already chose the note on screen; its address is one commit
    // away. Reading the older address here would put the note being left back
    // on screen and start a fight between the two effects that never settles.
    if (pendingOpenRef.current) {
      if (route.noteId !== pendingOpenRef.current) return;
      pendingOpenRef.current = null;
    }

    const previousRouteNoteId = routeNoteIdRef.current;
    routeNoteIdRef.current = route.noteId;

    if (!route.noteId) {
      if (noteEditModalOpen) {
        setNoteEditModalOpen(false);
        setEditingNote(null);
        setNoteViewModeOverride(null);
      }
      return;
    }

    if (editingNote?.id === route.noteId) {
      pendingOpenRef.current = null;
      return;
    }

    // A closed note stays in the address for one commit while the address heads
    // back to its folder; opening it here would immediately undo the close.
    if (!noteEditModalOpen && previousRouteNoteId === route.noteId) return;

    const found = notes.find((note) => note.id === route.noteId);
    if (!found) return;
    setEditingNote(found);
    setNoteEditModalOpen(true);
  }, [route.noteId, notes, editingNote?.id, noteEditModalOpen]);

  // Closing the window drops the note from the address. Replace, so Back does
  // not simply reopen what was just closed. `wasOpenRef` keeps a cold deep link
  // alive: on the first render the note opens one effect above this one.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (noteEditModalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const current = parseHash(window.location.hash);
    if (!current.noteId) return;
    // A note opened from Today or a task returns there, not to the notebook.
    const from = returnHashRef.current ? parseHash(returnHashRef.current) : current;
    const target = from.noteId ? { ...from, noteId: null } : from;
    navigate({ ...target, noteId: null }, true);
  }, [noteEditModalOpen]);

  const boxNotesCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    boxes.forEach((b) => (map[b.id] = 0));
    notes.forEach((n) => {
      if (n.box_id && map[n.box_id] !== undefined) {
        map[n.box_id]++;
      }
    });
    return map;
  }, [boxes, notes]);

  const createNoteWithBody = useCallback(
    async (
      body: string,
      title = '',
      /** A template's own look, carried into the note it starts. */
      appearance?: { icon?: string; cover?: string; color?: string }
    ) => {
      try {
        const targetBoxId =
          currentFolderId && currentFolderId !== 'all_notes' ? currentFolderId : null;
        const created = await noteRepo.create({
          entry_id: null,
          box_id: targetBoxId,
          type: 'note',
          title,
          body,
          tag_ids: [],
          ...(appearance?.icon ? { icon: appearance.icon } : {}),
          ...(appearance?.cover ? { cover: appearance.cover } : {}),
          ...(appearance?.color ? { color: appearance.color } : {}),
        });
        await loadData();
        setEditingNote(created);
        setNoteViewModeOverride('fullscreen');
        setNoteEditModalOpen(true);
      } catch (err) {
        console.error('Failed to create new note:', err);
        toast.show('خطا در ایجاد یادداشت جدید');
      }
    },
    [currentFolderId, loadData]
  );

  /**
   * One step: a new note with whatever body fits this spot. A template marked
   * for this folder, or for new notes, is used; otherwise it starts blank.
   */
  const handleCreateNewNote = useCallback(() => {
    void (async () => {
      try {
        const templates = await loadNoteTemplates();
        const targetBoxId =
          currentFolderId && currentFolderId !== 'all_notes' ? currentFolderId : null;
        const template =
          pickTemplateFor(templates, { kind: 'folder', folderId: targetBoxId }) ??
          pickTemplateFor(templates, { kind: 'new-note' });
        await createNoteWithBody(
          template?.body ?? '',
          '',
          template
            ? {
                icon: template.icon,
                cover: template.cover,
                color:
                  template.cover && !template.cover.startsWith('data:')
                    ? template.cover
                    : undefined,
              }
            : undefined
        );
      } catch (err) {
        console.error('Failed to start a new note:', err);
        await createNoteWithBody('');
      }
    })();
  }, [currentFolderId, createNoteWithBody]);

  const handleOpenCreateBox = (parentBoxId?: string | null) => {
    setBoxToEdit(null);
    setTargetParentBoxId(
      parentBoxId !== undefined
        ? parentBoxId
        : currentFolderId && currentFolderId !== 'all_notes'
        ? currentFolderId
        : null
    );
    setCreateBoxOpen(true);
  };

  const handleDropOnBox = async (noteId: string, targetBoxId: string | null) => {
    try {
      await noteRepo.update(noteId, { box_id: targetBoxId });
      const targetBox = targetBoxId ? boxes.find((b) => b.id === targetBoxId) : null;
      const boxTitle = targetBox ? targetBox.title : 'ریشه';
      toast.show(`یادداشت به «${boxTitle}» منتقل شد`);
      loadData();
    } catch (err) {
      console.error('Failed to move note on drop:', err);
      toast.show('خطا در جابه‌جایی یادداشت');
    }
  };

  const value = useMemo(
    () => ({
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
      noteViewModeOverride,
      setNoteViewModeOverride,
      createBoxOpen,
      setCreateBoxOpen,
      boxToEdit,
      setBoxToEdit,
      targetParentBoxId,
      setTargetParentBoxId,
      loadData,
      handleCreateNewNote,
      createNoteWithBody,
      editingTemplate,
      setEditingTemplate,
      templateEditorOpen,
      setTemplateEditorOpen,
      handleOpenCreateBox,
      handleDropOnBox,
    }),
    [
      notes,
      boxes,
      tagsMap,
      currentFolderId,
      setCurrentFolderId,
      boxNotesCountMap,
      editingNote,
      noteEditModalOpen,
      noteViewModeOverride,
      createBoxOpen,
      boxToEdit,
      targetParentBoxId,
      loadData,
      handleCreateNewNote,
      createNoteWithBody,
      editingTemplate,
      templateEditorOpen,
      handleOpenCreateBox,
      handleDropOnBox,
    ]
  );

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
};

export const useNotebook = () => {
  const ctx = useContext(NotebookContext);
  if (!ctx) {
    throw new Error('useNotebook must be used within a NotebookProvider');
  }
  return ctx;
};
