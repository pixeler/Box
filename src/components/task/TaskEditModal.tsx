import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Tag, Box, TimeOfDay, Subtask, Note } from '@/types/models';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Sun01Icon } from '@hugeicons/core-free-icons';
import { MorningSunriseIcon, EveningMoonIcon } from '../stream/timeOfDayConfig';
import { taskRepo, tagRepo, boxRepo, noteRepo } from '@/repositories';
import {
  parseJalaliKey,
  formatJalaliDisplay,
  getTodayJalaliKey,
  toPersianDigits,
  addJalaliDays,
  nextWeekendFrom,
} from '@/lib/jalali';
import { useMediaQuery } from '@/lib/device';
import { JalaliDatePicker } from '@/components/calendar/LazyJalaliDatePicker';
import { TagPickerSheet } from '../pickers/TagPickerSheet';
import { PriorityPickerSheet } from '../pickers/PriorityPickerSheet';
import { BoxPickerSheet } from '../pickers/BoxPickerSheet';
import { NoteLinkPickerSheet } from '../pickers/NoteLinkPickerSheet';
import { TimeOfDayPickerSheet } from '../pickers/TimeOfDayPickerSheet';
import type { PickerAnchor } from '../pickers/PickerPopover';
import { RecurringDeleteSheet } from './RecurringDeleteSheet';
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import { playTaskDoneSound } from '@/lib/sound';
import {
  RiCloseLine,
  RiMoreLine,
  RiCheckLine,
  RiCalendarLine,
  RiSunLine,
  RiCloudyLine,
  RiUmbrellaLine,
  RiForbid2Line,
  RiFlagLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiInboxLine,
  RiDeleteBinLine,
  RiAlignJustify,
  RiPushpinLine,
  RiPushpinFill,
  RiAlarmLine,
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiStickyNoteLine,
} from '@remixicon/react';
import { ReminderPickerSheet } from '../pickers/ReminderPickerSheet';
import { useNotebook } from '@/components/notebook/NotebookContext';
import { useOverlayLayer } from '@/lib/overlayLayer';

export interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const cleanSubtasks = (list: Subtask[]): Subtask[] =>
  list
    .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
    .filter((subtask) => subtask.title.length > 0);

