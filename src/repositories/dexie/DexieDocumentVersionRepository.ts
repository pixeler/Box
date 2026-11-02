import { db } from '@/lib/db/dexie';
import type { DocumentVersion } from '@/types/models';

/** 50 snapshots, but never prune anything younger than a week. */
const KEEP = 50;
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Autosave fires every few hundred milliseconds; history does not need that. */
export const VERSION_INTERVAL_MS = 2 * 60 * 1000;

export type NewDocumentVersion = Omit<DocumentVersion, 'id' | 'created_at'>;

/**
 * Append-only version history for any document (notes today, tasks next).
 * Restoring never deletes: it writes another version with cause `restore`.
 */
export class DexieDocumentVersionRepository {
  async list(
    entityType: DocumentVersion['entity_type'],
    entityId: string,
    limit = 100
  ): Promise<DocumentVersion[]> {
    const rows = await db.document_versions.where('entity_id').equals(entityId).toArray();
    return rows
      .filter((row) => row.entity_type === entityType)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  async latest(
    entityType: DocumentVersion['entity_type'],
    entityId: string
  ): Promise<DocumentVersion | null> {
    const [latest] = await this.list(entityType, entityId, 1);
    return latest ?? null;
  }

  /** Returns null when the content is unchanged or the last one is too recent. */
  async snapshot(
    input: NewDocumentVersion & { force?: boolean }
  ): Promise<DocumentVersion | null> {
    const { force = false, ...row } = input;
    const latest = await this.latest(row.entity_type, row.entity_id);

    const unchanged =
      latest &&
      latest.title === row.title &&
      latest.body === row.body &&
      (latest.body_json ?? '') === (row.body_json ?? '');
    if (unchanged) return null;

    if (!force && latest && Date.now() - new Date(latest.created_at).getTime() < VERSION_INTERVAL_MS) {
      return null;
    }

    const version: DocumentVersion = {
      ...row,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    await db.document_versions.add(version);
    await this.prune(row.entity_type, row.entity_id);
    return version;
  }

  async prune(entityType: DocumentVersion['entity_type'], entityId: string): Promise<void> {
    const rows = await this.list(entityType, entityId, 1000);
    const newest = new Set(rows.slice(0, KEEP).map((row) => row.id));
    const cutoff = Date.now() - MIN_AGE_MS;
    const stale = rows
      .filter((row) => !newest.has(row.id) && new Date(row.created_at).getTime() < cutoff)
      .map((row) => row.id);
    if (stale.length) await db.document_versions.bulkDelete(stale);
  }
}
