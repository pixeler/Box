import React, { useState, useEffect } from 'react';
import type { Task, Tag } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay } from '@/lib/jalali';
import { JalaliDatePicker } from '../calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { toast } from '@/lib/toast';
import {
  RiCloseLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiCalendarEventLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
} from '@remixicon/react';

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !task) return null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState<string | null>(task.due_date || null);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(task.priority);
  const [tagIds, setTagIds] = useState<string[]>(task.tag_ids || []);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setDueDate(task.due_date || null);
    setPriority(task.priority);
    setTagIds(task.tag_ids || []);

    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
  }, [task]);

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
    if (!title.trim()) return;

    if (task.status !== 'done' && status === 'done') {
      toast.show('تسک دان شد');
    }

    await taskRepo.update(task.id, {
      title: title.trim(),
      description: description.trim(),
      status,
      due_date: dueDate || undefined,
      priority,
      tag_ids: tagIds,
    });

    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (window.confirm('آیا از حذف این تسک اطمینان دارید؟')) {
      await taskRepo.softDelete(task.id);
      onSaved();
      onClose();
    }
  };

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const formattedDueDate = dueDate
    ? formatJalaliDisplay(parseJalaliKey(dueDate))
    : 'بدون تاریخ سررسید';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-white rounded-[8px] border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">ویرایش تسک</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 flex flex-col gap-3.5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              عنوان تسک
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان تسک را بنویسید..."
              className="w-full text-sm font-bold text-gray-900 border border-gray-200 rounded-[6px] px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              توضیحات (اختیاری)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جزئیات بیشتر..."
              rows={2}
              className="w-full text-xs text-gray-700 border border-gray-200 rounded-[6px] px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
            />
          </div>

          {/* Row: Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                وضعیت
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs text-gray-700 border border-gray-200 rounded-[6px] px-2.5 py-1.5 outline-none bg-white cursor-pointer"
              >
                <option value="open">انجام‌نشده</option>
                <option value="done">انجام‌شده</option>
              </select>
            </div>

            {/* Priority Flags */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                اولویت
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPriority(undefined)}
                  title="بدون اولویت"
                  className={`p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    !priority
                      ? 'border-gray-400 bg-gray-100 text-gray-700'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <RiFlagLine className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setPriority(1)}
                  title="اولویت کم (P3)"
                  className={`p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    priority === 1
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <RiFlagFill className="w-3.5 h-3.5 text-blue-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setPriority(2)}
                  title="اولویت متوسط (P2)"
                  className={`p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    priority === 2
                      ? 'border-amber-300 bg-amber-50 text-amber-600'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <RiFlagFill className="w-3.5 h-3.5 text-amber-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setPriority(3)}
                  title="اولویت زیاد / فوری (P1)"
                  className={`p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    priority === 3
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <RiFlagFill className="w-3.5 h-3.5 text-rose-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Due Date Row */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              تاریخ موعد
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDatePickerOpen(!datePickerOpen)}
                className="flex-1 flex items-center justify-between border border-gray-200 rounded-[6px] px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400 bg-white cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <RiCalendarEventLine className="w-3.5 h-3.5 text-gray-500" />
                  <span>{formattedDueDate}</span>
                </div>
                {dueDate && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setDueDate(null);
                    }}
                    className="text-gray-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                    title="حذف تاریخ"
                  >
                    <RiCloseLine className="w-3 h-3" />
                  </span>
                )}
              </button>
            </div>

            {/* Embedded Date Picker Popover */}
            {datePickerOpen && (
              <div className="absolute top-14 right-0 z-50">
                <JalaliDatePicker
                  value={dueDate}
                  onChange={(d) => {
                    setDueDate(d);
                    setDatePickerOpen(false);
                  }}
                  onClose={() => setDatePickerOpen(false)}
                />
              </div>
            )}
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
            >
              <RiDeleteBinLine className="w-3.5 h-3.5" />
              <span>حذف تسک</span>
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
                <span>ذخیره تغییرات</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
