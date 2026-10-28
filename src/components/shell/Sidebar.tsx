import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Note, Task } from '@/types/models';
import type { ActiveTab } from '@/components/navigation/BottomDock';
import type { SettingsSection } from '@/components/profile/ProfileView';
import { useAuth } from '@/lib/auth';
import { syncManager, type SyncState } from '@/lib/sync';
import { noteRepo, taskRepo } from '@/repositories';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  formatJalaliDisplay,
  formatTaskDateDisplay,
  getJalaliDate,
  getTodayJalaliKey,
} from '@/lib/jalali';
import { shortcutAria, shortcutLabel } from '@/lib/platform';
import { useNotebook } from '@/components/notebook/NotebookContext';
import { SidebarFolderTree } from './SidebarFolderTree';
import { useRecentItems, type RecentItem } from '@/hooks/useRecentItems';
import {
  ArrowUpDown,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Copy,
  Database,
  Ellipsis,
  Focus,
  Folder,
  Info,
  ListTodo,
  LogIn,
  LogOut,
  Palette,
  PanelRight,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  SquareCheck,
  SquareText,
  Sun,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export interface SidebarProps {
  activeTab: ActiveTab;
  compact?: boolean;
  canCollapse?: boolean;
  onToggleCollapsed?: () => void;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
  onOpenNote: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenAuth: () => void;
  onOpenTask: (task: Task) => void;
  /** Called after a navigation action, so the mobile sheet can close itself. */
  onNavigate?: () => void;
  /** Only supplied inside the mobile sheet. */
  onClose?: () => void;
}

const NAV_ITEMS = [
  { id: 'day' as const, label: 'امروز', icon: Sun, activeIcon: Sun },
  { id: 'calendar' as const, label: 'تقویم', icon: Calendar, activeIcon: CalendarDays },
];

const TOOL_ITEMS = [
  { id: 'todo' as const, label: 'همه کارها', icon: ListTodo },
  { id: 'focus' as const, label: 'تمرکز', icon: Focus },
];

const RECENT_SORTS = [
  { id: 'recent' as const, label: 'آخرین تغییر' },
  { id: 'created' as const, label: 'تاریخ ایجاد' },
  { id: 'title' as const, label: 'عنوان' },
];

type RecentSort = (typeof RECENT_SORTS)[number]['id'];

const formatCreatedDate = (timestamp: number): string => {
  if (!timestamp) return 'تاریخ نامشخص';
  try {
    return formatJalaliDisplay(getJalaliDate(new Date(timestamp)));
  } catch {
    return 'تاریخ نامشخص';
  }
};

const Shortcut: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border/70 bg-background/30 px-1.5 font-sans text-[10px] font-medium leading-none text-subtle',
      className
    )}
  >
    {children}
  </kbd>
);

const plainSnippet = (body?: string): string => {
  if (!body) return '';
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 110 ? `${text.slice(0, 110).trim()}…` : text;
};

const RecentPreview: React.FC<{
  item: RecentItem;
  anchor: { top: number; right: number };
  relativeTime: (timestamp: number) => string;
  folderPath?: string;
}> = ({ item, anchor, relativeTime, folderPath }) => {
  if (typeof document === 'undefined') return null;

  const TypeIcon = item.type === 'note' ? SquareText : SquareCheck;
  const typeLabel = item.type === 'note' ? 'یادداشت' : 'کار';
  const noteSnippet = item.type === 'note' ? plainSnippet(item.note.body) : '';
  const dueLabel =
    item.type === 'task'
      ? formatTaskDateDisplay(
          item.task.due_date,
          getTodayJalaliKey(),
          true,
          item.task.due_time,
          item.task.duration_minutes
        ) || 'بدون موعد'
      : '';
  const statusLabel =
    item.type === 'task' ? (item.task.status === 'done' ? 'انجام‌شده' : 'باز') : '';

  return createPortal(
    <div
      style={{ position: 'fixed', top: anchor.top, right: anchor.right, width: 300, zIndex: 40 }}
      className="pointer-events-none rounded-xl bg-popover p-3 text-popover-foreground shadow-2xl"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
        <TypeIcon className="size-3.5" />
        <span>{typeLabel}</span>
      </div>
      {item.type === 'note' && (
        <div
          className="mt-1 flex items-center gap-1 text-[10.5px] leading-4 text-subtle"
          title={folderPath || 'بدون پوشه'}
        >
          <Folder className="size-3 shrink-0" />
          <span className="truncate">{folderPath || 'بدون پوشه'}</span>
        </div>
      )}

      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-6 text-foreground">
        {item.title}
      </p>

      {item.type === 'note' ? (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-6 text-muted-foreground">
          {noteSnippet || 'این یادداشت هنوز متنی ندارد.'}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-muted-foreground">
          <span>موعد: {dueLabel}</span>
          <span>وضعیت: {statusLabel}</span>
        </div>
      )}

      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        ایجاد: {formatCreatedDate(item.createdAt)}
        {item.createdAt > 0 && <> · {relativeTime(item.createdAt)}</>}
      </p>
    </div>,
    document.body
  );
};

