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
      className="w-[240px] bg-white rounded-[8px] border border-gray-200 shadow-xl p-2 select-none text-right font-sans z-50"
    >
      {/* Search Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200/80 mb-2">
        <RiSearchLine className="w-3.5 h-3.5 text-gray-400 shrink-0" />
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
          className="w-full bg-transparent text-xs outline-none text-gray-800 placeholder-gray-400"
          autoFocus
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <RiCloseLine className="w-3 h-3" />
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-3 h-3" />
          </button>
        ) : null}
      </div>

      {/* Tag List */}
      <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
        {filteredTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <RiPriceTag3Line className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">#{tag.name}</span>
              </div>
              {isSelected && <RiCheckLine className="w-3.5 h-3.5 text-black shrink-0" />}
            </button>
          );
        })}

        {filteredTags.length === 0 && !showCreate && (
          <div className="text-center py-3 text-xs text-gray-400">
            برچسبی یافت نشد
          </div>
        )}

        {/* Create new tag option */}
        {showCreate && (
          <button
            type="button"
            onClick={handleCreateNewTag}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer mt-1 border-t border-gray-100 pt-2"
          >
            <RiAddLine className="w-3.5 h-3.5" />
            <span>ایجاد برچسب «{search.trim()}»</span>
          </button>
        )}
      </div>
    </div>
  );
};
