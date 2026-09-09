import React, { useState } from 'react';
import type { Task, Tag } from '@/types/models';
import { taskRepo } from '@/repositories';
import {
  getTodayJalaliKey,
  addJalaliDays,
  nextWeekendFrom,
  formatTaskDateDisplay,
  parseJalaliKey,
  formatJalaliDisplay,
} from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  MenuSectionLabel,
} from '@/components/ui/context-menu';
import { TaskEditModal } from '@/components/task/TaskEditModal';
import { JalaliDatePicker } from '@/components/calendar/JalaliDatePicker';
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
} from '@remixicon/react';
import { playTaskDoneSound } from '@/lib/sound';

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
}

export const TaskItemRow: React.FC<TaskItemRowProps> = ({
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
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const isDone = task.status === 'done';
  const isPinned = !!task.pinned;
  const todayKey = getTodayJalaliKey();
  const tomorrowKey = addJalaliDays(todayKey, 1);
  const nextWeekKey = addJalaliDays(todayKey, 7);
  const weekendKey = nextWeekendFrom(todayKey);
  const dateDisplay = isPinned && task.due_date
    ? (() => {
        try {
          const j = parseJalaliKey(task.due_date);
          return formatJalaliDisplay(j);
        } catch {
          return formatTaskDateDisplay(task.due_date, currentDateKey || todayKey);
        }
      })()
    : formatTaskDateDisplay(task.due_date, currentDateKey || todayKey);

  const handleToggle = async () => {
    if (!isDone) {
      playTaskDoneSound();
      toast.show('تسک دان شد');
    }
    await taskRepo.toggleDone(task.id);
    onStatusChanged();
  };

  const handleTogglePin = async () => {
    await taskRepo.update(task.id, { pinned: !isPinned });
    onStatusChanged();
  };

  const handleSoftDelete = async () => {
    await taskRepo.softDelete(task.id);
    onStatusChanged();
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

  return (
    <>
      <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onClick={() => setEditModalOpen(true)}
            className={`group relative w-full border-b border-dotted border-gray-200 py-3 px-1 select-none transition-all duration-150 ${
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            } hover:bg-black/[0.015] ${
              isDone ? 'opacity-55' : ''
            }`}
          >
            <div className="flex items-center justify-between w-full">
              {/* 1. RIGHT SIDE in RTL: Checkbox and Title */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Circle Checkbox on the far right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle();
                  }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isDone
                      ? 'bg-[#27272a] border-[#27272a] text-white'
                      : task.priority === 3
                      ? 'border-rose-500 hover:border-rose-600 bg-white'
                      : task.priority === 2
                      ? 'border-amber-500 hover:border-amber-600 bg-white'
                      : task.priority === 1
                      ? 'border-blue-500 hover:border-blue-600 bg-white'
                      : 'border-gray-400 hover:border-black bg-white'
                  }`}
                  title={isDone ? 'بازگردانی' : 'انجام شد'}
                >
                  {isDone && <RiCheckLine className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                {/* Title and Badges */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Pin icon if pinned */}
                  {isPinned && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin();
                      }}
                      title="برداشتن سنجاق"
                      className="shrink-0 flex items-center text-gray-700 hover:text-black cursor-pointer p-0.5"
                    >
                      <RiPushpin2Fill className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span
                    className={`text-[13.5px] font-bold leading-snug transition-all truncate ${
                      isDone
                        ? 'line-through text-gray-400 font-normal'
                        : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
              </div>

              {/* 2. LEFT SIDE in RTL: Date/Time display */}
              {dateDisplay && (
                <span className="text-[12px] text-gray-400 font-normal select-none shrink-0">
                  {dateDisplay}
                </span>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right Click Context Menu matching reference project */}
        <ContextMenuContent
          className="w-[15.5rem] p-1"
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
            <RiEditLine className="size-4 text-gray-500" />
            <span>ویرایش</span>
          </ContextMenuItem>

          <ContextMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              setContextMenuOpen(false);
              handleTogglePin();
            }}
          >
            {isPinned ? (
              <>
                <RiPushpin2Line className="size-4 text-gray-500" />
                <span>برداشتن سنجاق</span>
              </>
            ) : (
              <>
                <RiPushpin2Fill className="size-4 text-gray-700" />
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
              <RiCalendarEventLine className="size-4 text-gray-500" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer text-gray-700',
                  task.due_date === todayKey && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiSunLine className="size-4 text-amber-500" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer text-gray-700',
                  task.due_date === tomorrowKey && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiCloudyLine className="size-4 text-blue-500" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer text-gray-700',
                  task.due_date === nextWeekKey && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiCalendarLine className="size-4 text-indigo-500" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer text-gray-700',
                  task.due_date === weekendKey && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiUmbrellaLine className="size-4 text-teal-600" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer text-gray-700',
                  !task.due_date && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiForbid2Line className="size-4 text-rose-500" />
              </button>

              {/* تقویم بازشونده */}
              <button
                type="button"
                title="تقویم"
                onClick={() => {
                  setContextMenuOpen(false);
                  setDatePickerOpen(true);
                }}
                className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer',
                  task.priority === 3 && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiFlagFill className="size-4 text-rose-600" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer',
                  task.priority === 2 && 'bg-gray-100 ring-1 ring-gray-300'
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer',
                  task.priority === 1 && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiFlagFill className="size-4 text-blue-500" />
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
                  'flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 cursor-pointer',
                  !task.priority && 'bg-gray-100 ring-1 ring-gray-300'
                )}
              >
                <RiFlagLine className="size-4 text-gray-400" />
              </button>
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
            <RiFileCopyLine className="size-4 text-gray-500" />
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
            <RiDeleteBinLine className="size-4 text-rose-600" />
            <span>حذف</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit Modal */}
      <TaskEditModal
        task={task}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={onStatusChanged}
      />

      {/* Floating Date Picker if chosen from context menu */}
      {datePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xs"
          onClick={() => setDatePickerOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <JalaliDatePicker
              value={task.due_date}
              onChange={(d) => {
                handleQuickDate(d);
                setDatePickerOpen(false);
              }}
              onClose={() => setDatePickerOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};
