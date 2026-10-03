import { db } from '@/lib/db/dexie';
import type { Tag } from '@/types/models';
import type { TagRepository } from '../interfaces';

export class DexieTagRepository implements TagRepository {
  async getOrCreate(name: string, source: 'manual' | 'ai' = 'manual'): Promise<Tag> {
    const cleanName = name.trim().replace(/^#/, '');
    const existing = await db.tags.where('name').equalsIgnoreCase(cleanName).first();
    if (existing) {
      return existing;
    }
    const newTag: Tag = {
      id: crypto.randomUUID(),
      name: cleanName,
      source,
    };
    await db.tags.add(newTag);
    return newTag;
  }

  async listAll(): Promise<Tag[]> {
    return db.tags.toArray();
  }
}
