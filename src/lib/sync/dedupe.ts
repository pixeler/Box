import { db } from '../db/dexie';
import { extractDateOnly } from '../jalali';
import { markMultipleIdsAsDeleted } from '../storage';
import type { Task, Note, EventItem, Box } from '@/types/models';


/**
 * Deduplicate tasks:
 * - Drops invalid tasks and tasks with empty titles.
 * - Merges demo tasks by title so different copies created across devices/seed always reconcile.
 * - Merges regular tasks by title + recurrence + due_date.
 * - Merges all progress (done_dates, deleted_dates, tags, highest priority, status).
 */
export function deduplicateTasks(taskList: Task[]): { uniqueTasks: Task[]; removedIds: string[] } {
  const removedIds: string[] = [];
  const taskMap = new Map<string, Task>();

  for (const t of taskList) {
    if (!t || !t.id || t.status === 'dropped') {
      if (t?.id) removedIds.push(t.id);
      continue;
    }

    const cleanTitle = (t.title || '').trim().toLowerCase();
    if (!cleanTitle) {
      removedIds.push(t.id);
      continue;
    }

    const datePart = extractDateOnly(t.due_date);
    const recurrence = (t.recurrence_rule || 'none').trim();

    // Demo tasks seeded on initial app launch
    const isDemo =
      cleanTitle.includes('تکمیل دیزاین تسک') ||
      cleanTitle.includes('بررسی فیدبک') ||
      cleanTitle.includes('آماده‌سازی خروجی');

    const key = isDemo
      ? `demo_${cleanTitle}`
      : `${cleanTitle}|${recurrence}|${recurrence !== 'none' ? '' : datePart}`;

    if (taskMap.has(key)) {
      const existing = taskMap.get(key)!;
      removedIds.push(t.id);

      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const tTime = new Date(t.updated_at || t.created_at || 0).getTime();

      const mergedDoneDates = Array.from(
        new Set([
          ...(existing.done_dates || []).map(extractDateOnly),
          ...(t.done_dates || []).map(extractDateOnly),
        ])
      ).filter(Boolean);
      const mergedDeletedDates = Array.from(
        new Set([
          ...(existing.deleted_dates || []).map(extractDateOnly),
          ...(t.deleted_dates || []).map(extractDateOnly),
        ])
      ).filter(Boolean);
      const mergedTagIds = Array.from(
        new Set([...(existing.tag_ids || []), ...(t.tag_ids || [])])
      );

      const isRecurring =
        (existing.recurrence_rule && existing.recurrence_rule !== 'none') ||
        (t.recurrence_rule && t.recurrence_rule !== 'none');

      const newerTask = existingTime >= tTime ? existing : t;
      let finalDoneDates: string[] = [];
      if (isRecurring) {
        finalDoneDates = mergedDoneDates;
      } else if (newerTask.status === 'done') {
        const taskDate = extractDateOnly(newerTask.due_date);
        finalDoneDates = taskDate ? [taskDate] : mergedDoneDates;
      } else {
        finalDoneDates = [];
      }

      const mergedTask: Task = {
        ...existing,
        ...newerTask,
        status: isRecurring ? 'open' : newerTask.status,
        done_dates: finalDoneDates,
        deleted_dates: mergedDeletedDates,
        tag_ids: mergedTagIds,
        description: existing.description?.trim() ? existing.description : (t.description || ''),
        priority: (Math.max(existing.priority || 0, t.priority || 0) || undefined) as 1 | 2 | 3 | undefined,
        box_id: existing.box_id || t.box_id || null,
        time_of_day: existing.time_of_day || t.time_of_day,
        due_date: existing.due_date || t.due_date,
        due_time: existing.due_time || t.due_time,
        duration_minutes: existing.duration_minutes || t.duration_minutes,
        pinned: existing.pinned || t.pinned,
        recurrence_rule:
          existing.recurrence_rule && existing.recurrence_rule !== 'none'
            ? existing.recurrence_rule
            : t.recurrence_rule,
        recurrence_start_date: existing.recurrence_start_date || t.recurrence_start_date,
        recurrence_end_date: existing.recurrence_end_date || t.recurrence_end_date,
        updated_at: new Date(Math.max(existingTime, tTime)).toISOString(),
      };

      taskMap.set(key, mergedTask);
    } else {
      const normDones = (t.done_dates || []).map(extractDateOnly).filter(Boolean);
      const normDeleted = (t.deleted_dates || []).map(extractDateOnly).filter(Boolean);
      const taskDate = extractDateOnly(t.due_date);
      if (t.status === 'done' && taskDate && !normDones.includes(taskDate)) {
        normDones.push(taskDate);
      }
      taskMap.set(key, {
        ...t,
        done_dates: normDones,
        deleted_dates: normDeleted,
      });
    }
  }

  return {
    uniqueTasks: Array.from(taskMap.values()),
    removedIds,
  };
}

export function deduplicateNotes(noteList: Note[]): { uniqueNotes: Note[]; removedIds: string[] } {
  const removedIds: string[] = [];
  const noteMap = new Map<string, Note>();

  for (const n of noteList) {
    if (!n || !n.id) continue;
    const cleanTitle = (n.title || '').trim().toLowerCase();
    const cleanBody = (n.body || '').trim().toLowerCase();
    const key = cleanTitle || cleanBody.slice(0, 100);

    if (!key) {
      noteMap.set(n.id, n);
      continue;
    }

    if (noteMap.has(key)) {
      const existing = noteMap.get(key)!;
      removedIds.push(n.id);
      const nTime = new Date(n.updated_at || n.created_at || 0).getTime();
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      if (nTime > existingTime) {
        noteMap.set(key, { ...existing, ...n, id: existing.id });
      }
    } else {
      noteMap.set(key, n);
    }
  }

  return {
    uniqueNotes: Array.from(noteMap.values()),
    removedIds,
  };
}

