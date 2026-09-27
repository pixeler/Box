import { db } from '@/lib/db/dexie';
import type { Task, TaskFilter } from '@/types/models';
import type { TaskRepository } from '../interfaces';
import { getTodayJalaliKey, extractDateOnly } from '@/lib/jalali';
import { isTaskOccurringOnDate } from '@/lib/recurrence';
import { markIdAsDeleted } from '@/lib/storage';

export class DexieTaskRepository implements TaskRepository {
  async create(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id: (taskData as any).id || crypto.randomUUID(),
      created_at: (taskData as any).created_at || now,
      updated_at: (taskData as any).updated_at || now,
    };
    await db.tasks.add(task);
    return task;
  }

  async update(id: string, patch: Partial<Task>): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task with id ${id} not found`);
    }
    const updated: Task = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await db.tasks.put(updated);
    return updated;
  }

  async getById(id: string): Promise<Task | null> {
    const t = await db.tasks.get(id);
    return t || null;
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    let collection = db.tasks.toCollection();

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      collection = db.tasks.where('status').anyOf(statuses);
    }

    let items = await collection.toArray();

    // Never show dropped unless explicitly asked
    if (!filter?.status) {
      items = items.filter((item) => item.status !== 'dropped');
    }

    if (filter?.due_date) {
      const targetDate = extractDateOnly(filter.due_date);
      items = items.filter((item) => isTaskOccurringOnDate(item, targetDate));

      // For recurring tasks appearing on this date, reflect their completion status for THIS date
      items = items.map((item) => {
        if (item.recurrence_rule && item.recurrence_rule !== 'none') {
          const isDoneOnDate = (item.done_dates || []).includes(targetDate);
          return {
            ...item,
            status: isDoneOnDate ? 'done' : 'open',
          };
        }
        return item;
      });
    }

    if (filter?.tag_id) {
      items = items.filter((item) => item.tag_ids.includes(filter.tag_id!));
    }

    if (filter?.box_id !== undefined) {
      items = items.filter((item) => (item.box_id || null) === (filter.box_id || null));
    }

    if (filter?.search_query) {
      const q = filter.search_query.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    // Sort: open first, then by priority (descending 3 -> 1), then created_at
    return items.sort((a, b) => {
      if (a.status === 'open' && b.status === 'done') return -1;
      if (a.status === 'done' && b.status === 'open') return 1;
      const pA = a.priority || 0;
      const pB = b.priority || 0;
      if (pA !== pB) return pB - pA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async toggleDone(id: string, dateKey?: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);

    // Handle recurring task completion per date
    if (existing.recurrence_rule && existing.recurrence_rule !== 'none') {
      const targetDate = dateKey ? extractDateOnly(dateKey) : getTodayJalaliKey();
      const currentDones = existing.done_dates || [];
      const isAlreadyDone = currentDones.includes(targetDate);
      const nextDones = isAlreadyDone
        ? currentDones.filter((d) => d !== targetDate)
        : [...currentDones, targetDate];

      const updated = await this.update(id, {
        done_dates: nextDones,
      });

      return {
        ...updated,
        status: isAlreadyDone ? 'open' : 'done',
      };
    }

    const newStatus = existing.status === 'done' ? 'open' : 'done';

    // اگر تسک سنجاق شده تیک خورد، سنجاقش برداشته می‌شود و در تاریخ همان روز قرار می‌گیرد
    if (newStatus === 'done' && existing.pinned) {
      const todayKey = getTodayJalaliKey();
      const timeMatch = existing.due_date?.match(/\d{1,2}:\d{2}/);
      const newDueDate = timeMatch ? `${todayKey} ${timeMatch[0]}` : todayKey;
      return this.update(id, {
        status: 'done',
        pinned: false,
        due_date: newDueDate,
      });
    }

    return this.update(id, { status: newStatus });
  }

  async softDelete(id: string): Promise<void> {
    await this.update(id, { status: 'dropped' });
    markIdAsDeleted(id);
  }

  async skipDate(id: string, dateKey: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);
    const normDate = extractDateOnly(dateKey);
    const currentDeleted = existing.deleted_dates || [];
    if (!currentDeleted.includes(normDate)) {
      return this.update(id, {
        deleted_dates: [...currentDeleted, normDate],
      });
    }
    return existing;
  }

  async migrate(id: string, newDueDate: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);

    // Recurring tasks occur automatically on each date
    if (existing.recurrence_rule && existing.recurrence_rule !== 'none') {
      return existing;
    }

    // Move task to new due date directly without duplicating
    return this.update(id, { due_date: newDueDate });
  }

  async getOverdueOpen(beforeDate: string): Promise<Task[]> {
    const normBefore = extractDateOnly(beforeDate);
    const allOpen = await db.tasks.where('status').equals('open').toArray();
    return allOpen
      .filter((t): t is Task & { due_date: string } => {
        if (t.recurrence_rule && t.recurrence_rule !== 'none') return false;
        if (!t.due_date) return false;
        const taskDate = extractDateOnly(t.due_date);
        return taskDate !== '' && taskDate < normBefore;
      })
      .sort((a, b) => {
        const dateCmp = extractDateOnly(a.due_date).localeCompare(extractDateOnly(b.due_date));
        if (dateCmp !== 0) return dateCmp;
        return (b.priority || 0) - (a.priority || 0);
      });
  }

  async getFutureOpen(afterDate: string): Promise<Task[]> {
    const normAfter = extractDateOnly(afterDate);
    const allOpen = await db.tasks.where('status').equals('open').toArray();
    return allOpen
      .filter((t): t is Task & { due_date: string } => {
        if (t.recurrence_rule && t.recurrence_rule !== 'none') return false;
        if (!t.due_date) return false;
        const taskDate = extractDateOnly(t.due_date);
        return taskDate !== '' && taskDate > normAfter;
      })
      .sort((a, b) => extractDateOnly(a.due_date).localeCompare(extractDateOnly(b.due_date)));
  }

  async duplicate(id: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);
    return this.create({
      entry_id: null,
      title: `${existing.title} (کپی)`,
      description: existing.description,
      status: 'open',
      due_date: existing.due_date,
      due_time: existing.due_time,
      duration_minutes: existing.duration_minutes,
      priority: existing.priority,
      tag_ids: [...existing.tag_ids],
      recurrence_rule: existing.recurrence_rule,
      recurrence_start_date: existing.recurrence_start_date,
      recurrence_end_date: existing.recurrence_end_date,
    });
  }
}
