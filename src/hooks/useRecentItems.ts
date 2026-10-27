import { useCallback, useEffect, useState } from 'react';
import type { Note, Task } from '@/types/models';
import { noteRepo, taskRepo } from '@/repositories';
import { syncManager } from '@/lib/sync';
import { toPersianDigits } from '@/lib/jalali';

export type RecentItem =
  | {
      id: string;
      type: 'note';
      title: string;
      timestamp: number;
      createdAt: number;
      note: Note;
    }
  | {
      id: string;
      type: 'task';
      title: string;
      timestamp: number;
      createdAt: number;
      task: Task;
    };

function toTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function relativeTime(timestamp: number): string {
  if (!timestamp) return '';

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${toPersianDigits(days)} روز پیش`;

  return new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

/**
 * A small, cached recent list for the sidebar. It reads notes and tasks
 * together, sorts by last edit and refreshes whenever background sync reports
 * a data change.
 */
export function useRecentItems(limit = 7) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [pinnedItems, setPinnedItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [notes, tasks] = await Promise.all([noteRepo.list(), taskRepo.list()]);

      const recentNotes: RecentItem[] = notes.map((note) => ({
        id: note.id,
        type: 'note',
        title: note.title?.trim() || 'بدون عنوان',
        timestamp: toTime(note.updated_at || note.created_at),
        createdAt: toTime(note.created_at),
        note,
      }));

      const recentTasks: RecentItem[] = tasks
        .filter((task) => task.status !== 'dropped')
        .map((task) => ({
          id: task.id,
          type: 'task',
          title: task.title?.trim() || 'بدون عنوان',
          timestamp: toTime(task.updated_at || task.created_at),
          createdAt: toTime(task.created_at),
          task,
        }));

      const allItems = [...recentNotes, ...recentTasks].sort(
        (a, b) => b.timestamp - a.timestamp
      );
      const pinned = allItems.filter((item) =>
        item.type === 'note' ? Boolean(item.note.pinned) : Boolean(item.task.pinned)
      );
      const pinnedKeys = new Set(pinned.map((item) => `${item.type}-${item.id}`));

      setPinnedItems(pinned.slice(0, limit));
      setItems(
        allItems
          .filter((item) => !pinnedKeys.has(`${item.type}-${item.id}`))
          .slice(0, limit)
      );
    } catch (error) {
      console.error('Failed to load recent items:', error);
      setItems([]);
      setPinnedItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    return syncManager.onDataChange(load);
  }, [load]);

  return { items, pinnedItems, isLoading, relativeTime, refresh: load };
}
