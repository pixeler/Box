import { createClient } from '@supabase/supabase-js';

/**
 * Cloud sync is optional. A self-hosted build supplies its own Supabase
 * project through `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; without them
 * the app runs fully local and the sync/sign-in surfaces stay disabled.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isCloudSyncConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isCloudSyncConfigured) {
  console.info('Supabase is not configured: running in local-only mode.');
}

const SUPABASE_FETCH_TIMEOUT_MS = 15000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  if (init?.signal) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Network request timed out')), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const supabase = createClient(
  // Placeholder values keep the client constructible in local-only mode; every
  // request is guarded by `isCloudSyncConfigured` before it is attempted.
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'local-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  }
);
