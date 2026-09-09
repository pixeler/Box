import { db } from '@/lib/db/dexie';
import type { Task, TaskFilter } from '@/types/models';
import type { TaskRepository } from '../interfaces';

export class DexieTaskRepository implements TaskRepository {
  async create(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
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
      items = items.filter((item) => item.due_date === filter.due_date);
    }

    if (filter?.tag_id) {
      items = items.filter((item) => item.tag_ids.includes(filter.tag_id!));
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

  async toggleDone(id: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);
    const newStatus = existing.status === 'done' ? 'open' : 'done';
    return this.update(id, { status: newStatus });
  }

  async softDelete(id: string): Promise<void> {
    await this.update(id, { status: 'dropped' });
  }

  async migrate(id: string, newDueDate: string): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task with id ${id} not found`);

    // Mark current as migrated
    await this.update(id, { status: 'migrated' });

    // Create new task linked to original
    return this.create({
      entry_id: existing.entry_id,
      title: existing.title,
      description: existing.description,
      status: 'open',
      due_date: newDueDate,
      priority: existing.priority,
      tag_ids: existing.tag_ids,
      recurrence_rule: existing.recurrence_rule,
      migrated_from_id: existing.id,
    });
  }

  async getOverdueOpen(beforeDate: string): Promise<Task[]> {
    const allOpen = await db.tasks.where('status').equals('open').toArray();
    return allOpen
      .filter((t): t is Task & { due_date: string } => !!t.due_date && t.due_date < beforeDate)
      .sort((a, b) => {
        const dateCmp = a.due_date.localeCompare(b.due_date);
        if (dateCmp !== 0) return dateCmp;
        return (b.priority || 0) - (a.priority || 0);
      });
  }

  async getFutureOpen(afterDate: string): Promise<Task[]> {
    const allOpen = await db.tasks.where('status').equals('open').toArray();
    return allOpen
      .filter((t): t is Task & { due_date: string } => !!t.due_date && t.due_date > afterDate)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
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
      priority: existing.priority,
      tag_ids: [...existing.tag_ids],
      recurrence_rule: existing.recurrence_rule,
    });
  }
}
