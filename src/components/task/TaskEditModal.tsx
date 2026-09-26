import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Tag, Box } from '@/types/models';
import { taskRepo, tagRepo, boxRepo } from '@/repositories';
import { parseJalaliKey, formatJalaliDisplay, getTodayJalaliKey, toPersianDigits } from '@/lib/jalali';
import { JalaliDatePicker } from '@/components/calendar/JalaliDatePicker';
import { TagPickerPopover } from '../tags/TagPickerPopover';
import { PriorityPickerSheet } from '../pickers/PriorityPickerSheet';
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import { playTaskDoneSound } from '@/lib/sound';
import {
  RiCloseLine,
  RiMoreLine,
  RiCheckLine,
  RiCalendarLine,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiInboxLine,
  RiDeleteBinLine,
  RiAlignJustify,
  RiPushpinLine,
  RiPushpinFill,
  RiAlarmLine,
} from '@remixicon/react';
import { ReminderPickerSheet } from '../pickers/ReminderPickerSheet';

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
  const [dueTime, setDueTime] = useState<string | null>(task?.due_time || null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(task?.duration_minutes || null);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(task?.recurrence_rule || null);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string | null>(task?.recurrence_start_date || null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string | null>(task?.recurrence_end_date || null);
  const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(task?.priority);
  const [tagIds, setTagIds] = useState<string[]>(task?.tag_ids || []);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string>(task?.box_id || '');
  const [isDone, setIsDone] = useState(task?.status === 'done');
  const [isPinned, setIsPinned] = useState(task?.pinned || false);
  const [reminder, setReminder] = useState<string | null>(task?.reminder || null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);

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
    reminder: string | null;
  }>({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.due_date || null,
    priority: task?.priority,
    tagIds: task?.tag_ids || [],
    boxId: task?.box_id || null,
    reminder: task?.reminder || null,
  });

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    boxRepo.list().then(setBoxes);
  }, []);

  // Sync only on opening or task ID change
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const taskChanged = task?.id !== prevTaskIdRef.current;

    if (task && isOpen && (justOpened || taskChanged)) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDueDate(task.due_date || null);
      setDueTime(task.due_time || null);
      setDurationMinutes(task.duration_minutes || null);
      setRecurrenceRule(task.recurrence_rule || null);
      setRecurrenceStartDate(task.recurrence_start_date || null);
      setRecurrenceEndDate(task.recurrence_end_date || null);
      setPriority(task.priority);
      setTagIds(task.tag_ids || []);
      setSelectedBox(task.box_id || '');
      setIsDone(task.status === 'done');
      setIsPinned(task.pinned || false);
      setReminder(task.reminder || null);
      setIsClosing(false);
      setMoreMenuOpen(false);

      lastSavedRef.current = {
        title: task.title || '',
        description: task.description || '',
        dueDate: task.due_date || null,
        priority: task.priority,
        tagIds: task.tag_ids || [],
        boxId: task.box_id || null,
        reminder: task.reminder || null,
      };

      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.style.height = 'auto';
          titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
        }
      }, 50);
    }

    prevTaskIdRef.current = task?.id;
    prevIsOpenRef.current = isOpen;
  }, [task, isOpen]);

  // Clean close animation handler
  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (task) {
      const currentTitle = title.trim();
      const needsFinalSave =
        currentTitle !== lastSavedRef.current.title ||
        description !== lastSavedRef.current.description ||
        dueDate !== lastSavedRef.current.dueDate ||
        priority !== lastSavedRef.current.priority ||
        selectedBox !== (lastSavedRef.current.boxId || '') ||
        reminder !== lastSavedRef.current.reminder;

      if (needsFinalSave && currentTitle) {
        taskRepo
          .update(task.id, {
            title: currentTitle,
            description,
            due_date: dueDate || undefined,
            due_time: dueTime || undefined,
            duration_minutes: durationMinutes || undefined,
            recurrence_rule: recurrenceRule || undefined,
            recurrence_start_date: recurrenceStartDate || undefined,
            recurrence_end_date: recurrenceEndDate || undefined,
            priority,
            tag_ids: tagIds,
            box_id: selectedBox || null,
            reminder: reminder || undefined,
          })
          .then(() => onSaved())
          .catch((err) => console.error('Final save on close failed:', err));
      }
    }

    setIsClosing(true);
    setMoreMenuOpen(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 350);
  }, [
    task,
    title,
    description,
    dueDate,
    dueTime,
    durationMinutes,
    recurrenceRule,
    recurrenceStartDate,
    recurrenceEndDate,
    priority,
    tagIds,
    selectedBox,
    onClose,
    onSaved,
  ]);

  // Auto-save helper
  const performSave = useCallback(
    async (updates: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      dueTime?: string | null;
      durationMinutes?: number | null;
      recurrenceRule?: string | null;
      recurrenceStartDate?: string | null;
      recurrenceEndDate?: string | null;
      priority?: 1 | 2 | 3;
      tagIds?: string[];
      boxId?: string | null;
      reminder?: string | null;
    }) => {
      if (!task) return;

      const newTitle = updates.title !== undefined ? updates.title.trim() : title.trim();
      const newDesc = updates.description !== undefined ? updates.description : description;
      const newDueDate = updates.dueDate !== undefined ? updates.dueDate : dueDate;
      const newDueTime = updates.dueTime !== undefined ? updates.dueTime : dueTime;
      const newDuration = updates.durationMinutes !== undefined ? updates.durationMinutes : durationMinutes;
      const newRecurrence = updates.recurrenceRule !== undefined ? updates.recurrenceRule : recurrenceRule;
      const newRecStart = updates.recurrenceStartDate !== undefined ? updates.recurrenceStartDate : recurrenceStartDate;
      const newRecEnd = updates.recurrenceEndDate !== undefined ? updates.recurrenceEndDate : recurrenceEndDate;
      const newPriority = updates.priority !== undefined ? updates.priority : priority;
      const newTagIds = updates.tagIds !== undefined ? updates.tagIds : tagIds;
      const newBoxId = updates.boxId !== undefined ? updates.boxId : selectedBox;
      const newReminder = updates.reminder !== undefined ? updates.reminder : reminder;

      if (!newTitle) return;

      const changed =
        newTitle !== lastSavedRef.current.title ||
        newDesc !== lastSavedRef.current.description ||
        newDueDate !== lastSavedRef.current.dueDate ||
        newPriority !== lastSavedRef.current.priority ||
        JSON.stringify(newTagIds) !== JSON.stringify(lastSavedRef.current.tagIds) ||
        newBoxId !== (lastSavedRef.current.boxId || '') ||
        newReminder !== lastSavedRef.current.reminder;

      if (!changed) return;

      try {
        await taskRepo.update(task.id, {
          title: newTitle,
          description: newDesc,
          due_date: newDueDate || undefined,
          due_time: newDueTime || undefined,
          duration_minutes: newDuration || undefined,
          recurrence_rule: newRecurrence || undefined,
          recurrence_start_date: newRecStart || undefined,
          recurrence_end_date: newRecEnd || undefined,
          priority: newPriority,
          tag_ids: newTagIds,
          box_id: newBoxId || null,
          reminder: newReminder || undefined,
        });

        lastSavedRef.current = {
          title: newTitle,
          description: newDesc,
          dueDate: newDueDate,
          priority: newPriority,
          tagIds: newTagIds,
          boxId: newBoxId || null,
          reminder: newReminder,
        };

        onSaved();
      } catch (err) {
        console.error('Failed to auto-save task:', err);
      }
    },
    [
      task,
      title,
      description,
      dueDate,
      dueTime,
      durationMinutes,
      recurrenceRule,
      recurrenceStartDate,
      recurrenceEndDate,
      priority,
      tagIds,
      selectedBox,
      onSaved,
    ]
  );

  const scheduleSave = useCallback(
    (delayMs: number, updates: Parameters<typeof performSave>[0]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        performSave(updates);
      }, delayMs);
    },
    [performSave]
  );

  const handleToggleTag = (tagId: string) => {
    const nextTags = tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
    setTagIds(nextTags);
    performSave({ tagIds: nextTags });
  };

  const handleToggleDone = async () => {
    if (!task) return;
    const newStatus = isDone ? 'open' : 'done';
    setIsDone(!isDone);
    if (newStatus === 'done') {
      playTaskDoneSound();
    }
    await taskRepo.update(task.id, {
      status: newStatus,
    });
    onSaved();
  };

  const handleTogglePin = async () => {
    if (!task) return;
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    await taskRepo.update(task.id, {
      pinned: nextPinned,
    });
    onSaved();
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
    if (!dueDate) return 'تاریخ و زمان';
    let base = dueDate === todayKey ? 'امروز' : formatJalaliDisplay(parseJalaliKey(dueDate));
    if (dueTime) {
      base += ` (${toPersianDigits(dueTime)})`;
    }
    if (recurrenceRule && recurrenceRule !== 'none') {
      base += ` ↻`;
    }
    return base;
  };

  const portalTarget = typeof document !== 'undefined' ? (document.getElementById('app-main') || document.body) : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-2xs select-none ${
        isClosing ? 'animate-panel-backdrop-out' : 'animate-panel-backdrop-in'
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        data-open={isClosing ? 'false' : 'true'}
        className={`t-panel-slide relative w-full bg-card text-card-foreground border-t border-border/80 dark:border-white/10 rounded-t-[28px] shadow-2xl pb-6 px-4 sm:px-6 pt-3 font-sans text-right flex flex-col max-h-[92%] overflow-y-auto ${
          isClosing ? 'animate-panel-out' : 'animate-panel-in'
        }`}
        dir="rtl"
      >
        {/* Todoist Top Bar: Center Handle & Top Action Circles */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3 shrink-0" />

        <div className="flex items-center justify-between w-full pb-2">
          {/* Close button (Right in RTL - Todoist circular style) */}
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/15 text-foreground flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="بستن"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>

          {/* Action buttons (Left in RTL - Pin & More options) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePin}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs ${
                isPinned
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-secondary/80 hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/15 text-foreground'
              }`}
              title={isPinned ? 'حذف از پین‌شده‌ها' : 'پین کردن تسک'}
            >
              {isPinned ? (
                <RiPushpinFill className="w-4 h-4 text-amber-500" />
              ) : (
                <RiPushpinLine className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/15 text-foreground flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="گزینه‌ها"
              >
                <RiMoreLine className="w-5 h-5" />
              </button>

            {moreMenuOpen && (
              <div className="absolute left-0 top-11 z-30 w-40 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    handleDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <RiDeleteBinLine className="w-4 h-4" />
                  <span>حذف تسک</span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Todoist Structured Properties Card */}
        <div className="w-full bg-card rounded-2xl border border-border/70 dark:border-white/10 shadow-xs divide-y divide-border/60 dark:divide-white/5 my-2 overflow-hidden">
          {/* Row 1: Checkbox + Title */}
          <div className="flex items-start gap-3 p-3.5 sm:p-4">
            <button
              type="button"
              onClick={handleToggleDone}
              className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center shrink-0 mt-0.5 cursor-pointer ${
                isDone
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : priority === 3
                  ? 'border-rose-500 hover:bg-rose-500/10'
                  : priority === 2
                  ? 'border-amber-500 hover:bg-amber-500/10'
                  : priority === 1
                  ? 'border-blue-500 hover:bg-blue-500/10'
                  : 'border-muted-foreground/50 hover:border-foreground'
              }`}
              title={isDone ? 'علامت به عنوان انجام‌نشده' : 'علامت به عنوان انجام‌شده'}
            >
              {isDone && <RiCheckLine className="w-3.5 h-3.5 stroke-[3]" />}
            </button>

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
              placeholder="عنوان کار..."
              className={`w-full text-base sm:text-lg font-bold text-foreground bg-transparent outline-none resize-none leading-snug placeholder:text-muted-foreground/45 placeholder:font-normal ${
                isDone ? 'line-through text-muted-foreground' : ''
              }`}
              dir="rtl"
            />
          </div>

          {/* Row 2: Description */}
          <div className="flex items-start gap-3 p-3.5 sm:p-4">
            <RiAlignJustify className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            <textarea
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                setDescription(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
                scheduleSave(400, { description: val });
              }}
              placeholder="توضیحات کار..."
              rows={2}
              className="w-full text-sm text-foreground/85 bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/45 placeholder:font-normal max-h-[160px] overflow-y-auto"
              dir="rtl"
            />
          </div>

          {/* Row 3: Box / Project */}
          <button
            type="button"
            onClick={() => setBoxPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-3">
              <RiInboxLine className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {selectedBoxObj?.title || 'اینباکس'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">تغییر جعبه</span>
          </button>

          {/* Row 4: Due Date */}
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-3">
              <RiCalendarLine
                className={`w-4 h-4 shrink-0 ${dueDate ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span className={`text-sm ${dueDate ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                {renderDateText()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">تنظیم تاریخ</span>
          </button>

          {/* Row 5: Priority */}
          <button
            type="button"
            onClick={() => setPriorityPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-3">
              {priority ? (
                <RiFlagFill
                  className={`w-4 h-4 shrink-0 ${
                    priority === 3
                      ? 'text-rose-600 dark:text-rose-400'
                      : priority === 2
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-blue-500 dark:text-blue-400'
                  }`}
                />
              ) : (
                <RiFlagLine className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={`text-sm ${
                  priority === 3
                    ? 'font-bold text-rose-600 dark:text-rose-400'
                    : priority === 2
                    ? 'font-bold text-amber-500 dark:text-amber-400'
                    : priority === 1
                    ? 'font-bold text-blue-500 dark:text-blue-400'
                    : 'text-muted-foreground'
                }`}
              >
                {priority === 3
                  ? 'اولویت ۱ (فوری)'
                  : priority === 2
                  ? 'اولویت ۲ (متوسط)'
                  : priority === 1
                  ? 'اولویت ۳ (کم)'
                  : 'اولویت'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">انتخاب</span>
          </button>

          {/* Row 6: Labels / Tags */}
          <button
            type="button"
            onClick={() => setTagPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-3">
              <RiPriceTag3Line className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedTags.length > 0 ? (
                  selectedTags.map((t) => (
                    <span
                      key={t.id}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border/60"
                    >
                      #{t.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">برچسب‌ها</span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">افزودن برچسب</span>
          </button>

          {/* Row 7: Reminder (Todoist Reminders style) */}
          <button
            type="button"
            onClick={() => setReminderPickerOpen(true)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors cursor-pointer text-right"
          >
            <div className="flex items-center gap-3">
              <RiAlarmLine
                className={`w-4 h-4 shrink-0 ${reminder ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span className={`text-sm ${reminder ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                {reminder || 'یادآور'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{reminder ? 'تغییر' : 'تنظیم'}</span>
          </button>
        </div>

        {/* Quick Action Chips (below the card - Todoist style) */}
        <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar">
          {!dueDate && (
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10 border border-border/70 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              <RiCalendarLine className="w-3.5 h-3.5" />
              <span>+ تاریخ</span>
            </button>
          )}
          {!priority && (
            <button
              type="button"
              onClick={() => setPriorityPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10 border border-border/70 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              <RiFlagLine className="w-3.5 h-3.5" />
              <span>+ اولویت</span>
            </button>
          )}
          {selectedTags.length === 0 && (
            <button
              type="button"
              onClick={() => setTagPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10 border border-border/70 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              <RiPriceTag3Line className="w-3.5 h-3.5" />
              <span>+ برچسب</span>
            </button>
          )}
          {!reminder && (
            <button
              type="button"
              onClick={() => setReminderPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10 border border-border/70 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              <RiAlarmLine className="w-3.5 h-3.5" />
              <span>+ یادآور</span>
            </button>
          )}
        </div>

        {/* Bottom Auto-save notice */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground/70">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>تغییرات ذخیره شد</span>
          </div>
          <span>برای بستن به بیرون ضربه بزنید</span>
        </div>

        {/* Date Picker Modal (Full-width bottom sheet) */}
        {datePickerOpen && (
          <JalaliDatePicker
            value={dueDate}
            timeValue={dueTime}
            durationMinutes={durationMinutes}
            repeatValue={recurrenceRule}
            recurrenceStartDate={recurrenceStartDate || dueDate}
            recurrenceEndDate={recurrenceEndDate}
            onChange={(d) => {
              setDueDate(d);
              setDatePickerOpen(false);
              performSave({ dueDate: d });
            }}
            onDateTimeChange={(res) => {
              setDueDate(res.dateKey);
              setDueTime(res.time || null);
              setDurationMinutes(res.durationMinutes || null);
              setRecurrenceRule(res.repeat || null);
              setRecurrenceStartDate(res.recurrenceStartDate || null);
              setRecurrenceEndDate(res.recurrenceEndDate || null);
              setDatePickerOpen(false);
              performSave({
                dueDate: res.dateKey,
                dueTime: res.time || null,
                durationMinutes: res.durationMinutes || null,
                recurrenceRule: res.repeat || null,
                recurrenceStartDate: res.recurrenceStartDate || null,
                recurrenceEndDate: res.recurrenceEndDate || null,
              });
            }}
            onClose={() => setDatePickerOpen(false)}
          />
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

        {/* Reminder Picker Sheet */}
        <ReminderPickerSheet
          isOpen={reminderPickerOpen}
          onClose={() => setReminderPickerOpen(false)}
          value={reminder}
          onChange={(r) => {
            setReminder(r);
            performSave({ reminder: r });
          }}
        />
      </div>
    </div>,
    portalTarget
  );
};
