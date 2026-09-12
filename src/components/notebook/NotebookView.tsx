import React, { useState, useEffect } from 'react';
import type { Note, Tag } from '@/types/models';
import { noteRepo, tagRepo, entryRepo } from '@/repositories';
import { NoteItemRow } from '../stream/NoteItemRow';
import {
  RiBookletLine,
  RiAddLine,
  RiPriceTag3Line,
  RiLightbulbLine,
} from '@remixicon/react';
import { toast } from '@/lib/toast';

export const NotebookView: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'idea'>('note');

  const loadData = async () => {
    const allNotes = await noteRepo.list();
    const allTags = await tagRepo.listAll();
    const map: Record<string, Tag> = {};
    allTags.forEach((t) => (map[t.id] = t));
    setTagsMap(map);
    setNotes(allNotes);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNoteText.trim();
    if (!trimmed) return;

    const entry = await entryRepo.create({
      raw_text: trimmed,
      source: 'text',
      processed: true,
    });

    await noteRepo.create({
      entry_id: entry.id,
      type: noteType,
      title: trimmed.slice(0, 40),
      body: trimmed,
      tag_ids: selectedTag ? [selectedTag] : [],
    });

    toast.show(noteType === 'idea' ? 'ایده جدید ثبت شد' : 'یادداشت جدید ثبت شد');
    setNewNoteText('');
    loadData();
  };

  const filteredNotes = selectedTag
    ? notes.filter((n) => n.tag_ids.includes(selectedTag))
    : notes;

  return (
    <div className="w-full flex-1 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RiBookletLine className="w-5 h-5 text-foreground" />
            <h2 className="text-base font-bold text-foreground">دفترچه یادداشت و ایده‌ها</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {notes.length} یادداشت
          </span>
        </div>

        {/* Quick note creator */}
        <form onSubmit={handleCreateNote} className="mb-4">
          <div className="w-full bg-secondary/60 border border-border rounded-2xl p-3 focus-within:border-primary/60 transition-colors">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
                if (isEnter && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateNote(e);
                }
              }}
              placeholder="نوشتن یک فکر، یادداشت یا ایده جدید... (Enter برای ثبت)"
              rows={2}
              className="w-full bg-transparent text-sm outline-none resize-none text-foreground placeholder-muted-foreground"
              dir="rtl"
            />
            <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-1">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNoteType(noteType === 'note' ? 'idea' : 'note')}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                >
                  <RiLightbulbLine className="w-3.5 h-3.5 text-amber-500" />
                  <span>{noteType === 'idea' ? 'نوع: ایده' : 'نوع: یادداشت'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={!newNoteText.trim()}
                className="px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>ثبت</span>
                <RiAddLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Tag filter pills */}
        {Object.keys(tagsMap).length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                selectedTag === null
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              همه
            </button>
            {Object.values(tagsMap).map((tag) => (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(tag.id === selectedTag ? null : tag.id)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                  selectedTag === tag.id
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <RiPriceTag3Line className="w-3 h-3" />
                <span>{tag.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Notes list */}
        <div className="space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              هنوز یادداشتی در این بخش ثبت نشده است.
            </div>
          ) : (
            filteredNotes.map((note) => (
              <NoteItemRow
                key={note.id}
                note={note}
                tagsMap={tagsMap}
                onStatusChanged={loadData}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
