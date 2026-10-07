import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Task, EventItem, Note, Tag, TimeOfDay } from '@/types/models';
import { TaskItemRow } from './TaskItemRow';
import { NoteItemRow } from './NoteItemRow';
import { EventItemRow } from './EventItemRow';
import { ResurfacingSection } from './ResurfacingSection';
import { setupDragCardGhost } from '@/lib/drag';
import { CardDropPreview } from './CardDropPreview';
import { toPersianDigits, getTodayJalaliKey, formatJalaliDisplay, parseJalaliKey, getDescriptiveDayLabel } from '@/lib/jalali';
import { triggerHaptic } from '@/lib/capacitor';
import { HugeiconsIcon } from '@hugeicons/react';
import { RiArrowDownSLine, RiArrowUpSLine, RiAddLine } from '@remixicon/react';
import { taskRepo } from '@/repositories';

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
  onOpenAdd?: (initialTimeOfDay?: TimeOfDay) => void;
  newlyAddedTaskId?: string | null;
  isLoading?: boolean;
  todayDoneCount?: number;
  dailyTaskGoal?: number;
  enableDaySections?: boolean;
  goalPillRef?: React.Ref<HTMLDivElement>;
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

export function getItemTimeOfDay(item: UnifiedStreamItem): TimeOfDay {
  if (item.type === 'task') {
    if (item.data.time_of_day) {
      return item.data.time_of_day;
    }
    if (item.data.due_time) {
      const timeMatch = item.data.due_time.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        if (h >= 5 && h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'day';
        if (h >= 17 && h < 24) return 'evening';
      }
    }
    return 'anytime';
  }
  if (item.type === 'event' && item.data.start_at) {
    const timeMatch = item.data.start_at.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      if (h >= 5 && h < 12) return 'morning';
      if (h >= 12 && h < 17) return 'day';
      if (h >= 17 && h < 24) return 'evening';
    }
  }
  return 'anytime';
}

import { TIME_OF_DAY_SECTIONS } from './timeOfDayConfig';
import type { TimeOfDaySectionConfig } from './timeOfDayConfig';
export type { TimeOfDaySectionConfig };
export { TIME_OF_DAY_SECTIONS };