const RecentRow: React.FC<{
  item: RecentItem;
  relativeTime: (timestamp: number) => string;
  folderPath?: string;
  onOpenTask: (task: Task) => void;
  onOpenNote: (note: Note) => void;
  onNavigate?: () => void;
  refresh: () => Promise<void>;
}> = ({ item, relativeTime, folderPath, onOpenTask, onOpenNote, onNavigate, refresh }) => {
  const [preview, setPreview] = useState<{ top: number; right: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const TypeIcon = item.type === 'note' ? SquareText : SquareCheck;
  const title = item.title;

  const clearPreview = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setPreview(null);
  };

  const showPreview = (element: HTMLElement) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const rect = element.getBoundingClientRect();
    const top = Math.max(12, Math.min(rect.top - 10, window.innerHeight - 150));
    const right = Math.max(12, window.innerWidth - rect.left + 8);

    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPreview({ top, right }), 180);
  };

  useEffect(() => {
    if (!preview) return;
    const hide = () => setPreview(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [preview]);

  useEffect(
    () => () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    },
    []
  );

  const openItem = () => {
    if (item.type === 'note') onOpenNote(item.note);
    else onOpenTask(item.task);
    onNavigate?.();
  };

  const togglePin = async () => {
    try {
      if (item.type === 'note') {
        await noteRepo.update(item.note.id, { pinned: !item.note.pinned });
        toast.show(item.note.pinned ? 'از سنجاق خارج شد' : 'سنجاق شد');
      } else {
        await taskRepo.update(item.task.id, { pinned: !item.task.pinned });
        toast.show(item.task.pinned ? 'از سنجاق خارج شد' : 'سنجاق شد');
      }
      await refresh();
      clearPreview();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.show('تغییر وضعیت سنجاق انجام نشد');
    }
  };

  const toggleTaskDone = async () => {
    if (item.type !== 'task') return;
    try {
      const nextStatus = item.task.status === 'done' ? 'open' : 'done';
      await taskRepo.update(item.task.id, { status: nextStatus });
      toast.show(nextStatus === 'done' ? 'کار انجام شد' : 'کار به حالت باز برگشت');
      await refresh();
      clearPreview();
    } catch (error) {
      console.error('Failed to toggle task:', error);
      toast.show('تغییر وضعیت کار انجام نشد');
    }
  };

  const copyTitle = async () => {
    try {
      await navigator.clipboard.writeText(title);
      toast.show('عنوان کپی شد');
    } catch {
      toast.show('کپی عنوان انجام نشد');
    }
  };

  const pinned = item.type === 'note' ? item.note.pinned : item.task.pinned;

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) clearPreview();
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          onMouseEnter={(event) => showPreview(event.currentTarget)}
          onMouseLeave={clearPreview}
          onFocus={(event) => showPreview(event.currentTarget)}
          onBlur={clearPreview}
          className="group/recent relative flex h-9 w-full min-w-0 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-foreground/[0.04] focus-within:bg-foreground/[0.04]"
        >
      <button
        type="button"
        onClick={openItem}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-sm text-right outline-none"
      >
        <TypeIcon className="size-4 shrink-0 text-subtle" />
        <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-muted-foreground group-hover/recent:text-foreground">
          {title}
        </span>
      </button>

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) clearPreview();
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="گزینه‌های این مورد"
            title="گزینه‌ها"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle opacity-100 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover/recent:opacity-100 md:group-focus-within/recent:opacity-100"
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={6} className="w-48 p-1">
          <DropdownMenuItem onSelect={openItem}>
            <TypeIcon className="size-3.5 text-subtle" />
            <span>باز کردن</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void togglePin()}>
            {pinned ? (
              <PinOff className="size-3.5 text-subtle" />
            ) : (
              <Pin className="size-3.5 text-subtle" />
            )}
            <span>{pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</span>
          </DropdownMenuItem>
          {item.type === 'task' && (
            <DropdownMenuItem onSelect={() => void toggleTaskDone()}>
              <CircleCheck className="size-3.5 text-subtle" />
              <span>{item.task.status === 'done' ? 'برگرداندن به انجام‌نشده' : 'علامت انجام‌شده'}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void copyTitle()}>
            <Copy className="size-3.5 text-subtle" />
            <span>کپی عنوان</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

          {preview && (
            <RecentPreview
              item={item}
              anchor={preview}
              relativeTime={relativeTime}
              folderPath={folderPath}
            />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48 p-1">
        <ContextMenuItem onSelect={openItem}>
          <TypeIcon className="size-3.5 text-subtle" />
          <span>باز کردن</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void togglePin()}>
          {pinned ? (
            <PinOff className="size-3.5 text-subtle" />
          ) : (
            <Pin className="size-3.5 text-subtle" />
          )}
          <span>{pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</span>
        </ContextMenuItem>
        {item.type === 'task' && (
          <ContextMenuItem onSelect={() => void toggleTaskDone()}>
            <CircleCheck className="size-3.5 text-subtle" />
            <span>{item.task.status === 'done' ? 'برگرداندن به انجام‌نشده' : 'علامت انجام‌شده'}</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => void copyTitle()}>
          <Copy className="size-3.5 text-subtle" />
          <span>کپی عنوان</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const AccountMenu: React.FC<{
  compact: boolean;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenAuth: () => void;
}> = ({ compact, onOpenSettings, onOpenAuth }) => {
  const { user, signOut } = useAuth();
  const settingsShortcut = shortcutLabel(',');
  const [avatarError, setAvatarError] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState().state);
  const [lastSyncLabel, setLastSyncLabel] = useState<string>(() => syncManager.getFormattedLastSync());
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const unsub = syncManager.subscribe(() => {
      setSyncState(syncManager.getState().state);
      setLastSyncLabel(syncManager.getFormattedLastSync());
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(() => {
      setLastSyncLabel(syncManager.getFormattedLastSync());
    }, 60000);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || '/avatar.png';
  const displayName: string =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'مهمان';

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) toast.show('خروج از حساب انجام نشد');
    else toast.show('از حساب خارج شدی');
  };

  const syncLabel = !online
    ? 'آفلاین'
    : syncState === 'syncing'
    ? 'در حال همگام‌سازی…'
    : lastSyncLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="منوی حساب کاربری"
          className={cn(
            'group relative flex w-full items-center rounded-md text-right transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04] group/account',
            compact ? 'h-10 justify-center' : 'h-11 gap-2.5 px-2'
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
            {!avatarError && avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="size-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <User className="size-4 text-muted-foreground" />
            )}
          </span>

          {!compact && (
            <>
              <div className="flex min-w-0 flex-1 flex-col items-start text-right">
                <span className="truncate text-[13px] font-medium leading-5 text-foreground">
                  {displayName}
                </span>
                <span className="truncate text-[11px] leading-4 text-subtle">
                  {syncLabel}
                </span>
              </div>
              <ChevronDown className="size-3.5 shrink-0 text-subtle transition-transform duration-150 group-data-[state=open]/account:rotate-180" />
            </>
          )}
          {compact && <RailTip label={displayName} />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[268px] p-1.5">
        <div className="px-2 py-1.5">
          <p className="truncate text-[11px] text-subtle">{user?.email || 'حساب مهمان'}</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-foreground">{displayName}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          aria-keyshortcuts={shortcutAria(',')}
          onSelect={() => onOpenSettings('main')}
        >
          <Settings className="size-4 text-subtle" />
          <span className="flex-1">تنظیمات</span>
          <Shortcut>{settingsShortcut}</Shortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenSettings('theme')}>
          <Palette className="size-4 text-subtle" />
          <span>تم و ظاهر</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenSettings('backup')}>
          <Database className="size-4 text-subtle" />
          <span>پشتیبان‌گیری و داده</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenSettings('feedback')}>
          <CircleHelp className="size-4 text-subtle" />
          <span>راهنما و بازخورد</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenSettings('about')}>
          <Info className="size-4 text-subtle" />
          <span>درباره جعبه</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {user ? (
          <DropdownMenuItem
            onSelect={() => void handleLogout()}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="size-4" />
            <span>خروج از حساب</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onOpenAuth}>
            <LogIn className="size-4 text-subtle" />
            <span>ورود به حساب</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * The primary navigation. The same component is rendered in the desktop
 * sidebar and inside the mobile sheet; compact mode is the tablet icon rail and
 * the collapsed desktop state.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  compact = false,
  canCollapse = false,
  onToggleCollapsed,
  onTabChange,
  onOpenAdd,
  onOpenNote,
  onOpenSettings,
  onOpenAuth,
  onOpenTask,
  onNavigate,
  onClose,
}) => {
  const collapseShortcut = shortcutLabel('B');
  const {
    boxes,
    setCurrentFolderId,
    setEditingNote,
    setNoteEditModalOpen,
    setNoteViewModeOverride,
  } = useNotebook();
  const {
    items: recentItems,
    pinnedItems,
    isLoading: recentsLoading,
    relativeTime,
    refresh,
  } = useRecentItems(20);
  const [notesOpen, setNotesOpen] = useState(activeTab === 'notebook');
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [recentsQuery, setRecentsQuery] = useState('');
  const [recentsSort, setRecentsSort] = useState<RecentSort>('recent');

  useEffect(() => {
    if (activeTab === 'notebook') setNotesOpen(true);
  }, [activeTab]);

  const navigate = (tab: ActiveTab) => {
    onTabChange(tab);
    onNavigate?.();
  };

  const visibleRecents = useMemo(() => {
    const query = recentsQuery.trim().toLocaleLowerCase('fa');
    const filtered = query
      ? recentItems.filter((item) => item.title.toLocaleLowerCase('fa').includes(query))
      : recentItems;

    return [...filtered]
      .sort((a, b) => {
        if (recentsSort === 'title') return a.title.localeCompare(b.title, 'fa');
        if (recentsSort === 'created') return b.createdAt - a.createdAt;
        return b.timestamp - a.timestamp;
      })
      .slice(0, 10);
  }, [recentItems, recentsQuery, recentsSort]);

  const boxesById = useMemo(() => new Map(boxes.map((box) => [box.id, box])), [boxes]);

  const folderPathFor = (note: Note): string => {
    if (!note.box_id) return 'بدون پوشه';
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor = boxesById.get(note.box_id);

    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.unshift(cursor.title);
      cursor = cursor.parent_id ? boxesById.get(cursor.parent_id) : undefined;
    }

    return chain.length ? chain.join(' / ') : 'بدون پوشه';
  };

  const openNote = (note: Note) => {
    onTabChange('notebook');
    setCurrentFolderId(note.box_id ?? null);
    setEditingNote(note);
    setNoteViewModeOverride('fullscreen');
    setNoteEditModalOpen(true);
    onNavigate?.();
  };

  const renderRecentItem = (item: RecentItem) => (
    <RecentRow
      key={`${item.type}-${item.id}`}
      item={item}
      relativeTime={relativeTime}
      folderPath={item.type === 'note' ? folderPathFor(item.note) : ''}
      onOpenTask={onOpenTask}
      onOpenNote={openNote}
      onNavigate={onNavigate}
      refresh={refresh}
    />
  );

  const closeRecentsSearch = () => {
    setRecentsOpen(false);
    setRecentsQuery('');
  };

  const toggleRecents = () => {
    setRecentsExpanded((expanded) => {
      const next = !expanded;
      if (!next) closeRecentsSearch();
      return next;
    });
  };

  return (
    <aside
      className="flex h-full w-full flex-col overflow-visible bg-sidebar px-2 pb-2 pt-3 text-sidebar-foreground [&_svg]:stroke-[1.75]"
      aria-label="ناوبری اصلی"
    >
      <div
        className={cn(
          'flex h-10 shrink-0 items-center',
          compact ? 'justify-center' : 'justify-between pe-0.5'
        )}
      >
        {canCollapse && compact && onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={`باز کردن منو (${collapseShortcut})`}
            aria-label="باز کردن منو"
            aria-keyshortcuts={shortcutAria('B')}
            className="group/brand relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-foreground/[0.06]"
          >
            <img
              src="/Boxs/Box 2.png"
              alt=""
              className="size-7 rounded-md object-contain transition-opacity group-hover/brand:opacity-0"
            />
            <PanelRight className="absolute size-[18px] text-muted-foreground opacity-0 transition-opacity group-hover/brand:opacity-100" />
          </button>
        ) : (
          <div className={cn('flex min-w-0 items-center gap-2.5 ps-2.5', compact && 'justify-center')}>
            <img src="/Boxs/Box 2.png" alt="" className="size-7 shrink-0 rounded-md object-contain" />
            {!compact && (
              <span className="truncate font-darvish text-[18px] font-semibold leading-none text-foreground">
                جعبه
              </span>
            )}
          </div>
        )}

        {!compact && (onToggleCollapsed || onClose) && (
          <div className="flex shrink-0 items-center gap-0.5">
            {canCollapse && onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={`بستن منو (${collapseShortcut})`}
                aria-label="بستن منو"
                aria-keyshortcuts={shortcutAria('B')}
                className="flex size-8 items-center justify-center rounded-md text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <PanelRight className="size-[18px]" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="بستن منو"
                aria-label="بستن منو"
                className="flex size-8 items-center justify-center rounded-md text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="size-[18px]" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={cn('mt-4 flex flex-col gap-1.5', compact && 'items-center gap-1')}>
        {compact ? (
          <>
            <button
              type="button"
              onClick={onOpenAdd}
              title="کار (T)"
              aria-label="کار"
              className="group relative flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              <Plus className="size-[18px]" />
              <RailTip label="کار (T)" />
            </button>
            <button
              type="button"
              onClick={onOpenNote}
              title="یادداشت (N)"
              aria-label="یادداشت"
              className="group relative flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              <SquareText className="size-[18px]" />
              <RailTip label="یادداشت (N)" />
            </button>
          </>
        ) : (
          <div className="flex w-full items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAdd}
              title="کار (T)"
              className="flex flex-1 items-center justify-between gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="size-4 shrink-0" />
                کار
              </span>
              <Shortcut>T</Shortcut>
            </button>
            <button
              type="button"
              onClick={onOpenNote}
              title="یادداشت (N)"
              className="flex flex-1 items-center justify-between gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
            >
              <span className="flex items-center gap-1.5">
                <SquareText className="size-4 shrink-0" />
                یادداشت
              </span>
              <Shortcut>N</Shortcut>
            </button>
          </div>
        )}
      </div>

      <nav className={cn('mt-4 flex flex-col gap-0.5', compact && 'items-center')} aria-label="صفحه‌ها">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            activeIcon={item.activeIcon}
            active={activeTab === item.id}
            compact={compact}
            onClick={() => navigate(item.id)}
          />
        ))}

        <div
          className={cn(
            'group group/notes relative flex h-9 items-center rounded-md text-[13px] transition-colors',
            activeTab === 'notebook'
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
            compact ? 'w-full justify-center' : 'ps-2.5'
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (compact) {
                navigate('notebook');
                return;
              }
              setNotesOpen((open) => !open);
            }}
            title={compact ? undefined : notesOpen ? 'بستن پوشه‌ها' : 'باز کردن پوشه‌ها'}
            aria-label={
              compact
                ? 'یادداشت‌ها'
                : notesOpen
                ? 'بستن پوشه‌های یادداشت'
                : 'باز کردن پوشه‌های یادداشت'
            }
            aria-expanded={compact ? undefined : notesOpen}
            aria-controls={compact ? undefined : 'sidebar-notes-tree'}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md text-current outline-none',
              !compact && '-ms-1.5'
            )}
          >
            {compact ? (
              <SquareText className="size-[18px] shrink-0" />
            ) : (
              <span className="relative flex size-[18px] items-center justify-center">
                <SquareText className="size-[18px] shrink-0 group-hover/notes:hidden group-focus-within/notes:hidden max-md:hidden" />
                <ChevronDown
                  className={cn(
                    'hidden size-[18px] shrink-0 group-hover/notes:block group-focus-within/notes:block max-md:block',
                    !notesOpen && 'rotate-90'
                  )}
                />
              </span>
            )}
          </button>

          {compact ? (
            <RailTip label="یادداشت‌ها" />
          ) : (
            <button
              type="button"
              onClick={() => {
                navigate('notebook');
                setNotesOpen(true);
              }}
              aria-current={activeTab === 'notebook' ? 'page' : undefined}
              className="flex h-full min-w-0 flex-1 items-center ps-1 pe-2 text-right outline-none"
            >
              <span className="flex-1 truncate leading-5">یادداشت‌ها</span>
            </button>
          )}
        </div>

        {!compact && notesOpen && (
          <div id="sidebar-notes-tree" className="mt-0.5 ps-2">
            <SidebarFolderTree
              showAll={false}
              onNavigate={() => {
                onTabChange('notebook');
                onNavigate?.();
              }}
            />
          </div>
        )}
      </nav>

      <div className={cn('mt-4 flex flex-col gap-0.5', compact && 'items-center')}>
        {TOOL_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            compact={compact}
            onClick={() => navigate(item.id)}
          />
        ))}
      </div>

      {!compact && (
        <section
          aria-labelledby="sidebar-recents-heading"
          className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
        >
          {pinnedItems.length > 0 && (
            <div className="mb-5" aria-labelledby="sidebar-pinned-heading">
              <div className="recents-header flex h-7 items-center px-2">
                <h2 id="sidebar-pinned-heading" className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setPinnedExpanded((expanded) => !expanded)}
                    aria-expanded={pinnedExpanded}
                    aria-controls="sidebar-pinned-list"
                    className="inline-flex max-w-full items-center gap-1 rounded-sm text-[11px] font-medium text-subtle transition-colors hover:text-foreground"
                  >
                    <span>پین‌شده</span>
                    <ChevronDown
                      className={cn(
                        'recents-controls size-3.5 shrink-0 transition-transform duration-150',
                        !pinnedExpanded && 'rotate-90'
                      )}
                    />
                  </button>
                </h2>
              </div>
              {pinnedExpanded && (
                <div id="sidebar-pinned-list" className="flex flex-col">
                  {pinnedItems.map(renderRecentItem)}
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              'recents-header flex h-7 items-center gap-1 px-2',
              recentsOpen && 'recents-header-open'
            )}
          >
            <h2 id="sidebar-recents-heading" className="min-w-0 flex-1">
              <button
                type="button"
                onClick={toggleRecents}
                aria-expanded={recentsExpanded}
                aria-controls="sidebar-recents-list"
                className="inline-flex max-w-full items-center gap-1 rounded-sm text-[11px] font-medium text-subtle transition-colors hover:text-foreground"
              >
                <span>اخیر</span>
                <ChevronDown
                  className={cn(
                    'recents-controls size-3.5 shrink-0 transition-transform duration-150',
                    !recentsExpanded && 'rotate-90'
                  )}
                />
              </button>
            </h2>
            <button
              type="button"
              onClick={() => {
                setRecentsExpanded(true);
                if (recentsOpen) closeRecentsSearch();
                else setRecentsOpen(true);
              }}
              aria-label={recentsOpen ? 'بستن جستجوی اخیر' : 'جستجو در اخیر'}
              title={recentsOpen ? 'بستن جستجوی اخیر' : 'جستجو در اخیر'}
              aria-expanded={recentsOpen}
              className={cn(
                'recents-controls flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-foreground/[0.05] hover:text-foreground',
                recentsOpen && 'bg-foreground/[0.06] text-foreground'
              )}
            >
              <Search className="size-3.5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="مرتب‌سازی اخیر"
                  title={`مرتب‌سازی اخیر · ${RECENT_SORTS.find((option) => option.id === recentsSort)?.label}`}
                  className={cn(
                    'recents-controls flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-foreground/[0.05] hover:text-foreground',
                    recentsSort !== 'recent' && 'text-foreground'
                  )}
                >
                  <ArrowUpDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-40 p-1">
                {RECENT_SORTS.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onSelect={() => setRecentsSort(option.id)}
                  >
                    <span className="flex-1">{option.label}</span>
                    {recentsSort === option.id && <Check className="size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {recentsExpanded && (
            <div id="sidebar-recents-list">
          {recentsOpen && (
            <div className="px-1 pb-1">
              <div className="flex h-8 items-center gap-1.5 rounded-md bg-foreground/[0.05] px-2">
                <Search className="size-3.5 shrink-0 text-subtle" />
                <input
                  autoFocus
                  value={recentsQuery}
                  onChange={(event) => setRecentsQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') closeRecentsSearch();
                  }}
                  placeholder="جستجو در اخیر"
                  aria-label="جستجو در موارد اخیر"
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-subtle"
                />
                {recentsQuery && (
                  <button
                    type="button"
                    onClick={() => setRecentsQuery('')}
                    aria-label="پاک کردن جستجو"
                    className="flex size-5 items-center justify-center rounded text-subtle hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {recentsLoading ? (
            /* Local reads settle in a few milliseconds: stay quiet instead of
               flashing placeholder rows on every start. */
            <div className="h-0" aria-hidden="true" />
          ) : visibleRecents.length === 0 ? (
            <p className="px-2 py-1 text-[12px] leading-5 text-subtle">
              {recentsQuery ? 'نتیجه‌ای پیدا نشد.' : 'هنوز چیزی برای نمایش نیست.'}
            </p>
          ) : (
            <div className="flex flex-col">{visibleRecents.map(renderRecentItem)}</div>
          )}
            </div>
          )}
        </section>
      )}

      <div className={cn('mt-auto flex flex-col pt-3', compact && 'items-center')}>
        <AccountMenu
          compact={compact}
          onOpenSettings={onOpenSettings}
          onOpenAuth={onOpenAuth}
        />
      </div>
    </aside>
  );
};

/** A quiet side tooltip for the collapsed icon rail. */
const RailTip: React.FC<{ label: string }> = ({ label }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2.5 py-1 text-[12px] font-normal text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
  >
    {label}
  </span>
);

const SidebarNavItem: React.FC<{
  label: string;
  icon: LucideIcon;
  activeIcon?: LucideIcon;
  active?: boolean;
  compact?: boolean;
  onClick: () => void;
}> = ({ label, icon, activeIcon, active = false, compact = false, onClick }) => {
  const Glyph = active && activeIcon ? activeIcon : icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={compact ? label : undefined}
      className={cn(
        'group relative flex h-9 w-full items-center rounded-md text-[13px] font-medium transition-colors',
        compact ? 'justify-center' : 'gap-2.5 px-2.5',
        active
          ? 'bg-foreground/[0.06] text-foreground'
          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
      )}
    >
      <Glyph className="size-[18px] shrink-0" />
      {!compact && <span className="min-w-0 flex-1 truncate text-right leading-5">{label}</span>}
      {compact && <RailTip label={label} />}
    </button>
  );
};

