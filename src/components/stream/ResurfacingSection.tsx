import React, { useState, useEffect } from 'react';
import type { Task, EventItem, Tag } from '@/types/models';
import { toPersianDigits } from '@/lib/jalali';
import { TaskItemRow } from './TaskItemRow';
import { EventItemRow } from './EventItemRow';
import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { setupDragCardGhost } from '@/lib/drag';
import { CardDropPreview } from './CardDropPreview';

interface ResurfacingSectionProps {
  overdueTasks: Task[];
  futureTasks: Task[];
  futureEvents: EventItem[];
  tagsMap: Record<string, Tag>;
  selectedDateKey?: string;
  onMigrateToCurrentDate?: (taskId: string) => void;
  onStatusChanged: () => void;
  onExternalTouchStart?: (e: React.TouchEvent, task: Task, source: 'overdue' | 'future') => void;
  onExternalTouchMove?: (e: React.TouchEvent) => void;
  onExternalTouchEnd?: () => void;
  externalDraggingTaskId?: string | null;
  externalTouchDeltaY?: number;
}

export const ResurfacingSection: React.FC<ResurfacingSectionProps> = ({
  overdueTasks,
  futureTasks,
  futureEvents,
  tagsMap,
  selectedDateKey,
  onMigrateToCurrentDate,
  onStatusChanged,
  onExternalTouchStart,
  onExternalTouchMove,
  onExternalTouchEnd,
  externalDraggingTaskId,
  externalTouchDeltaY = 0,
}) => {
  const [openPrevious, setOpenPrevious] = useState(() => overdueTasks.length > 0);
  const [openFuture, setOpenFuture] = useState(false);
  const [localOverdueTasks, setLocalOverdueTasks] = useState<Task[]>(overdueTasks);

  // وضعیت درگ درون بخش کارهای عقب‌افتاده
  const [draggedOverdueIndex, setDraggedOverdueIndex] = useState<number | null>(null);
  const [dropSlotOverdueIndex, setDropSlotOverdueIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalOverdueTasks(overdueTasks);
  }, [overdueTasks]);

  // پاک‌سازی وضعیت درگ
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedOverdueIndex(null);
      setDropSlotOverdueIndex(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent<any>, index: number, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `migrate:${task.id}`);
    e.dataTransfer.setData('application/x-overdue-index', String(index));
    e.dataTransfer.setData('application/x-task-id', task.id);
    try {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          type: 'task',
          taskId: task.id,
          title: task.title,
          durationMinutes: task.duration_minutes || 60,
        })
      );
    } catch {}
    setupDragCardGhost(e);
    setDraggedOverdueIndex(index);
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const isLowerHalf = e.clientY - rect.top > rect.height / 2;
    const targetSlot = isLowerHalf ? index + 1 : index;

    if (dropSlotOverdueIndex !== targetSlot) {
      setDropSlotOverdueIndex(targetSlot);
    }
  };

  const handleDropAtSlot = (e: React.DragEvent, slot: number) => {
    e.preventDefault();
    e.stopPropagation();

    const overdueIdxStr = e.dataTransfer.getData('application/x-overdue-index');
    const sourceIndex = overdueIdxStr !== '' ? Number(overdueIdxStr) : draggedOverdueIndex;

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex >= 0) {
      let targetIndex = slot;
      if (sourceIndex < targetIndex) {
        targetIndex = targetIndex - 1;
      }

      if (sourceIndex !== targetIndex) {
        const updated = [...localOverdueTasks];
        const [moved] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, moved);
        setLocalOverdueTasks(updated);
      }
    }

    setDraggedOverdueIndex(null);
    setDropSlotOverdueIndex(null);
  };

  // بخش از روزهای قبل در صورت وجود تسک، به صورت پیش‌فرض باز است
  useEffect(() => {
    if (overdueTasks.length > 0) {
      setOpenPrevious(true);
    }
  }, [overdueTasks.length]);

  const overdueCount = localOverdueTasks.length;
  const futureTaskCount = futureTasks.length;
  const futureEventCount = futureEvents.length;

  return (
    <div className="w-full my-2 space-y-1 select-none">
      {/* 1. از روزهای قبل */}
      <div className="w-full">
        <button
          onClick={() => setOpenPrevious(!openPrevious)}
          className="w-full flex items-center justify-between py-2 px-6 transition-colors cursor-pointer text-right"
        >
          {/* 1. Text and count on FAR RIGHT (First child in RTL) */}
          <div className="flex items-center gap-2">
            <span className="text-foreground font-normal text-[12px]">
              از روزهای قبل
            </span>
            <span className="text-muted-foreground font-normal text-[12px]">
              {toPersianDigits(overdueCount)}
            </span>
          </div>

          {/* 2. Chevron on FAR LEFT (Second child in RTL) */}
          <div className="text-muted-foreground">
            {openPrevious ? (
              <RiArrowUpSLine className="w-4 h-4" />
            ) : (
              <RiArrowDownSLine className="w-4 h-4" />
            )}
          </div>
        </button>

        {openPrevious && (
          <div
            className="pt-1 w-full"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dropSlotOverdueIndex === null) {
                setDropSlotOverdueIndex(localOverdueTasks.length);
              }
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDropSlotOverdueIndex(null);
            }}
            onDrop={(e) => {
              const targetSlot =
                dropSlotOverdueIndex !== null ? dropSlotOverdueIndex : localOverdueTasks.length;
              handleDropAtSlot(e, targetSlot);
            }}
          >
            {localOverdueTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-6">موردی برای نمایش وجود ندارد.</p>
            ) : (
              <>
                {dropSlotOverdueIndex === 0 &&
                  (draggedOverdueIndex === null || draggedOverdueIndex > 0) && (
                    <CardDropPreview />
                  )}

                {localOverdueTasks.map((task, idx) => {
                  const isDragging = draggedOverdueIndex === idx;

                  return (
                    <React.Fragment key={task.id}>
                      <div
                        onTouchStart={(e) => onExternalTouchStart?.(e, task, 'overdue')}
                        onTouchMove={onExternalTouchMove}
                        onTouchEnd={onExternalTouchEnd}
                        onTouchCancel={onExternalTouchEnd}
                        onDragOver={(e) => handleItemDragOver(e, idx)}
                        onDrop={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLowerHalf = e.clientY - rect.top > rect.height / 2;
                          const targetSlot = isLowerHalf ? idx + 1 : idx;
                          handleDropAtSlot(e, targetSlot);
                        }}
                        style={
                          externalDraggingTaskId === task.id
                            ? {
                                transform: `translate3d(0, ${externalTouchDeltaY}px, 0) scale(1.03)`,
                                zIndex: 60,
                                boxShadow:
                                  '0 20px 35px -8px rgba(0, 0, 0, 0.22), 0 10px 18px -4px rgba(0, 0, 0, 0.12), 0 0 0 1.5px rgba(99, 102, 241, 0.35)',
                                pointerEvents: 'none',
                              }
                            : undefined
                        }
                        className={`transition-opacity duration-150 relative w-full ${
                          externalDraggingTaskId === task.id
                            ? 'transition-none select-none ring-2 ring-primary/30 rounded-lg'
                            : isDragging
                            ? 'opacity-30'
                            : 'opacity-100'
                        }`}
                      >
                        <TaskItemRow
                          task={task}
                          tagsMap={tagsMap}
                          currentDateKey={selectedDateKey}
                          onStatusChanged={onStatusChanged}
                          onMigrate={onMigrateToCurrentDate}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx, task)}
                          onDragEnd={() => {
                            setDraggedOverdueIndex(null);
                            setDropSlotOverdueIndex(null);
                          }}
                          isLast={idx === localOverdueTasks.length - 1}
                        />
                      </div>

                      {dropSlotOverdueIndex === idx + 1 &&
                        (draggedOverdueIndex === null ||
                          (draggedOverdueIndex !== idx && draggedOverdueIndex !== idx + 1)) && (
                          <CardDropPreview />
                        )}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. برای بعدا */}
      <div className="w-full">
        <button
          onClick={() => setOpenFuture(!openFuture)}
          className="w-full flex items-center justify-between py-2 px-6 transition-colors cursor-pointer text-right"
        >
          {/* 1. Text on FAR RIGHT (First child in RTL) */}
          <div className="flex items-center gap-2">
            <span className="text-foreground font-normal text-[12px]">
              برای بعدا
            </span>
            <span className="text-muted-foreground font-normal text-[12px]">
              {toPersianDigits(futureTaskCount + futureEventCount)}
            </span>
          </div>

          {/* 2. Chevron on FAR LEFT (Second child in RTL) */}
          <div className="text-muted-foreground">
            {openFuture ? (
              <RiArrowUpSLine className="w-4 h-4" />
            ) : (
              <RiArrowDownSLine className="w-4 h-4" />
            )}
          </div>
        </button>

        {openFuture && (
          <div className="pt-1 w-full">
            {futureTasks.length === 0 && futureEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">موردی برای نمایش وجود ندارد.</p>
            ) : (
              (() => {
                const futureItems = [
                  ...futureTasks.map((t) => ({ type: 'task' as const, data: t })),
                  ...futureEvents.map((e) => ({ type: 'event' as const, data: e })),
                ];
                return (
                  <>
                    {futureItems.map((item, idx) => {
                      const isLast = idx === futureItems.length - 1;
                      if (item.type === 'task') {
                        return (
                          <div
                            key={item.data.id}
                            onTouchStart={(e) => onExternalTouchStart?.(e, item.data, 'future')}
                            onTouchMove={onExternalTouchMove}
                            onTouchEnd={onExternalTouchEnd}
                            onTouchCancel={onExternalTouchEnd}
                            style={
                              externalDraggingTaskId === item.data.id
                                ? {
                                    transform: `translate3d(0, ${externalTouchDeltaY}px, 0) scale(1.03)`,
                                    zIndex: 60,
                                    boxShadow:
                                      '0 20px 35px -8px rgba(0, 0, 0, 0.22), 0 10px 18px -4px rgba(0, 0, 0, 0.12), 0 0 0 1.5px rgba(99, 102, 241, 0.35)',
                                    pointerEvents: 'none',
                                  }
                                : undefined
                            }
                            className={`transition-opacity duration-150 relative w-full ${
                              externalDraggingTaskId === item.data.id
                                ? 'transition-none select-none ring-2 ring-primary/30 rounded-lg'
                                : 'opacity-100'
                            }`}
                          >
                            <TaskItemRow
                              task={item.data}
                              tagsMap={tagsMap}
                              currentDateKey={selectedDateKey}
                              onStatusChanged={onStatusChanged}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', `migrate:${item.data.id}`);
                                e.dataTransfer.setData('application/x-task-id', item.data.id);
                                try {
                                  e.dataTransfer.setData(
                                    'application/json',
                                    JSON.stringify({
                                      type: 'task',
                                      taskId: item.data.id,
                                      title: item.data.title,
                                      durationMinutes: item.data.duration_minutes || 60,
                                    })
                                  );
                                } catch {}
                                setupDragCardGhost(e);
                              }}
                              isLast={isLast}
                            />
                          </div>
                        );
                      }
                      return (
                        <EventItemRow
                          key={item.data.id}
                          event={item.data}
                          onStatusChanged={onStatusChanged}
                          isLast={isLast}
                        />
                      );
                    })}
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
};
