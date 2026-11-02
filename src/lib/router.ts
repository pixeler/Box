import { useEffect, useState } from 'react';
import type { ActiveTab } from '@/components/navigation/BottomDock';

/**
 * The whole app is one hash route. A hash works in a browser tab and inside a
 * packaged window (`file://`) without registering a custom protocol, and it
 * gives back/forward, deep links and note URLs for free.
 */
export interface AppRoute {
  tab: ActiveTab;
  /** Notebook folder: null = root, 'all_notes', or a box id. */
  folderId: string | null | 'all_notes';
  noteId: string | null;
}

const TABS: ActiveTab[] = ['day', 'calendar', 'todo', 'focus', 'notebook'];

const asTab = (value: string): ActiveTab =>
  (TABS as string[]).includes(value) ? (value as ActiveTab) : 'day';

const folderFromParam = (value: string | null): AppRoute['folderId'] => {
  if (!value) return null;
  return value === 'all' ? 'all_notes' : decodeURIComponent(value);
};

export const parseHash = (hash: string): AppRoute => {
  const raw = hash.replace(/^#/, '').replace(/^\/+/, '');
  const [path = '', query = ''] = raw.split('?');
  const [head, second, third] = path.split('/');
  const params = new URLSearchParams(query);

  if (!head) return { tab: 'day', folderId: null, noteId: null };

  if (head === 'notes') {
    const folderId = folderFromParam(params.get('folder'));
    if (second === 'all') return { tab: 'notebook', folderId: 'all_notes', noteId: null };
    if (second === 'folder' && third) {
      return { tab: 'notebook', folderId: decodeURIComponent(third), noteId: null };
    }
    if (second) return { tab: 'notebook', folderId, noteId: decodeURIComponent(second) };
    return { tab: 'notebook', folderId, noteId: null };
  }

  return { tab: asTab(head), folderId: null, noteId: null };
};

export const buildHash = (route: AppRoute): string => {
  if (route.tab !== 'notebook') return `#/${route.tab}`;
  if (route.noteId) {
    const folder =
      route.folderId === 'all_notes'
        ? 'all'
        : route.folderId
        ? encodeURIComponent(route.folderId)
        : '';
    return `#/notes/${encodeURIComponent(route.noteId)}${folder ? `?folder=${folder}` : ''}`;
  }
  if (route.folderId === 'all_notes') return '#/notes/all';
  if (route.folderId) return `#/notes/folder/${encodeURIComponent(route.folderId)}`;
  return '#/notes';
};

// Back/forward availability comes from our own stack: history.length cannot
// tell a forward entry from an unrelated page.
let stack: string[] = [];
let index = 0;
let started = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const syncStack = (hash: string) => {
  if (!started) {
    started = true;
    stack = [hash];
    index = 0;
    return;
  }
  if (hash === stack[index]) return;
  if (index > 0 && hash === stack[index - 1]) {
    index -= 1;
    return;
  }
  if (index < stack.length - 1 && hash === stack[index + 1]) {
    index += 1;
    return;
  }
  stack = [...stack.slice(0, index + 1), hash];
  index = stack.length - 1;
};

const snapshot = () => ({
  route: parseHash(window.location.hash),
  canGoBack: index > 0,
  canGoForward: index < stack.length - 1,
});

export type RouteSnapshot = ReturnType<typeof snapshot>;

export const navigate = (route: AppRoute, replace = false) => {
  const hash = buildHash(route);
  if (window.location.hash === hash) return;
  if (replace) window.history.replaceState(null, '', hash);
  else window.location.hash = hash;
  syncStack(hash);
  emit();
};

export const goBack = () => window.history.back();
export const goForward = () => window.history.forward();

/** Route state plus the two arrows; call once per app shell. */
export const useRoute = (): RouteSnapshot => {
  const [state, setState] = useState<RouteSnapshot>(() => {
    // A packaged window boots with no hash at all; normalise it so the first
    // push still has somewhere to go back to.
    if (!window.location.hash) window.history.replaceState(null, '', '#/day');
    return snapshot();
  });

  useEffect(() => {
    const update = () => {
      syncStack(window.location.hash);
      setState(snapshot());
    };
    listeners.add(update);
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    update();
    return () => {
      listeners.delete(update);
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);

  return state;
};
