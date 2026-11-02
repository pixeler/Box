import { getSupabase } from '../cloud';
import { db } from '../db/dexie';
import { toPersianDigits, formatJalaliKey, getJalaliDate, extractDateOnly } from '../jalali';
import { markIdAsDeleted, markMultipleIdsAsDeleted, getDeletedIds } from '../storage';
import { runWhenIdle } from '../idle';
import type { Task, Note, EventItem, Tag, Box } from '@/types/models';
import {
  deduplicateTasks,
  deduplicateNotes,
  deduplicateEvents,
  deduplicateBoxes,
  deduplicateLocalDatabase,
} from './dedupe';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'up_to_date' | 'table_missing' | 'error';

/** A timeout or a dropped connection is temporary; the queued change survives it. */
const isTransientNetworkError = (message?: string) =>
  !!message &&
  /timed out|timeout|failed to fetch|fetch failed|network ?error|load failed|aborted/i.test(message);

/** Mirrors `isCloudSyncConfigured` without pulling the Supabase chunk into the boot graph. */
const CLOUD_SYNC_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

type SyncListener = (state: SyncState, message?: string) => void;
type DataChangeListener = () => void;

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
    // Local-only builds have no backend: do not queue uploads, poll remote
    // changes or open a realtime channel that is guaranteed to fail.
    if (!CLOUD_SYNC_CONFIGURED) return;
    this.isInitialized = true;

    // 1. Hook to database mutations across all tables
    const onLocalMutation = () => {
      if (this.isApplyingRemote) return;
      this.hasPendingChanges = true;
      // Debounce: wait 1.2s of idle time after user actions before syncing to cloud
      this.requestDebouncedSync(1200);
      // Immediately notify local UI listeners on next microtask so all components (DayStream, TodoView, etc.) stay in sync
      queueMicrotask(() => {
        this.notifyDataChanged();
      });
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

    // Local de-duplication is a maintenance pass over the entire database.
    // It must never run on the boot path: the first screen reads IndexedDB
    // directly, so this waits until the app is idle.
    runWhenIdle(() => {
      deduplicateLocalDatabase().catch((err) => {
        console.warn('Initial deduplication warning:', err);
      });
    }, 3000);

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

    // 5. Realtime is a network concern: subscribe once the UI is idle so the
    //    auth round-trip never delays the first screen.
    runWhenIdle(() => {
      void this.setupRealtimeListener();
    });
  }

  private async setupRealtimeListener() {
    try {
      const supabase = await getSupabase();
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
    if (!raw) return 'نشده';
    try {
      const d = new Date(raw);
      const diffMs = Date.now() - d.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) return 'همین حالا';
      if (diffMinutes < 60) return `${toPersianDigits(diffMinutes)} دقیقه پیش`;
      const hours = Math.floor(diffMinutes / 60);
      if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${toPersianDigits(days)} روز پیش`;

      return formatJalaliKey(getJalaliDate(d));
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

  private notifyScheduled: boolean = false;

  public notifyDataChanged() {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      this.dataChangeListeners.forEach((l) => {
        try {
          l();
        } catch (e) {
          console.error('Data change listener failed:', e);
        }
      });
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

    const supabase = await getSupabase();
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

      // Pre-deduplicate remote items in case server contains duplicate records
      let remoteTasks: Task[] = [];
      let remoteNotes: Note[] = [];
      let remoteEvents: EventItem[] = [];
      let remoteBoxes: Box[] = [];

      if (remoteRow?.data) {
        const rawTasks: Task[] = Array.isArray(remoteRow.data.tasks) ? remoteRow.data.tasks : [];
        const rawNotes: Note[] = Array.isArray(remoteRow.data.notes) ? remoteRow.data.notes : [];
        const rawEvents: EventItem[] = Array.isArray(remoteRow.data.events) ? remoteRow.data.events : [];
        const rawBoxes: Box[] = Array.isArray(remoteRow.data.boxes) ? remoteRow.data.boxes : [];

        const tDedup = deduplicateTasks(rawTasks);
        const nDedup = deduplicateNotes(rawNotes);
        const eDedup = deduplicateEvents(rawEvents);
        const bDedup = deduplicateBoxes(rawBoxes);

        remoteTasks = tDedup.uniqueTasks;
        remoteNotes = nDedup.uniqueNotes;
        remoteEvents = eDedup.uniqueEvents;
        remoteBoxes = bDedup.uniqueBoxes;

        // Any duplicate IDs found on remote are added to tombstones so they get deleted everywhere
        [...tDedup.removedIds, ...nDedup.removedIds, ...eDedup.removedIds, ...bDedup.removedIds].forEach(
          (id) => allDeletedIds.add(id)
        );
      }

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

        // 3.2. If remote server already has tasks/data, remove unlinked local demo seed tasks
        if (remoteTasks.length > 0) {
          const remoteTaskIds = new Set(remoteTasks.map((t) => t.id));
          const currentLocalTasks = await db.tasks.toArray();
          for (const lt of currentLocalTasks) {
            const cleanTitle = (lt.title || '').trim().toLowerCase();
            const isDemo =
              cleanTitle.includes('تکمیل دیزاین تسک') ||
              cleanTitle.includes('بررسی فیدبک') ||
              cleanTitle.includes('آماده‌سازی خروجی');
            if (isDemo && !remoteTaskIds.has(lt.id)) {
              await db.tasks.delete(lt.id);
              localDataMutated = true;
            }
          }
        }

        // 3.5. Deduplicate and reconcile Tags (handles duplicate names between devices without ConstraintError)
        const tagIdRemap = new Map<string, string>(); // oldId -> canonicalId

        // A. Deduplicate existing local tags by normalized name
        const initialLocalTags = await db.tags.toArray();
        const localTagsByName = new Map<string, Tag>();
        for (const lt of initialLocalTags) {
          const normName = (lt.name || '').trim().toLowerCase().replace(/^#/, '');
          if (!normName) continue;
          if (!localTagsByName.has(normName)) {
            localTagsByName.set(normName, lt);
          } else {
            const canonical = localTagsByName.get(normName)!;
            tagIdRemap.set(lt.id, canonical.id);
            await db.tags.delete(lt.id);
            localDataMutated = true;
          }
        }

        // B. Reconcile remote tags safely
        if (remoteRow?.data && Array.isArray(remoteRow.data.tags)) {
          for (const rt of remoteRow.data.tags as Tag[]) {
            const cleanName = (rt.name || '').trim().replace(/^#/, '');
            const normName = cleanName.toLowerCase();
            if (!normName) continue;

            const existingByNorm = localTagsByName.get(normName);
            if (existingByNorm) {
              if (existingByNorm.id !== rt.id) {
                tagIdRemap.set(rt.id, existingByNorm.id);
              }
            } else {
              const existingById = await db.tags.get(rt.id);
              if (existingById) {
                localTagsByName.set(normName, existingById);
              } else {
                const newTag: Tag = { ...rt, name: cleanName };
                await db.tags.put(newTag);
                localTagsByName.set(normName, newTag);
                localDataMutated = true;
              }
            }
          }
        }

        // C. If any tag IDs were remapped, update existing local tasks and notes
        if (tagIdRemap.size > 0) {
          const currentLocalTasks = await db.tasks.toArray();
          for (const t of currentLocalTasks) {
            if (t.tag_ids?.some((id) => tagIdRemap.has(id))) {
              const fixedIds = Array.from(new Set(t.tag_ids.map((id) => tagIdRemap.get(id) || id)));
              await db.tasks.update(t.id, { tag_ids: fixedIds });
              localDataMutated = true;
            }
          }
          const currentLocalNotes = await db.notes.toArray();
          for (const n of currentLocalNotes) {
            if (n.tag_ids?.some((id) => tagIdRemap.has(id))) {
              const fixedIds = Array.from(new Set(n.tag_ids.map((id) => tagIdRemap.get(id) || id)));
              await db.notes.update(n.id, { tag_ids: fixedIds });
              localDataMutated = true;
            }
          }
        }

        // 4. Merge Remote Tasks into Local (Last-Write-Wins with CRDT progress preservation)
        for (const rt of remoteTasks) {
          if (allDeletedIds.has(rt.id) || rt.status === 'dropped') {
            allDeletedIds.add(rt.id);
            await db.tasks.delete(rt.id);
            continue;
          }

          if (rt.tag_ids && tagIdRemap.size > 0) {
            rt.tag_ids = Array.from(new Set(rt.tag_ids.map((id) => tagIdRemap.get(id) || id)));
          }

          const localTask = await db.tasks.get(rt.id);
          if (!localTask) {
            const normDones = (rt.done_dates || []).map(extractDateOnly).filter(Boolean);
            const taskDate = extractDateOnly(rt.due_date);
            if (rt.status === 'done' && taskDate && !normDones.includes(taskDate)) {
              normDones.push(taskDate);
            }
            await db.tasks.put({
              ...rt,
              done_dates: normDones,
            });
            localDataMutated = true;
          } else {
            const remoteTime = new Date(rt.updated_at || rt.created_at || 0).getTime();
            const localTime = new Date(localTask.updated_at || localTask.created_at || 0).getTime();

            // CRUCIAL: ALWAYS take UNION of completion dates and skipped dates
            const mergedDoneDates = Array.from(
              new Set([
                ...(localTask.done_dates || []).map(extractDateOnly),
                ...(rt.done_dates || []).map(extractDateOnly),
              ])
            ).filter(Boolean);

            const mergedDeletedDates = Array.from(
              new Set([
                ...(localTask.deleted_dates || []).map(extractDateOnly),
                ...(rt.deleted_dates || []).map(extractDateOnly),
              ])
            ).filter(Boolean);

            const mergedTagIds = Array.from(
              new Set([...(localTask.tag_ids || []), ...(rt.tag_ids || [])])
            );

            const isRecurring = Boolean(
              (localTask.recurrence_rule && localTask.recurrence_rule !== 'none') ||
              (rt.recurrence_rule && rt.recurrence_rule !== 'none')
            );

            // Last-Write-Wins: newer timestamp dictates non-recurring task status
            const baseTask = remoteTime > localTime ? rt : localTask;

            let finalDoneDates: string[] = [];
            if (isRecurring) {
              finalDoneDates = mergedDoneDates;
            } else if (baseTask.status === 'done') {
              const taskDate = extractDateOnly(baseTask.due_date);
              finalDoneDates = taskDate ? [taskDate] : mergedDoneDates;
            } else {
              // Open non-recurring task: clear done_dates so it won't be resurrected as done
              finalDoneDates = [];
            }

            const mergedTask: Task = {
              ...baseTask,
              status: isRecurring ? 'open' : baseTask.status,
              done_dates: finalDoneDates,
              deleted_dates: mergedDeletedDates,
              tag_ids: mergedTagIds,
              updated_at: new Date(Math.max(remoteTime, localTime)).toISOString(),
            };

            if (
              localTask.status !== mergedTask.status ||
              JSON.stringify(localTask.done_dates || []) !== JSON.stringify(mergedTask.done_dates) ||
              JSON.stringify(localTask.deleted_dates || []) !== JSON.stringify(mergedTask.deleted_dates) ||
              remoteTime > localTime
            ) {
              await db.tasks.put(mergedTask);
              localDataMutated = true;
            }
          }
        }

        // 5. Merge Remote Notes (Last-Write-Wins)
        for (const rn of remoteNotes) {
          if (allDeletedIds.has(rn.id)) {
            await db.notes.delete(rn.id);
            continue;
          }

          if (rn.tag_ids && tagIdRemap.size > 0) {
            rn.tag_ids = Array.from(new Set(rn.tag_ids.map((id) => tagIdRemap.get(id) || id)));
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

        // 6. Merge Remote Events
        for (const re of remoteEvents) {
          if (allDeletedIds.has(re.id) || re.title?.includes('مصرف دارو')) {
            allDeletedIds.add(re.id);
            await db.events.delete(re.id);
            continue;
          }

          if (re.tag_ids && tagIdRemap.size > 0) {
            re.tag_ids = Array.from(new Set(re.tag_ids.map((id) => tagIdRemap.get(id) || id)));
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

        // 7. Merge Remote Boxes
        for (const bx of remoteBoxes) {
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

        // 7.5. Run full deduplication pass on local database to clean any duplicate tasks/notes/events
        const dedupRes = await deduplicateLocalDatabase();
        if (
          dedupRes.tasksCleaned > 0 ||
          dedupRes.notesCleaned > 0 ||
          dedupRes.eventsCleaned > 0 ||
          dedupRes.boxesCleaned > 0
        ) {
          localDataMutated = true;
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

      const { uniqueTasks: cleanTasks, removedIds: extraTaskIds } = deduplicateTasks(
        finalTasks.filter((t) => !allDeletedIds.has(t.id) && t.status !== 'dropped')
      );
      const { uniqueNotes: cleanNotes, removedIds: extraNoteIds } = deduplicateNotes(
        finalNotes.filter((n) => !allDeletedIds.has(n.id))
      );
      const { uniqueEvents: cleanEvents, removedIds: extraEventIds } = deduplicateEvents(
        finalEvents.filter((e) => !allDeletedIds.has(e.id) && !e.title?.includes('مصرف دارو'))
      );
      const { uniqueBoxes: cleanBoxes, removedIds: extraBoxIds } = deduplicateBoxes(
        finalBoxes.filter((b) => !allDeletedIds.has(b.id))
      );

      [...extraTaskIds, ...extraNoteIds, ...extraEventIds, ...extraBoxIds].forEach((id) =>
        allDeletedIds.add(id)
      );

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
          if (isTransientNetworkError(upsertError.message)) {
            this.hasPendingChanges = true;
            console.warn('Sync upload postponed (network):', upsertError.message);
            if (!options?.background) {
              this.setState('idle', 'اتصال به سرور برقرار نشد؛ تلاش بعدی خودکار است');
            }
            return false;
          }
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
