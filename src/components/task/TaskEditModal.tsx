import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Tag } from '@/types/models';
import { taskRepo, tagRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey } from '@/lib/jalali';
import { JalaliDatePicker } from '@/components/calendar/JalaliDatePicker';
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
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiUserLine,
  RiInboxArchiveLine,
  RiDeleteBinLine,
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
  const [isClosing, setIsClosing] = useState(false);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState<string | null>(task?.due_date || null);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(task?.priority);
  const [tagIds, setTagIds] = useState<string[]>(task?.tag_ids || []);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [assignee, setAssignee] = useState<string>('');
  const [selectedBox, setSelectedBox] = useState<string>('');

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevTaskIdRef = useRef(task?.id);
  const prevIsOpenRef = useRef(isOpen);

  const todayKey = getTodayJalaliKey();

  const lastSavedRef = useRef<{
    title: string;
    description: string;
    dueDate: string | null;
    priority: 1 | 2 | 3 | undefined;
    tagIds: string[];
  }>({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.due_date || null,
    priority: task?.priority,
    tagIds: task?.tag_ids || [],
  });

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
  }, []);

  // Sync only on opening or task ID change (prevents re-syncing while typing)
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const taskChanged = task?.id !== prevTaskIdRef.current;

    if (task && isOpen && (justOpened || taskChanged)) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDueDate(task.due_date || null);
      setPriority(task.priority);
      setTagIds(task.tag_ids || []);
      setIsClosing(false);
      lastSavedRef.current = {
        title: task.title || '',
        description: task.description || '',
        dueDate: task.due_date || null,
        priority: task.priority,
        tagIds: [...(task.tag_ids || [])],
      };

      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    prevTaskIdRef.current = task?.id;
    prevIsOpenRef.current = isOpen;
  }, [task?.id, isOpen]);

  const performSave = useCallback(
    async (overrides?: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      priority?: 1 | 2 | 3 | undefined;
      tagIds?: string[];
    }) => {
      if (!task) return;

      const currentTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      if (!currentTitle) return;

      const currentDesc = (overrides?.description !== undefined ? overrides.description : description).trim();
      const currentDue = overrides?.dueDate !== undefined ? overrides.dueDate : dueDate;
      const currentPriority = overrides?.priority !== undefined ? overrides.priority : priority;
      const currentTags = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;

      const last = lastSavedRef.current;
      const tagsUnchanged =
        currentTags.length === last.tagIds.length &&
        currentTags.every((id, idx) => id === last.tagIds[idx]);

      if (
        currentTitle === last.title &&
        currentDesc === last.description &&
        currentDue === last.dueDate &&
        currentPriority === last.priority &&
        tagsUnchanged
      ) {
        return; // Nothing changed
      }

      try {
        await taskRepo.update(task.id, {
          title: currentTitle,
          description: currentDesc,
          due_date: currentDue || undefined,
          priority: currentPriority,
          tag_ids: currentTags,
        });

        lastSavedRef.current = {
          title: currentTitle,
          description: currentDesc,
          dueDate: currentDue,
          priority: currentPriority,
          tagIds: [...currentTags],
        };
        onSaved();
      } catch (err) {
        console.error('Failed to auto-save task:', err);
      }
    },
    [task, title, description, dueDate, priority, tagIds, onSaved]
  );

  const scheduleSave = useCallback(
    (delay = 400, overrides?: Parameters<typeof performSave>[0]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        performSave(overrides);
      }, delay);
    },
    [performSave]
  );

  const handleClose = () => {
    if (isClosing) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    performSave();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, datePickerOpen, tagPickerOpen, boxPickerOpen]);

  const handleToggleTag = (tagId: string) => {
    const nextTags = tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
    setTagIds(nextTags);
    performSave({ tagIds: nextTags });
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('آیا از حذف این تسک اطمینان دارید؟')) {
      await taskRepo.softDelete(task.id);
      onSaved();
      handleClose();
    }
  };

  if (!isOpen && !isClosing) return null;
  if (!task) return null;

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);

  const renderDateText = () => {
    if (!dueDate) return 'تاریخ';
    if (dueDate === todayKey) return 'امروز';
    return formatJalaliDisplay(parseJalaliKey(dueDate));
  };

  const portalTarget = typeof document !== 'undefined' ? (document.getElementById('app-main') || document.body) : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full bg-card text-card-foreground border-t border-border rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 font-sans text-right flex flex-col min-h-[440px] max-h-[92%] overflow-hidden ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Top Action Buttons: Delete and Close */}
        <div className="absolute left-6 top-6 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
            title="حذف تسک"
          >
            <RiDeleteBinLine className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleClose(); }} className="flex-1 flex flex-col justify-between">
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3">
            {/* Title Input */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                scheduleSave(400, { title: val });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleClose();
                }
              }}
              placeholder="چی کاره‌ای؟"
              className="w-full text-xl font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground placeholder:font-normal"
              dir="rtl"
            />

            {/* BlockNote Description Editor */}
            <div className="flex-1 overflow-y-auto mt-3 min-h-[140px] max-h-[38vh] border-t border-border/70 pt-2">
              <BlockNoteEditor
                key={`${task.id}-${isOpen ? 'open' : 'closed'}`}
                initialContent={description}
                onChange={(md) => {
                  setDescription(md);
                  scheduleSave(400, { description: md });
                }}
                placeholder="توضیحات تسک را بنویسید یا برای دیدن دستورات / را تایپ کنید..."
                minHeight="140px"
              />
            </div>
          </div>

          {/* Middle Toolbar */}
          <div className="w-full">
            <div className="flex items-center gap-4 pb-3 flex-wrap">
              {/* تاریخ */}
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
                  <DropdownMenuItem onClick={() => { setPriority(3); performSave({ priority: 3 }); }} className="gap-2">
                    <RiFlagFill className="w-3.5 h-3.5 text-rose-600" />
                    <span>فوری</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPriority(2); performSave({ priority: 2 }); }} className="gap-2">
                    <RiFlagFill className="w-3.5 h-3.5 text-amber-500" />
                    <span>متوسط</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPriority(1); performSave({ priority: 1 }); }} className="gap-2">
                    <RiFlagFill className="w-3.5 h-3.5 text-blue-500" />
                    <span>کم</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPriority(undefined); performSave({ priority: undefined }); }} className="text-gray-400">
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

            {/* Common Bottom Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {/* Right side in RTL: Auto-save status indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-normal">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>ذخیره خودکار</span>
              </div>

              {/* Left side in RTL: Mode label pill */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/80">
                  <span>ویرایش کار</span>
                </span>
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
                  performSave({ dueDate: d });
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
    </div>,
    portalTarget
  );
};
