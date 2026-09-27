import { supabase } from './supabase';
import { db } from './db/dexie';
import { toPersianDigits, formatJalaliKey, getJalaliDate } from './jalali';
import { markIdAsDeleted, markMultipleIdsAsDeleted, getDeletedIds } from './storage';
import type { Task, Note, EventItem, Tag, Box } from '@/types/models';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'up_to_date' | 'table_missing' | 'error';

type SyncListener = (state: SyncState, message?: string) => void;
type DataChangeListener = () => void;

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
  private dataChangeListeners: Set<DataChangeListener> = new Set();
  private autoClearTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isApplyingRemote: boolean = false;
  private isSyncRunning: boolean = false;
  private hasPendingChanges: boolean = false;
  private isInitialized: boolean = false;
  private lastResumeSyncTime: number = 0;
  private realtimeChannel: any = null;
  private currentUserId: string | null = null;

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
      // Debounce: wait 1.2s of idle time after user actions before syncing to cloud
      this.requestDebouncedSync(1200);
    };

    const tables = [db.tasks, db.notes, db.events, db.tags, db.boxes];
    tables.forEach((table) => {
      table.hook('creating', onLocalMutation);
      table.hook('updating', onLocalMutation);
      table.hook('deleting', (primKey) => {
        if (!this.isApplyingRemote && typeof primKey === 'string') {
          markIdAsDeleted(primKey);
        }
        onLocalMutation();
      });
    });

    // 2. Reconnection listener: push changes when back online
    window.addEventListener('online', () => {
      if (this.hasPendingChanges) {
        this.performSync({ background: true });
      }
    });

    // 3. Tab visibility / App resume: check remote updates on app focus (throttled to 8 seconds)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - this.lastResumeSyncTime > 8 * 1000) {
          this.lastResumeSyncTime = now;
          this.performSync({ background: true, silentIfUpToDate: true });
        }
      } else if (document.visibilityState === 'hidden') {
        // If app goes to background with pending mutations, flush immediately
        if (this.hasPendingChanges) {
          this.performSync({ background: true });
        }
      }
    });

    // 4. Before unload: flush pending changes
    window.addEventListener('beforeunload', () => {
      if (this.hasPendingChanges) {
        this.performSync({ background: true });
      }
    });

    // 5. Setup realtime listener for currently logged in user
    this.setupRealtimeListener();
  }

  private async setupRealtimeListener() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (this.currentUserId === user.id && this.realtimeChannel) return;

      this.currentUserId = user.id;

      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabase
        .channel(`user_sync_channel_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_sync',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Received cloud update from another device! Sync immediately
            if (!this.isSyncRunning && !this.isApplyingRemote) {
              this.performSync({ background: true, silentIfUpToDate: true });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  }

  public requestDebouncedSync(delayMs = 1200) {
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

  public onDataChange(listener: DataChangeListener) {
    this.dataChangeListeners.add(listener);
    return () => {
      this.dataChangeListeners.delete(listener);
    };
  }

  public notifyDataChanged() {
    this.dataChangeListeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('Data change listener failed:', e);
      }
    });
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
   * Two-way CRDT / Last-Write-Wins Sync between local Dexie and Supabase user_sync
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

    this.setupRealtimeListener();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.hasPendingChanges = true;
      if (!options?.background) {
        this.setState('error', 'اتصال اینترنت برقرار نیست');
      }
      return false;
    }

    this.isSyncRunning = true;
    if (!options?.background) {
      this.setState('syncing', 'در حال ارتباط با سرور و همگام‌سازی...');
    }

    try {
      const nowISO = new Date().toISOString();

      // 1. Fetch remote record from Supabase
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

      this.isApplyingRemote = true;
      let localDataMutated = false;

      // 2. Combine Tombstones (Deleted IDs) from Remote and Local
      const localDeletedIds = getDeletedIds();
      const remoteDeletedList: string[] = remoteRow?.data?.deleted_ids || [];
      const allDeletedIds = new Set<string>([...localDeletedIds, ...remoteDeletedList]);

      markMultipleIdsAsDeleted(Array.from(allDeletedIds));

      try {
        // 3. Purge all deleted items from local Dexie
        for (const deletedId of allDeletedIds) {
          const t = await db.tasks.get(deletedId);
          if (t) {
            await db.tasks.delete(deletedId);
            localDataMutated = true;
          }
          const n = await db.notes.get(deletedId);
          if (n) {
            await db.notes.delete(deletedId);
            localDataMutated = true;
          }
          const e = await db.events.get(deletedId);
          if (e) {
            await db.events.delete(deletedId);
            localDataMutated = true;
          }
          const b = await db.boxes.get(deletedId);
          if (b) {
            await db.boxes.delete(deletedId);
            localDataMutated = true;
          }
        }

        // 4. Merge Remote Tasks into Local (Last-Write-Wins)
        if (remoteRow?.data && Array.isArray(remoteRow.data.tasks)) {
          for (const rt of remoteRow.data.tasks as Task[]) {
            if (allDeletedIds.has(rt.id) || rt.status === 'dropped') {
              allDeletedIds.add(rt.id);
              await db.tasks.delete(rt.id);
              continue;
            }

            const localTask = await db.tasks.get(rt.id);
            if (!localTask) {
              await db.tasks.put(rt);
              localDataMutated = true;
            } else {
              const remoteTime = new Date(rt.updated_at || rt.created_at || 0).getTime();
              const localTime = new Date(localTask.updated_at || localTask.created_at || 0).getTime();

              if (remoteTime > localTime) {
                await db.tasks.put(rt);
                localDataMutated = true;
              } else if (remoteTime === localTime) {
                // If timestamps match but status or properties differ, reconcile
                if (
                  rt.status !== localTask.status ||
                  rt.title !== localTask.title ||
                  JSON.stringify(rt.done_dates || []) !== JSON.stringify(localTask.done_dates || []) ||
                  JSON.stringify(rt.deleted_dates || []) !== JSON.stringify(localTask.deleted_dates || [])
                ) {
                  // Merge done_dates and deleted_dates
                  const mergedDoneDates = Array.from(
                    new Set([...(rt.done_dates || []), ...(localTask.done_dates || [])])
                  );
                  const mergedDeletedDates = Array.from(
                    new Set([...(rt.deleted_dates || []), ...(localTask.deleted_dates || [])])
                  );
                  await db.tasks.put({
                    ...localTask,
                    ...rt,
                    done_dates: mergedDoneDates,
                    deleted_dates: mergedDeletedDates,
                  });
                  localDataMutated = true;
                }
              }
            }
          }
        }

        // 5. Merge Remote Notes (Last-Write-Wins)
        if (remoteRow?.data && Array.isArray(remoteRow.data.notes)) {
          for (const rn of remoteRow.data.notes as Note[]) {
            if (allDeletedIds.has(rn.id)) {
              await db.notes.delete(rn.id);
              continue;
            }
            const localNote = await db.notes.get(rn.id);
            if (!localNote) {
              await db.notes.put(rn);
              localDataMutated = true;
            } else {
              const remoteTime = new Date(rn.updated_at || rn.created_at || 0).getTime();
              const localTime = new Date(localNote.updated_at || localNote.created_at || 0).getTime();
              if (remoteTime > localTime) {
                await db.notes.put(rn);
                localDataMutated = true;
              }
            }
          }
        }

        // 6. Merge Remote Events
        if (remoteRow?.data && Array.isArray(remoteRow.data.events)) {
          for (const re of remoteRow.data.events as EventItem[]) {
            if (allDeletedIds.has(re.id) || re.title?.includes('مصرف دارو')) {
              allDeletedIds.add(re.id);
              await db.events.delete(re.id);
              continue;
            }
            const localEvent = await db.events.get(re.id);
            if (!localEvent) {
              await db.events.put(re);
              localDataMutated = true;
            } else {
              const remoteTime = new Date(re.updated_at || re.created_at || 0).getTime();
              const localTime = new Date(localEvent.updated_at || localEvent.created_at || 0).getTime();
              if (remoteTime > localTime) {
                await db.events.put(re);
                localDataMutated = true;
              }
            }
          }
        }

        // 7. Merge Remote Tags and Boxes
        if (remoteRow?.data && Array.isArray(remoteRow.data.tags)) {
          for (const tg of remoteRow.data.tags as Tag[]) {
            const localTag = await db.tags.get(tg.id);
            if (!localTag) {
              await db.tags.put(tg);
              localDataMutated = true;
            }
          }
        }

        if (remoteRow?.data && Array.isArray(remoteRow.data.boxes)) {
          for (const bx of remoteRow.data.boxes as Box[]) {
            if (allDeletedIds.has(bx.id)) {
              await db.boxes.delete(bx.id);
              continue;
            }
            const localBox = await db.boxes.get(bx.id);
            if (!localBox) {
              await db.boxes.put(bx);
              localDataMutated = true;
            }
          }
        }
      } finally {
        this.isApplyingRemote = false;
      }

      // 8. Compile complete unified state to upload
      const [finalTasks, finalNotes, finalEvents, finalTags, finalBoxes] = await Promise.all([
        db.tasks.toArray(),
        db.notes.toArray(),
        db.events.toArray(),
        db.tags.toArray(),
        db.boxes.toArray(),
      ]);

      const cleanTasks = finalTasks.filter((t) => !allDeletedIds.has(t.id) && t.status !== 'dropped');
      const cleanNotes = finalNotes.filter((n) => !allDeletedIds.has(n.id));
      const cleanEvents = finalEvents.filter((e) => !allDeletedIds.has(e.id) && !e.title?.includes('مصرف دارو'));
      const cleanBoxes = finalBoxes.filter((b) => !allDeletedIds.has(b.id));

      const cleanPayload = {
        tasks: cleanTasks,
        notes: cleanNotes,
        events: cleanEvents,
        tags: finalTags,
        boxes: cleanBoxes,
        deleted_ids: Array.from(allDeletedIds).slice(-3000), // Keep recent tombstones
        synced_at: nowISO,
      };

      // 9. Check if upload is necessary
      const remoteData = remoteRow?.data;
      const remoteTasksSig = (remoteData?.tasks || []).map((t: any) => `${t.id}:${t.status}:${t.updated_at}`).sort().join('|');
      const localTasksSig = cleanTasks.map((t) => `${t.id}:${t.status}:${t.updated_at}`).sort().join('|');
      const remoteNotesSig = (remoteData?.notes || []).map((n: any) => `${n.id}:${n.updated_at}`).sort().join('|');
      const localNotesSig = cleanNotes.map((n) => `${n.id}:${n.updated_at}`).sort().join('|');
      const remoteDeletedCount = (remoteData?.deleted_ids || []).length;
      const localDeletedCount = allDeletedIds.size;

      const needsUpload =
        !remoteRow ||
        remoteTasksSig !== localTasksSig ||
        remoteNotesSig !== localNotesSig ||
        remoteDeletedCount !== localDeletedCount ||
        this.hasPendingChanges;

      if (needsUpload) {
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
      }

      this.hasPendingChanges = false;
      localStorage.setItem('second_brain_last_sync', nowISO);

      // If local data was updated from remote, immediately notify UI
      if (localDataMutated) {
        this.notifyDataChanged();
      }

      if (options?.silentIfUpToDate && !localDataMutated && !needsUpload) {
        this.setState('idle', '');
      } else {
        this.setState(
          'synced',
          `همگام‌سازی موفق (${toPersianDigits(cleanTasks.length)} تسک و ${toPersianDigits(cleanNotes.length)} یادداشت)`
        );
      }

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
