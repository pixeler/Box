import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Tag, Box } from '@/types/models';
import { taskRepo, tagRepo, boxRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey } from '@/lib/jalali';
import { JalaliDatePicker } from '@/components/calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { BlockNoteEditor } from '@/components/editor/BlockNoteEditor';
import { PriorityPickerSheet } from '../pickers/PriorityPickerSheet';
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import {
  RiCloseLine,
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
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
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string>(task?.box_id || '');

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
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
    boxId: string | null;
  }>({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.due_date || null,
    priority: task?.priority,
    tagIds: task?.tag_ids || [],
    boxId: task?.box_id || null,
  });

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    boxRepo.list().then(setBoxes);
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
      setSelectedBox(task.box_id || '');
      setIsClosing(false);
      lastSavedRef.current = {
        title: task.title || '',
        description: task.description || '',
        dueDate: task.due_date || null,
        priority: task.priority,
        tagIds: [...(task.tag_ids || [])],
        boxId: task.box_id || null,
      };

      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.style.height = 'auto';
          titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
          titleInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    prevTaskIdRef.current = task?.id;
    prevIsOpenRef.current = isOpen;
  }, [task?.id, isOpen]);

  // Auto-resize title textarea as user types or changes content
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title, isOpen]);

  const performSave = useCallback(
    async (overrides?: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      priority?: 1 | 2 | 3 | undefined;
      tagIds?: string[];
      boxId?: string | null;
    }) => {
      if (!task) return;

      const currentTitle = (overrides?.title !== undefined ? overrides.title : title).trim();
      if (!currentTitle) return;

      const currentDesc = (overrides?.description !== undefined ? overrides.description : description).trim();
      const currentDue = overrides?.dueDate !== undefined ? overrides.dueDate : dueDate;
      const currentPriority = overrides?.priority !== undefined ? overrides.priority : priority;
      const currentTags = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;
      const currentBoxId = overrides?.boxId !== undefined ? overrides.boxId : selectedBox;

      const last = lastSavedRef.current;
      const tagsUnchanged =
        currentTags.length === last.tagIds.length &&
        currentTags.every((id, idx) => id === last.tagIds[idx]);

      if (
        currentTitle === last.title &&
        currentDesc === last.description &&
        currentDue === last.dueDate &&
        currentPriority === last.priority &&
        currentBoxId === last.boxId &&
        tagsUnchanged
      ) {
        return;
      }

      try {
        await taskRepo.update(task.id, {
          title: currentTitle,
          description: currentDesc,
          due_date: currentDue || undefined,
          priority: currentPriority,
          tag_ids: currentTags,
          box_id: currentBoxId || null,
        });

        lastSavedRef.current = {
          title: currentTitle,
          description: currentDesc,
          dueDate: currentDue,
          priority: currentPriority,
          tagIds: [...currentTags],
          boxId: currentBoxId || null,
        };

        onSaved();
      } catch (err) {
        console.error('Failed to auto-save task:', err);
      }
    },
    [task, title, description, dueDate, priority, tagIds, selectedBox, onSaved]
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
        if (priorityPickerOpen) {
          setPriorityPickerOpen(false);
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, datePickerOpen, tagPickerOpen, boxPickerOpen, priorityPickerOpen]);

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
  const selectedBoxObj = boxes.find((b) => b.id === selectedBox);

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
        className={`relative w-full bg-card text-card-foreground border-t border-border/80 dark:border-white/10 rounded-t-[28px] shadow-2xl pb-4 px-5 pt-5 font-sans text-right flex flex-col min-h-[440px] max-h-[92%] overflow-hidden ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        dir="rtl"
      >
        {/* Top Action Buttons: Delete and Close */}
        <div className="absolute left-6 top-6 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="حذف تسک"
          >
            <RiDeleteBinLine className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleClose(); }} className="flex-1 flex flex-col justify-between">
          {/* Main Top Input Area */}
          <div className="flex-1 flex flex-col pt-3">
            {/* Title Input: text-foreground and soft placeholder in dark mode */}
            {/* Title Textarea: auto-expanding to multiple lines with word wrap */}
            <textarea
              ref={titleInputRef}
              rows={1}
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
                scheduleSave(400, { title: val });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleClose();
                }
              }}
              placeholder="چی کاره‌ای؟"
              className="w-full text-xl font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500 placeholder:font-normal transition-all resize-none overflow-y-auto max-h-[140px] leading-snug break-words [overflow-wrap:anywhere] pl-16"
              dir="rtl"
            />

            {/* BlockNote Description Editor */}
            <div className="flex-1 overflow-y-auto mt-3 min-h-[140px] max-h-[38vh] border-t border-border/70 dark:border-white/10 pt-2">
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
            <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar py-0.5">
              {/* تاریخ */}
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                  dueDate
                    ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <RiCalendarLine
                  className={`w-3.5 h-3.5 ${dueDate ? 'text-foreground' : 'text-muted-foreground'}`}
                />
                <span>{renderDateText()}</span>
              </button>

              {/* اولویت */}
              <button
                type="button"
                onClick={() => setPriorityPickerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                  priority === 3
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
                    : priority === 2
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                    : priority === 1
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                {priority === 3 ? (
                  <RiFlagFill className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                ) : priority === 2 ? (
                  <RiFlagFill className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                ) : priority === 1 ? (
                  <RiFlagFill className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                ) : (
                  <RiFlagLine className="w-3.5 h-3.5 text-muted-foreground" />
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

              {/* برچسب */}
              <button
                type="button"
                onClick={() => setTagPickerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                  selectedTags.length > 0
                    ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <RiPriceTag3Line
                  className={`w-3.5 h-3.5 ${
                    selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
                <span>
                  {selectedTags.length > 0
                    ? selectedTags.map((t) => `#${t.name}`).join(' ')
                    : 'برچسب'}
                </span>
              </button>

              {/* جعبه */}
              <button
                type="button"
                onClick={() => setBoxPickerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border active:scale-95 shrink-0 ${
                  selectedBox
                    ? 'bg-secondary border-border text-foreground font-semibold dark:bg-white/10 dark:border-white/20 shadow-2xs'
                    : 'bg-muted/40 dark:bg-white/5 border-border/60 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                <RiInboxArchiveLine
                  className={`w-3.5 h-3.5 ${selectedBox ? 'text-foreground' : 'text-muted-foreground'}`}
                />
                <span>{selectedBoxObj?.title || 'جعبه'}</span>
              </button>
            </div>

            {/* Common Bottom Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-border/70 dark:border-white/10">
              {/* Right side in RTL: Auto-save status indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>ذخیره خودکار</span>
              </div>

              {/* Left side in RTL: Mode label pill */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-muted/60 dark:bg-white/10 text-foreground border border-border/70 dark:border-white/10">
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

        {/* Priority Picker Sheet */}
        <PriorityPickerSheet
          isOpen={priorityPickerOpen}
          onClose={() => setPriorityPickerOpen(false)}
          value={priority}
          onChange={(p) => {
            setPriority(p);
            performSave({ priority: p });
          }}
        />

        {/* Box Picker Sheet */}
        <BoxPickerSheet
          isOpen={boxPickerOpen}
          onClose={() => setBoxPickerOpen(false)}
          boxes={boxes}
          selectedBoxId={selectedBox}
          onSelectBox={(bId) => {
            setSelectedBox(bId || '');
            performSave({ boxId: bId || null });
          }}
        />
      </div>
    </div>,
    portalTarget
  );
};
