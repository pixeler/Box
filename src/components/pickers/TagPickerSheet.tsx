import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getOverlayPortalTarget } from '@/lib/overlay';
import type { Tag } from '@/types/models';
import { tagRepo } from '@/repositories';
import {
  RiPriceTag3Line,
  RiCheckLine,
  RiAddLine,
  RiSearchLine,
  RiCloseLine,
} from '@remixicon/react';

interface TagPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export const TagPickerSheet: React.FC<TagPickerSheetProps> = ({
  isOpen,
  onClose,
  selectedTagIds,
  onToggleTag,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      loadTags();
    }
  }, [isOpen]);

  const loadTags = async () => {
    const all = await tagRepo.listAll();
    setTags(all);
  };

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
  }, [isOpen]);

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

  if (!isOpen && !isClosing) return null;

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
        className={`w-full bg-card text-card-foreground rounded-t-[28px] border-t border-border/80 dark:border-white/10 shadow-2xl px-5 pt-3 pb-6 font-sans text-right flex flex-col max-h-[80%] relative ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-foreground">انتخاب برچسب‌ها</h3>
            {selectedTagIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary">
                {selectedTagIds.length} برچسب
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

        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 dark:bg-white/5 rounded-2xl border border-border/60 dark:border-white/10 mb-2.5 shrink-0">
          <RiSearchLine className="w-4 h-4 text-muted-foreground shrink-0" />
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
            placeholder="جستجو یا ایجاد برچسب جدید..."
            className="w-full bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/60"
            autoFocus
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

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5">
          {/* Create option if searching */}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreateNewTag}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition cursor-pointer text-right group mb-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <RiAddLine className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-primary">ایجاد برچسب «{search.trim()}»</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">افزودن و برگزیدن برای این تسک</div>
                </div>
              </div>
            </button>
          )}

          {filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer active:scale-[0.98] text-right group ${
                  isSelected
                    ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                    : 'border-border/60 dark:border-white/10 hover:border-primary/30 hover:bg-muted/40 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 dark:bg-white/10 text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    <RiPriceTag3Line className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    #{tag.name}
                  </span>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <RiCheckLine className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}
              </button>
            );
          })}

          {filteredTags.length === 0 && !showCreate && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              هیچ برچسبی یافت نشد
            </div>
          )}
        </div>

        {/* Bottom Done Button */}
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
      </div>
    </div>,
    portalTarget
  );
};