export const DayStream: React.FC<DayStreamProps> = React.memo(({
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
  onOpenAdd,
  newlyAddedTaskId,
  isLoading,
  todayDoneCount: _todayDoneCount = 0,
  dailyTaskGoal: _dailyTaskGoal = 5,
  enableDaySections = false,
  goalPillRef: _goalPillRef,
}) => {
  const [filterType] = useState<'all' | 'task' | 'note' | 'event'>('all');
  const [sortBy] = useState<'priority' | 'created' | 'alpha'>('priority');
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);
  const dragEnterCountRef = useRef(0);

  const todayKey = getTodayJalaliKey();
  const isToday = selectedDateKey === todayKey;
  const dayTitle = getDescriptiveDayLabel(selectedDateKey, todayKey);

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

  const hasAnyItems = streamItems.length > 0;

  useEffect(() => {
    setStreamItems(sortStreamItems(rawItems, sortBy));
  }, [rawItems, sortBy]);

  // Time of Day sections state (open/close)
  const [openSections, setOpenSections] = useState<Record<TimeOfDay, boolean>>(() => {
    try {
      const saved = localStorage.getItem('second_brain_time_of_day_sections');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      anytime: true,
      morning: true,
      day: true,
      evening: true,
    };
  });

  const toggleSection = (key: TimeOfDay) => {
    setOpenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('second_brain_time_of_day_sections', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [dragOverSection, setDragOverSection] = useState<TimeOfDay | null>(null);

  const handleSectionDragOver = (e: React.DragEvent, sectionKey: TimeOfDay) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSection !== sectionKey) {
      setDragOverSection(sectionKey);
    }
  };

  const handleSectionDragLeave = (e: React.DragEvent, sectionKey: TimeOfDay) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverSection === sectionKey) {
      setDragOverSection(null);
    }
  };

  const handleDropOnSection = async (e: React.DragEvent, sectionKey: TimeOfDay) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSection(null);

    const textData = e.dataTransfer.getData('text/plain');
    const isMigrate = textData && textData.startsWith('migrate:');
    const migrateTaskId = isMigrate ? textData.replace('migrate:', '') : null;

    if (migrateTaskId) {
      await taskRepo.update(migrateTaskId, { time_of_day: sectionKey, due_date: selectedDateKey });
      onStatusChanged();
      triggerHaptic('heavy');
      handleDragEnd();
      return;
    }

    const xTaskId = e.dataTransfer.getData('application/x-task-id');
    const dragIdx = draggedIndex;
    let targetTaskId: string | null = null;
    if (dragIdx !== null && streamItems[dragIdx]?.type === 'task') {
      targetTaskId = (streamItems[dragIdx].data as Task).id;
    } else if (xTaskId) {
      targetTaskId = xTaskId;
    }

    if (targetTaskId) {
      await taskRepo.update(targetTaskId, { time_of_day: sectionKey });
      onStatusChanged();
      triggerHaptic('medium');
    }
    handleDragEnd();
  };

  const itemsBySection = useMemo(() => {
    const map: Record<TimeOfDay, UnifiedStreamItem[]> = {
      anytime: [],
      morning: [],
      day: [],
      evening: [],
    };
    streamItems.forEach((item) => {
      const tod = getItemTimeOfDay(item);
      map[tod].push(item);
    });
    return map;
  }, [streamItems]);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);

  // Mobile Touch Drag and Drop state (with hold delay & card elevation)
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchDeltaY, setTouchDeltaY] = useState<number>(0);
  const touchHoldTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; index: number } | null>(null);
  const isTouchDraggingRef = useRef<boolean>(false);
  const targetSlotRef = useRef<number | null>(null);
  const justFinishedTouchDragRef = useRef<boolean>(false);

  // External Touch Drag State (from overdue / future sections into today)
  const [externalTouchDragInfo, setExternalTouchDragInfo] = useState<{
    taskId: string;
    task: Task;
    source: 'overdue' | 'future';
  } | null>(null);
  const [externalTouchDeltaY, setExternalTouchDeltaY] = useState<number>(0);
  const externalTouchHoldTimerRef = useRef<number | null>(null);
  const externalTouchStartPosRef = useRef<{
    x: number;
    y: number;
    task: Task;
    source: 'overdue' | 'future';
  } | null>(null);
  const isExternalTouchDraggingRef = useRef<boolean>(false);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);

  // FLIP layout animation refs for smooth sliding when tasks are completed or reordered
  const itemElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositionsRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    // Skip FLIP during HTML5 or touch drag-and-drop to avoid conflicts
    if (draggedIndex !== null || touchDragIndex !== null || externalTouchDragInfo !== null) return;

    const prevPositions = prevPositionsRef.current;
    const currentPositions = new Map<string, number>();

    // 1. Measure all current items' top positions (using scrollY to be scroll-independent)
    itemElementsRef.current.forEach((el, id) => {
      if (el) {
        currentPositions.set(id, el.getBoundingClientRect().top + window.scrollY);
      }
    });

    // 2. Compute vertical delta for elements that shifted
    const animatedElements: { el: HTMLDivElement; deltaY: number }[] = [];

    currentPositions.forEach((newTop, id) => {
      const prevTop = prevPositions.get(id);
      const el = itemElementsRef.current.get(id);

      if (prevTop !== undefined && el) {
        const deltaY = prevTop - newTop;
        if (Math.abs(deltaY) > 2) {
          // Invert: position element back at previous location without animation
          el.style.transform = `translate3d(0, ${deltaY}px, 0)`;
          el.style.transition = 'none';

          // If task is sliding downwards (deltaY < 0), elevate z-index so it glides smoothly on top of other cards
          if (deltaY < 0) {
            el.style.zIndex = '20';
          }
          animatedElements.push({ el, deltaY });
        }
      }
    });

    // Save current positions for subsequent renders
    prevPositionsRef.current = currentPositions;

    if (animatedElements.length === 0) return;

    // Force DOM reflow to apply the inverted transforms
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    document.body.offsetHeight;

    // 3. Play: animate back to zero (translate3d(0, 0, 0)) with smooth fluid cubic-bezier
    const rafId = requestAnimationFrame(() => {
      animatedElements.forEach(({ el }) => {
        el.style.transition = 'transform 500ms cubic-bezier(0.2, 0.9, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      });
    });

    const cleanupTimer = setTimeout(() => {
      animatedElements.forEach(({ el }) => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
      });
    }, 520);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(cleanupTimer);
    };
  }, [streamItems, draggedIndex, touchDragIndex]);

  // Clean reorder helper
  const reorderItems = (fromIdx: number, toSlot: number) => {
    let targetIndex = toSlot;
    if (fromIdx < targetIndex) {
      targetIndex = targetIndex - 1;
    }

    if (fromIdx !== targetIndex && targetIndex >= 0 && targetIndex < streamItems.length) {
      const updated = [...streamItems];
      const [movedItem] = updated.splice(fromIdx, 1);
      updated.splice(targetIndex, 0, movedItem);
      setStreamItems(updated);
    }
  };

  // Mobile Touch Drag handlers (300ms hold delay + elevated card lift)
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (e.touches.length > 1) return;

    // Do not initiate drag if user tapped an interactive button or control
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, textarea, a, [role="button"], .no-drag')) {
      return;
    }

    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, index };

    if (touchHoldTimerRef.current) {
      window.clearTimeout(touchHoldTimerRef.current);
    }

    // 300ms hold delay: user holds firmly before drag begins ("یک کوچولو بیشتر باید نگه داره")
    touchHoldTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setTouchDragIndex(index);
      setTouchDeltaY(0);
      setDropSlotIndex(index);
      targetSlotRef.current = index;

      triggerHaptic('medium');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch {}
      }

      const onWindowTouchMove = (we: TouchEvent) => {
        if (!isTouchDraggingRef.current) return;
        if (we.cancelable) {
          we.preventDefault(); // Stop mobile browser scrolling while dragging
        }
        const t = we.touches[0];
        if (!t || !touchStartPosRef.current) return;

        const dy = t.clientY - touchStartPosRef.current.y;
        setTouchDeltaY(dy);

        // Auto-scroll when dragging near viewport edges
        const touchY = t.clientY;
        const edgeThreshold = 65;
        if (touchY < edgeThreshold) {
          window.scrollBy({ top: -7, behavior: 'auto' });
        } else if (window.innerHeight - touchY < edgeThreshold) {
          window.scrollBy({ top: 7, behavior: 'auto' });
        }

        // Determine target drop slot
        let newSlot = streamItems.length;
        for (let i = 0; i < streamItems.length; i++) {
          const it = streamItems[i];
          const el = itemElementsRef.current.get(it.id);
          if (el) {
            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (touchY < midY) {
              newSlot = i;
              break;
            }
          }
        }

        if (newSlot !== targetSlotRef.current) {
          targetSlotRef.current = newSlot;
          setDropSlotIndex(newSlot);
        }
      };

      const onWindowTouchEnd = () => {
        window.removeEventListener('touchmove', onWindowTouchMove);
        window.removeEventListener('touchend', onWindowTouchEnd);
        window.removeEventListener('touchcancel', onWindowTouchEnd);

        if (isTouchDraggingRef.current) {
          justFinishedTouchDragRef.current = true;
          setTimeout(() => {
            justFinishedTouchDragRef.current = false;
          }, 350);

          const fromIdx = touchStartPosRef.current?.index ?? null;
          const toSlot = targetSlotRef.current;

          if (fromIdx !== null && toSlot !== null) {
            if (enableDaySections) {
              const sourceItem = streamItems[fromIdx];
              const targetItem = streamItems[Math.min(toSlot, streamItems.length - 1)];
              if (sourceItem && sourceItem.type === 'task' && targetItem) {
                const targetTod = getItemTimeOfDay(targetItem);
                if (sourceItem.data.time_of_day !== targetTod) {
                  taskRepo.update(sourceItem.data.id, { time_of_day: targetTod }).then(() => {
                    onStatusChanged();
                  });
                }
              }
            }
            reorderItems(fromIdx, toSlot);
          }
        }

        isTouchDraggingRef.current = false;
        setTouchDragIndex(null);
        setTouchDeltaY(0);
        setDropSlotIndex(null);
        setDragOverSection(null);
        targetSlotRef.current = null;
        touchStartPosRef.current = null;
      };

      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd, { once: true });
      window.addEventListener('touchcancel', onWindowTouchEnd, { once: true });
    }, 300);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // If user moved > 8px before hold delay fired, cancel drag timer so natural scroll occurs
    if (touchHoldTimerRef.current && !isTouchDraggingRef.current) {
      const start = touchStartPosRef.current;
      if (start) {
        const touch = e.touches[0];
        const dist = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
        if (dist > 8) {
          window.clearTimeout(touchHoldTimerRef.current);
          touchHoldTimerRef.current = null;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchHoldTimerRef.current && !isTouchDraggingRef.current) {
      window.clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
      touchStartPosRef.current = null;
    }
  };

  // Touch drag from external sections (overdue / future) into Today
  const handleExternalTouchStart = (
    e: React.TouchEvent,
    task: Task,
    source: 'overdue' | 'future'
  ) => {
    if (e.touches.length > 1) return;

    // Ignore taps on interactive elements like checkboxes or buttons
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, textarea, a, [role="button"], .no-drag')) {
      return;
    }

    const touch = e.touches[0];
    externalTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY, task, source };

    if (externalTouchHoldTimerRef.current) {
      window.clearTimeout(externalTouchHoldTimerRef.current);
    }

    // 300ms hold delay for external cards
    externalTouchHoldTimerRef.current = window.setTimeout(() => {
      isExternalTouchDraggingRef.current = true;
      setExternalTouchDragInfo({ taskId: task.id, task, source });
      setExternalTouchDeltaY(0);

      triggerHaptic('medium');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch {}
      }

      const onWindowTouchMove = (we: TouchEvent) => {
        if (!isExternalTouchDraggingRef.current) return;
        if (we.cancelable) we.preventDefault();

        const t = we.touches[0];
        if (!t || !externalTouchStartPosRef.current) return;

        const dy = t.clientY - externalTouchStartPosRef.current.y;
        setExternalTouchDeltaY(dy);

        const touchY = t.clientY;
        const edgeThreshold = 65;
        if (touchY < edgeThreshold) {
          window.scrollBy({ top: -7, behavior: 'auto' });
        } else if (window.innerHeight - touchY < edgeThreshold) {
          window.scrollBy({ top: 7, behavior: 'auto' });
        }

        // Check if dragged over or into today's stream
        let newSlot: number | null = null;
        const container = streamContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          if (touchY <= rect.bottom + 35) {
            if (streamItems.length === 0) {
              newSlot = 0;
              setIsDragOverEmpty(true);
            } else {
              setIsDragOverEmpty(false);
              newSlot = streamItems.length;
              for (let i = 0; i < streamItems.length; i++) {
                const it = streamItems[i];
                const el = itemElementsRef.current.get(it.id);
                if (el) {
                  const elRect = el.getBoundingClientRect();
                  const midY = elRect.top + elRect.height / 2;
                  if (touchY < midY) {
                    newSlot = i;
                    break;
                  }
                }
              }
            }
          } else {
            setIsDragOverEmpty(false);
          }
        }

        setDropSlotIndex(newSlot);
        targetSlotRef.current = newSlot;
      };

      const onWindowTouchEnd = () => {
        window.removeEventListener('touchmove', onWindowTouchMove);
        window.removeEventListener('touchend', onWindowTouchEnd);
        window.removeEventListener('touchcancel', onWindowTouchEnd);

        if (isExternalTouchDraggingRef.current) {
          justFinishedTouchDragRef.current = true;
          setTimeout(() => {
            justFinishedTouchDragRef.current = false;
          }, 350);

          const startInfo = externalTouchStartPosRef.current;
          const targetSlot = targetSlotRef.current;

          // If dragged into today's stream area
          if (startInfo && (targetSlot !== null || isDragOverEmpty)) {
            onMigrateTask(startInfo.task.id, selectedDateKey);
            triggerHaptic('heavy');
          }
        }

        isExternalTouchDraggingRef.current = false;
        setExternalTouchDragInfo(null);
        setExternalTouchDeltaY(0);
        setDropSlotIndex(null);
        setIsDragOverEmpty(false);
        targetSlotRef.current = null;
        externalTouchStartPosRef.current = null;
      };

      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd, { once: true });
      window.addEventListener('touchcancel', onWindowTouchEnd, { once: true });
    }, 300);
  };

  const handleExternalTouchMove = (e: React.TouchEvent) => {
    if (externalTouchHoldTimerRef.current && !isExternalTouchDraggingRef.current) {
      const start = externalTouchStartPosRef.current;
      if (start) {
        const touch = e.touches[0];
        const dist = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
        if (dist > 8) {
          window.clearTimeout(externalTouchHoldTimerRef.current);
          externalTouchHoldTimerRef.current = null;
        }
      }
    }
  };

  const handleExternalTouchEnd = () => {
    if (externalTouchHoldTimerRef.current && !isExternalTouchDraggingRef.current) {
      window.clearTimeout(externalTouchHoldTimerRef.current);
      externalTouchHoldTimerRef.current = null;
      externalTouchStartPosRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (touchHoldTimerRef.current) {
        window.clearTimeout(touchHoldTimerRef.current);
      }
      if (externalTouchHoldTimerRef.current) {
        window.clearTimeout(externalTouchHoldTimerRef.current);
      }
    };
  }, []);

  const handleDragStart = (e: React.DragEvent<any>, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    const item = streamItems[index];
    if (item && item.type === 'task') {
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
    }
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
    setDragOverSection(null);
    setIsDragOverEmpty(false);
    dragEnterCountRef.current = 0;
  };

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      dragEnterCountRef.current = 0;
      setIsDragOverEmpty(false);
      setDraggedIndex(null);
      setDropSlotIndex(null);
      setDragOverSection(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const handleDropAtSlot = async (
    e: React.DragEvent,
    slot: number,
    targetSection?: TimeOfDay
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSection(null);

    // انتقال تسک از بخش روزهای قبل یا بعد به این روز
    const textData = e.dataTransfer.getData('text/plain');
    const isMigrate = textData && textData.startsWith('migrate:');
    const migrateTaskId = isMigrate ? textData.replace('migrate:', '') : null;

    if (migrateTaskId) {
      await taskRepo.update(migrateTaskId, {
        due_date: selectedDateKey,
        ...(targetSection ? { time_of_day: targetSection } : {}),
      });
      onStatusChanged();
      handleDragEnd();
      return;
    }

    if (draggedIndex === null) {
      handleDragEnd();
      return;
    }

    const item = streamItems[draggedIndex];
    if (item && item.type === 'task' && targetSection && item.data.time_of_day !== targetSection) {
      await taskRepo.update(item.data.id, { time_of_day: targetSection });
      onStatusChanged();
    }

    reorderItems(draggedIndex, slot);
    handleDragEnd();
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between">
      <div>
        {/* هدر بخش روز با دکمه مینیمال اضافه کردن کار */}
        <div className="w-full flex items-center justify-between py-2 px-6 text-right select-none" dir="rtl">
          {/* سمت راست: عنوان توصیفی روز و تاریخ */}
          <h2 className="text-sm font-medium text-muted-foreground tracking-tight select-none leading-none">
            {dayTitle} {formatJalaliDisplay(parseJalaliKey(selectedDateKey))}
          </h2>

          {/* سمت چپ: دکمه مینیمال و میوت اضافه کردن کار */}
          <button
            type="button"
            onClick={() => onOpenAdd?.('anytime')}
            className="border border-neutral-200 dark:border-neutral-800 text-muted-foreground hover:text-foreground hover:bg-secondary/40 text-xs px-3 py-1 rounded-full flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 select-none"
            title="اضافه کردن کار (میانبر / یا N)"
          >
            <span className="text-sm font-light leading-none">+</span>
            <span className="font-normal text-[11px] sm:text-xs">اضافه کردن کار</span>
            <span className="opacity-40 text-[11px] font-mono leading-none">/</span>
          </button>
        </div>

        {/* Skeleton loading state on initial load */}
        {isLoading ? (
          <div className="w-full flex flex-col py-1 select-none animate-in fade-in duration-200">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={`skeleton-${i}`}
                className="w-full flex items-center justify-between py-3 px-3 animate-pulse"
                style={{
                  borderBottom: i < 4 ? '1px dashed rgba(161, 161, 170, 0.25)' : 'none',
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Checkbox skeleton circle */}
                  <div className="w-5 h-5 rounded-full border border-border/70 bg-muted/50 shrink-0" />
                  {/* Title skeleton pill */}
                  <div
                    className="h-3.5 bg-muted/70 rounded-md"
                    style={{
                      width: i === 1 ? '64%' : i === 2 ? '44%' : i === 3 ? '78%' : '52%',
                    }}
                  />
                </div>
                {/* Tag / metadata chip skeleton */}
                <div className="w-12 h-4 rounded-full bg-muted/40 shrink-0" />
              </div>
            ))}
          </div>
        ) : enableDaySections ? (
          /* 4 Time-of-Day Sections matching Tiimo & TodoView styles */
          <div
            ref={streamContainerRef}
            className="w-full min-h-[70px] space-y-4"
          >
            {TIME_OF_DAY_SECTIONS.map((sec) => {
              const secItems = itemsBySection[sec.key];
              const isOpen = openSections[sec.key];
              const activeDragIndex = draggedIndex !== null ? draggedIndex : touchDragIndex;
              const isExternalDragging = externalTouchDragInfo !== null;
              const isDraggingActive = activeDragIndex !== null || isExternalDragging;
              const isSectionDragOver = isDraggingActive && dragOverSection === sec.key;

              return (
                <div
                  key={sec.key}
                  onDragOver={(e) => handleSectionDragOver(e, sec.key)}
                  onDragLeave={(e) => handleSectionDragLeave(e, sec.key)}
                  onDrop={(e) => handleDropOnSection(e, sec.key)}
                  className={`w-full transition-colors duration-150 ${
                    isSectionDragOver ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Section Header: Pill badge matching TodoView / Tiimo */}
                  <div className="flex items-center justify-between px-6 pt-2 pb-1.5 select-none">
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer active:scale-95 select-none transition-colors ${sec.pillClasses}`}
                    >
                      <HugeiconsIcon icon={sec.icon} size={16} className="text-current opacity-70 shrink-0" />
                      <span className="tracking-tight">{sec.label}</span>
                      <span className="opacity-75 font-normal tabular-nums">({toPersianDigits(secItems.length)})</span>
                      {isOpen ? (
                        <RiArrowDownSLine className="size-3.5 opacity-60" />
                      ) : (
                        <RiArrowUpSLine className="size-3.5 opacity-60" />
                      )}
                    </button>

                    {secItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenAdd?.(sec.key)}
                        className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer active:scale-95"
                        title={`افزودن کار به ${sec.label}`}
                      >
                        <RiAddLine className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Section Content */}
                  {isOpen && (
                    <div className="w-full flex flex-col">
                      {secItems.length === 0 ? (
                        <div className="px-6 py-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenAdd?.(sec.key)}
                            className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-border hover:border-primary/40 bg-secondary/20 hover:bg-secondary/40 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group select-none"
                          >
                            <span>{sec.emptyHint}</span>
                            <RiAddLine className="size-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                          </button>
                        </div>
                      ) : (
                        secItems.map((item, itemIdx) => {
                          const idx = streamItems.indexOf(item);
                          const isHtml5Dragging = draggedIndex === idx;
                          const isTouchDragging = touchDragIndex === idx;

                          return (
                            <React.Fragment key={item.id}>
                              <div
                                ref={(el) => {
                                  if (el) {
                                    itemElementsRef.current.set(item.id, el);
                                  } else {
                                    itemElementsRef.current.delete(item.id);
                                  }
                                }}
                                onTouchStart={(e) => handleTouchStart(e, idx)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                onClickCapture={(e) => {
                                  if (justFinishedTouchDragRef.current) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }
                                }}
                                onDragOver={(e) => handleItemDragOver(e, idx)}
                                onDrop={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const isLowerHalf = e.clientY - rect.top > rect.height / 2;
                                  const targetSlot = isLowerHalf ? idx + 1 : idx;
                                  handleDropAtSlot(e, targetSlot, sec.key);
                                }}
                                style={
                                  isTouchDragging
                                    ? {
                                        transform: `translate3d(0, ${touchDeltaY}px, 0) scale(1.03)`,
                                        zIndex: 60,
                                        boxShadow:
                                          '0 20px 35px -8px rgba(0, 0, 0, 0.22), 0 10px 18px -4px rgba(0, 0, 0, 0.12), 0 0 0 1.5px rgba(99, 102, 241, 0.35)',
                                        pointerEvents: 'none',
                                      }
                                    : undefined
                                }
                                className={`relative will-change-transform ${
                                  isTouchDragging
                                    ? 'transition-none select-none ring-2 ring-primary/30 rounded-lg'
                                    : isHtml5Dragging
                                    ? 'opacity-30'
                                    : 'opacity-100 transition-opacity duration-150'
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
                                    isNewlyAdded={item.data.id === newlyAddedTaskId}
                                    isLast={itemIdx === secItems.length - 1}
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
                                    isLast={itemIdx === secItems.length - 1}
                                  />
                                )}

                                {item.type === 'event' && (
                                  <EventItemRow
                                    event={item.data}
                                    onStatusChanged={onStatusChanged}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    isLast={itemIdx === secItems.length - 1}
                                  />
                                )}
                              </div>

                              {/* پیش‌نمایش خاکستری کارت پس از این ردیف در صورتی که اسلات هدف باشد */}
                              {dropSlotIndex === idx + 1 &&
                                (isExternalDragging ||
                                  activeDragIndex === null ||
                                  (activeDragIndex !== idx && activeDragIndex !== idx + 1)) && (
                                  <CardDropPreview />
                                )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Flat Unified Stream (when day sectioning is disabled in settings) */
          <div
            ref={streamContainerRef}
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
            {(() => {
              const activeDragIndex = draggedIndex !== null ? draggedIndex : touchDragIndex;
              const isExternalDragging = externalTouchDragInfo !== null;
              return (
                <>
                  {/* نمایش اسلات در ابتدای لیست اگر اسلات ۰ انتخاب شده باشد */}
                  {hasAnyItems &&
                    dropSlotIndex === 0 &&
                    (activeDragIndex === null || activeDragIndex > 0 || isExternalDragging) && (
                      <CardDropPreview />
                    )}

                  {streamItems.map((item, idx) => {
                    const isHtml5Dragging = draggedIndex === idx;
                    const isTouchDragging = touchDragIndex === idx;

                    return (
                      <React.Fragment key={item.id}>
                        <div
                          ref={(el) => {
                            if (el) {
                              itemElementsRef.current.set(item.id, el);
                            } else {
                              itemElementsRef.current.delete(item.id);
                            }
                          }}
                          onTouchStart={(e) => handleTouchStart(e, idx)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          onClickCapture={(e) => {
                            if (justFinishedTouchDragRef.current) {
                              e.stopPropagation();
                              e.preventDefault();
                            }
                          }}
                          onDragOver={(e) => handleItemDragOver(e, idx)}
                          onDrop={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const isLowerHalf = e.clientY - rect.top > rect.height / 2;
                            const targetSlot = isLowerHalf ? idx + 1 : idx;
                            handleDropAtSlot(e, targetSlot);
                          }}
                          style={
                            isTouchDragging
                              ? {
                                  transform: `translate3d(0, ${touchDeltaY}px, 0) scale(1.03)`,
                                  zIndex: 60,
                                  boxShadow:
                                    '0 20px 35px -8px rgba(0, 0, 0, 0.22), 0 10px 18px -4px rgba(0, 0, 0, 0.12), 0 0 0 1.5px rgba(99, 102, 241, 0.35)',
                                  pointerEvents: 'none',
                                }
                              : undefined
                          }
                          className={`relative will-change-transform ${
                            isTouchDragging
                              ? 'transition-none select-none ring-2 ring-primary/30 rounded-lg'
                              : isHtml5Dragging
                              ? 'opacity-30'
                              : 'opacity-100 transition-opacity duration-150'
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
                              isNewlyAdded={item.data.id === newlyAddedTaskId}
                              isLast={idx === streamItems.length - 1}
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
                              isLast={idx === streamItems.length - 1}
                            />
                          )}

                          {item.type === 'event' && (
                            <EventItemRow
                              event={item.data}
                              onStatusChanged={onStatusChanged}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragEnd={handleDragEnd}
                              isLast={idx === streamItems.length - 1}
                            />
                          )}
                        </div>

                        {/* پیش‌نمایش خاکستری کارت پس از این ردیف در صورتی که اسلات هدف باشد */}
                        {dropSlotIndex === idx + 1 &&
                          (isExternalDragging ||
                            activeDragIndex === null ||
                            (activeDragIndex !== idx && activeDragIndex !== idx + 1)) && (
                            <CardDropPreview />
                          )}
                      </React.Fragment>
                    );
                  })}
                </>
              );
            })()}

            {/* پیش‌نمایش در حالت خالی بودن لیست فقط اگر آیتم درگی غیر از روی کامپوننت خالی هست */}
            {/* Empty state when no items */}
            {!hasAnyItems && (
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  dragEnterCountRef.current += 1;
                  setIsDragOverEmpty(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (!isDragOverEmpty) setIsDragOverEmpty(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  dragEnterCountRef.current -= 1;
                  if (dragEnterCountRef.current <= 0) {
                    dragEnterCountRef.current = 0;
                    setIsDragOverEmpty(false);
                  }
                }}
                onDrop={(e) => {
                  dragEnterCountRef.current = 0;
                  setIsDragOverEmpty(false);
                  handleDropAtSlot(e, 0);
                }}
                className={`w-full py-6 flex flex-col items-center justify-center text-center transition-all duration-200 select-none rounded-2xl ${
                  isDragOverEmpty ? 'bg-gray-50/70 dark:bg-white/5 scale-[1.01]' : 'bg-transparent'
                }`}
              >
                <img
                  src="/empty-today.png"
                  alt={isToday ? 'امروز کاری برای انجام دادن نیست' : 'کاری برای این روز تعریف نشده'}
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain -mb-1 select-none pointer-events-none drop-shadow-sm transition-transform duration-200"
                  draggable={false}
                />

                {isDragOverEmpty ? (
                  <p className="text-xs text-muted-foreground font-normal leading-relaxed max-w-[340px] mx-auto animate-in fade-in duration-150">
                    {isToday
                      ? 'اینجا رها کن تا کار برای امروز برنامه‌ریزی بشه'
                      : 'اینجا رها کن تا کار برای این روز برنامه‌ریزی بشه'}
                  </p>
                ) : (
                  <div className="flex flex-col items-center select-none">
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                      {isToday ? 'امروز کاری برای انجام دادن نیست' : 'کاری برای این روز تعریف نشده است'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 font-normal leading-relaxed mt-1 max-w-[340px] mx-auto">
                      <button
                        type="button"
                        onClick={() => onOpenAdd?.()}
                        className="underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground hover:text-foreground transition-colors cursor-pointer inline font-medium"
                      >
                        کاری اضافه کنید
                      </button>
                      <span>
                        {isToday
                          ? ' یا کارهای قبلی را درگ کنید روی امروز!'
                          : ' یا کارهای دیگر را درگ کنید روی این روز!'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resurfacing sections: smoothly placed under today's tasks */}
        <div className="w-full mt-6">
          <ResurfacingSection
            overdueTasks={overdueTasks}
            futureTasks={futureTasks}
            futureEvents={futureEvents}
            tagsMap={tagsMap}
            selectedDateKey={selectedDateKey}
            onMigrateToCurrentDate={(id) => onMigrateTask(id, selectedDateKey)}
            onStatusChanged={onStatusChanged}
            onExternalTouchStart={handleExternalTouchStart}
            onExternalTouchMove={handleExternalTouchMove}
            onExternalTouchEnd={handleExternalTouchEnd}
            externalDraggingTaskId={externalTouchDragInfo?.taskId ?? null}
            externalTouchDeltaY={externalTouchDeltaY}
          />
        </div>
      </div>
    </div>
  );
});
