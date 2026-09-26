import { db } from '@/lib/db/dexie';
import type { FocusSession } from '@/types/models';

export class DexieFocusSessionRepository {
  async create(sessionData: Omit<FocusSession, 'id' | 'created_at'>): Promise<FocusSession> {
    const now = new Date().toISOString();
    const session: FocusSession = {
      ...sessionData,
      id: crypto.randomUUID(),
      created_at: now,
    };
    await db.focus_sessions.add(session);
    return session;
  }

  async list(): Promise<FocusSession[]> {
    return await db.focus_sessions.orderBy('created_at').reverse().toArray();
  }

  async listByDate(dateKey: string): Promise<FocusSession[]> {
    return await db.focus_sessions.where('date_key').equals(dateKey).toArray();
  }

  async delete(id: string): Promise<void> {
    await db.focus_sessions.delete(id);
  }
}