export function deduplicateEvents(eventList: EventItem[]): { uniqueEvents: EventItem[]; removedIds: string[] } {
  const removedIds: string[] = [];
  const eventMap = new Map<string, EventItem>();

  for (const e of eventList) {
    if (!e || !e.id || e.title?.includes('مصرف دارو')) {
      if (e?.id) removedIds.push(e.id);
      continue;
    }
    const cleanTitle = (e.title || '').trim().toLowerCase();
    const datePart = extractDateOnly(e.start_at);
    const key = `${cleanTitle}|${datePart}`;

    if (eventMap.has(key)) {
      removedIds.push(e.id);
    } else {
      eventMap.set(key, e);
    }
  }

  return {
    uniqueEvents: Array.from(eventMap.values()),
    removedIds,
  };
}

export function deduplicateBoxes(boxList: Box[]): { uniqueBoxes: Box[]; boxIdRemap: Map<string, string>; removedIds: string[] } {
  const removedIds: string[] = [];
  const boxIdRemap = new Map<string, string>();
  const boxMap = new Map<string, Box>();

  for (const b of boxList) {
    if (!b || !b.id) continue;
    const cleanTitle = (b.title || '').trim().toLowerCase();
    if (!cleanTitle) continue;

    if (boxMap.has(cleanTitle)) {
      const existing = boxMap.get(cleanTitle)!;
      boxIdRemap.set(b.id, existing.id);
      removedIds.push(b.id);
    } else {
      boxMap.set(cleanTitle, b);
    }
  }

  return {
    uniqueBoxes: Array.from(boxMap.values()),
    boxIdRemap,
    removedIds,
  };
}

export async function deduplicateLocalDatabase(): Promise<{
  tasksCleaned: number;
  notesCleaned: number;
  eventsCleaned: number;
  boxesCleaned: number;
}> {
  const [allTasks, allNotes, allEvents, allBoxes] = await Promise.all([
    db.tasks.toArray(),
    db.notes.toArray(),
    db.events.toArray(),
    db.boxes.toArray(),
  ]);

  const { uniqueTasks, removedIds: removedTaskIds } = deduplicateTasks(allTasks);
  const { uniqueNotes, removedIds: removedNoteIds } = deduplicateNotes(allNotes);
  const { uniqueEvents, removedIds: removedEventIds } = deduplicateEvents(allEvents);
  const { uniqueBoxes, boxIdRemap, removedIds: removedBoxIds } = deduplicateBoxes(allBoxes);

  const allRemovedIds = [
    ...removedTaskIds,
    ...removedNoteIds,
    ...removedEventIds,
    ...removedBoxIds,
  ];

  if (allRemovedIds.length > 0) {
    markMultipleIdsAsDeleted(allRemovedIds);

    for (const id of removedTaskIds) {
      await db.tasks.delete(id);
    }
    for (const t of uniqueTasks) {
      await db.tasks.put(t);
    }

    for (const id of removedNoteIds) {
      await db.notes.delete(id);
    }
    for (const n of uniqueNotes) {
      await db.notes.put(n);
    }

    for (const id of removedEventIds) {
      await db.events.delete(id);
    }
    for (const e of uniqueEvents) {
      await db.events.put(e);
    }

    for (const id of removedBoxIds) {
      await db.boxes.delete(id);
    }
    for (const b of uniqueBoxes) {
      await db.boxes.put(b);
    }

    if (boxIdRemap.size > 0) {
      const currentTasks = await db.tasks.toArray();
      for (const t of currentTasks) {
        if (t.box_id && boxIdRemap.has(t.box_id)) {
          await db.tasks.update(t.id, { box_id: boxIdRemap.get(t.box_id)! });
        }
      }
      const currentNotes = await db.notes.toArray();
      for (const n of currentNotes) {
        if (n.box_id && boxIdRemap.has(n.box_id)) {
          await db.notes.update(n.id, { box_id: boxIdRemap.get(n.box_id)! });
        }
      }
    }
  }

  // Healing pass for all tasks: ensure done_dates and status consistency
  for (const t of uniqueTasks) {
    let changed = false;
    const normDones = (t.done_dates || []).map(extractDateOnly).filter(Boolean);
    const isRecurring = Boolean(t.recurrence_rule && t.recurrence_rule !== 'none');
    const taskDate = extractDateOnly(t.due_date);

    if (t.status === 'done' && taskDate && !normDones.includes(taskDate)) {
      normDones.push(taskDate);
      changed = true;
    }

    if (!isRecurring && t.status === 'open' && normDones.length > 0) {
      normDones.length = 0;
      changed = true;
    }

    if (changed || JSON.stringify(t.done_dates || []) !== JSON.stringify(normDones)) {
      t.done_dates = Array.from(new Set(normDones));
      await db.tasks.put(t);
    }
  }

  return {
    tasksCleaned: removedTaskIds.length,
    notesCleaned: removedNoteIds.length,
    eventsCleaned: removedEventIds.length,
    boxesCleaned: removedBoxIds.length,
  };
}
