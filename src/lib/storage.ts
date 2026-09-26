import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Universal key-value storage:
 * - On Native (Android / iOS): uses Capacitor Preferences (stored in Android SharedPreferences)
 * - On Web: uses standard localStorage
 * Also syncs with localStorage for synchronous fallback when needed.
 */
export const AppStorage = {
  async get(key: string): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await Preferences.get({ key });
        return value;
      } catch {
        return localStorage.getItem(key);
      }
    }
    return localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.set({ key, value });
      } catch (err) {
        console.warn('AppStorage set failed:', err);
      }
    }
  },

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key });
      } catch (err) {
        console.warn('AppStorage remove failed:', err);
      }
    }
  },

  async clear(): Promise<void> {
    localStorage.clear();
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.clear();
      } catch (err) {
        console.warn('AppStorage clear failed:', err);
      }
    }
  },
};

const DELETED_IDS_KEY = 'second_brain_deleted_ids';

export function markIdAsDeleted(id: string): void {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY) || '[]';
    const list: string[] = JSON.parse(raw);
    if (!list.includes(id)) {
      list.push(id);
      if (list.length > 2000) list.splice(0, list.length - 2000);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function isIdDeleted(id: string): boolean {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY) || '[]';
    const list: string[] = JSON.parse(raw);
    return list.includes(id);
  } catch {
    return false;
  }
}

export function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY) || '[]';
    const list: string[] = JSON.parse(raw);
    return new Set(list);
  } catch {
    return new Set();
  }
}
