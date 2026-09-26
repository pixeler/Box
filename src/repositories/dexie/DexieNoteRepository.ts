import { db } from '@/lib/db/dexie';
import type { Note } from '@/types/models';
import type { NoteRepository } from '../interfaces';
import { markIdAsDeleted } from '@/lib/storage';

export class DexieNoteRepository implements NoteRepository {
  async create(noteData: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = {
      ...noteData,
      id: (noteData as any).id || crypto.randomUUID(),
      created_at: (noteData as any).created_at || now,
      updated_at: (noteData as any).updated_at || now,
    };
    await db.notes.add(note);
    return note;
  }

  async update(id: string, patch: Partial<Note>): Promise<Note> {
    const existing = await db.notes.get(id);
    if (!existing) throw new Error(`Note with id ${id} not found`);
    const updated: Note = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await db.notes.put(updated);
    return updated;
  }

  async getById(id: string): Promise<Note | null> {
    const n = await db.notes.get(id);
    return n || null;
  }

  async list(filter?: { type?: 'note' | 'idea'; tag_id?: string; box_id?: string | null }): Promise<Note[]> {
    let items = await db.notes.orderBy('created_at').reverse().toArray();
    if (filter?.type) {
      items = items.filter((n) => n.type === filter.type);
    }
    if (filter?.tag_id) {
      items = items.filter((n) => n.tag_ids.includes(filter.tag_id!));
    }
    if (filter?.box_id !== undefined) {
      items = items.filter((n) => (n.box_id || null) === (filter.box_id || null));
    }
    return items;
  }


  async softDelete(id: string): Promise<void> {
    await db.notes.delete(id);
    markIdAsDeleted(id);
  }

  async duplicate(id: string): Promise<Note> {
    const existing = await db.notes.get(id);
    if (!existing) throw new Error(`Note with id ${id} not found`);
    return this.create({
      entry_id: null,
      type: existing.type,
      title: `${existing.title} (کپی)`,
      body: existing.body,
      description: existing.description,
      tag_ids: [...existing.tag_ids],
      pinned: existing.pinned,
    });
  }
}
