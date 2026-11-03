import React, { useEffect, useState } from 'react';
import type { Task, Tag, TimeOfDay, Note } from '@/types/models';
import { taskRepo, noteRepo } from '@/repositories';
import {
  getTodayJalaliKey,
  addJalaliDays,
  nextWeekendFrom,
  formatTaskDateDisplay,
  formatTaskTimeRange,
} from '@/lib/jalali';
import { cn, getTaskPencilPattern } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { stripMarkdownForPreview } from '@/lib/markdown';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  MenuSectionLabel,
} from '@/components/ui/context-menu';
import { TaskEditModal } from '@/components/task/LazyTaskEditModal';
import { RecurringDeleteSheet } from '@/components/task/RecurringDeleteSheet';
import { DeleteConfirmSheet } from '@/components/common/DeleteConfirmSheet';
import { JalaliDatePicker } from '@/components/calendar/LazyJalaliDatePicker';
import { useIsMobile } from '@/lib/device';
import { useNotebook } from '@/components/notebook/NotebookContext';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  Sun01Icon,
} from '@hugeicons/core-free-icons';
import { MorningSunriseIcon, EveningMoonIcon } from './timeOfDayConfig';
import {
  RiCheckLine,
  RiMoreLine,
  RiDeleteBinLine,
  RiCalendarEventLine,
  RiEditLine,
  RiFileCopyLine,
  RiFlagLine,
  RiFlagFill,
  RiSunLine,
  RiCloudyLine,
  RiCalendarLine,
  RiUmbrellaLine,
  RiForbid2Line,
  RiPushpin2Line,
  RiPushpin2Fill,
  RiRepeatLine,
  RiStickyNoteLine,
  RiTimerLine,
} from '@remixicon/react';
import { playTaskDoneSound } from '@/lib/sound';
import { requestFocusTask } from '@/components/focus/focusBus';

