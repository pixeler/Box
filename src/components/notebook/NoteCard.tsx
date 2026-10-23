import React from 'react';
import type { Note, Tag, Box } from '@/types/models';
import {
  RiPushpin2Fill,
  RiPushpin2Line,
  RiMoreLine,
  RiEditLine,
  RiFolderTransferLine,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiPaletteLine,
} from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stripMarkdownForPreview } from '@/lib/markdown';
import { getNoteColorPreset, NOTE_COLOR_PRESETS, formatNoteDate } from './noteTheme';
import { BOX_ICONS_LIST } from '@/components/boxes/BoxIconRenderer';
import {
  noteMenuContentClass,
  noteMenuDangerClass,
  noteMenuItemClass,
  noteMenuSeparatorClass,
} from './noteMenu';

interface NoteCardProps {
  note: Note;
  index?: number;
  box?: Box | null;
  tagsMap: Record<string, Tag>;
  /** Show the folder name in the footer, e.g. in the All notes view. */
  showBoxPath?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onMoveToBox: () => void;
  onChangeColor: (colorId: string) => void;
  onDragStart?: (e: React.DragEvent) => void;
}

/**
 * A note tile: a tall, quiet card with the title on top, a preview that fades
 * into the card, and the date at the bottom. Actions sit behind the menu in the
 * footer so the words lead.
 */
export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  index = 0,
  box,
  showBoxPath = false,
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
  const NoteIcon = note.icon
    ? BOX_ICONS_LIST.find((item) => item.id === note.icon)?.Icon || null
    : null;

  const coverImage =
    note.cover && /^(data:|https?:|blob:)/.test(note.cover) ? note.cover : null;
  const hasCustomColor = !coverImage && Boolean(note.color && note.color !== 'default');
  const preset = hasCustomColor ? getNoteColorPreset(note.color, index) : null;

  const title = note.title?.trim() || 'بدون عنوان';
  const rawBody = note.body?.trim() || note.description?.trim() || '';
  const cleanPreview = stripMarkdownForPreview(
    rawBody.startsWith(title) ? rawBody.slice(title.length).trim() : rawBody
  );

  const cardThemeClass = preset
    ? `${preset.lightBg} ${preset.lightBorder} ${preset.darkBg} ${preset.darkBorder}`
    : 'border-border/50 bg-card hover:border-border';

  const titleThemeClass = preset
    ? `${preset.lightText} ${preset.darkText}`
    : 'text-foreground';

  const bodyThemeClass = preset
    ? `${preset.lightSubtext} ${preset.darkSubtext}`
    : 'text-muted-foreground';

  const onCardKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`یادداشت ${title}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', note.id);
        e.dataTransfer.setData('text/note-id', note.id);
        e.dataTransfer.effectAllowed = 'move';
        if (onDragStart) onDragStart(e);
      }}
      onClick={onClick}
      onKeyDown={onCardKeyDown}
      className={`note-tile group/note relative flex aspect-[4/5] w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border p-3 text-right shadow-[0_6px_18px_rgba(15,15,13,0.07)] transition-all duration-200 outline-none select-none hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,15,13,0.16)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-none dark:hover:shadow-none ${cardThemeClass}`}
      dir="rtl"
    >
      {coverImage && (
        <div className="-mx-3 -mt-3 mb-2 h-20 shrink-0 overflow-hidden bg-secondary">
          <img
            src={coverImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-start gap-1.5">
        {note.icon && (
          <span className="mt-px shrink-0 text-[14px] leading-5 text-muted-foreground" aria-hidden="true">
            {NoteIcon ? <NoteIcon className="size-3.5" /> : note.icon}
          </span>
        )}

        <h3
          className={`line-clamp-2 min-w-0 flex-1 break-words text-[13px] font-semibold leading-[1.6] sm:text-[14px] ${titleThemeClass}`}
        >
          {title}
        </h3>

        {isPinned && (
          <span className="mt-0.5 shrink-0 text-muted-foreground" title="سنجاق شده">
            <RiPushpin2Fill className="size-3.5" />
          </span>
        )}
      </div>

      {cleanPreview && (
        <div
          className="mt-2 min-h-0 flex-1 overflow-hidden"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
          }}
        >
          <p
            className={`line-clamp-[10] break-words text-[11px] leading-[1.9] ${bodyThemeClass}`}
          >
            {cleanPreview}
          </p>
        </div>
      )}

      <div
        className={`mt-2 flex shrink-0 items-center gap-1.5 text-[10px] leading-4 ${
          preset ? `${preset.lightSubtext} ${preset.darkSubtext}` : 'text-muted-foreground'
        }`}
      >
        <span className="shrink-0">{formatNoteDate(note.created_at)}</span>

        {showBoxPath && box && (
          <span className="min-w-0 truncate opacity-80">{box.title}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`گزینه‌های یادداشت ${title}`}
              title="گزینه‌های یادداشت"
              onClick={(e) => e.stopPropagation()}
              className="ms-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/80 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiMoreLine className="size-4" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className={noteMenuContentClass}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem className={noteMenuItemClass} onClick={onEdit}>
              <RiEditLine className="size-3.5 text-muted-foreground" />
              <span>ویرایش یادداشت</span>
            </DropdownMenuItem>

            <DropdownMenuItem className={noteMenuItemClass} onClick={onMoveToBox}>
              <RiFolderTransferLine className="size-3.5 text-muted-foreground" />
              <span>انتقال به پوشه دیگر...</span>
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={noteMenuItemClass}>
                <RiPaletteLine className="size-3.5 text-muted-foreground" />
                <span>رنگ کارت</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44 rounded-xl border border-border/70 bg-popover p-2 shadow-xl">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeColor('default')}
                    className={`flex size-6 items-center justify-center rounded-full border bg-card text-[10px] font-bold text-muted-foreground transition-transform hover:scale-105 active:scale-95 ${
                      !hasCustomColor
                        ? 'border-foreground/40 ring-2 ring-foreground/20'
                        : 'border-border'
                    }`}
                    title="پیش‌فرض (بدون رنگ)"
                    aria-label="پیش‌فرض (بدون رنگ)"
                  >
                    ×
                  </button>
                  {NOTE_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChangeColor(p.id)}
                      className={`size-6 rounded-full border border-black/10 transition-transform hover:scale-105 active:scale-95 ${p.lightBg} ${
                        note.color === p.id
                          ? 'ring-2 ring-foreground/40 ring-offset-1 ring-offset-popover'
                          : ''
                      }`}
                      title={p.name}
                      aria-label={p.name}
                      aria-pressed={note.color === p.id}
                    />
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem className={noteMenuItemClass} onClick={onTogglePin}>
              {isPinned ? (
                <>
                  <RiPushpin2Line className="size-3.5 text-muted-foreground" />
                  <span>برداشتن سنجاق</span>
                </>
              ) : (
                <>
                  <RiPushpin2Fill className="size-3.5 text-muted-foreground" />
                  <span>سنجاق کردن</span>
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem className={noteMenuItemClass} onClick={onDuplicate}>
              <RiFileCopyLine className="size-3.5 text-muted-foreground" />
              <span>تکثیر / کپی</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className={noteMenuSeparatorClass} />

            <DropdownMenuItem
              className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
              onClick={onDelete}
            >
              <RiDeleteBinLine className="size-3.5" />
              <span>حذف یادداشت</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
};
