import { db } from '@/lib/db/dexie';
import type { Entry } from '@/types/models';
import type { EntryRepository } from '../interfaces';

export class DexieEntryRepository implements EntryRepository {
  async create(entryData: Omit<Entry, 'id' | 'created_at'>): Promise<Entry> {
    const entry: Entry = {
      ...entryData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    await db.entries.add(entry);
    return entry;
  }

  async getById(id: string): Promise<Entry | null> {
    const e = await db.entries.get(id);
    return e || null;
  }

  async listAll(): Promise<Entry[]> {
    return db.entries.orderBy('created_at').reverse().toArray();
  }
}
