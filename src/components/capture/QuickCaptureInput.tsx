import React, { useState, useEffect, useRef } from 'react';
import type { Tag } from '@/types/models';
import { entryRepo, taskRepo, noteRepo, tagRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey } from '@/lib/jalali';
import { JalaliDatePicker } from '../calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { BlockNoteEditor } from '@/components/editor/BlockNoteEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RiCloseLine,
  RiCheckboxLine,
  RiCalendarScheduleLine,
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiUserLine,
  RiInboxArchiveLine,
  RiPushpinLine,
  RiPushpinFill,
  RiLink,
  RiImageLine,
  RiFullscreenLine,
  RiFullscreenExitLine,
} from '@remixicon/react';

import { toast } from '@/lib/toast';

interface QuickCaptureInputProps {
  currentSelectedDateKey: string;
  onItemCreated: () => void | Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

type CaptureTab = 'task' | 'note';

export const QuickCaptureInput: React.FC<QuickCaptureInputProps> = ({
  currentSelectedDateKey,
  onItemCreated,
  isOpen,
  onClose,
  onOpen,
}) => {
  const [activeTab, setActiveTab] = useState<CaptureTab>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(currentSelectedDateKey);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [assignee, setAssignee] = useState<string>('');
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const todayKey = getTodayJalaliKey();

  // Load tags
  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
  }, []);

  // When opening or switching tab, focus title input immediately and sync due date
  useEffect(() => {
    if (isOpen) {
      setDueDate(currentSelectedDateKey);
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, currentSelectedDateKey]);

  // Keep due date updated with selected date
  useEffect(() => {
    setDueDate(currentSelectedDateKey);
  }, [currentSelectedDateKey]);

  // Global key bindings: 'N' / Persian 'د' to open, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')));

      if (!isOpen) {
        if (
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          (e.key === 'n' || e.key === 'N' || e.key === 'د' || e.code === 'KeyN') &&
          !isInput
        ) {
          e.preventDefault();
          onOpen?.();
        }
      } else {
        if (e.key === 'Escape' || e.code === 'Escape') {
          if (datePickerOpen) {
            setDatePickerOpen(false);
            return;
          }
          if (tagPickerOpen) {
            setTagPickerOpen(false);
            return;
          }
          if (boxPickerOpen) {
            setBoxPickerOpen(false);
            return;
          }
          e.preventDefault();
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, datePickerOpen, tagPickerOpen, boxPickerOpen, onOpen]);

  const handleToggleTag = (tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      resetForm();
    }, 240);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority(undefined);
    setTagIds([]);
    setAssignee('');
    setSelectedBox('');
    setIsPinned(false);
    setIsFullscreen(false);
    setDatePickerOpen(false);
    setTagPickerOpen(false);
    setBoxPickerOpen(false);
    setDueDate(currentSelectedDateKey);
    onClose?.();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current) return;

    // Use DOM input value as fallback if React state is not yet flushed
    const cleanTitle = (titleInputRef.current?.value || title).trim();
    if (!cleanTitle) return;

    isSubmittingRef.current = true;
    try {
      const entry = await entryRepo.create({
        raw_text: cleanTitle,
        source: 'text',
        processed: true,
      });

      const effectiveDueDate = dueDate || currentSelectedDateKey;

      if (activeTab === 'task') {
        await taskRepo.create({
          entry_id: entry.id,
          title: cleanTitle,
          description: description.trim(),
          status: 'open',
          due_date: effectiveDueDate,
          priority: priority,
          tag_ids: tagIds,
        });
        toast.show('تسک جدید با موفقیت ایجاد شد');
      } else {
        const bodyContent = description.trim();
        await noteRepo.create({
          entry_id: entry.id,
          type: 'note',
          title: cleanTitle,
          body: bodyContent ? `${cleanTitle}\n${bodyContent}` : cleanTitle,
          description: bodyContent || undefined,
          date_key: effectiveDueDate,
          tag_ids: tagIds,
          pinned: isPinned,
        });
        toast.show('یادداشت جدید با موفقیت ثبت شد');
      }

      await onItemCreated();
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        resetForm();
      }, 240);
    } catch (err) {
      console.error('Failed to create item:', err);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const applyFormat = (format: 'h1' | 'italic' | 'bold' | 'todo' | 'link' | 'image') => {
    const textarea = noteBodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = description;
    const selectedText = val.substring(start, end);

    let replacement = '';
    switch (format) {
      case 'h1':
        replacement = `\n# ${selectedText || 'عنوان'}\n`;
        break;
      case 'italic':
        replacement = `*${selectedText || 'متن کج'}*`;
        break;
      case 'bold':
        replacement = `**${selectedText || 'متن برجسته'}**`;
        break;
      case 'todo':
        replacement = `\n- [ ] ${selectedText || 'مورد جدید'}\n`;
        break;
      case 'link':
        replacement = `[${selectedText || 'عنوان پیوند'}](url)`;
        break;
      case 'image':
        replacement = `![${selectedText || 'تصویر'}](url)`;
        break;
    }

    const newVal = val.substring(0, start) + replacement + val.substring(end);
    setDescription(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 10);
  };

  if (isOpen !== undefined && !isOpen && !isClosing) {
    return null;
  }

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  const renderDateText = () => {
    if (!dueDate) return 'تاریخ';
    if (dueDate === todayKey) return 'امروز';
    return formatJalaliDisplay(parseJalaliKey(dueDate));
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-card text-card-foreground font-sans text-right flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen && activeTab === 'note'
            ? 'fixed inset-0 z-50 w-full h-full pb-5 px-6 pt-6 md:px-16 lg:px-24'
            : `relative w-full rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 min-h-[440px] max-h-[92%] border-t border-border ${
                isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
              }`
        }`}
        dir="rtl"
      >
        {/* Top Left Action Buttons: Fullscreen & Close */}
        <div className="absolute left-6 top-6 flex items-center gap-1 z-10">
          {activeTab === 'note' && (
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title={isFullscreen ? 'کوچک کردن' : 'تمام‌صفحه'}
            >
              {isFullscreen ? (
                <RiFullscreenExitLine className="w-5 h-5" />
              ) : (
                <RiFullscreenLine className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={`flex-1 flex flex-col justify-between ${isFullscreen && activeTab === 'note' ? 'max-w-4xl mx-auto w-full h-full' : ''}`}>
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3 min-h-0">
            {/* Title Input */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
                if (isEnter && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={activeTab === 'task' ? 'چی کاره‌ای؟' : 'چی تو ذهنته؟'}
              className={`w-full font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-400 placeholder:font-normal transition-all ${
                isFullscreen && activeTab === 'note' ? 'text-2xl md:text-3xl pl-24' : 'text-xl pl-16'
              }`}
              dir="rtl"
            />

            {/* Note Property Chips Row (under title in Note view) */}
            {activeTab === 'note' && (
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {/* پین‌کردن */}
                <button
                  type="button"
                  onClick={() => setIsPinned(!isPinned)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                    isPinned
                      ? 'bg-gray-100 border-gray-300 text-gray-900 font-bold'
                      : 'border-transparent text-gray-400 hover:text-gray-600 font-normal'
                  }`}
                >
                  {isPinned ? (
                    <RiPushpinFill className="w-3.5 h-3.5 text-gray-800" />
                  ) : (
                    <RiPushpinLine className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span>پین‌کردن</span>
                </button>

                {/* برچسب */}
                <button
                  type="button"
                  onClick={() => setTagPickerOpen(!tagPickerOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                    selectedTags.length > 0
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400 hover:text-gray-600 font-normal'
                  }`}
                >
                  <RiPriceTag3Line
                    className={`w-3.5 h-3.5 ${
                      selectedTags.length > 0 ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  />
                  <span>
                    {selectedTags.length > 0
                      ? selectedTags.map((t) => `#${t.name}`).join(' ')
                      : 'برچسب'}
                  </span>
                </button>

                {/* جعبه */}
                <DropdownMenu open={boxPickerOpen} onOpenChange={setBoxPickerOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                        selectedBox
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-400 hover:text-gray-600 font-normal'
                      }`}
                    >
                      <RiInboxArchiveLine
                        className={`w-3.5 h-3.5 ${
                          selectedBox ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      />
                      <span>{selectedBox || 'جعبه'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-36 p-1 text-xs" dir="rtl">
                    <DropdownMenuItem onClick={() => setSelectedBox('کار')}>کار</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('شخصی')}>شخصی</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('ایده‌ها')}>ایده‌ها</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('')} className="text-gray-400">
                      بدون جعبه
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Description / Note body */}
            {activeTab === 'note' ? (
              <div
                className={`flex-1 overflow-y-auto mt-3 border-t border-gray-100/70 pt-2 ${
                  isFullscreen ? 'min-h-[300px]' : 'min-h-[160px] max-h-[46vh]'
                }`}
              >
                <BlockNoteEditor
                  initialContent={description}
                  onChange={(md) => setDescription(md)}
                  placeholder="متن یادداشت یا خاطره خود را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                  minHeight={isFullscreen ? '350px' : '160px'}
                />
              </div>
            ) : (
              <textarea
                ref={noteBodyRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
                  if (isEnter && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="توضیحات (Enter برای ایجاد تسک، Shift+Enter برای خط بعد)"
                rows={7}
                className="w-full resize-none text-sm text-gray-700 bg-transparent outline-none placeholder:text-gray-400 placeholder:font-normal leading-relaxed mt-4 flex-1"
                dir="rtl"
              />
            )}
          </div>

          {/* Middle Toolbars */}
          <div className="w-full">
            {/* Task Tool Bar (Image 1) */}
            {activeTab === 'task' && (
              <div className="flex items-center gap-4 pb-3 flex-wrap">
                {/* امروز */}
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                    dueDate
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400 hover:text-gray-600 font-normal'
                  }`}
                >
                  <RiCalendarLine
                    className={`w-4 h-4 ${dueDate ? 'text-gray-900' : 'text-gray-400'}`}
                  />
                  <span>{renderDateText()}</span>
                </button>

                {/* اولویت */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                        priority !== undefined
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-400 hover:text-gray-600 font-normal'
                      }`}
                    >
                      {priority === 3 ? (
                        <RiFlagFill className="w-4 h-4 text-rose-600" />
                      ) : priority === 2 ? (
                        <RiFlagFill className="w-4 h-4 text-amber-500" />
                      ) : priority === 1 ? (
                        <RiFlagFill className="w-4 h-4 text-blue-500" />
                      ) : (
                        <RiFlagLine className="w-4 h-4 text-gray-400" />
                      )}
                      <span>
                        {priority === 3
                          ? 'فوری'
                          : priority === 2
                          ? 'متوسط'
                          : priority === 1
                          ? 'کم'
                          : 'اولویت'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-36 p-1 text-xs" dir="rtl">
                    <DropdownMenuItem onClick={() => setPriority(3)} className="gap-2">
                      <RiFlagFill className="w-3.5 h-3.5 text-rose-600" />
                      <span>فوری</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority(2)} className="gap-2">
                      <RiFlagFill className="w-3.5 h-3.5 text-amber-500" />
                      <span>متوسط</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority(1)} className="gap-2">
                      <RiFlagFill className="w-3.5 h-3.5 text-blue-500" />
                      <span>کم</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority(undefined)} className="text-gray-400">
                      بدون اولویت
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* برچسب */}
                <button
                  type="button"
                  onClick={() => setTagPickerOpen(!tagPickerOpen)}
                  className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                    selectedTags.length > 0
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400 hover:text-gray-600 font-normal'
                  }`}
                >
                  <RiPriceTag3Line
                    className={`w-4 h-4 ${
                      selectedTags.length > 0 ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  />
                  <span>
                    {selectedTags.length > 0
                      ? selectedTags.map((t) => `#${t.name}`).join(' ')
                      : 'برچسب'}
                  </span>
                </button>

                {/* مسئول */}
                <button
                  type="button"
                  onClick={() => setAssignee(assignee ? '' : 'شما')}
                  className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                    assignee
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400 hover:text-gray-600 font-normal'
                  }`}
                  title="تعیین مسئول"
                >
                  <RiUserLine
                    className={`w-4 h-4 ${assignee ? 'text-gray-900' : 'text-gray-400'}`}
                  />
                  <span>{assignee || 'مسئول'}</span>
                </button>

                {/* جعبه */}
                <DropdownMenu open={boxPickerOpen} onOpenChange={setBoxPickerOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                        selectedBox
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-400 hover:text-gray-600 font-normal'
                      }`}
                    >
                      <RiInboxArchiveLine
                        className={`w-4 h-4 ${selectedBox ? 'text-gray-900' : 'text-gray-400'}`}
                      />
                      <span>{selectedBox || 'جعبه'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-36 p-1 text-xs" dir="rtl">
                    <DropdownMenuItem onClick={() => setSelectedBox('کار')}>کار</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('شخصی')}>شخصی</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('پروژه‌ها')}>پروژه‌ها</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedBox('')} className="text-gray-400">
                      بدون جعبه
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Note Formatting Bar (Image 2) */}
            {activeTab === 'note' && (
              <div className="flex items-center gap-5 pb-3 text-gray-400">
                <button
                  type="button"
                  onClick={() => applyFormat('h1')}
                  className="hover:text-gray-800 text-sm font-bold font-sans transition-colors cursor-pointer"
                  title="سرتیتر H1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('italic')}
                  className="hover:text-gray-800 italic font-serif text-sm transition-colors cursor-pointer"
                  title="کج (Italic)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('bold')}
                  className="hover:text-gray-800 font-bold text-sm transition-colors cursor-pointer"
                  title="برجسته (Bold)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('todo')}
                  className="hover:text-gray-800 transition-colors cursor-pointer"
                  title="لیست کارها"
                >
                  <RiCheckboxLine className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('link')}
                  className="hover:text-gray-800 transition-colors cursor-pointer"
                  title="افزودن پیوند"
                >
                  <RiLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('image')}
                  className="hover:text-gray-800 transition-colors cursor-pointer"
                  title="افزودن تصویر"
                >
                  <RiImageLine className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Common Bottom Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {/* Right side in RTL: اضافه کردن */}
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex items-center gap-1 rounded-full bg-[#27272a] hover:bg-black disabled:opacity-40 text-white px-5 py-2.5 text-sm font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <span>اضافه کردن</span>
                <kbd className="inline-flex items-center justify-center text-[10px] font-mono text-gray-300 bg-white/15 px-1.5 py-0.5 rounded mr-0.5 select-none font-bold">
                  ↵
                </kbd>
              </button>

              {/* Left side in RTL: Mode toggle pills */}
              <div className="flex items-center gap-2">
                {/* کار */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('task');
                    setIsFullscreen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    activeTab === 'task'
                      ? 'border-gray-400 bg-white text-gray-900 font-bold shadow-xs'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  <RiCheckboxLine className="w-4 h-4" />
                  <span>کار</span>
                </button>

                {/* یادداشت */}
                <button
                  type="button"
                  onClick={() => setActiveTab('note')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    activeTab === 'note'
                      ? 'border-gray-400 bg-white text-gray-900 font-bold shadow-xs'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  <RiCalendarScheduleLine className="w-4 h-4" />
                  <span>یادداشت</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Date Picker Modal */}
        {datePickerOpen && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
            onClick={() => setDatePickerOpen(false)}
          >
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

        {/* Tag Picker Modal */}
        {tagPickerOpen && (
          <div
            className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
            onClick={() => setTagPickerOpen(false)}
          >
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
    </div>
  );
};
