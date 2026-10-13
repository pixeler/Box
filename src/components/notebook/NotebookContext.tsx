import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Note, Tag, Box } from '@/types/models';
import { noteRepo, tagRepo, boxRepo } from '@/repositories';
import { toast } from '@/lib/toast';

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
  createBoxOpen: boolean;
  setCreateBoxOpen: (open: boolean) => void;
  boxToEdit: Box | null;
  setBoxToEdit: (box: Box | null) => void;
  targetParentBoxId: string | null;
  setTargetParentBoxId: (id: string | null) => void;
  loadData: () => Promise<void>;
  handleCreateNewNote: () => Promise<void>;
  handleOpenCreateBox: (parentId?: string | null) => void;
  handleDropOnBox: (noteId: string, targetBoxId: string | null) => Promise<void>;
}

const NotebookContext = createContext<NotebookContextType | null>(null);

export const NotebookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  const [currentFolderId, setCurrentFolderId] = useState<string | null | 'all_notes'>(null);

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteEditModalOpen, setNoteEditModalOpen] = useState(false);

  const [createBoxOpen, setCreateBoxOpen] = useState(false);
  const [boxToEdit, setBoxToEdit] = useState<Box | null>(null);
  const [targetParentBoxId, setTargetParentBoxId] = useState<string | null>(null);

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

  const handleCreateNewNote = async () => {
    try {
      const targetBoxId =
        currentFolderId && currentFolderId !== 'all_notes' ? currentFolderId : null;

      const created = await noteRepo.create({
        entry_id: null,
        box_id: targetBoxId,
        type: 'note',
        title: '',
        body: '',
        tag_ids: [],
      });
      setEditingNote(created);
      setNoteEditModalOpen(true);
      loadData();
    } catch (err) {
      console.error('Failed to create new note:', err);
      toast.show('خطا در ایجاد یادداشت جدید');
    }
  };

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
      const boxTitle = targetBox ? targetBox.title : 'شاخه اصلی';
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
    }),
    [
      notes,
      boxes,
      tagsMap,
      currentFolderId,
      boxNotesCountMap,
      editingNote,
      noteEditModalOpen,
      createBoxOpen,
      boxToEdit,
      targetParentBoxId,
      loadData,
      handleCreateNewNote,
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
