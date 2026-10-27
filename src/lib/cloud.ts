import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy handle to the Supabase client.
 *
 * The app is offline-first: the first screen renders straight from IndexedDB
 * and the cloud is only a background reconciler. `@supabase/supabase-js` is a
 * ~220 KB chunk, so keeping it behind a dynamic import takes it out of the boot
 * graph entirely — it is fetched the first time something actually needs the
 * network (session restore, sync, realtime) and is shared by every consumer
 * through the module-level promise.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('./supabase').then((mod) => mod.supabase);
  }
  return clientPromise;
}

/** True once the client has already been pulled into memory. */
export function isCloudLoaded(): boolean {
  return clientPromise !== null;
}
