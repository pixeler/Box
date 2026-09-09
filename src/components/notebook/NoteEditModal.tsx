import React, { useState, useEffect } from 'react';
import type { Note, Tag } from '@/types/models';
import { noteRepo, tagRepo } from '@/repositories';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import {
  RiCloseLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiPriceTag3Line,
  RiPushpin2Line,
  RiPushpin2Fill,
  RiLightbulbLine,
  RiFileTextLine,
  RiPaletteLine,
} from '@remixicon/react';
import { PASTEL_NOTE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface NoteEditModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NoteEditModal: React.FC<NoteEditModalProps> = ({
  note,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !note) return null;

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [type, setType] = useState<'note' | 'idea'>(note.type || 'note');
  const [pinned, setPinned] = useState(!!note.pinned);
  const [color, setColor] = useState<string | undefined>(note.color);
  const [tagIds, setTagIds] = useState<string[]>(note.tag_ids || []);

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  useEffect(() => {
    setTitle(note.title);
    setBody(note.body);
    setType(note.type || 'note');
    setPinned(!!note.pinned);
    setColor(note.color);
    setTagIds(note.tag_ids || []);

    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
  }, [note]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;

    await noteRepo.update(note.id, {
      title: title.trim() || body.trim().slice(0, 30),
      body: body.trim(),
      type,
      pinned,
      color,
      tag_ids: tagIds,
    });

    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('آیا از حذف این یادداشت اطمینان دارید؟')) {
      await noteRepo.softDelete(note.id);
      onSaved();
      onClose();
    }
  };

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-white rounded-[8px] border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">ویرایش یادداشت / ایده</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              title={pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                pinned ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {pinned ? <RiPushpin2Fill className="w-4 h-4" /> : <RiPushpin2Line className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 flex flex-col gap-3.5">
          {/* Type Selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setType('note')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                type === 'note'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <RiFileTextLine className="w-3.5 h-3.5" />
              <span>یادداشت</span>
            </button>

            <button
              type="button"
              onClick={() => setType('idea')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                type === 'idea'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <RiLightbulbLine className="w-3.5 h-3.5" />
              <span>ایده</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              عنوان (اختیاری)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان یادداشت..."
              className="w-full text-sm font-bold text-gray-900 border border-gray-200 rounded-[6px] px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              متن کامل
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="شرح کامل یادداشت یا ایده..."
              rows={4}
              className="w-full text-xs text-gray-800 border border-gray-200 rounded-[6px] px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none leading-relaxed"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              برچسب‌ها
            </label>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[30px] p-1.5 border border-gray-200 rounded-[6px] bg-white">
              {tagIds.map((id) => {
                const tag = tagsMap[id];
                if (!tag) return null;
                return (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md"
                  >
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <RiCloseLine className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}

              <button
                type="button"
                onClick={() => setTagPickerOpen(!tagPickerOpen)}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-black px-1.5 py-0.5 rounded hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <RiPriceTag3Line className="w-3 h-3" />
                <span>+ برچسب</span>
              </button>
            </div>

            {tagPickerOpen && (
              <div className="absolute top-14 right-0 z-50">
                <TagPickerPopover
                  selectedTagIds={tagIds}
                  onToggleTag={handleToggleTag}
                  onClose={() => setTagPickerOpen(false)}
                />
              </div>
            )}
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <RiPaletteLine className="w-3.5 h-3.5 text-gray-400" />
              <span>رنگ یادداشت</span>
            </label>
            <div className="flex items-center gap-2 pt-0.5">
              {PASTEL_NOTE_COLORS.map((c) => {
                const isSelected = (!color && c.hex === '') || color === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setColor(c.hex || undefined)}
                    className={cn(
                      'w-6 h-6 rounded-full border transition-all flex items-center justify-center cursor-pointer hover:scale-110 shadow-2xs',
                      c.borderClass,
                      isSelected
                        ? 'ring-2 ring-black ring-offset-1 scale-105'
                        : 'opacity-85 hover:opacity-100'
                    )}
                    style={{ backgroundColor: c.hex || '#ffffff' }}
                  >
                    {isSelected && (
                      <RiCheckLine className="w-3.5 h-3.5 text-gray-800 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
            >
              <RiDeleteBinLine className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-black rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer transition-colors flex items-center gap-1"
              >
                <RiCheckLine className="w-3.5 h-3.5" />
                <span>ذخیره</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
