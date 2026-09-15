import React, { useState, useEffect, useRef } from 'react';
import type { Tag } from '@/types/models';
import { RiAddLine, RiCheckLine } from '@remixicon/react';

interface QuickTagSuggestProps {
  query: string;
  tags: Tag[];
  selectedTagIds: string[];
  onSelectTag: (tagName: string) => void;
  onClose: () => void;
}

export const QuickTagSuggest: React.FC<QuickTagSuggestProps> = ({
  query,
  tags,
  selectedTagIds,
  onSelectTag,
  onClose,
}) => {
  const cleanQuery = query.replace(/^#/, '').trim().toLowerCase();

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(cleanQuery)
  );

  const exactMatch = filtered.some(
    (t) => t.name.toLowerCase() === cleanQuery
  );

  // Items list: filtered existing tags, plus optional "create new" item
  type ListItem = { type: 'existing'; tag: Tag } | { type: 'create'; name: string };

  const items: ListItem[] = filtered.map((t) => ({ type: 'existing' as const, tag: t }));
  if (cleanQuery && !exactMatch) {
    items.push({ type: 'create' as const, name: cleanQuery });
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [cleanQuery]);

  // Handle keyboard events passed or captured
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((prev) =>
          items.length > 0 ? (prev - 1 + items.length) % items.length : 0
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (items.length > 0 && activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
          e.stopPropagation();
          const item = items[activeIndex];
          if (item.type === 'existing') {
            onSelectTag(item.tag.name);
          } else {
            onSelectTag(item.name);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [items, activeIndex, onSelectTag, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div
      className="absolute top-full right-0 mt-1.5 z-50 w-64 max-w-[92vw] bg-card/85 dark:bg-card/90 backdrop-blur-xl rounded-xl border border-border/60 dark:border-white/10 shadow-xl overflow-hidden animate-popover-fade text-right select-none"
      dir="rtl"
    >
      <div
        ref={listRef}
        className="max-h-56 overflow-y-auto p-1 space-y-0.5"
      >
        {items.length === 0 ? (
          <div className="py-3 text-center text-xs text-muted-foreground">
            برچسبی یافت نشد
          </div>
        ) : (
          items.map((item, idx) => {
            const isSelected = idx === activeIndex;
            if (item.type === 'existing') {
              const isAlreadyAdded = selectedTagIds.includes(item.tag.id);
              return (
                <button
                  key={item.tag.id}
                  type="button"
                  onClick={() => onSelectTag(item.tag.name)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-right ${
                    isSelected
                      ? 'bg-black/[0.04] dark:bg-white/[0.055] text-foreground font-medium'
                      : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.035] text-foreground/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/60" />
                    <span className="truncate leading-tight">#{item.tag.name}</span>
                  </div>
                  {isAlreadyAdded && (
                    <RiCheckLine className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                  )}
                </button>
              );
            } else {
              return (
                <button
                  key={`create-${item.name}`}
                  type="button"
                  onClick={() => onSelectTag(item.name)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-right ${
                    isSelected
                      ? 'bg-black/[0.04] dark:bg-white/[0.055] text-foreground font-medium'
                      : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.035] text-muted-foreground'
                  }`}
                >
                  <RiAddLine className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate leading-tight">ایجاد برچسب «{item.name}»</span>
                </button>
              );
            }
          })
        )}
      </div>
    </div>
  );
};
