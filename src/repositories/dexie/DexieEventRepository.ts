import { db } from '@/lib/db/dexie';
import type { EventItem } from '@/types/models';
import type { EventRepository } from '../interfaces';

export class DexieEventRepository implements EventRepository {
  async create(eventData: Omit<EventItem, 'id' | 'created_at' | 'updated_at'>): Promise<EventItem> {
    const now = new Date().toISOString();
    const event: EventItem = {
      ...eventData,
      id: (eventData as any).id || crypto.randomUUID(),
      created_at: (eventData as any).created_at || now,
      updated_at: (eventData as any).updated_at || now,
    };
    await db.events.add(event);
    return event;
  }

  async update(id: string, patch: Partial<EventItem>): Promise<EventItem> {
    const existing = await db.events.get(id);
    if (!existing) throw new Error(`Event with id ${id} not found`);
    const updated: EventItem = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await db.events.put(updated);
    return updated;
  }

  async getById(id: string): Promise<EventItem | null> {
    const ev = await db.events.get(id);
    return ev || null;
  }

  async list(filter?: { dateStr?: string }): Promise<EventItem[]> {
    let items = await db.events.orderBy('created_at').reverse().toArray();
    if (filter?.dateStr) {
      // Items that match start_at starting with dateStr or recurrence
      items = items.filter((ev) => {
        if (ev.recurrence_rule?.includes('هر روز') || ev.recurrence_rule?.includes('هرروز')) return true;
        return ev.start_at.includes(filter.dateStr!);
      });
    }
    return items;
  }
}
