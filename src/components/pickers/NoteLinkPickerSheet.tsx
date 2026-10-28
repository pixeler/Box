import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import type { Note } from '@/types/models';
import { noteRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import { PickerPopover, type PickerAnchor } from './PickerPopover';
import {
  RiStickyNoteLine,
  RiCheckLine,
  RiAddLine,
  RiSearchLine,
  RiCloseLine,
  RiLinksLine,
} from '@remixicon/react';

interface NoteLinkPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNoteIds: string[];
  onChange: (noteIds: string[]) => void;
  /** New notes inherit the task's box, so they land where the user expects. */
  defaultBoxId?: string | null;
  variant?: 'sheet' | 'popover';
  anchorRect?: PickerAnchor | null;
}

const noteTitle = (note: Note) => note.title?.trim() || 'یادداشت بدون عنوان';

const noteSnippet = (note: Note): string => {
  const raw = note.description?.trim() || note.body || '';
  if (!raw) return '';
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 90 ? `${text.slice(0, 90).trim()}…` : text;
};

export const NoteLinkPickerSheet: React.FC<NoteLinkPickerSheetProps> = ({
  isOpen,
  onClose,
  selectedNoteIds,
  onChange,
  defaultBoxId = null,
  variant = 'sheet',
  anchorRect = null,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    setSearch('');
    setNewNoteTitle('');
    noteRepo.list().then(setNotes).catch(console.error);
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing]);

  const normalizedSearch = search.trim().toLocaleLowerCase('fa');
  const filteredNotes = useMemo(() => {
    if (!normalizedSearch) return notes;
    return notes.filter((note) => {
      const haystack = `${note.title || ''} ${note.description || ''} ${note.body || ''}`
        .toLocaleLowerCase('fa');
      return haystack.includes(normalizedSearch);
    });
  }, [notes, normalizedSearch]);

  const toggleNote = (noteId: string) => {
    const next = selectedNoteIds.includes(noteId)
      ? selectedNoteIds.filter((id) => id !== noteId)
      : [...selectedNoteIds, noteId];
    onChange(next);
  };

  const handleCreateNote = async () => {
    const title = newNoteTitle.trim();
    if (!title || creating) return;

    setCreating(true);
    try {
      const created = await noteRepo.create({
        entry_id: null,
        box_id: defaultBoxId || null,
        type: 'note',
        title,
        body: '',
        tag_ids: [],
      });
      setNotes((prev) => [created, ...prev]);
      onChange([...selectedNoteIds, created.id]);
      setNewNoteTitle('');
      setSearch('');
      toast.show('یادداشت ساخته و به تسک لینک شد');
    } catch (err) {
      console.error('Failed to create linked note:', err);
      toast.show('ساخت یادداشت انجام نشد');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen && !isClosing) return null;

  const isPopover = variant === 'popover';

  const panelBody = (
    <>
      {!isPopover && (
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab" />
      )}

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-foreground">یادداشت‌های مرتبط</h3>
          {selectedNoteIds.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary">
              {selectedNoteIds.length} یادداشت
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
        >
          <RiCloseLine className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 dark:bg-white/5 rounded-2xl border border-border/60 dark:border-white/10 mb-2 shrink-0">
        <RiSearchLine className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو در یادداشت‌ها..."
          className="w-full bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/60"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5"
          >
            <RiCloseLine className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 shrink-0">
        <input
          type="text"
          value={newNoteTitle}
          onChange={(e) => setNewNoteTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreateNote();
            }
          }}
          placeholder="یادداشت جدید..."
          className="min-w-0 flex-1 rounded-2xl border border-dashed border-border/70 bg-transparent px-3 py-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <button
          type="button"
          onClick={() => void handleCreateNote()}
          disabled={!newNoteTitle.trim() || creating}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <RiAddLine className="w-4 h-4" />
          <span>{creating ? 'در حال ساخت...' : 'ساخت و لینک'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5">
        {filteredNotes.map((note) => {
          const isSelected = selectedNoteIds.includes(note.id);
          const snippet = noteSnippet(note);
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => toggleNote(note.id)}
              className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition cursor-pointer active:scale-[0.98] text-right group ${
                isSelected
                  ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                  : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 dark:bg-white/10 text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  <RiStickyNoteLine className="w-4 h-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span
                    className={`truncate text-xs font-bold leading-tight ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {noteTitle(note)}
                  </span>
                  {snippet && (
                    <span className="mt-0.5 truncate text-[10.5px] font-normal leading-normal text-muted-foreground">
                      {snippet}
                    </span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="w-5 h-5 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <RiCheckLine className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              )}
            </button>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-7 text-center text-xs text-muted-foreground">
            <RiLinksLine className="w-5 h-5 text-muted-foreground/60" />
            <span>{search ? 'یادداشتی پیدا نشد' : 'هنوز یادداشتی نداری؛ از بالا یکی بساز'}</span>
          </div>
        )}
      </div>

      <div className="pt-3 mt-1 border-t border-border/60 dark:border-white/10 shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-2.5 rounded-2xl bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-xs font-bold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <RiCheckLine className="w-4 h-4 stroke-[2.5]" />
          <span>تأیید و بازگشت</span>
        </button>
      </div>
    </>
  );

  if (isPopover) {
    return (
      <PickerPopover anchorRect={anchorRect} onClose={onClose} width={380}>
        <div className="flex max-h-[min(65vh,520px)] w-full flex-col px-3.5 pb-3.5 pt-3" dir="rtl">
          {panelBody}
        </div>
      </PickerPopover>
    );
  }

  const portalTarget = getOverlayPortalTarget();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-[80] flex flex-col justify-end bg-black/65 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-6 font-sans text-right flex flex-col max-h-[82%] relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {panelBody}
      </div>
    </div>,
    portalTarget
  );
};
