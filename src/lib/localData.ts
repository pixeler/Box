import { db } from './db/dexie';

/**
 * Whether this build talks to a backend at all. Mirrors `isCloudSyncConfigured`
 * without importing the Supabase chunk on the boot path.
 */
export const IS_CLOUD_BUILD = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

/** Which account the database on this device belongs to. */
export const LOCAL_OWNER_KEY = 'box:local-owner';

const DELETED_IDS_KEY = 'second_brain_deleted_ids';
const LAST_SYNC_KEY = 'second_brain_last_sync';

export function getLocalOwnerId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LOCAL_OWNER_KEY);
  } catch {
    return null;
  }
}

function setLocalOwnerId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(LOCAL_OWNER_KEY, userId);
    else localStorage.removeItem(LOCAL_OWNER_KEY);
  } catch {}
}

/**
 * Removes every trace of a person's content from this device. Tombstones and
 * the last-sync stamp go with it, or the next account would inherit the
 * previous one's deletions (and never download them again).
 */
export async function clearLocalUserData(): Promise<void> {
  await Promise.all([
    db.entries.clear(),
    db.tasks.clear(),
    db.events.clear(),
    db.notes.clear(),
    db.habits.clear(),
    db.tags.clear(),
    db.relations.clear(),
    db.boxes.clear(),
    db.focus_sessions.clear(),
    db.document_versions.clear(),
  ]);
  try {
    localStorage.removeItem(DELETED_IDS_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  } catch {}
  setLocalOwnerId(null);
}

/**
 * The local database belongs to exactly one account.
 *
 * - No owner recorded yet: this is an upgraded install or a guest who just
 *   signed in, so the existing content is adopted (nothing is lost).
 * - A different owner: the content must not be shown to the new account, so it
 *   is wiped first and the database is handed over clean.
 */
export async function claimLocalDataForUser(userId: string): Promise<'kept' | 'wiped'> {
  const owner = getLocalOwnerId();
  if (owner === userId) return 'kept';

  if (!owner) {
    setLocalOwnerId(userId);
    return 'kept';
  }

  await clearLocalUserData();
  setLocalOwnerId(userId);
  return 'wiped';
}
