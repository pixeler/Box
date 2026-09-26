import { supabase } from './supabase';
import { db } from './db/dexie';
import { taskRepo, noteRepo, eventRepo, tagRepo, boxRepo } from '@/repositories';
import { toPersianDigits, formatJalaliKey, getJalaliDate } from './jalali';
import { isIdDeleted, markIdAsDeleted } from './storage';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'up_to_date' | 'table_missing' | 'error';

type SyncListener = (state: SyncState, message?: string) => void;

export const SUPABASE_SYNC_SQL = `-- 1. ایجاد جدول ذخیره ابری اطلاعات کاربری
create table if not exists public.user_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. فعال‌سازی امنیت داده‌ها (RLS)
alter table public.user_sync enable row level security;

-- 3. دسترسی فقط برای صاحب حساب
create policy "Allow users to read their own sync data"
  on public.user_sync for select
  using (auth.uid() = user_id);

create policy "Allow users to insert/update their own sync data"
  on public.user_sync for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`;

class SyncManager {
  private state: SyncState = 'idle';
  private message: string = '';
  private listeners: Set<SyncListener> = new Set();
  private autoClearTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isApplyingRemote: boolean = false;
  private isSyncRunning: boolean = false;
  private hasPendingChanges: boolean = false;
  private isInitialized: boolean = false;
  private lastResumeSyncTime: number = 0;

