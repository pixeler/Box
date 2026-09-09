import React, { useState, useEffect, useRef } from 'react';
import type { Tag } from '@/types/models';
import { entryRepo, taskRepo, tagRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey } from '@/lib/jalali';
import { parseQuickInput } from '@/lib/quick-parser';
import { JalaliDatePicker } from '../calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiCloseLine,
  RiArrowDownSLine,
} from '@remixicon/react';

interface TaskInlineFormProps {
  initialDate?: string;
  initialTitle?: string;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const TaskInlineForm: React.FC<TaskInlineFormProps> = ({
  initialDate,
  initialTitle = '',
  onClose,
  onTaskCreated,
}) => {
  const todayKey = getTodayJalaliKey();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(initialDate || todayKey);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    if (initialTitle) {
      handleTitleChange(initialTitle);
    }
  }, []);

  // Handle live title typing with regex parsing
  const handleTitleChange = async (val: string) => {
    setTitle(val);

    // Live regex detection
    const parsed = parseQuickInput(val, dueDate || todayKey);

    // If tags detected in typing
    if (parsed.tags.length > 0) {
      for (const t of parsed.tags) {
        const createdTag = await tagRepo.getOrCreate(t, 'manual');
        setTagIds((prev) => (prev.includes(createdTag.id) ? prev : [...prev, createdTag.id]));
        setTagsMap((prev) => ({ ...prev, [createdTag.id]: createdTag }));
      }
    }

    // If priority detected in typing
    if (parsed.priority !== undefined) {
      setPriority(parsed.priority);
    }

    // If due date explicitly detected in typing
    if (parsed.dueDate && parsed.dueDate !== dueDate) {
      setDueDate(parsed.dueDate);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseQuickInput(title, dueDate || todayKey);
    const cleanTitle = parsed.cleanTitle || title.trim().replace(/[/~#]+$/u, '').trim();
    if (!cleanTitle) return;

    try {
      const entry = await entryRepo.create({
        raw_text: cleanTitle,
        source: 'text',
        processed: true,
      });

      await taskRepo.create({
        entry_id: entry.id,
        title: cleanTitle,
        description: description.trim(),
        status: 'open',
        due_date: dueDate || parsed.dueDate || undefined,
        priority: priority ?? parsed.priority,
        tag_ids: tagIds,
      });

      onTaskCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  return (
    <div className="w-full mb-3 rounded-[8px] border border-gray-300 bg-white p-3 shadow-md select-none font-sans text-right transition-all">
      <form onSubmit={handleSubmit}>
        {/* Title Input */}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="عنوان تسک..."
          className="w-full text-[14px] font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-400 placeholder:font-normal mb-2"
          dir="rtl"
        />

        {/* Description Textarea */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="توضیحات (اختیاری)..."
          rows={2}
          className="w-full resize-none text-[12px] text-gray-600 bg-transparent outline-none placeholder:text-gray-400 leading-relaxed mb-3"
          dir="rtl"
        />

        {/* Property Chips Toolbar (Date, Tags, Priority) */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* 1. Date Picker Chip */}
          <div className="relative">
            <button
              ref={dateBtnRef}
              type="button"
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs transition-colors cursor-pointer border ${
                dueDate
                  ? 'bg-gray-50 border-gray-300 text-gray-800'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <RiCalendarLine className="w-3.5 h-3.5 text-gray-500" />
              <span>
                {dueDate ? formatJalaliDisplay(parseJalaliKey(dueDate)) : 'تاریخ سررسید'}
              </span>
              {dueDate && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDueDate(null);
                  }}
                  className="hover:text-rose-600 p-0.5"
                  title="حذف تاریخ"
                >
                  <RiCloseLine className="w-3 h-3" />
                </span>
              )}
            </button>

            {datePickerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xs" onClick={() => setDatePickerOpen(false)}>
                <div onClick={(e) => e.stopPropagation()}>
                  <JalaliDatePicker
                    value={dueDate}
                    onChange={(d) => {
                      setDueDate(d);
                      setDatePickerOpen(false);
                    }}
                    onClose={() => setDatePickerOpen(false)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Tag Picker Chip */}
          <div className="relative">
            <button
              ref={tagBtnRef}
              type="button"
              onClick={() => setTagPickerOpen(!tagPickerOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs transition-colors cursor-pointer border ${
                selectedTags.length > 0
                  ? 'bg-gray-50 border-gray-300 text-gray-800'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <RiPriceTag3Line className="w-3.5 h-3.5 text-gray-500" />
              <span>
                {selectedTags.length > 0
                  ? selectedTags.map((t) => `#${t.name}`).join(' ')
                  : 'برچسب...'}
              </span>
            </button>

            {tagPickerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xs" onClick={() => setTagPickerOpen(false)}>
                <div onClick={(e) => e.stopPropagation()}>
                  <TagPickerPopover
                    selectedTagIds={tagIds}
                    onToggleTag={handleToggleTag}
                    onClose={() => setTagPickerOpen(false)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Priority Dropdown Chip */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs transition-colors cursor-pointer border ${
                  priority
                    ? 'bg-gray-50 border-gray-300'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {priority === 3 && <RiFlagFill className="w-3.5 h-3.5 text-rose-600" />}
                {priority === 2 && <RiFlagFill className="w-3.5 h-3.5 text-amber-500" />}
                {priority === 1 && <RiFlagFill className="w-3.5 h-3.5 text-blue-500" />}
                {!priority && <RiFlagLine className="w-3.5 h-3.5 text-gray-400" />}
                <span>
                  {priority === 3 && 'فوری (P1)'}
                  {priority === 2 && 'متوسط (P2)'}
                  {priority === 1 && 'کم (P3)'}
                  {!priority && 'اولویت'}
                </span>
                <RiArrowDownSLine className="w-3 h-3 text-gray-400 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-36 p-1" dir="rtl">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => setPriority(3)}
              >
                <RiFlagFill className="w-3.5 h-3.5 text-rose-600" />
                <span>فوری (P1)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => setPriority(2)}
              >
                <RiFlagFill className="w-3.5 h-3.5 text-amber-500" />
                <span>متوسط (P2)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => setPriority(1)}
              >
                <RiFlagFill className="w-3.5 h-3.5 text-blue-500" />
                <span>کم (P3)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-gray-500"
                onClick={() => setPriority(undefined)}
              >
                <RiFlagLine className="w-3.5 h-3.5 text-gray-400" />
                <span>بدون اولویت</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] px-3.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            لغو
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-[6px] bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            افزودن کار
          </button>
        </div>
      </form>
    </div>
  );
};
