import React, { useState, useEffect, useMemo } from 'react';
import type { Task, EventItem, Note, Tag } from '@/types/models';
import { DayHeader } from './DayHeader';
import { TaskItemRow } from './TaskItemRow';
import { NoteItemRow } from './NoteItemRow';
import { EventItemRow } from './EventItemRow';
import { ResurfacingSection } from './ResurfacingSection';
import { RiSparklingLine } from '@remixicon/react';
import { setupDragCardGhost } from '@/lib/drag';
import { CardDropPreview } from './CardDropPreview';

export type UnifiedStreamItem =
  | { id: string; type: 'task'; data: Task }
  | { id: string; type: 'note'; data: Note }
  | { id: string; type: 'event'; data: EventItem };

interface DayStreamProps {
  selectedDateKey: string;
  tasks: Task[];
  notes: Note[];
  events: EventItem[];
  overdueTasks: Task[];
  futureTasks: Task[];
  futureEvents: EventItem[];
  tagsMap: Record<string, Tag>;
  onStatusChanged: () => void;
  onMigrateTask: (taskId: string, targetDate?: string) => void;
  onGoToToday?: () => void;
}

function getPriorityScore(item: UnifiedStreamItem): number {
  if (item.type === 'task') {
    return item.data.priority || 0;
  }
  return 0;
}

function isItemPinned(item: UnifiedStreamItem): boolean {
  if (item.type === 'task') return !!item.data.pinned;
  if (item.type === 'note') return !!item.data.pinned;
  return false;
}

function isItemDone(item: UnifiedStreamItem): boolean {
  if (item.type === 'task') return item.data.status === 'done';
  return false;
}