const subtasksEqual = (a: Subtask[], b: Subtask[]) =>
  JSON.stringify(cleanSubtasks(a)) === JSON.stringify(cleanSubtasks(b));

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { setEditingNote, setNoteViewModeOverride, setNoteEditModalOpen } = useNotebook();
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

  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(task?.linked_note_ids || []);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [boxPickerOpen, setBoxPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [timeOfDayPickerOpen, setTimeOfDayPickerOpen] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [recurringDeleteOpen, setRecurringDeleteOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(task?.time_of_day || 'anytime');

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevTaskIdRef = useRef(task?.id);
  const prevIsOpenRef = useRef(isOpen);

  // The desktop window needs room for two panes; below that the bottom sheet stays.
  const isWindow = useMediaQuery('(min-width: 768px)');
  // Opened from a note (or opening one), so it takes the layer above it.
  const { zIndex: overlayZ } = useOverlayLayer(isOpen);
  const todayKey = getTodayJalaliKey();
  const tomorrowKey = addJalaliDays(todayKey, 1);
  const nextWeekKey = addJalaliDays(todayKey, 7);
  const weekendKey = nextWeekendFrom(todayKey);

  const lastSavedRef = useRef<{
    title: string;
    description: string;
    dueDate: string | null;
    priority: 1 | 2 | 3 | undefined;
    tagIds: string[];
    boxId: string | null;
    reminder: string | null;
    subtasks: Subtask[];
    linkedNoteIds: string[];
  }>({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.due_date || null,
    priority: task?.priority,
    tagIds: task?.tag_ids || [],
    boxId: task?.box_id || null,
    reminder: task?.reminder || null,
    subtasks: cleanSubtasks(task?.subtasks || []),
    linkedNoteIds: task?.linked_note_ids || [],
  });

  useEffect(() => {
    tagRepo.listAll().then((all) => {
      const m: Record<string, Tag> = {};
      all.forEach((t) => (m[t.id] = t));
      setTagsMap(m);
    });
    boxRepo.list().then(setBoxes);
  }, [isOpen, tagPickerOpen]);

  // Notes are needed both for the linked-note chips and after creating a new one.
  useEffect(() => {
    if (!isOpen) return;
    noteRepo.list().then(setAllNotes).catch(console.error);
  }, [isOpen, notePickerOpen]);

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
      setTimeOfDay(task.time_of_day || 'anytime');
      setSubtasks(task.subtasks || []);
      setSubtasksExpanded(true);
      setLinkedNoteIds(task.linked_note_ids || []);
      setNotesExpanded(true);
      setPickerAnchor(null);
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
        subtasks: cleanSubtasks(task.subtasks || []),
        linkedNoteIds: task.linked_note_ids || [],
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
        reminder !== lastSavedRef.current.reminder ||
        !subtasksEqual(subtasks, lastSavedRef.current.subtasks) ||
        JSON.stringify(linkedNoteIds) !== JSON.stringify(lastSavedRef.current.linkedNoteIds);

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
            subtasks: cleanSubtasks(subtasks),
            linked_note_ids: linkedNoteIds,
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
    reminder,
    subtasks,
    linkedNoteIds,
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
      priority?: 1 | 2 | 3 | null;
      tagIds?: string[];
      boxId?: string | null;
      reminder?: string | null;
      timeOfDay?: TimeOfDay;
      subtasks?: Subtask[];
      linkedNoteIds?: string[];
    }) => {
      if (!task) return;

      // A pending debounce may carry older subtask/title text; this save already
      // uses the freshest state, so it must not overwrite it afterwards.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const newTitle = updates.title !== undefined ? updates.title.trim() : title.trim();
      const newDesc = updates.description !== undefined ? updates.description : description;
      const newDueDate = updates.dueDate !== undefined ? updates.dueDate : dueDate;
      const newDueTime = updates.dueTime !== undefined ? updates.dueTime : dueTime;
      const newDuration = updates.durationMinutes !== undefined ? updates.durationMinutes : durationMinutes;
      const newRecurrence = updates.recurrenceRule !== undefined ? updates.recurrenceRule : recurrenceRule;
      const newRecStart = updates.recurrenceStartDate !== undefined ? updates.recurrenceStartDate : recurrenceStartDate;
      const newRecEnd = updates.recurrenceEndDate !== undefined ? updates.recurrenceEndDate : recurrenceEndDate;
      const newPriority =
        updates.priority !== undefined ? updates.priority ?? undefined : priority;
      const newTagIds = updates.tagIds !== undefined ? updates.tagIds : tagIds;
      const newBoxId = updates.boxId !== undefined ? updates.boxId : selectedBox;
      const newReminder = updates.reminder !== undefined ? updates.reminder : reminder;
      const newTimeOfDay = updates.timeOfDay !== undefined ? updates.timeOfDay : timeOfDay;
      const newSubtasks = updates.subtasks !== undefined ? updates.subtasks : subtasks;
      const newLinkedNoteIds =
        updates.linkedNoteIds !== undefined ? updates.linkedNoteIds : linkedNoteIds;

      if (!newTitle) return;

      const changed =
        newTitle !== lastSavedRef.current.title ||
        newDesc !== lastSavedRef.current.description ||
        newDueDate !== lastSavedRef.current.dueDate ||
        newPriority !== lastSavedRef.current.priority ||
        JSON.stringify(newTagIds) !== JSON.stringify(lastSavedRef.current.tagIds) ||
        newBoxId !== (lastSavedRef.current.boxId || '') ||
        newReminder !== lastSavedRef.current.reminder ||
        newTimeOfDay !== task.time_of_day ||
        !subtasksEqual(newSubtasks, lastSavedRef.current.subtasks) ||
        JSON.stringify(newLinkedNoteIds) !== JSON.stringify(lastSavedRef.current.linkedNoteIds);

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
          time_of_day: newTimeOfDay,
          subtasks: cleanSubtasks(newSubtasks),
          linked_note_ids: newLinkedNoteIds,
        });

        lastSavedRef.current = {
          title: newTitle,
          description: newDesc,
          dueDate: newDueDate,
          priority: newPriority,
          tagIds: newTagIds,
          boxId: newBoxId || null,
          reminder: newReminder,
          subtasks: cleanSubtasks(newSubtasks),
          linkedNoteIds: newLinkedNoteIds,
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
      reminder,
      timeOfDay,
      subtasks,
      linkedNoteIds,
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

  const focusSubtaskInput = (subtaskId: string) => {
    setTimeout(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>(`input[data-subtask-id="${subtaskId}"]`)
        ?.focus();
    }, 30);
  };

  const handleSubtaskAdd = (afterId?: string) => {
    const newSubtask: Subtask = { id: crypto.randomUUID(), title: '', done: false };
    const next = [...subtasks];
    const insertAt = afterId ? next.findIndex((item) => item.id === afterId) + 1 : next.length;
    next.splice(insertAt || next.length, 0, newSubtask);
    setSubtasks(next);
    setSubtasksExpanded(true);
    focusSubtaskInput(newSubtask.id);
  };

  const handleSubtaskTitleChange = (subtaskId: string, value: string) => {
    const next = subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, title: value } : subtask
    );
    setSubtasks(next);
    scheduleSave(400, { subtasks: next });
  };

  const handleSubtaskToggle = (subtaskId: string) => {
    const next = subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
    );
    setSubtasks(next);
    performSave({ subtasks: next });
  };

  const handleSubtaskDelete = (subtaskId: string) => {
    const next = subtasks.filter((subtask) => subtask.id !== subtaskId);
    setSubtasks(next);
    performSave({ subtasks: next });
  };

  const handleLinkedNotesChange = (nextNoteIds: string[]) => {
    setLinkedNoteIds(nextNoteIds);
    performSave({ linkedNoteIds: nextNoteIds });
  };

  /** The task stays open underneath; the note window stacks above it. */
  const openLinkedNote = (note: Note) => {
    setEditingNote(note);
    setNoteViewModeOverride('side-peek');
    setNoteEditModalOpen(true);
  };

  const anchorOf = (event: React.MouseEvent<HTMLElement>) =>
    event.currentTarget.getBoundingClientRect();

  const openDatePicker = (event: React.MouseEvent<HTMLElement>) => {
    setPickerAnchor(anchorOf(event));
    setDatePickerOpen(true);
  };

  const openBoxPicker = (event: React.MouseEvent<HTMLElement>) => {
    setPickerAnchor(anchorOf(event));
    setBoxPickerOpen(true);
  };

  const openTagPicker = (event: React.MouseEvent<HTMLElement>) => {
    setPickerAnchor(anchorOf(event));
    setTagPickerOpen(true);
  };

  const openReminderPicker = (event: React.MouseEvent<HTMLElement>) => {
    setPickerAnchor(anchorOf(event));
    setReminderPickerOpen(true);
  };

  const openNotePicker = (event: React.MouseEvent<HTMLElement>) => {
    setPickerAnchor(anchorOf(event));
    setNotePickerOpen(true);
  };

  const pickerVariant = isWindow ? 'popover' : 'sheet';

  const isRecurring = Boolean(task?.recurrence_rule && task.recurrence_rule !== 'none');

  const handleDelete = () => {
    if (!task) return;
    if (isRecurring) {
      setRecurringDeleteOpen(true);
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleConfirmNormalDelete = async () => {
    if (!task) return;
    await taskRepo.softDelete(task.id);
    onSaved();
    handleClose();
  };

  const handleDeleteSingleOccurrence = async () => {
    if (!task) return;
    await taskRepo.skipDate(task.id, dueDate || todayKey);
    onSaved();
    handleClose();
  };

  const handleDeleteAllOccurrences = async () => {
    if (!task) return;
    await taskRepo.softDelete(task.id);
    onSaved();
    handleClose();
  };

  if (!isOpen && !isClosing) return null;
  if (!task) return null;

  const selectedTags = tagIds.map((id) => tagsMap[id]).filter(Boolean);
  const selectedBoxObj = boxes.find((b) => b.id === selectedBox);
  const linkedNotes = linkedNoteIds
    .map((id) => allNotes.find((note) => note.id === id))
    .filter((note): note is Note => Boolean(note));
  const completedSubtasks = subtasks.filter((subtask) => subtask.done).length;

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

  const priorityColor =
    priority === 3
      ? 'text-rose-600 dark:text-rose-400'
      : priority === 2
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-blue-500 dark:text-blue-400';

  const renderFlagIcon = (size: string) =>
    priority ? (
      <RiFlagFill className={`${size} shrink-0 ${priorityColor}`} />
    ) : (
      <RiFlagLine className={`${size} shrink-0 text-muted-foreground`} />
    );

  const renderMoreMenu = () => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
        className="flex size-9 items-center justify-center rounded-full bg-secondary/80 text-foreground shadow-2xs transition hover:bg-secondary active:scale-95 cursor-pointer dark:bg-white/10 dark:hover:bg-white/15"
        title="گزینه‌ها"
      >
        <RiMoreLine className="size-5" />
      </button>

      {moreMenuOpen && (
        <div className="absolute left-0 top-11 z-30 w-40 rounded-xl border border-border bg-popover py-1 text-xs text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setMoreMenuOpen(false);
              handleDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-rose-600 transition-colors hover:bg-rose-500/10 cursor-pointer dark:text-rose-400"
          >
            <RiDeleteBinLine className="size-4" />
            <span>حذف تسک</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderTopActions = () => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTogglePin}
        className={`flex size-9 items-center justify-center rounded-full shadow-2xs transition active:scale-95 cursor-pointer ${
          isPinned
            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
            : 'bg-secondary/80 text-foreground hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/15'
        }`}
        title={isPinned ? 'حذف از پین‌شده‌ها' : 'پین کردن تسک'}
      >
        {isPinned ? (
          <RiPushpinFill className="size-4 text-foreground" />
        ) : (
          <RiPushpinLine className="size-4 text-muted-foreground" />
        )}
      </button>
      {renderMoreMenu()}
    </div>
  );

  const renderCheckbox = (sizeClass: string) => (
    <button
      type="button"
      onClick={handleToggleDone}
      className={`${sizeClass} shrink-0 rounded-full border-2 transition flex items-center justify-center cursor-pointer ${
        isDone
          ? 'border-emerald-500 bg-emerald-500 text-white'
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
      {isDone && <RiCheckLine className="size-3.5 stroke-[3]" />}
    </button>
  );

  const renderSubtaskSection = (variant: 'sheet' | 'window') => {
    const isSheet = variant === 'sheet';
    return (
      <div className={isSheet ? 'p-3.5' : 'mt-7 border-t border-border/60 pt-5 pe-1'}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubtasksExpanded((expanded) => !expanded)}
            className="flex items-center gap-1.5 rounded-md text-right cursor-pointer"
            aria-expanded={subtasksExpanded}
          >
            <RiArrowDownSLine
              className={`size-4 text-muted-foreground transition-transform duration-150 ${
                subtasksExpanded ? '' : '-rotate-90'
              }`}
            />
            <span className={isSheet ? 'text-sm font-semibold text-foreground' : 'text-[15px] font-bold text-foreground'}>
              زیرکارها
            </span>
          </button>
          {subtasks.length > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {toPersianDigits(completedSubtasks)}/{toPersianDigits(subtasks.length)}
            </span>
          )}
        </div>

        {subtasksExpanded && (
          <div className={isSheet ? 'mt-1.5' : 'mt-2'}>
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="group/subtask flex items-center gap-2.5 border-b border-border/40 py-1.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => handleSubtaskToggle(subtask.id)}
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition cursor-pointer ${
                    subtask.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-muted-foreground/45 hover:border-foreground'
                  }`}
                  title={subtask.done ? 'انجام‌نشده' : 'انجام شد'}
                >
                  {subtask.done && <RiCheckLine className="size-2.5 stroke-[3]" />}
                </button>

                <input
                  type="text"
                  data-subtask-id={subtask.id}
                  value={subtask.title}
                  onChange={(event) => handleSubtaskTitleChange(subtask.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSubtaskAdd(subtask.id);
                    } else if (event.key === 'Backspace' && !event.currentTarget.value) {
                      event.preventDefault();
                      handleSubtaskDelete(subtask.id);
                    }
                  }}
                  placeholder="زیرکار جدید…"
                  className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/45 ${
                    isSheet ? 'text-[13px]' : 'text-sm'
                  } ${subtask.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                  dir="rtl"
                />

                <button
                  type="button"
                  onClick={() => handleSubtaskDelete(subtask.id)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover/subtask:opacity-100 focus-visible:opacity-100 cursor-pointer max-md:opacity-100"
                  title="حذف زیرکار"
                >
                  <RiCloseLine className="size-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => handleSubtaskAdd()}
              className={`flex items-center gap-1.5 rounded-md py-1.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer ${
                isSheet ? 'text-[12.5px] font-medium' : 'text-[13px] font-medium'
              }`}
            >
              <RiAddLine className="size-4" />
              <span>افزودن زیرکار</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderNotesSection = (variant: 'sheet' | 'window') => {
    const isSheet = variant === 'sheet';
    return (
      <div className={isSheet ? 'p-3.5' : 'mt-5 border-t border-border/60 pt-5 pe-1'}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotesExpanded((expanded) => !expanded)}
            className="flex items-center gap-1.5 rounded-md text-right cursor-pointer"
            aria-expanded={notesExpanded}
          >
            <RiArrowDownSLine
              className={`size-4 text-muted-foreground transition-transform duration-150 ${
                notesExpanded ? '' : '-rotate-90'
              }`}
            />
            <span className={isSheet ? 'text-sm font-semibold text-foreground' : 'text-[15px] font-bold text-foreground'}>
              یادداشت‌ها
            </span>
          </button>
          {linkedNotes.length > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {toPersianDigits(linkedNotes.length)}
            </span>
          )}
        </div>

        {notesExpanded && (
          <div className={isSheet ? 'mt-1.5' : 'mt-2'}>
            {linkedNotes.map((note) => (
              <div
                key={note.id}
                className="group/note flex items-center gap-2.5 border-b border-border/40 py-1.5 last:border-b-0"
              >
                <RiStickyNoteLine className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => openLinkedNote(note)}
                  className={`min-w-0 flex-1 truncate text-right text-foreground transition-colors hover:text-primary cursor-pointer ${
                    isSheet ? 'text-[13px]' : 'text-sm'
                  }`}
                  title="باز کردن یادداشت"
                >
                  {note.title?.trim() || 'یادداشت بدون عنوان'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleLinkedNotesChange(linkedNoteIds.filter((id) => id !== note.id))
                  }
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover/note:opacity-100 focus-visible:opacity-100 cursor-pointer max-md:opacity-100"
                  title="قطع پیوند یادداشت"
                >
                  <RiCloseLine className="size-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={openNotePicker}
              className={`flex items-center gap-1.5 rounded-md py-1.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer ${
                isSheet ? 'text-[12.5px] font-medium' : 'text-[13px] font-medium'
              }`}
            >
              <RiAddLine className="size-4" />
              <span>افزودن یا پیوند به یادداشت</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Always opens over the whole browser window (not only the app frame or the
  // note panel), so on desktop the detail window floats above the whole app.
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  const pickers = (
    <>
      {/* Date Picker: bottom sheet on mobile, anchored popover on desktop */}
      {datePickerOpen && (
        <JalaliDatePicker
          variant={pickerVariant}
          anchorRect={pickerAnchor}
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

      {/* Tag Picker Sheet */}
      <TagPickerSheet
        variant={pickerVariant}
        anchorRect={pickerAnchor}
        isOpen={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        selectedTagIds={tagIds}
        onToggleTag={handleToggleTag}
      />

      {/* Priority Picker Sheet */}
      <PriorityPickerSheet
        isOpen={priorityPickerOpen}
        onClose={() => setPriorityPickerOpen(false)}
        value={priority}
        onChange={(p) => {
          setPriority(p);
          performSave({ priority: p ?? null });
        }}
      />

      {/* Box Picker Sheet */}
      <BoxPickerSheet
        variant={pickerVariant}
        anchorRect={pickerAnchor}
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
        variant={pickerVariant}
        anchorRect={pickerAnchor}
        isOpen={reminderPickerOpen}
        onClose={() => setReminderPickerOpen(false)}
        value={reminder}
        onChange={(r) => {
          setReminder(r);
          performSave({ reminder: r });
        }}
      />

      {/* Time of Day Picker Sheet */}
      <TimeOfDayPickerSheet
        isOpen={timeOfDayPickerOpen}
        onClose={() => setTimeOfDayPickerOpen(false)}
        value={timeOfDay}
        onChange={(tod) => {
          setTimeOfDay(tod);
          performSave({ timeOfDay: tod });
        }}
      />

      {/* Linked Notes Picker Sheet */}
      <NoteLinkPickerSheet
        variant={pickerVariant}
        anchorRect={pickerAnchor}
        isOpen={notePickerOpen}
        onClose={() => setNotePickerOpen(false)}
        selectedNoteIds={linkedNoteIds}
        onChange={handleLinkedNotesChange}
        defaultBoxId={selectedBox || null}
      />

      {/* Recurring Delete Sheet */}
      <RecurringDeleteSheet
        isOpen={recurringDeleteOpen}
        taskTitle={title || task.title}
        onDeleteSingle={handleDeleteSingleOccurrence}
        onDeleteAll={handleDeleteAllOccurrences}
        onClose={() => setRecurringDeleteOpen(false)}
      />

      {/* Normal Delete Confirm Sheet */}
      <DeleteConfirmSheet
        isOpen={deleteConfirmOpen}
        title="حذف تسک"
        itemTitle={title || task.title}
        description="آیا از حذف این تسک اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        confirmLabel="حذف تسک"
        onConfirm={handleConfirmNormalDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </>
  );

  const sheetLayout = (
    <>
      <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

      <div className="flex w-full items-center justify-between pb-2">
        <button
          type="button"
          onClick={handleClose}
          className="flex size-9 items-center justify-center rounded-full bg-secondary/80 text-foreground shadow-2xs transition hover:bg-secondary active:scale-95 cursor-pointer dark:bg-white/10 dark:hover:bg-white/15"
          title="بستن"
        >
          <RiCloseLine className="size-5" />
        </button>
        {renderTopActions()}
      </div>

      {/* Todoist Structured Properties Card */}
      <div className="my-2 w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs divide-y divide-border/60 dark:divide-white/5 dark:border-white/10">
        {/* Row 1: Checkbox + Title */}
        <div className="flex items-start gap-3 p-3.5">
          <div className="mt-0.5">{renderCheckbox('size-5')}</div>

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
            className={`focus-quiet w-full resize-none bg-transparent text-base font-bold leading-snug text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/45 ${
              isDone ? 'text-muted-foreground line-through' : ''
            }`}
            dir="rtl"
          />
        </div>

        {/* Row 2: Description */}
        <div className="flex items-start gap-3 p-3.5">
          <RiAlignJustify className="mt-1 size-4 shrink-0 text-muted-foreground" />
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
            className="focus-quiet max-h-[160px] w-full resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-foreground/85 outline-none placeholder:font-normal placeholder:text-muted-foreground/45"
            dir="rtl"
          />
        </div>

        {/* Row 3: Subtasks */}
        {renderSubtaskSection('sheet')}

        {/* Row 4: Linked Notes */}
        {renderNotesSection('sheet')}

        {/* Row 5: Box / Project */}
        <button
          type="button"
          onClick={openBoxPicker}
          className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-muted/40 cursor-pointer dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <RiInboxLine className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {selectedBoxObj?.title || 'اینباکس'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">تغییر جعبه</span>
        </button>

        {/* Row 6: Due Date */}
        <button
          type="button"
          onClick={openDatePicker}
          className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-muted/40 cursor-pointer dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <RiCalendarLine
              className={`size-4 shrink-0 ${dueDate ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className={`text-sm ${dueDate ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
              {renderDateText()}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">تنظیم تاریخ</span>
        </button>

        {/* Row 6: Priority */}
        <button
          type="button"
          onClick={() => setPriorityPickerOpen(true)}
          className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-muted/40 cursor-pointer dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            {renderFlagIcon('size-4')}
            <span
              className={`text-sm ${
                priority ? `font-bold ${priorityColor}` : 'text-muted-foreground'
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

        {/* Row 7: Time of Day */}
        <div className="flex flex-col gap-2 bg-muted/20 p-3.5 dark:bg-white/2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">بخش روز</span>
            <span>دسته‌بندی زمانی</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/50 bg-secondary/60 p-1 dark:bg-white/5">
            {[
              { id: 'anytime' as const, label: 'هر زمان', icon: Clock01Icon, activeClass: 'bg-card text-foreground shadow-xs font-semibold' },
              { id: 'morning' as const, label: 'صبح', icon: MorningSunriseIcon, activeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold shadow-xs' },
              { id: 'day' as const, label: 'ظهر', icon: Sun01Icon, activeClass: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold shadow-xs' },
              { id: 'evening' as const, label: 'عصر و شب', icon: EveningMoonIcon, activeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold shadow-xs' },
            ].map((item) => {
              const isSelected = (timeOfDay || 'anytime') === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTimeOfDay(item.id);
                    performSave({ timeOfDay: item.id });
                  }}
                  className={`flex flex-col items-center justify-center rounded-lg px-1 py-2 text-xs transition cursor-pointer ${
                    isSelected
                      ? item.activeClass
                      : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                  }`}
                >
                  <HugeiconsIcon icon={item.icon} size={18} className="mb-1" />
                  <span className="truncate text-[11px] leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 8: Labels / Tags */}
        <button
          type="button"
          onClick={openTagPicker}
          className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-muted/40 cursor-pointer dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <RiPriceTag3Line className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTags.length > 0 ? (
                selectedTags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-border/60 bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
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

        {/* Row 9: Reminder */}
        <button
          type="button"
          onClick={openReminderPicker}
          className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-muted/40 cursor-pointer dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <RiAlarmLine
              className={`size-4 shrink-0 ${reminder ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className={`text-sm ${reminder ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
              {reminder || 'یادآور'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{reminder ? 'تغییر' : 'تنظیم'}</span>
        </button>
      </div>

      {/* Quick Action Chips (below the card - Todoist style) */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-2">
        {!dueDate && (
          <button
            type="button"
            onClick={openDatePicker}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer dark:bg-white/5 dark:hover:bg-white/10"
          >
            <RiCalendarLine className="size-3.5" />
            <span>+ تاریخ</span>
          </button>
        )}
        {!priority && (
          <button
            type="button"
            onClick={() => setPriorityPickerOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer dark:bg-white/5 dark:hover:bg-white/10"
          >
            <RiFlagLine className="size-3.5" />
            <span>+ اولویت</span>
          </button>
        )}
        {selectedTags.length === 0 && (
          <button
            type="button"
            onClick={openTagPicker}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer dark:bg-white/5 dark:hover:bg-white/10"
          >
            <RiPriceTag3Line className="size-3.5" />
            <span>+ برچسب</span>
          </button>
        )}
        {!reminder && (
          <button
            type="button"
            onClick={openReminderPicker}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer dark:bg-white/5 dark:hover:bg-white/10"
          >
            <RiAlarmLine className="size-3.5" />
            <span>+ یادآور</span>
          </button>
        )}
      </div>
    </>
  );

  const windowLayout = (
    <div className="flex min-h-0 flex-1">
      {/* Main pane (right in RTL, like Todoist mirrored for Persian) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer"
            title="بستن"
          >
            <RiCloseLine className="size-5" />
          </button>
          {renderTopActions()}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="flex items-start gap-3.5">
            <div className="mt-1.5">{renderCheckbox('size-5')}</div>
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
              className={`focus-quiet w-full resize-none bg-transparent text-[22px] font-bold leading-relaxed text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/40 ${
                isDone ? 'text-muted-foreground line-through' : ''
              }`}
              dir="rtl"
            />
          </div>

          <div className="mt-2 flex items-start gap-2 ps-8">
            <RiAlignJustify className="mt-1 size-4 shrink-0 text-muted-foreground/70" />
            <textarea
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                setDescription(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
                scheduleSave(400, { description: val });
              }}
              placeholder="توضیحات"
              rows={2}
              className="focus-quiet max-h-[260px] min-h-[52px] w-full resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-foreground/85 outline-none placeholder:font-normal placeholder:text-muted-foreground/45"
              dir="rtl"
            />
          </div>

          <div className="ps-8">
            {renderSubtaskSection('window')}
            {renderNotesSection('window')}
          </div>
        </div>
      </div>

      {/* Properties pane (left in RTL) */}
      <aside className="flex w-[286px] shrink-0 flex-col overflow-y-auto border-s border-border/60 bg-muted/20">
        <div className="px-4 pb-1.5 pt-4 text-[11px] font-semibold text-subtle">جزئیات تسک</div>

        <button
          type="button"
          onClick={openBoxPicker}
          className="group w-full border-b border-border/50 px-4 py-3 text-right transition-colors hover:bg-foreground/[0.03] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">جعبه</span>
            <RiArrowLeftSLine className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex min-h-[22px] items-center gap-2 text-[13px] font-medium text-foreground">
            <RiInboxLine className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedBoxObj?.title || 'اینباکس'}</span>
          </div>
        </button>

        {/* Date: icon quick picks with captions, like the card context menu. */}
        <div className="border-b border-border/50 px-3 py-2.5">
          <span className="px-1 text-[11px] font-medium text-muted-foreground">تاریخ</span>
          <div className="mt-1.5 grid grid-cols-6 gap-0.5 rounded-lg border border-border/50 bg-secondary/60 p-1 dark:bg-white/5">
            {[
              { key: todayKey, label: 'امروز', Icon: RiSunLine },
              { key: tomorrowKey, label: 'فردا', Icon: RiCloudyLine },
              { key: nextWeekKey, label: 'هفته', Icon: RiCalendarLine },
              { key: weekendKey, label: 'آخر هفته', Icon: RiUmbrellaLine },
              { key: null as string | null, label: 'بدون', Icon: RiForbid2Line },
            ].map(({ key, label, Icon }) => {
              const isSelected = key ? dueDate === key : !dueDate;
              return (
                <button
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => {
                    setDueDate(key);
                    performSave({ dueDate: key });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[9.5px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-card text-foreground shadow-xs dark:bg-white/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="truncate leading-tight">{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              title="تقویم"
              onClick={openDatePicker}
              className="flex flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[9.5px] font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <RiMoreLine className="size-4" />
              <span className="truncate leading-tight">تقویم</span>
            </button>
          </div>
        </div>

        {/* Priority: flag icons with captions, same language as the task card. */}
        <div className="border-b border-border/50 px-3 py-2.5">
          <span className="px-1 text-[11px] font-medium text-muted-foreground">اولویت</span>
          <div className="mt-1.5 grid grid-cols-4 gap-0.5 rounded-lg border border-border/50 bg-secondary/60 p-1 dark:bg-white/5">
            {[
              { level: undefined, label: 'بدون', color: 'text-muted-foreground' },
              { level: 1 as const, label: 'کم', color: 'text-blue-500' },
              { level: 2 as const, label: 'متوسط', color: 'text-warning' },
              { level: 3 as const, label: 'فوری', color: 'text-destructive' },
            ].map((option) => {
              const isSelected = priority === option.level;
              return (
                <button
                  key={option.label}
                  type="button"
                  title={option.label}
                  onClick={() => {
                    setPriority(option.level);
                    performSave({ priority: option.level ?? null });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[10.5px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-card text-foreground shadow-xs dark:bg-white/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.level ? (
                    <RiFlagFill className={`size-4 ${option.color}`} />
                  ) : (
                    <RiFlagLine className={`size-4 ${option.color}`} />
                  )}
                  <span className="truncate leading-tight">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time of day: four options fit in a segmented control, so no menu. */}
        <div className="border-b border-border/50 px-4 py-3">
          <span className="text-[11px] font-medium text-muted-foreground">بخش روز</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-lg border border-border/50 bg-secondary/60 p-1 dark:bg-white/5">
            {[
              { id: 'anytime' as const, label: 'هر زمان', icon: Clock01Icon },
              { id: 'morning' as const, label: 'صبح', icon: MorningSunriseIcon },
              { id: 'day' as const, label: 'ظهر', icon: Sun01Icon },
              { id: 'evening' as const, label: 'عصر و شب', icon: EveningMoonIcon },
            ].map((option) => {
              const isSelected = (timeOfDay || 'anytime') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setTimeOfDay(option.id);
                    performSave({ timeOfDay: option.id });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[10.5px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-card text-foreground shadow-xs dark:bg-white/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <HugeiconsIcon icon={option.icon} size={14} />
                  <span className="truncate leading-tight">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={openTagPicker}
          className="group w-full border-b border-border/50 px-4 py-3 text-right transition-colors hover:bg-foreground/[0.03] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">برچسب‌ها</span>
            <RiArrowLeftSLine className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex min-h-[22px] flex-wrap items-center gap-1.5">
            {selectedTags.length > 0 ? (
              selectedTags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border border-border/60 bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                >
                  #{t.name}
                </span>
              ))
            ) : (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <RiPriceTag3Line className="size-4 shrink-0" />
                <span>بدون برچسب</span>
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={openReminderPicker}
          className="group w-full border-b border-border/50 px-4 py-3 text-right transition-colors hover:bg-foreground/[0.03] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">یادآور</span>
            <RiArrowLeftSLine className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex min-h-[22px] items-center gap-2 text-[13px] font-medium">
            <RiAlarmLine
              className={`size-4 shrink-0 ${reminder ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className={reminder ? 'text-primary' : 'text-muted-foreground'}>
              {reminder || 'بدون یادآور'}
            </span>
          </div>
        </button>

      </aside>
    </div>
  );

  return createPortal(
    <div
      data-overlay-root=""
      className={`fixed inset-0 select-none bg-black/60 backdrop-blur-2xs ${
        isWindow ? 'flex items-center justify-center p-6' : 'flex flex-col justify-end'
      } ${isClosing ? 'animate-panel-backdrop-out' : 'animate-panel-backdrop-in'}`}
      style={{ zIndex: overlayZ }}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        data-open={isClosing ? 'false' : 'true'}
        dir="rtl"
        className={
          isWindow
            ? `relative flex h-[min(720px,calc(100dvh-3rem))] w-[min(1020px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[22px] border border-border/80 bg-card text-card-foreground font-sans text-right shadow-2xl transition-all duration-200 dark:border-white/10 ${
                isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
              }`
            : `relative flex max-h-[92%] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-border/80 bg-card px-4 pb-6 pt-3 font-sans text-right text-card-foreground shadow-2xl dark:border-white/10 ${
                isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
              } transition-all duration-200`
        }
      >
        {isWindow ? windowLayout : sheetLayout}
        {pickers}
      </div>
    </div>,
    portalTarget
  );
};
