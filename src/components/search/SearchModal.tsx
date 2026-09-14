import React, { useState, useEffect, useMemo } from 'react';
import MiniSearch from 'minisearch';
import { taskRepo, noteRepo, eventRepo } from '@/repositories';
import {
  RiSearchLine,
  RiCloseLine,
  RiCheckboxCircleLine,
  RiStickyNoteLine,
  RiCalendarEventLine,
} from '@remixicon/react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
}

interface SearchDocument {
  id: string;
  type: 'task' | 'note' | 'event';
  title: string;
  content: string;
  date?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
}) => {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDocument[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadAll = async () => {
      const tasks = await taskRepo.list();
      const notes = await noteRepo.list();
      const events = await eventRepo.list();

      const searchDocs: SearchDocument[] = [
        ...tasks.map((t) => ({
          id: t.id,
          type: 'task' as const,
          title: t.title,
          content: `${t.title} ${t.description || ''}`,
          date: t.due_date,
        })),
        ...notes.map((n) => ({
          id: n.id,
          type: 'note' as const,
          title: n.title,
          content: `${n.title} ${n.body}`,
          date: undefined,
        })),
        ...events.map((e) => ({
          id: e.id,
          type: 'event' as const,
          title: e.title,
          content: `${e.title} ${e.recurrence_rule || ''}`,
          date: undefined,
        })),
      ];

      setDocs(searchDocs);
    };

    loadAll();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const miniSearch = useMemo(() => {
    const ms = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['type', 'title', 'content', 'date'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
      },
    });
    if (docs.length > 0) {
      ms.addAll(docs);
    }
    return ms;
  }, [docs]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    try {
      return miniSearch.search(q);
    } catch {
      return [];
    }
  }, [miniSearch, query]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card text-card-foreground rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Search Input */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <RiSearchLine className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="جستجوی آنی در تمام تسک‌ها، یادداشت‌ها و رویدادها..."
            className="w-full text-sm outline-none text-foreground placeholder-muted-foreground font-sans bg-transparent"
            dir="rtl"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              یک کلمه، هشتگ یا عبارت را جستجو کنید.
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              موردی مطابق با «{query}» پیدا نشد.
            </div>
          ) : (
            results.map((res) => (
              <div
                key={res.id}
                onClick={() => {
                  if (res.date) {
                    onSelectDate(res.date);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-secondary/70 cursor-pointer transition-colors border border-transparent hover:border-border"
              >
                <div className="p-2 rounded-xl bg-secondary text-secondary-foreground shrink-0">
                  {res.type === 'task' && <RiCheckboxCircleLine className="w-4 h-4 text-emerald-500" />}
                  {res.type === 'note' && <RiStickyNoteLine className="w-4 h-4 text-blue-500" />}
                  {res.type === 'event' && <RiCalendarEventLine className="w-4 h-4 text-purple-500" />}
                </div>

                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-bold text-foreground truncate">
                    {res.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {res.content}
                  </p>
                </div>

                {res.date && (
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                    {res.date}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