function getItemCreationTime(item: UnifiedStreamItem): number {
  if (item.data.created_at) {
    const t = new Date(item.data.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

function getItemTitle(item: UnifiedStreamItem): string {
  if (item.type === 'task') return item.data.title || '';
  if (item.type === 'note') return item.data.title || item.data.body || '';
  if (item.type === 'event') return item.data.title || '';
  return '';
}

function sortStreamItems(
  items: UnifiedStreamItem[],
  sortBy: 'priority' | 'created' | 'alpha'
): UnifiedStreamItem[] {
  return [...items].sort((a, b) => {
    // 1. Pinned items always on top
    const aPinned = isItemPinned(a);
    const bPinned = isItemPinned(b);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // 2. Completed items always at the bottom
    const aDone = isItemDone(a);
    const bDone = isItemDone(b);
    if (!aDone && bDone) return -1;
    if (aDone && !bDone) return 1;

    // 3. Sort strategy
    if (sortBy === 'priority') {
      const aPrio = getPriorityScore(a);
      const bPrio = getPriorityScore(b);
      if (aPrio !== bPrio) {
        return bPrio - aPrio; // Higher priority first (3 > 2 > 1 > 0)
      }
      // If priorities are equal, sort chronologically
      const aTime = getItemCreationTime(a);
      const bTime = getItemCreationTime(b);
      return aTime - bTime;
    }

    if (sortBy === 'alpha') {
      return getItemTitle(a).localeCompare(getItemTitle(b));
    }

    // sortBy === 'created'
    const aTime = getItemCreationTime(a);
    const bTime = getItemCreationTime(b);
    return aTime - bTime;
  });
}

export const DayStream: React.FC<DayStreamProps> = ({
  selectedDateKey,
  tasks,
  notes,
  events,
  overdueTasks,
  futureTasks,
  futureEvents,
  tagsMap,
  onStatusChanged,
  onMigrateTask,
  onGoToToday,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'task' | 'note' | 'event'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'alpha'>('priority');

  // Unified items list
  const rawItems: UnifiedStreamItem[] = useMemo(() => {
    const list: UnifiedStreamItem[] = [];
    if (filterType === 'all' || filterType === 'task') {
      tasks.forEach((t) => {
        if (!t.pinned) list.push({ id: `task-${t.id}`, type: 'task', data: t });
      });
    }
    if (filterType === 'all' || filterType === 'note') {
      notes.forEach((n) => {
        if (!n.pinned) list.push({ id: `note-${n.id}`, type: 'note', data: n });
      });
    }
    if (filterType === 'all' || filterType === 'event') {
      events.forEach((e) => list.push({ id: `event-${e.id}`, type: 'event', data: e }));
    }
    return list;
  }, [tasks, notes, events, filterType]);

  // Sorted items
  const [streamItems, setStreamItems] = useState<UnifiedStreamItem[]>(() =>
    sortStreamItems(rawItems, sortBy)
  );

  useEffect(() => {
    setStreamItems(sortStreamItems(rawItems, sortBy));
  }, [rawItems, sortBy]);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);

  // پاک‌سازی کامل وضعیت درگ با پایان حرکت
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedIndex(null);
      setDropSlotIndex(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent<any>, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setupDragCardGhost(e);
    setDraggedIndex(index);
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const isLowerHalf = e.clientY - rect.top > rect.height / 2;
    const targetSlot = isLowerHalf ? index + 1 : index;

    if (dropSlotIndex !== targetSlot) {
      setDropSlotIndex(targetSlot);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropSlotIndex(null);
  };

  const handleDropAtSlot = (e: React.DragEvent, slot: number) => {
    e.preventDefault();
    e.stopPropagation();

    // انتقال تسک از بخش روزهای قبل به این روز
    const textData = e.dataTransfer.getData('text/plain');
    if (textData && textData.startsWith('migrate:')) {
      const taskId = textData.replace('migrate:', '');
      onMigrateTask(taskId, selectedDateKey);
      handleDragEnd();
      return;
    }

    if (draggedIndex === null) {
      handleDragEnd();
      return;
    }

    // بازآرایی تسک‌ها در جریان روز
    let targetIndex = slot;
    if (draggedIndex < targetIndex) {
      targetIndex = targetIndex - 1;
    }

    if (draggedIndex !== targetIndex) {
      const updated = [...streamItems];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      setStreamItems(updated);
    }

    handleDragEnd();
  };

  const hasAnyItems = streamItems.length > 0;

  return (
    <div className="w-full flex-1 flex flex-col justify-between day-slide-transition">
      <div>
        {/* Header (Date on right, filter/sort icon on left) */}
        <DayHeader
          selectedDateKey={selectedDateKey}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onGoToToday={onGoToToday}
        />

        {/* Unified List of stream items with drag-and-drop */}
        <div
          className="w-full min-h-[70px]"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dropSlotIndex === null) {
              setDropSlotIndex(streamItems.length);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDropSlotIndex(null);
          }}
          onDrop={(e) => {
            const targetSlot = dropSlotIndex !== null ? dropSlotIndex : streamItems.length;
            handleDropAtSlot(e, targetSlot);
          }}
        >
          {/* نمایش اسلات در ابتدای لیست اگر اسلات ۰ انتخاب شده باشد */}
          {hasAnyItems && dropSlotIndex === 0 && (draggedIndex === null || draggedIndex > 0) && (
            <CardDropPreview />
          )}

          {streamItems.map((item, idx) => {
            const isDragging = draggedIndex === idx;

            return (
              <React.Fragment key={item.id}>
                <div
                  onDragOver={(e) => handleItemDragOver(e, idx)}
                  onDrop={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isLowerHalf = e.clientY - rect.top > rect.height / 2;
                    const targetSlot = isLowerHalf ? idx + 1 : idx;
                    handleDropAtSlot(e, targetSlot);
                  }}
                  className={`transition-opacity duration-150 relative rounded-xl ${
                    isDragging ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  {item.type === 'task' && (
                    <TaskItemRow
                      task={item.data}
                      tagsMap={tagsMap}
                      currentDateKey={selectedDateKey}
                      onStatusChanged={onStatusChanged}
                      onMigrate={(id) => onMigrateTask(id)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  )}

                  {item.type === 'note' && (
                    <NoteItemRow
                      note={item.data}
                      tagsMap={tagsMap}
                      onStatusChanged={onStatusChanged}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  )}

                  {item.type === 'event' && (
                    <EventItemRow
                      event={item.data}
                      onStatusChanged={onStatusChanged}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  )}
                </div>

                {/* پیش‌نمایش خاکستری کارت پس از این ردیف در صورتی که اسلات هدف باشد */}
                {dropSlotIndex === idx + 1 &&
                  (draggedIndex === null || (draggedIndex !== idx && draggedIndex !== idx + 1)) && (
                    <CardDropPreview />
                  )}
              </React.Fragment>
            );
          })}

          {/* پیش‌نمایش در حالت خالی بودن لیست هنگام کشیدن تسک به این روز */}
          {!hasAnyItems && dropSlotIndex !== null && (
            <CardDropPreview />
          )}

          {/* Empty state when no items */}
          {!hasAnyItems && (
            <div className="w-full py-8 flex flex-col items-center justify-center text-center text-gray-400">
              <RiSparklingLine className="w-7 h-7 text-gray-300 mb-1.5" />
              <p className="text-xs font-medium text-gray-500">
                هنوز تسک یا یادداشتی برای این روز ثبت نشده
              </p>
            </div>
          )}
        </div>

        {/* Resurfacing sections: independent of today's items and outside the right dashed line */}
        <div className="w-full mt-2">
          <ResurfacingSection
            overdueTasks={overdueTasks}
            futureTasks={futureTasks}
            futureEvents={futureEvents}
            tagsMap={tagsMap}
            selectedDateKey={selectedDateKey}
            onMigrateToCurrentDate={(id) => onMigrateTask(id, selectedDateKey)}
            onStatusChanged={onStatusChanged}
          />
        </div>
      </div>
    </div>
  );
};
