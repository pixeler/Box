import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Box, Task, Note, Tag } from '@/types/models';
import { boxRepo, taskRepo } from '@/repositories';
import { BoxThumbnail } from './BoxThumbnail';
import { TaskEditModal } from '@/components/task/TaskEditModal';
import { NoteEditModal } from '@/components/notebook/NoteEditModal';
import { toPersianDigits, formatJalaliDisplay, parseJalaliKey, getTodayJalaliKey } from '@/lib/jalali';
import {
  RiArrowRightLine,
  RiSearchLine,
  RiAddLine,
  RiCheckboxCircleFill,
  RiCheckboxBlankCircleLine,
  RiFlagFill,
  RiPriceTag3Line,
  RiFileTextLine,
  RiMore2Fill,
  RiPushpinFill,
  RiSortDesc,
} from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BoxDetailViewProps {
  box: Box;
  onBack: () => void;
  onEditBox: (box: Box) => void;
  onOpenAddForBox: (boxId: string) => void;
  tagsMap: Record<string, Tag>;
}

type SortOption = 'date_desc' | 'date_asc' | 'priority' | 'alphabetical' | 'status';
type TypeFilter = 'all' | 'task' | 'note';

export const BoxDetailView: React.FC<BoxDetailViewProps> = ({
  box,
  onBack,
  onEditBox,
  onOpenAddForBox,
  tagsMap,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const todayKey = getTodayJalaliKey();

  const loadItems = useCallback(async () => {
    try {
      const data = await boxRepo.getItems(box.id);
      setTasks(data.tasks);
      setNotes(data.notes);
    } catch (err) {
      console.error('Failed to load box items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [box.id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleToggleTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await taskRepo.toggleDone(taskId);
      loadItems();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  // Filter & sort
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Filter tasks
    let tList = tasks.filter((t) => {
      if (typeFilter === 'note') return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    });

    // 2. Filter notes
    let nList = notes.filter((n) => {
      if (typeFilter === 'task') return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.body && n.body.toLowerCase().includes(q)) ||
        (n.description && n.description.toLowerCase().includes(q))
      );
    });

    type UnifiedItem =
      | { kind: 'task'; item: Task; dateStr: string; title: string; priority: number }
      | { kind: 'note'; item: Note; dateStr: string; title: string; priority: number };

    const unified: UnifiedItem[] = [
      ...tList.map((t) => ({
        kind: 'task' as const,
        item: t,
        dateStr: t.due_date || t.created_at,
        title: t.title,
        priority: t.priority || 0,
      })),
      ...nList.map((n) => ({
        kind: 'note' as const,
        item: n,
        dateStr: n.date_key || n.created_at,
        title: n.title,
        priority: 0,
      })),
    ];

    // Sort
    unified.sort((a, b) => {
      if (sortBy === 'priority') {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime();
      }
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title, 'fa');
      }
      if (sortBy === 'status') {
        const aDone = a.kind === 'task' && a.item.status === 'done' ? 1 : 0;
        const bDone = b.kind === 'task' && b.item.status === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime();
      }
      // date_desc
      return new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime();
    });

    return unified;
  }, [tasks, notes, searchQuery, typeFilter, sortBy]);

  const sortLabel = {
    date_desc: 'جدیدترین تاریخ',
    date_asc: 'قدیمی‌ترین تاریخ',
    priority: 'بیشترین اولویت',
    alphabetical: 'حروف الفبا (الف - ی)',
    status: 'انجام‌نشده‌ها اول',
  }[sortBy];

  return (
    <div className="flex-1 flex flex-col min-h-0 text-right font-sans" dir="rtl">
      {/* 1. Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="بازگشت به لیست باکس‌ها"
          >
            <RiArrowRightLine className="w-4.5 h-4.5" />
          </button>

          {/* Box graphic and title */}
          <div className="flex items-center gap-2.5">
            <BoxThumbnail box={box} size="sm" />
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                {box.title}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {toPersianDigits(tasks.length)} تسک • {toPersianDigits(notes.length)} یادداشت
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions: Edit & Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <RiMore2Fill className="w-4.5 h-4.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40 p-1 text-xs" dir="rtl">
            <DropdownMenuItem onClick={() => onEditBox(box)} className="cursor-pointer">
              ویرایش مشخصات باکس
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Search & Toolbar */}
      <div className="pt-3 pb-2 space-y-2.5 shrink-0">
        {/* Search input */}
        <div className="relative flex items-center">
          <RiSearchLine className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در این باکس..."
            className="w-full text-xs text-foreground bg-muted/40 dark:bg-white/5 border border-border/70 dark:border-white/10 rounded-xl pr-9 pl-3 py-2 outline-none focus:border-primary placeholder:text-muted-foreground/50 dark:placeholder:text-zinc-500 transition-all"
          />
        </div>

        {/* Filter chips & Sort dropdown */}
        <div className="flex items-center justify-between gap-2">
          {/* Filter Type Pills */}
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'همه' },
                { id: 'task', label: `تسک‌ها (${toPersianDigits(tasks.length)})` },
                { id: 'note', label: `یادداشت‌ها (${toPersianDigits(notes.length)})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
                  typeFilter === tab.id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent shadow-xs font-bold'
                    : 'border-border/70 dark:border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/40 dark:bg-white/5 px-2.5 py-1 rounded-full border border-border/70 dark:border-white/10 transition-colors cursor-pointer"
              >
                <RiSortDesc className="w-3.5 h-3.5" />
                <span>{sortLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44 p-1 text-xs" dir="rtl">
              <DropdownMenuItem onClick={() => setSortBy('date_desc')}>جدیدترین تاریخ</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('date_asc')}>قدیمی‌ترین تاریخ</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')}>بیشترین اولویت</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>الفبایی (الف - ی)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('status')}>انجام‌نشده‌ها اول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 3. Items List Area */}
      <div className="flex-1 overflow-y-auto pt-1 pb-16 space-y-2 no-scrollbar">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            در حال بارگذاری...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/50 dark:bg-white/5 flex items-center justify-center mx-auto text-muted-foreground">
              <RiFileTextLine className="w-6 h-6" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {searchQuery
                ? 'موردی متناسب با جستجو یافت نشد'
                : 'هنوز تسک یا یادداشتی در این باکس قرار نگرفته است'}
            </p>
            <button
              type="button"
              onClick={() => onOpenAddForBox(box.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <RiAddLine className="w-4 h-4" />
              <span>افزودن اولین آیتم به این باکس</span>
            </button>
          </div>
        ) : (
          filteredItems.map((u) => {
            if (u.kind === 'task') {
              const task = u.item;
              const isDone = task.status === 'done';

              return (
                <div
                  key={task.id}
                  onClick={() => setEditingTask(task)}
                  className={`group flex items-start gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                    isDone
                      ? 'bg-muted/30 border-border/40 dark:border-white/5 opacity-65'
                      : 'bg-card dark:bg-white/5 border-border/70 dark:border-white/10 hover:border-primary/40 shadow-xs'
                  }`}
                >
                  {/* Done Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleTask(e, task.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0 cursor-pointer"
                  >
                    {isDone ? (
                      <RiCheckboxCircleFill className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                    ) : (
                      <RiCheckboxBlankCircleLine className="w-5 h-5 text-muted-foreground/60 hover:text-primary" />
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-semibold block truncate leading-snug ${
                        isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </span>

                    {task.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}

                    {/* Chips Row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted/60 dark:bg-white/5 px-2 py-0.5 rounded-md">
                          {task.due_date === todayKey
                            ? 'امروز'
                            : formatJalaliDisplay(parseJalaliKey(task.due_date))}
                        </span>
                      )}

                      {task.priority !== undefined && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          <RiFlagFill className="w-3 h-3" />
                          <span>
                            {task.priority === 3 ? 'فوری' : task.priority === 2 ? 'متوسط' : 'کم'}
                          </span>
                        </span>
                      )}

                      {task.tag_ids?.map((tId) => {
                        const tag = tagsMap[tId];
                        if (!tag) return null;
                        return (
                          <span
                            key={tId}
                            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 dark:bg-white/5 px-1.5 py-0.5 rounded-md"
                          >
                            <RiPriceTag3Line className="w-2.5 h-2.5" />
                            <span>{tag.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            } else {
              const note = u.item;
              return (
                <div
                  key={note.id}
                  onClick={() => setEditingNote(note)}
                  className="group p-3 rounded-2xl bg-card dark:bg-white/5 border border-border/70 dark:border-white/10 hover:border-primary/40 shadow-xs transition-all cursor-pointer select-none space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <RiFileTextLine className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate">
                        {note.title}
                      </span>
                    </div>

                    {note.pinned && (
                      <RiPushpinFill className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </div>

                  {(note.description || note.body) && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {note.description || note.body}
                    </p>
                  )}

                  {note.tag_ids && note.tag_ids.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {note.tag_ids.map((tId) => {
                        const tag = tagsMap[tId];
                        if (!tag) return null;
                        return (
                          <span
                            key={tId}
                            className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-white/5 px-1.5 py-0.5 rounded-md"
                          >
                            #{tag.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
          })
        )}
      </div>

      {/* 4. Floating Action: Add to this Box */}
      <div className="absolute bottom-5 left-5 z-10">
        <button
          type="button"
          onClick={() => onOpenAddForBox(box.id)}
          className="flex items-center gap-2 bg-[#1f2329] hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 px-5 py-3 rounded-full text-xs font-bold shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <RiAddLine className="w-4 h-4" />
          <span>افزودن به این باکس</span>
        </button>
      </div>

      {/* Task Edit Modal */}
      <TaskEditModal
        task={editingTask}
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSaved={loadItems}
      />

      {/* Note Edit Modal */}
      <NoteEditModal
        note={editingNote}
        isOpen={Boolean(editingNote)}
        onClose={() => setEditingNote(null)}
        onSaved={loadItems}
      />
    </div>
  );
};
