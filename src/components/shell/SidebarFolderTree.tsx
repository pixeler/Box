import React, { useEffect, useMemo, useState } from 'react';
import type { Box } from '@/types/models';
import { useNotebook } from '@/components/notebook/NotebookContext';
import { toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronLeft, Folder, Layers } from 'lucide-react';

interface SidebarFolderTreeProps {
  onNavigate: () => void;
  /** False when the parent "یادداشت‌ها" row already acts as "all notes". */
  showAll?: boolean;
}

interface FolderRowProps {
  box: Box;
  depth: number;
  count: number;
  active: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggle: () => void;
  children?: React.ReactNode;
}

const FolderRow: React.FC<FolderRowProps> = ({
  box,
  depth,
  count,
  active,
  expanded,
  hasChildren,
  onSelect,
  onToggle,
  children,
}) => (
  <div>
    <div
      className={cn(
        'group/folder flex h-8 min-w-0 items-center gap-1.5 rounded-md pe-3 transition-colors',
        active
          ? 'bg-foreground/[0.06] text-foreground'
          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
      )}
      style={{ paddingInlineStart: `${8 + depth * 12}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={hasChildren ? (expanded ? 'بستن پوشه' : 'باز کردن پوشه') : undefined}
        tabIndex={hasChildren ? 0 : -1}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded text-subtle transition-colors',
          hasChildren
            ? 'hover:text-foreground'
            : 'pointer-events-none text-transparent'
        )}
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={onSelect}
        title={box.title}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-right outline-none"
      >
        <Folder className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-5">{box.title}</span>
        {count > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-subtle">
            {toPersianDigits(count)}
          </span>
        )}
      </button>
    </div>

    {expanded && children}
  </div>
);

/**
 * The compact folder tree that lives inside the main sidebar. It is a
 * navigation surface, not a full file manager: selecting a folder filters the
 * notes view, and the deeper tree stays one click away.
 */
export const SidebarFolderTree: React.FC<SidebarFolderTreeProps> = ({
  onNavigate,
  showAll = true,
}) => {
  const { boxes, notes, currentFolderId, setCurrentFolderId } = useNotebook();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    notes.forEach((note) => {
      if (!note.box_id) return;
      map[note.box_id] = (map[note.box_id] || 0) + 1;
    });
    return map;
  }, [notes]);

  const byParent = useMemo(() => {
    const map: Record<string, Box[]> = {};
    boxes.forEach((box) => {
      const key = box.parent_id || 'root';
      if (!map[key]) map[key] = [];
      map[key].push(box);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'fa'))
    );
    return map;
  }, [boxes]);

  // Reveal the active folder's ancestors when the user arrives from a note.
  useEffect(() => {
    if (!currentFolderId || currentFolderId === 'all_notes') return;

    const ancestors: string[] = [];
    const seen = new Set<string>();
    let cursor = boxes.find((box) => box.id === currentFolderId)?.parent_id ?? null;

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      ancestors.push(cursor);
      cursor = boxes.find((box) => box.id === cursor)?.parent_id ?? null;
    }

    if (!ancestors.length) return;
    setExpandedIds((previous) => {
      const next = new Set(previous);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [boxes, currentFolderId]);

  const selectFolder = (id: string | null | 'all_notes') => {
    setCurrentFolderId(id);
    onNavigate();
  };

  const toggleFolder = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderBox = (box: Box, depth = 0): React.ReactNode => {
    const children = byParent[box.id] || [];
    const hasChildren = children.length > 0;
    const expanded = expandedIds.has(box.id);

    return (
      <FolderRow
        key={box.id}
        box={box}
        depth={depth}
        count={counts[box.id] || 0}
        active={currentFolderId === box.id}
        expanded={expanded}
        hasChildren={hasChildren}
        onSelect={() => selectFolder(box.id)}
        onToggle={() => toggleFolder(box.id)}
      >
        {children.map((child) => renderBox(child, depth + 1))}
      </FolderRow>
    );
  };

  const roots = byParent.root || [];

  return (
    <div className="flex flex-col gap-0.5">
      {showAll && (
        <button
          type="button"
          onClick={() => selectFolder('all_notes')}
          className={cn(
            'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[13px] transition-colors',
            currentFolderId === 'all_notes'
              ? 'bg-foreground/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
          )}
        >
          <Layers className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-right">همه یادداشت‌ها</span>
          <span className="shrink-0 text-[11px] tabular-nums text-subtle">
            {toPersianDigits(notes.length)}
          </span>
        </button>
      )}

      {roots.length === 0 ? (
        <p className="px-2 py-1.5 text-[12px] leading-5 text-subtle">هنوز پوشه‌ای نساخته‌ای.</p>
      ) : (
        roots.map((box) => renderBox(box))
      )}
    </div>
  );
};