interface TaskItemRowProps {
  task: Task;
  tagsMap?: Record<string, Tag>;
  currentDateKey?: string;
  onStatusChanged: () => void;
  onMigrate?: (taskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isNewlyAdded?: boolean;
  isLast?: boolean;
  /** Denser card for tight calendar grids (week view): smaller title and meta. */
  compact?: boolean;
  /** Set on cards rendered inside their own note, where the note chip is redundant. */
  hideNoteLink?: boolean;
  /** Show the task own steps under the title (note lists, not the day stream). */
  showSubtasks?: boolean;
  className?: string;
}

export const TaskItemRow: React.FC<TaskItemRowProps> = React.memo(({

  task,
  tagsMap: _tagsMap,
  currentDateKey,
  onStatusChanged,
  onMigrate,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isNewlyAdded = false,
  isLast = false,
  compact = false,
  hideNoteLink = false,
  showSubtasks = false,
  className = '',
}) => {
  const isMobile = useIsMobile();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [recurringDeleteOpen, setRecurringDeleteOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const { setEditingNote, setNoteViewModeOverride, setNoteEditModalOpen } = useNotebook();
  const [linkedNote, setLinkedNote] = useState<Note | null>(null);
  const linkedNoteId = task.linked_note_ids?.[0];
  const isDone = task.status === 'done' || isCompleting;
  const isPinned = !!task.pinned;
  const isRecurring = Boolean(task.recurrence_rule && task.recurrence_rule !== 'none');
  const todayKey = getTodayJalaliKey();
  const tomorrowKey = addJalaliDays(todayKey, 1);
  const nextWeekKey = addJalaliDays(todayKey, 7);
  const weekendKey = nextWeekendFrom(todayKey);
  const recurringTime = isRecurring
    ? formatTaskTimeRange(task.due_time, task.duration_minutes)
    : null;
  const dateDisplay = isRecurring
    ? null
    : formatTaskDateDisplay(
        task.due_date,
        currentDateKey || todayKey,
        isPinned,
        task.due_time,
        task.duration_minutes
      );

  // The note this task belongs to, if any: shown as a quiet chip that opens it.
  useEffect(() => {
    if (!linkedNoteId) {
      setLinkedNote(null);
      return;
    }
    let cancelled = false;
    noteRepo
      .getById(linkedNoteId)
      .then((note) => {
        if (!cancelled) setLinkedNote(note ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [linkedNoteId]);

  const handleToggle = async () => {
    if (!isDone) {
      playTaskDoneSound();
      setIsCompleting(true);
      // Wait for the full hand-drawn pencil strike animation to finish in-place before re-sorting
      await new Promise((resolve) => setTimeout(resolve, 480));
      await taskRepo.toggleDone(task.id, currentDateKey || todayKey);
      setIsCompleting(false);
      onStatusChanged();
      toast.show('تسک دان شد');
    } else {
      await taskRepo.toggleDone(task.id, currentDateKey || todayKey);
      onStatusChanged();
    }
  };

  const handleTogglePin = async () => {
    await taskRepo.update(task.id, { pinned: !isPinned });
    onStatusChanged();
  };

  const handleSoftDelete = async () => {
    if (isRecurring) {
      setRecurringDeleteOpen(true);
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleConfirmNormalDelete = async () => {
    await taskRepo.softDelete(task.id);
    onStatusChanged();
    toast.show('تسک حذف شد');
  };

  const handleDeleteSingleOccurrence = async () => {
    await taskRepo.skipDate(task.id, currentDateKey || todayKey);
    onStatusChanged();
    toast.show('تسک برای امروز حذف شد');
  };

  const handleDeleteAllOccurrences = async () => {
    await taskRepo.softDelete(task.id);
    onStatusChanged();
    toast.show('تسک تکرارشونده حذف شد');
  };

  const handleDuplicate = async () => {
    await taskRepo.duplicate(task.id);
    onStatusChanged();
  };

  const handleQuickDate = async (newDate: string | null) => {
    await taskRepo.update(task.id, { due_date: newDate || undefined });
    onStatusChanged();
  };

  const handleSetPriority = async (newPriority: 1 | 2 | 3 | undefined) => {
    await taskRepo.update(task.id, { priority: newPriority });
    onStatusChanged();
  };

  const handleSetTimeOfDay = async (newTimeOfDay: TimeOfDay) => {
    await taskRepo.update(task.id, { time_of_day: newTimeOfDay });
    onStatusChanged();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    const next = (task.subtasks || []).map((item) =>
      item.id === subtaskId ? { ...item, done: !item.done } : item
    );
    await taskRepo.update(task.id, { subtasks: next });
    onStatusChanged();
  };

  return (
    <>
      <ContextMenu
        open={isMobile ? false : contextMenuOpen}
        onOpenChange={(open) => {
          if (isMobile) {
            setContextMenuOpen(false);
            return;
          }
          setContextMenuOpen(open);
        }}
      >
        <ContextMenuTrigger disabled={isMobile} asChild>
          <div
            draggable={!isMobile && draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onContextMenu={(e) => {
              if (isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={() => setEditModalOpen(true)}
            className={cn(
              'group relative w-full select-none rounded-xl bg-card transition-colors duration-150',
              !isLast && 'mb-1.5',
              'py-3 px-4',
              'hover:bg-secondary/50',
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              isDone && 'opacity-55',
              isNewlyAdded && 'animate-task-insert',
              className
            )}
          >
            <div className={cn('flex items-start w-full', compact ? 'gap-2' : 'gap-3')}>
              {/* 1. RIGHT SIDE in RTL (reading start): Title + Description + Date */}
              <div className="flex flex-col flex-1 min-w-0 text-right">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {/* Pin icon if pinned */}
                  {isPinned && (
                    <span title="سنجاق‌شده" className="shrink-0 flex items-center text-primary">
                      <RiPushpin2Fill className="size-3.5 text-primary" />
                    </span>
                  )}

                  <h3
                    className={cn(
                      'font-medium leading-relaxed transition-colors break-words line-clamp-2',
                      compact ? 'text-[11.5px]' : 'text-[13.5px]'
                    )}
                  >
                    <span
                      className={cn(
                        isDone
                          ? ['pencil-strike', getTaskPencilPattern(task.id), 'text-muted-foreground font-normal']
                          : 'text-foreground'
                      )}
                    >
                      {stripMarkdownForPreview(task.title)}
                    </span>
                  </h3>

                  {/* The priority flag follows the title, like a marker on the page. */}
                  {task.priority && (
                    <span
                      title={
                        task.priority === 3
                          ? 'اولویت فوری'
                          : task.priority === 2
                          ? 'اولویت متوسط'
                          : 'اولویت کم'
                      }
                      className="flex shrink-0 items-center"
                    >
                      <RiFlagFill
                        className={cn(
                          'size-3.5',
                          task.priority === 3
                            ? 'text-destructive'
                            : task.priority === 2
                            ? 'text-warning'
                            : 'text-blue-500'
                        )}
                      />
                    </span>
                  )}
                </div>

                {/* Task Description if present */}
                {task.description && task.description.trim() && (
                  <p
                    className={cn(
                      'font-normal leading-relaxed mt-1 select-none break-words',
                      compact ? 'text-[10.5px] line-clamp-1' : 'text-[11.5px] leading-5 line-clamp-2'
                    )}
                  >
                    <span
                      className={cn(
                        isDone
                          ? ['pencil-strike', getTaskPencilPattern(task.id + '_desc'), 'text-muted-foreground/60']
                          : 'text-muted-foreground'
                      )}
                    >
                      {stripMarkdownForPreview(task.description)}
                    </span>
                  </p>
                )}

                {/* Subtasks, inline: the same steps shown in the task's own window. */}
                {showSubtasks && (task.subtasks?.length ?? 0) > 0 && (
                  <ul className="mt-1.5 flex w-full flex-col gap-1">
                    {(task.subtasks ?? []).map((subtask) => (
                      <li key={subtask.id} className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleSubtask(subtask.id);
                          }}
                          aria-label={subtask.done ? 'بازگرداندن زیرکار' : 'انجام زیرکار'}
                          className={cn(
                            'mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer',
                            subtask.done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40 hover:border-foreground'
                          )}
                        >
                          {subtask.done && <RiCheckLine className="size-2.5 stroke-[3]" />}
                        </button>
                        <span
                          className={cn(
                            'min-w-0 break-words text-[11px] leading-5',
                            subtask.done
                              ? 'text-muted-foreground/60 line-through'
                              : 'text-muted-foreground'
                          )}
                        >
                          {subtask.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Meta: Recurring tasks show only time and repeat icon. Non-recurring tasks show date/time */}
                {isRecurring ? (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-subtle font-normal select-none',
                      compact ? 'mt-1 text-[10.5px]' : 'mt-1.5 text-[11px]'
                    )}
                  >
                    {recurringTime && <span>{recurringTime}</span>}
                    <RiRepeatLine className="size-3.5 text-muted-foreground/80 shrink-0" />
                  </div>
                ) : dateDisplay ? (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-subtle font-normal select-none',
                      compact ? 'mt-1 text-[10.5px]' : 'mt-1.5 text-[11px]'
                    )}
                  >
                    {dateDisplay && (
                      <>
                        <RiCalendarLine className="size-3.5 shrink-0 text-muted-foreground/80" />
                        <span>{dateDisplay}</span>
                      </>
                    )}
                  </div>
                ) : null}

                {linkedNote && !hideNoteLink && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNote(linkedNote);
                      setNoteViewModeOverride(null);
                      setNoteEditModalOpen(true);
                    }}
                    title={`یادداشت: ${linkedNote.title?.trim() || 'بدون عنوان'}`}
                    className={cn(
                      'mt-1 flex max-w-full cursor-pointer items-center gap-1 self-start rounded px-0.5 text-muted-foreground transition-colors hover:text-foreground',
                      compact ? 'text-[10px]' : 'text-[11px]'
                    )}
                  >
                    <RiStickyNoteLine className="size-3 shrink-0" />
                    <span className="truncate">{linkedNote.title?.trim() || 'بدون عنوان'}</span>
                  </button>
                )}
              </div>

              {/* 2. LEFT SIDE in RTL (reading end): optional illustration, then the done circle at the far edge */}
              <div className={cn('flex shrink-0 items-start', compact ? 'gap-2' : 'gap-2.5')}>
                {Boolean((task as any).image_url || (task as any).icon) && (
                  <div className="size-10 flex items-center justify-center self-center select-none pointer-events-none">
                    <img
                      src={(task as any).image_url || (task as any).icon}
                      alt=""
                      className="size-9 object-contain"
                    />
                  </div>
                )}

                {/* Circular checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle();
                  }}
                  className={`flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer rounded-full border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    compact ? 'size-4' : 'size-5'
                  } ${
                    isRecurring
                      ? 'border-dashed'
                      : 'border-solid'
                  } ${
                    isDone
                      ? 'bg-primary border-primary text-primary-foreground border-solid'
                      : task.priority === 3
                      ? 'border-destructive hover:border-destructive/80 bg-card'
                      : task.priority === 2
                      ? 'border-amber-500 hover:border-amber-600 bg-card'
                      : task.priority === 1
                      ? 'border-blue-500 hover:border-blue-600 bg-card'
                      : 'border-muted-foreground/40 hover:border-foreground bg-card'
                  }`}
                  title={isDone ? 'بازگردانی' : 'انجام شد'}
                >
                  {isDone && <RiCheckLine className="size-3.5 stroke-[2.5]" />}
                </button>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right Click Context Menu matching reference project */}
        {!isMobile && (
          <ContextMenuContent
            className="w-[15.5rem] p-1.5 !z-[170]"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
          <ContextMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              setContextMenuOpen(false);
              setEditModalOpen(true);
            }}
          >
            <RiEditLine className="size-4 text-muted-foreground" />
            <span>ویرایش</span>
          </ContextMenuItem>

          {!isDone && (
            <ContextMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => {
                setContextMenuOpen(false);
                requestFocusTask({
                  id: task.id,
                  title: task.title,
                  minutes: task.duration_minutes,
                });
              }}
            >
              <RiTimerLine className="size-4 text-muted-foreground" />
              <span>شروع تمرکز</span>
            </ContextMenuItem>
          )}

          <ContextMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              setContextMenuOpen(false);
              handleTogglePin();
            }}
          >
            {isPinned ? (
              <>
                <RiPushpin2Line className="size-4 text-primary" />
                <span>برداشتن سنجاق</span>
              </>
            ) : (
              <>
                <RiPushpin2Fill className="size-4 text-muted-foreground" />
                <span>سنجاق کردن</span>
              </>
            )}
          </ContextMenuItem>

          {onMigrate && (!task.due_date || task.due_date >= todayKey) && (
            <ContextMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => {
                setContextMenuOpen(false);
                onMigrate(task.id);
              }}
            >
              <RiCalendarEventLine className="size-4 text-muted-foreground" />
              <span>انتقال به فردا</span>
            </ContextMenuItem>
          )}

          {/* Date quick selection row */}
          <div
            className="px-1"
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={(e) => e.preventDefault()}
          >
            <MenuSectionLabel>تاریخ</MenuSectionLabel>
            <div className="flex items-center justify-between gap-0.5 px-0.5 pb-1">
              {/* امروز */}
              <button
                type="button"
                title="امروز"
                onClick={() => {
                  handleQuickDate(todayKey);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.due_date === todayKey && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiSunLine className="size-4" />
              </button>

              {/* فردا */}
              <button
                type="button"
                title="فردا"
                onClick={() => {
                  handleQuickDate(tomorrowKey);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.due_date === tomorrowKey && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiCloudyLine className="size-4" />
              </button>

              {/* هفته بعد */}
              <button
                type="button"
                title="هفته بعد"
                onClick={() => {
                  handleQuickDate(nextWeekKey);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.due_date === nextWeekKey && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiCalendarLine className="size-4" />
              </button>

              {/* آخر هفته */}
              <button
                type="button"
                title="آخر هفته"
                onClick={() => {
                  handleQuickDate(weekendKey);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.due_date === weekendKey && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiUmbrellaLine className="size-4" />
              </button>

              {/* بدون تاریخ */}
              <button
                type="button"
                title="بدون تاریخ"
                onClick={() => {
                  handleQuickDate(null);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  !task.due_date && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiForbid2Line className="size-4" />
              </button>

              {/* تقویم بازشونده */}
              <button
                type="button"
                title="تقویم"
                onClick={() => {
                  setContextMenuOpen(false);
                  setDatePickerOpen(true);
                }}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <RiMoreLine className="size-4" />
              </button>
            </div>
          </div>

          {/* Priority selection row */}
          <div
            className="px-1"
            onPointerDown={(e) => e.preventDefault()}
            onPointerUp={(e) => e.preventDefault()}
          >
            <MenuSectionLabel>اولویت</MenuSectionLabel>
            <div className="flex items-center justify-between gap-0.5 px-0.5 pb-1">
              {/* اولویت زیاد / فوری (P3) */}
              <button
                type="button"
                title="زیاد / فوری"
                onClick={() => {
                  handleSetPriority(3);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.priority === 3 && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiFlagFill className="size-4 text-destructive" />
              </button>

              {/* اولویت متوسط (P2) */}
              <button
                type="button"
                title="متوسط"
                onClick={() => {
                  handleSetPriority(2);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.priority === 2 && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiFlagFill className="size-4 text-amber-500" />
              </button>

              {/* اولویت کم (P1) */}
              <button
                type="button"
                title="کم"
                onClick={() => {
                  handleSetPriority(1);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  task.priority === 1 && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiFlagLine className="size-4 text-blue-500" />
              </button>

              {/* بدون اولویت */}
              <button
                type="button"
                title="بدون اولویت"
                onClick={() => {
                  handleSetPriority(undefined);
                  setContextMenuOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                  !task.priority && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                )}
              >
                <RiForbid2Line className="size-4" />
              </button>
            </div>
          </div>

          <ContextMenuSeparator />

          {/* Time of Day Section */}
          <div className="px-2 py-1.5">
            <MenuSectionLabel>بخش روز</MenuSectionLabel>
            <div className="flex items-center gap-1 mt-1 justify-between">
              {[
                { id: 'anytime' as const, label: 'هر زمان', icon: Clock01Icon },
                { id: 'morning' as const, label: 'صبح', icon: MorningSunriseIcon },
                { id: 'day' as const, label: 'ظهر', icon: Sun01Icon },
                { id: 'evening' as const, label: 'عصر و شب', icon: EveningMoonIcon },
              ].map((item) => {
                const isSelected = (task.time_of_day || 'anytime') === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      handleSetTimeOfDay(item.id);
                      setContextMenuOpen(false);
                    }}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground cursor-pointer',
                      isSelected && 'bg-transparent text-foreground ring-1 ring-foreground/25'
                    )}
                  >
                    <HugeiconsIcon icon={item.icon} size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <ContextMenuSeparator />

          {/* Duplicate */}
          <ContextMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              setContextMenuOpen(false);
              handleDuplicate();
            }}
          >
            <RiFileCopyLine className="size-4 text-muted-foreground" />
            <span>تکثیر کردن</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Delete */}
          <ContextMenuItem
            variant="destructive"
            className="gap-2 cursor-pointer"
            onClick={() => {
              setContextMenuOpen(false);
              handleSoftDelete();
            }}
          >
            <RiDeleteBinLine className="size-4 text-destructive" />
            <span>حذف</span>
          </ContextMenuItem>
        </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Edit Modal */}
      {editModalOpen && (
        <TaskEditModal
          task={task}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSaved={onStatusChanged}
        />
      )}

      {/* Date Picker if chosen from context menu (Full-width bottom sheet) */}
      {datePickerOpen && (
        <JalaliDatePicker
          value={task.due_date}
          timeValue={task.due_time}
          durationMinutes={task.duration_minutes}
          repeatValue={task.recurrence_rule}
          recurrenceStartDate={task.recurrence_start_date || task.due_date}
          recurrenceEndDate={task.recurrence_end_date}
          onChange={(d) => {
            handleQuickDate(d);
            setDatePickerOpen(false);
          }}
          onDateTimeChange={async (res) => {
            await taskRepo.update(task.id, {
              due_date: res.dateKey || undefined,
              due_time: res.time || undefined,
              duration_minutes: res.durationMinutes || undefined,
              recurrence_rule: res.repeat || undefined,
              recurrence_start_date: res.recurrenceStartDate || undefined,
              recurrence_end_date: res.recurrenceEndDate !== undefined ? res.recurrenceEndDate : undefined,
            });
            onStatusChanged?.();
            setDatePickerOpen(false);
          }}
          onClose={() => setDatePickerOpen(false)}
        />
      )}

      {/* Recurring Delete Sheet */}
      <RecurringDeleteSheet
        isOpen={recurringDeleteOpen}
        taskTitle={task.title}
        onDeleteSingle={handleDeleteSingleOccurrence}
        onDeleteAll={handleDeleteAllOccurrences}
        onClose={() => setRecurringDeleteOpen(false)}
      />

      {/* Normal Task Delete Confirm Sheet */}
      <DeleteConfirmSheet
        isOpen={deleteConfirmOpen}
        title="حذف تسک"
        itemTitle={task.title}
        description="آیا از حذف این تسک اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        confirmLabel="حذف تسک"
        onConfirm={handleConfirmNormalDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
});