  constructor() {
    // Initial setup deferred to init()
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Hook to database mutations across all tables
    const onLocalMutation = () => {
      if (this.isApplyingRemote) return;
      this.hasPendingChanges = true;
      // Debounce: wait 2.5s of idle time after user actions before syncing
      this.requestDebouncedSync(2500);
    };

    const tables = [db.tasks, db.notes, db.events, db.tags, db.boxes];
    tables.forEach((table) => {
      table.hook('creating', onLocalMutation);
      table.hook('updating', onLocalMutation);
      table.hook('deleting', onLocalMutation);
    });

    // 2. Reconnection listener: push changes when back online
    window.addEventListener('online', () => {
      if (this.hasPendingChanges) {
        this.performSync({ background: true });
      }
    });

    // 3. Tab visibility / App resume: check remote updates on app focus (throttled to max once every 4 mins)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - this.lastResumeSyncTime > 4 * 60 * 1000) {
          this.lastResumeSyncTime = now;
          this.performSync({ background: true, silentIfUpToDate: true });
        }
      }
    });
  }

  public requestDebouncedSync(delayMs = 2500) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.hasPendingChanges = true;
        return;
      }
      await this.performSync({ background: true });
    }, delayMs);
  }

  public getState() {
    return { state: this.state, message: this.message };
  }

  public getLastSyncISO(): string | null {
    return localStorage.getItem('second_brain_last_sync');
  }

  public getFormattedLastSync(): string {
    const raw = this.getLastSyncISO();
    if (!raw) return 'هنوز همگام‌سازی انجام نشده است';
    try {
      const d = new Date(raw);
      const diffMs = Date.now() - d.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) return 'همین چند لحظه پیش';
      if (diffMinutes < 60) return `${toPersianDigits(diffMinutes)} دقیقه پیش`;
      const hours = Math.floor(diffMinutes / 60);
      if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;

      const jalali = formatJalaliKey(getJalaliDate(d));
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `${jalali} ساعت ${toPersianDigits(timeStr)}`;
    } catch {
      return 'اخیراً';
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.state, this.message);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setState(state: SyncState, message: string = '') {
    this.state = state;
    this.message = message;
    this.listeners.forEach((l) => l(state, message));

    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer);
      this.autoClearTimer = null;
    }

    if (state === 'synced' || state === 'up_to_date') {
      this.autoClearTimer = setTimeout(() => {
        this.state = 'idle';
        this.message = '';
        this.listeners.forEach((l) => l(this.state, this.message));
      }, 5000);
    }
  }

  /**
   * Syncs local IndexedDB with Supabase user_sync table
   */
  public async performSync(options?: { background?: boolean; silentIfUpToDate?: boolean }): Promise<boolean> {
    if (this.isSyncRunning) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (!options?.background) {
        this.setState('idle', 'ابتدا وارد حساب کاربری شوید');
      }
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.hasPendingChanges = true;
      if (!options?.background) {
        this.setState('error', 'اتصال اینترنت برقرار نیست');
      }
      return false;
    }

    this.isSyncRunning = true;
    this.setState('syncing', 'در حال ارتباط با سرور و بررسی اطلاعات...');

    try {
      // 1. Gather local tasks and notes for comparison
      const [tasks, notes] = await Promise.all([
        taskRepo.list(),
        noteRepo.list(),
      ]);

      const nowISO = new Date().toISOString();

      // 2. Fetch remote row from Supabase
      const { data: remoteRow, error: fetchError } = await supabase
        .from('user_sync')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        if (
          fetchError.code === 'PGRST205' ||
          fetchError.message?.toLowerCase().includes('not find the table') ||
          fetchError.message?.toLowerCase().includes('schema cache')
        ) {
          console.warn('Supabase user_sync table not found. SQL script needed.');
          this.setState('table_missing', 'جدول user_sync در پایگاه داده سوپابیس یافت نشد');
          return false;
        }
        console.error('Fetch remote error:', fetchError);
        this.setState('error', fetchError.message || 'خطا در ارتباط با سرور سوپابیس');
        return false;
      }

      // 3. Check whether local data is identical to remote data
      let hasLocalChanges = true;
      if (remoteRow?.data) {
        const remoteData = remoteRow.data;

        // Merge any remote items not present locally (avoid re-triggering mutation hooks)
        this.isApplyingRemote = true;
        let mergedAny = false;
        try {
          if (Array.isArray(remoteData.tasks)) {
            for (const rt of remoteData.tasks) {
              if (isIdDeleted(rt.id) || rt.status === 'dropped') {
                continue; // Do NOT resurrect deleted tasks
              }
              const exists = await taskRepo.getById(rt.id);
              if (!exists) {
                await taskRepo.create(rt);
                mergedAny = true;
              } else if (exists.status === 'dropped') {
                markIdAsDeleted(rt.id);
              }
            }
          }
          if (Array.isArray(remoteData.notes)) {
            for (const rn of remoteData.notes) {
              if (isIdDeleted(rn.id)) {
                continue; // Do NOT resurrect deleted notes
              }
              const exists = await noteRepo.getById(rn.id);
              if (!exists) {
                await noteRepo.create(rn);
                mergedAny = true;
              }
            }
          }
          if (Array.isArray(remoteData.events)) {
            for (const re of remoteData.events) {
              if (isIdDeleted(re.id)) {
                continue;
              }
              const exists = await eventRepo.getById(re.id);
              if (!exists) {
                await eventRepo.create(re);
                mergedAny = true;
              }
            }
          }
        } finally {
          this.isApplyingRemote = false;
        }

        // Compare local vs remote content signature
        const localTasksKeys = tasks.map((t) => `${t.id}:${t.status}:${t.updated_at}`).sort().join('|');
        const remoteTasksKeys = (remoteData.tasks || []).map((t: any) => `${t.id}:${t.status}:${t.updated_at}`).sort().join('|');

        const localNotesKeys = notes.map((n) => `${n.id}:${n.updated_at}`).sort().join('|');
        const remoteNotesKeys = (remoteData.notes || []).map((n: any) => `${n.id}:${n.updated_at}`).sort().join('|');

        if (!mergedAny && localTasksKeys === remoteTasksKeys && localNotesKeys === remoteNotesKeys && tasks.length > 0) {
          hasLocalChanges = false;
        }
      }

      if (!hasLocalChanges && remoteRow?.data) {
        // Data is already identical and up to date
        this.hasPendingChanges = false;
        localStorage.setItem('second_brain_last_sync', nowISO);
        if (options?.silentIfUpToDate) {
          this.setState('idle', '');
        } else {
          this.setState('up_to_date', 'داده‌ها به روز بودند و نیازی به همگام‌سازی مجدد نیست');
        }
        return true;
      }

      // Re-read current local state excluding any deleted items before uploading
      const [finalTasks, finalNotes, finalEvents, finalTags, finalBoxes] = await Promise.all([
        taskRepo.list(),
        noteRepo.list(),
        eventRepo.list(),
        tagRepo.listAll(),
        boxRepo.list(),
      ]);

      const cleanPayload = {
        tasks: finalTasks.filter((t) => !isIdDeleted(t.id) && t.status !== 'dropped'),
        notes: finalNotes.filter((n) => !isIdDeleted(n.id)),
        events: finalEvents.filter((e) => !isIdDeleted(e.id)),
        tags: finalTags,
        boxes: finalBoxes,
        synced_at: nowISO,
      };

      // 4. Upsert local payload to Supabase
      const { error: upsertError } = await supabase
        .from('user_sync')
        .upsert(
          {
            user_id: user.id,
            data: cleanPayload,
            updated_at: nowISO,
          },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        console.error('Sync upsert error:', upsertError);
        this.setState('error', upsertError.message || 'خطا در بارگذاری داده‌ها به سوپابیس');
        return false;
      }

      this.hasPendingChanges = false;
      localStorage.setItem('second_brain_last_sync', nowISO);
      this.setState(
        'synced',
        `همگام‌سازی موفق (${toPersianDigits(tasks.length)} تسک و ${toPersianDigits(notes.length)} یادداشت ذخیره شد)`
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای نامشخص در همگام‌سازی';
      console.error('Sync failed:', err);
      this.setState('error', msg);
      return false;
    } finally {
      this.isSyncRunning = false;
    }
  }
}

export const syncManager = new SyncManager();
