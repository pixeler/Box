import React, { useState, useEffect, useMemo } from 'react';
import type { Tag } from '@/types/models';
import { tagRepo } from '@/repositories';
import {
  RiPriceTag3Line,
  RiCheckLine,
  RiAddLine,
  RiSearchLine,
  RiCloseLine,
} from '@remixicon/react';

interface TagPickerPopoverProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClose?: () => void;
}

export const TagPickerPopover: React.FC<TagPickerPopoverProps> = ({
  selectedTagIds,
  onToggleTag,
  onClose,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');

  const loadTags = async () => {
    const all = await tagRepo.listAll();
    setTags(all);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTags = useMemo(() => {
    if (!normalizedSearch) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(normalizedSearch));
  }, [tags, normalizedSearch]);

  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === normalizedSearch
  );
  const showCreate = normalizedSearch.length > 0 && !exactMatch;

  const handleCreateNewTag = async () => {
    if (!normalizedSearch) return;
    const cleanName = search.trim().replace(/^#/, '');
    const newTag = await tagRepo.getOrCreate(cleanName, 'manual');
    await loadTags();
    onToggleTag(newTag.id);
    setSearch('');
  };

  return (
    <div
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
      className="w-[260px] bg-card text-card-foreground rounded-2xl border border-border/80 dark:border-white/10 shadow-2xl p-2.5 select-none text-right font-sans z-50"
    >
      {/* Search Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 dark:bg-white/5 rounded-xl border border-border/70 dark:border-white/10 mb-2">
        <RiSearchLine className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showCreate) {
                handleCreateNewTag();
              }
            }
          }}
          placeholder="جستجو یا افزودن برچسب..."
          className="w-full bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
          autoFocus
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <RiCloseLine className="w-3.5 h-3.5" />
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="بستن"
          >
            <RiCloseLine className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Tag List */}
      <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
        {filteredTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold shadow-xs'
                  : 'hover:bg-muted/70 dark:hover:bg-white/10 text-foreground/85 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <RiPriceTag3Line className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white dark:text-zinc-900' : 'text-muted-foreground'}`} />
                <span className="truncate">#{tag.name}</span>
              </div>
              {isSelected && <RiCheckLine className="w-3.5 h-3.5 text-white dark:text-zinc-900 shrink-0" />}
            </button>
          );
        })}

        {filteredTags.length === 0 && !showCreate && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            برچسبی یافت نشد
          </div>
        )}

        {/* Create new tag option */}
        {showCreate && (
          <button
            type="button"
            onClick={handleCreateNewTag}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs text-primary font-medium hover:bg-muted/70 dark:hover:bg-white/10 transition-colors cursor-pointer mt-1 border-t border-border/60 dark:border-white/10 pt-2"
          >
            <RiAddLine className="w-3.5 h-3.5" />
            <span>ایجاد برچسب «{search.trim()}»</span>
          </button>
        )}
      </div>
    </div>
  );
};
