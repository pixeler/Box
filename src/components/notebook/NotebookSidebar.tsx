import React from 'react';
import type { Box } from '@/types/models';
import {
  RiBookletLine,
  RiInboxLine,
  RiPushpin2Line,
  RiLightbulbLine,
  RiAddLine,
  RiMore2Line,
  RiEditLine,
  RiDeleteBinLine,
  RiFileList3Line,
} from '@remixicon/react';
import { toPersianDigits } from '@/lib/jalali';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export type NotebookFilterType = 'all' | 'pinned' | 'ideas' | 'uncategorized' | 'box';

interface NotebookSidebarProps {
  boxes: Box[];
  currentFilter: NotebookFilterType;
  selectedBoxId: string | null;
  totalNotesCount: number;
  pinnedCount: number;
  ideasCount: number;
  uncategorizedCount: number;
  boxNotesCountMap: Record<string, number>;
  onSelectFilter: (filter: NotebookFilterType, boxId?: string | null) => void;
  onOpenCreateBox: () => void;
  onEditBox: (box: Box) => void;
  onDeleteBox: (box: Box) => void;
  onDropNoteOnBox: (noteId: string, targetBoxId: string | null) => void;
  className?: string;
}

export const NotebookSidebar: React.FC<NotebookSidebarProps> = ({
  boxes,
  currentFilter,
  selectedBoxId,
  totalNotesCount,
  pinnedCount,
  ideasCount,
  uncategorizedCount,
  boxNotesCountMap,
  onSelectFilter,
  onOpenCreateBox,
  onEditBox,
  onDeleteBox,
  onDropNoteOnBox,
  className = '',
}) => {
  const [dragOverBoxId, setDragOverBoxId] = React.useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, boxId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBoxId(boxId);
  };

  const handleDragLeave = () => {
    setDragOverBoxId(null);
  };

  const handleDrop = (e: React.DragEvent, boxId: string | null) => {
    e.preventDefault();
    setDragOverBoxId(null);
    const noteId = e.dataTransfer.getData('text/note-id');
    if (noteId) {
      onDropNoteOnBox(noteId, boxId);
    }
  };

  return (
    <aside
      className={`w-full flex flex-col justify-between py-4 select-none ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col gap-5">
        {/* Sidebar Header */}
        <div className="px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <RiBookletLine className="size-4.5" />
            </span>
            <div>
              <h2 className="font-darvish text-sm sm:text-base font-bold text-foreground">
                کتابخانه و یادداشت‌ها
              </h2>
              <span className="text-[10px] text-muted-foreground">
                سامان‌دهی در جعبه‌ها
              </span>
            </div>
          </div>
        </div>

        {/* Quick System Navigation */}
        <div className="flex flex-col gap-1 px-1">
          {/* All Notes */}
          <button
            type="button"
            onClick={() => onSelectFilter('all', null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentFilter === 'all'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RiFileList3Line className="size-4 shrink-0 opacity-70" />
              <span>همه یادداشت‌ها</span>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                currentFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {toPersianDigits(totalNotesCount)}
            </span>
          </button>

          {/* Pinned */}
          <button
            type="button"
            onClick={() => onSelectFilter('pinned', null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentFilter === 'pinned'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RiPushpin2Line className="size-4 shrink-0 text-amber-500" />
              <span>سنجاق‌شده‌ها</span>
            </div>
            {pinnedCount > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  currentFilter === 'pinned'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {toPersianDigits(pinnedCount)}
              </span>
            )}
          </button>

          {/* Ideas */}
          <button
            type="button"
            onClick={() => onSelectFilter('ideas', null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              currentFilter === 'ideas'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RiLightbulbLine className="size-4 shrink-0 text-amber-500" />
              <span>ایده‌ها</span>
            </div>
            {ideasCount > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  currentFilter === 'ideas'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {toPersianDigits(ideasCount)}
              </span>
            )}
          </button>

          {/* Uncategorized (بدون جعبه) */}
          <button
            type="button"
            onDragOver={(e) => handleDragOver(e, 'null')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
            onClick={() => onSelectFilter('uncategorized', null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              dragOverBoxId === 'null' ? 'ring-2 ring-primary bg-primary/10' : ''
            } ${
              currentFilter === 'uncategorized'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RiInboxLine className="size-4 shrink-0 opacity-70" />
              <span>بدون جعبه</span>
            </div>
            {uncategorizedCount > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  currentFilter === 'uncategorized'
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {toPersianDigits(uncategorizedCount)}
              </span>
            )}
          </button>
        </div>

        {/* Section: جعبه‌های من (Folders / Categories) */}
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-bold text-muted-foreground tracking-wider">
              جعبه‌های من
            </span>
            <button
              type="button"
              onClick={onOpenCreateBox}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-bold transition-colors cursor-pointer"
              title="ایجاد جعبه جدید"
            >
              <RiAddLine className="size-3.5" />
              <span>جعبه جدید</span>
            </button>
          </div>

          <div className="flex flex-col gap-0.5 max-h-[calc(100vh-380px)] overflow-y-auto no-scrollbar">
            {boxes.map((box) => {
              const isActive = currentFilter === 'box' && selectedBoxId === box.id;
              const isDragOver = dragOverBoxId === box.id;
              const count = boxNotesCountMap[box.id] || 0;

              return (
                <div
                  key={box.id}
                  onDragOver={(e) => handleDragOver(e, box.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, box.id)}
                  className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isDragOver ? 'ring-2 ring-primary scale-[1.02] bg-primary/15' : ''
                  } ${
                    isActive
                      ? 'bg-secondary text-foreground font-bold shadow-xs'
                      : 'text-foreground hover:bg-secondary/60'
                  }`}
                  onClick={() => onSelectFilter('box', box.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: box.color || '#8B5CF6' }}
                    />
                    <span className="truncate max-w-[130px]">{box.title}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Count badge */}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-card text-foreground font-bold shadow-xs'
                          : 'bg-secondary/80 text-muted-foreground group-hover:bg-secondary'
                      }`}
                    >
                      {toPersianDigits(count)}
                    </span>

                    {/* Box options menu on hover */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="size-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="تنظیمات جعبه"
                        >
                          <RiMore2Line className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="start"
                        className="w-40 bg-card rounded-2xl p-1 shadow-xl border border-border/70 z-50 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={() => onEditBox(box)}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary"
                        >
                          <RiEditLine className="size-3.5 text-muted-foreground" />
                          <span>ویرایش جعبه</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onDeleteBox(box)}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer text-rose-500 hover:bg-rose-500/10"
                        >
                          <RiDeleteBinLine className="size-3.5" />
                          <span>حذف جعبه</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}

            {boxes.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                هیچ جعبه‌ای ساخته نشده است
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer button */}
      <div className="px-3 pt-3 border-t border-border/50">
        <button
          type="button"
          onClick={onOpenCreateBox}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-border/80 hover:border-primary/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-secondary/30 hover:bg-secondary/60 active:scale-98"
        >
          <RiAddLine className="size-4 text-primary" />
          <span>ساخت جعبه جدید</span>
        </button>
      </div>
    </aside>
  );
};
