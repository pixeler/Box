import React from 'react';
import type { Note, Tag, Box } from '@/types/models';
import {
  RiPushpin2Fill,
  RiPushpin2Line,
  RiMore2Fill,
  RiEditLine,
  RiFolderTransferLine,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiPaletteLine,
  RiArrowLeftSLine,
} from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { stripMarkdownForPreview } from '@/lib/markdown';
import { getNoteColorPreset, NOTE_COLOR_PRESETS } from './noteTheme';

interface NoteCardProps {
  note: Note;
  index?: number;
  box?: Box | null;
  parentBox?: Box | null;
  tagsMap: Record<string, Tag>;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onMoveToBox: () => void;
  onChangeColor: (colorId: string) => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  index = 0,
  box,
  parentBox,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onMoveToBox,
  onChangeColor,
  onDragStart,
}) => {
  const isPinned = !!note.pinned;

  // Custom user-selected color only (no random pastel colors by default)
  const hasCustomColor = Boolean(note.color && note.color !== 'default');
  const preset = hasCustomColor ? getNoteColorPreset(note.color, index) : null;

  // Note title & body preview
  const title = note.title?.trim() || 'بدون عنوان';
  const rawBody = note.body?.trim() || note.description?.trim() || '';
  const cleanPreview = stripMarkdownForPreview(
    rawBody.startsWith(title) ? rawBody.slice(title.length).trim() : rawBody
  );

  const cardThemeClass = preset
    ? `${preset.lightBg} ${preset.lightBorder} ${preset.darkBg} ${preset.darkBorder}`
    : 'bg-card text-card-foreground border-border/80 dark:border-white/10 hover:border-primary/40';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', note.id);
        e.dataTransfer.setData('text/note-id', note.id);
        e.dataTransfer.effectAllowed = 'move';
        if (onDragStart) onDragStart(e);
      }}
      onClick={onClick}
      className={`group relative rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer border shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] select-none min-w-0 w-full max-w-[200px] min-h-[140px] ${cardThemeClass}`}
      style={{ maxWidth: '200px' }}
      dir="rtl"
    >
      {/* Top Header: Title + Pin & Actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2 break-words">
          {title}
        </h3>

        {/* Pin & Dropdown Actions Menu */}
        <div className="flex items-center gap-1 shrink-0 -mt-1 -ml-1">
          {isPinned && (
            <span
              className="p-0.5 text-amber-500"
              title="سنجاق شده"
            >
              <RiPushpin2Fill className="w-3.5 h-3.5" />
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="عملیات یادداشت"
              >
                <RiMore2Fill className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              className="w-44 bg-card/95 backdrop-blur-md rounded-2xl p-1 shadow-xl border border-border/70 z-50 text-right font-sans"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <DropdownMenuItem
                onClick={onEdit}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary"
              >
                <RiEditLine className="w-3.5 h-3.5 text-muted-foreground" />
                <span>ویرایش یادداشت</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onMoveToBox}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary"
              >
                <RiFolderTransferLine className="w-3.5 h-3.5 text-muted-foreground" />
                <span>انتقال به باکس دیگر...</span>
              </DropdownMenuItem>

              {/* Sub-menu to pick custom color */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary">
                  <RiPaletteLine className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>تغییر رنگ کارت</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="p-2 grid grid-cols-4 gap-1.5 w-40 bg-card rounded-2xl shadow-xl border border-border/80">
                  <button
                    type="button"
                    onClick={() => onChangeColor('default')}
                    className="w-6 h-6 rounded-full border border-border bg-card text-[9px] flex items-center justify-center font-bold text-muted-foreground transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    title="پیش‌فرض (بدون رنگ)"
                  >
                    ×
                  </button>
                  {NOTE_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChangeColor(p.id)}
                      className={`w-6 h-6 rounded-full border border-black/15 transition-transform hover:scale-110 active:scale-95 cursor-pointer ${p.lightBg}`}
                      title={p.name}
                    />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                onClick={onTogglePin}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary"
              >
                {isPinned ? (
                  <>
                    <RiPushpin2Line className="w-3.5 h-3.5 text-amber-500" />
                    <span>برداشتن سنجاق</span>
                  </>
                ) : (
                  <>
                    <RiPushpin2Fill className="w-3.5 h-3.5 text-amber-500" />
                    <span>سنجاق کردن</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={onDuplicate}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-secondary"
              >
                <RiFileCopyLine className="w-3.5 h-3.5 text-muted-foreground" />
                <span>تکثیر / کپی</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              <DropdownMenuItem
                onClick={onDelete}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl cursor-pointer text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/20"
              >
                <RiDeleteBinLine className="w-3.5 h-3.5" />
                <span>حذف یادداشت</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Body Preview */}
      {cleanPreview && (
        <p className="text-xs sm:text-[13px] text-muted-foreground/80 leading-relaxed font-sans break-words line-clamp-3 sm:line-clamp-4 flex-1">
          {cleanPreview}
        </p>
      )}

      {/* Bottom Footer: Box Breadcrumb Path (e.g. سناریوها > یوتوب) matching user screenshot */}
      {box && (
        <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground/75 font-medium pt-3 mt-auto">
          {parentBox && (
            <>
              <span className="hover:underline">{parentBox.title}</span>
              <RiArrowLeftSLine className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </>
          )}
          <span className="underline underline-offset-2 decoration-muted-foreground/40">{box.title}</span>
        </div>
      )}
    </div>
  );
};
