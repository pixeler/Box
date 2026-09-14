import { db } from '@/lib/db/dexie';
import type { Box, Task, Note } from '@/types/models';
import type { BoxRepository } from '../interfaces';

export class DexieBoxRepository implements BoxRepository {
  async create(boxData: Omit<Box, 'id' | 'created_at' | 'updated_at'>): Promise<Box> {
    const now = new Date().toISOString();
    const box: Box = {
      ...boxData,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    await db.boxes.add(box);
    return box;
  }

  async update(id: string, patch: Partial<Box>): Promise<Box> {
    const existing = await db.boxes.get(id);
    if (!existing) {
      throw new Error(`Box with id ${id} not found`);
    }
    const updated: Box = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await db.boxes.put(updated);
    return updated;
  }

  async getById(id: string): Promise<Box | null> {
    const b = await db.boxes.get(id);
    return b || null;
  }

  async list(): Promise<Box[]> {
    const all = await db.boxes.toArray();
    return all.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  async delete(id: string): Promise<void> {
    // 1. Delete the box record
    await db.boxes.delete(id);

    // 2. Safely unassign all tasks in this box without deleting them
    const tasksInBox = await db.tasks.filter((t) => t.box_id === id).toArray();
    for (const t of tasksInBox) {
      await db.tasks.update(t.id, { box_id: null });
    }

    // 3. Safely unassign all notes in this box without deleting them
    const notesInBox = await db.notes.filter((n) => n.box_id === id).toArray();
    for (const n of notesInBox) {
      await db.notes.update(n.id, { box_id: null });
    }
  }

  async getItems(boxId: string): Promise<{ tasks: Task[]; notes: Note[] }> {
    const [tasks, notes] = await Promise.all([
      db.tasks.filter((t) => t.box_id === boxId && t.status !== 'dropped').toArray(),
      db.notes.filter((n) => n.box_id === boxId).toArray(),
    ]);

    // Sort newest first by default
    tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { tasks, notes };
  }
}
