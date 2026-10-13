import React, { useMemo } from 'react';
import type { Box, Note } from '@/types/models';
import { useNotebook } from './NotebookContext';
import { NoteCard } from './NoteCard';
import { MoveNoteModal } from './MoveNoteModal';
import { NoteEditModal } from './NoteEditModal';
import { CreateBoxSheet } from '@/components/boxes/CreateBoxSheet';
import { BoxThumbnail } from '@/components/boxes/BoxThumbnail';
import {
  RiAddLine,
  RiArrowRightLine,
  RiFolderOpenLine,
  RiEditLine,
} from '@remixicon/react';

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

  // Drag over feedback for 4-column grid
  const [dragOverBoxId, setDragOverBoxId] = React.useState<string | null>(null);

  // Move note modal
  const [moveNoteModalOpen, setMoveNoteModalOpen] = React.useState(false);
  const [noteToMove, setNoteToMove] = React.useState<Note | null>(null);

  const boxesMap = useMemo(() => {
    const map: Record<string, Box> = {};
    boxes.forEach((b) => (map[b.id] = b));
    return map;
  }, [boxes]);

  const rootBoxes = useMemo(() => {
    return boxes.filter((b) => !b.parent_id);
  }, [boxes]);

  const currentBox = useMemo(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return null;
    return boxesMap[currentFolderId] || null;
  }, [currentFolderId, boxesMap]);

  const parentBox = useMemo(() => {
    if (!currentBox || !currentBox.parent_id) return null;
    return boxesMap[currentBox.parent_id] || null;
  }, [currentBox, boxesMap]);

  const currentSubBoxes = useMemo(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return [];
    return boxes.filter((b) => b.parent_id === currentFolderId);
  }, [boxes, currentFolderId]);

  // Displayed notes:
  // Root (null): ONLY notes without any box (!n.box_id)
  // 'all_notes': ALL notes in the app
  // Box (boxId): ONLY notes belonging to this box
  const displayedNotes = useMemo(() => {
    let result: Note[] = [];
    if (currentFolderId === null) {
      result = notes.filter((n) => !n.box_id);
    } else if (currentFolderId === 'all_notes') {
      result = [...notes];
    } else {
      result = notes.filter((n) => n.box_id === currentFolderId);
    }

    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [notes, currentFolderId]);

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

  return (
    <div
      className="w-full h-full flex flex-col bg-background text-foreground overflow-hidden select-none font-sans"
      dir="rtl"
    >
      {/* 1. TOP HEADER / BREADCRUMBS */}
      <header className="w-full shrink-0 px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between">
        {/* Breadcrumb Trail on Right */}
        <div className="flex items-center gap-1.5 min-w-0">
          {currentFolderId !== null && (
            <button
              type="button"
              onClick={() => {
                if (currentFolderId === 'all_notes') {
                  setCurrentFolderId(null);
                } else if (parentBox) {
                  setCurrentFolderId(parentBox.id);
                } else {
                  setCurrentFolderId(null);
                }
              }}
              className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer shrink-0 transition-colors ml-1"
              title="بازگشت به سطح بالا"
            >
              <RiArrowRightLine className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`text-xl sm:text-2xl font-bold tracking-tight font-darvish transition-colors ${
                currentFolderId === null
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground cursor-pointer'
              }`}
            >
              یادداشت‌ها
            </button>

            {currentFolderId === 'all_notes' && (
              <>
                <span className="text-muted-foreground/60 text-lg">/</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground font-darvish">
                  همه یادداشت‌ها
                </span>
              </>
            )}

            {currentBox && (
              <>
                {parentBox && (
                  <>
                    <span className="text-muted-foreground/60 text-lg">/</span>
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(parentBox.id)}
                      className="text-base sm:text-lg font-bold text-muted-foreground hover:text-foreground cursor-pointer truncate max-w-[120px]"
                    >
                      {parentBox.title}
                    </button>
                  </>
                )}
                <span className="text-muted-foreground/60 text-lg">/</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground font-darvish truncate max-w-[180px]">
                  {currentBox.title}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBoxToEdit(currentBox);
                    setCreateBoxOpen(true);
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors mr-1"
                  title="ویرایش این باکس"
                >
                  <RiEditLine className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. SCROLLABLE BODY (4-Column 3D Boxes + Note Cards) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 pt-1 pb-28 no-scrollbar">
        {/* BOXES GRID IN ROOT VIEW */}
        {currentFolderId === null && (
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 text-center pb-5 pt-1">
            {/* 1st BOX: ALL NOTES (همه یادداشت‌ها) */}
            <button
              type="button"
              onClick={() => setCurrentFolderId('all_notes')}
              className="group flex flex-col items-center justify-start p-1.5 rounded-2xl transition-all cursor-pointer select-none relative hover:bg-muted/40 active:scale-95 focus:outline-none"
              title="همه یادداشت‌ها"
            >
              <BoxThumbnail
                box={{
                  title: 'همه یادداشت‌ها',
                  image: 'Box 1.png',
                  icon: 'RiBookOpenLine',
                }}
                size="md"
              />
              <span className="text-[11px] sm:text-xs mt-1.5 text-center font-bold text-foreground/90 group-hover:text-foreground line-clamp-1 max-w-[76px]">
                همه یادداشت‌ها
              </span>
            </button>

            {/* ROOT BOXES */}
            {rootBoxes.map((box) => {
              const isDragOver = dragOverBoxId === box.id;
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => setCurrentFolderId(box.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverBoxId(box.id);
                  }}
                  onDragLeave={() => setDragOverBoxId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverBoxId(null);
                    const noteId =
                      e.dataTransfer.getData('text/plain') ||
                      e.dataTransfer.getData('text/note-id');
                    if (noteId) handleDropOnBox(noteId, box.id);
                  }}
                  className={`group flex flex-col items-center justify-start p-1.5 rounded-2xl transition-all cursor-pointer select-none relative focus:outline-none hover:bg-muted/40 active:scale-95 ${
                    isDragOver
                      ? 'ring-2 ring-primary ring-offset-2 scale-105 bg-primary/25 shadow-lg'
                      : ''
                  }`}
                  title={box.title}
                >
                  <BoxThumbnail box={box} size="md" />
                  <span className="text-[11px] sm:text-xs mt-1.5 text-center line-clamp-1 max-w-[76px] font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                    {box.title}
                  </span>
                </button>
              );
            })}

            {/* ADD BOX BUTTON */}
            <button
              type="button"
              onClick={() => handleOpenCreateBox(null)}
              className="group flex flex-col items-center justify-start p-1.5 rounded-2xl transition-all cursor-pointer select-none hover:bg-muted/40 active:scale-95 focus:outline-none"
              title="اضافه کردن باکس جدید"
            >
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl border-2 border-dashed border-border/80 group-hover:border-primary/60 bg-muted/20 group-hover:bg-muted/40 flex items-center justify-center transition-all">
                <RiAddLine className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[11px] sm:text-xs mt-1.5 text-center font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1 max-w-[76px]">
                باکس جدید
              </span>
            </button>
          </div>
        )}

        {/* SUB-BOXES GRID INSIDE FOLDER */}
        {currentBox && (
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 text-center pb-5 pt-1">
            {currentSubBoxes.map((box) => {
              const isDragOver = dragOverBoxId === box.id;
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => setCurrentFolderId(box.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverBoxId(box.id);
                  }}
                  onDragLeave={() => setDragOverBoxId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverBoxId(null);
                    const noteId =
                      e.dataTransfer.getData('text/plain') ||
                      e.dataTransfer.getData('text/note-id');
                    if (noteId) handleDropOnBox(noteId, box.id);
                  }}
                  className={`group flex flex-col items-center justify-start p-1.5 rounded-2xl transition-all cursor-pointer select-none relative focus:outline-none hover:bg-muted/40 active:scale-95 ${
                    isDragOver
                      ? 'ring-2 ring-primary ring-offset-2 scale-105 bg-primary/25 shadow-lg'
                      : ''
                  }`}
                  title={box.title}
                >
                  <BoxThumbnail box={box} size="md" />
                  <span className="text-[11px] sm:text-xs mt-1.5 text-center line-clamp-1 max-w-[76px] font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                    {box.title}
                  </span>
                </button>
              );
            })}

            {/* Add Sub-Box button */}
            <button
              type="button"
              onClick={() => handleOpenCreateBox(currentBox.id)}
              className="group flex flex-col items-center justify-start p-1.5 rounded-2xl transition-all cursor-pointer select-none hover:bg-muted/40 active:scale-95 focus:outline-none"
              title="اضافه کردن زیرباکس جدید"
            >
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl border-2 border-dashed border-border/80 group-hover:border-primary/60 bg-muted/20 group-hover:bg-muted/40 flex items-center justify-center transition-all">
                <RiAddLine className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[11px] sm:text-xs mt-1.5 text-center font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1 max-w-[76px]">
                باکس جدید
              </span>
            </button>
          </div>
        )}

        {/* 3. NOTES LIST (Directly below boxes, clean and uncolored) */}
        <div className="pt-1">
          {displayedNotes.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center space-y-4 rounded-2xl border border-dashed border-border/60 bg-secondary/15">
              <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                <RiFolderOpenLine className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-xs">
                {currentBox
                  ? `هنوز یادداشتی در باکس «${currentBox.title}» وجود ندارد.`
                  : currentFolderId === 'all_notes'
                  ? 'هنوز یادداشتی ایجاد نشده است.'
                  : 'هیچ یادداشتی در شاخه اصلی وجود ندارد.'}
              </p>
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="group relative rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/15 hover:bg-muted/30 dark:hover:bg-muted/20 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] select-none min-w-0 w-full max-w-[200px] min-h-[140px] text-center"
                style={{ maxWidth: '200px' }}
                title="اضافه کردن یادداشت جدید"
              >
                <div className="w-10 h-10 rounded-full border border-border/80 group-hover:border-primary/60 bg-background/80 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <RiAddLine className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs sm:text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors">
                    یادداشت جدید
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    افزودن یادداشت تازه
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 justify-items-start">
              {displayedNotes.map((note, index) => {
                const noteBox = note.box_id ? boxesMap[note.box_id] : null;
                const noteParentBox = noteBox?.parent_id ? boxesMap[noteBox.parent_id] : null;

                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    index={index}
                    box={noteBox}
                    parentBox={noteParentBox}
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
                );
              })}

              {/* Last Card in Notes: Add Note Card (matches note card size & style) */}
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="group relative rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/15 hover:bg-muted/30 dark:hover:bg-muted/20 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] select-none min-w-0 w-full max-w-[200px] min-h-[140px] text-center"
                style={{ maxWidth: '200px' }}
                title="اضافه کردن یادداشت جدید"
              >
                <div className="w-10 h-10 rounded-full border border-border/80 group-hover:border-primary/60 bg-background/80 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <RiAddLine className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs sm:text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors">
                    یادداشت جدید
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    افزودن یادداشت تازه
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
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
    </div>
  );
};
