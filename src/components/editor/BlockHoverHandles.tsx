import React, { useEffect, useRef, useState } from 'react';
import { useBlockNoteEditor, useExtension } from '@blocknote/react';
import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  noteMenuContentClass,
  noteMenuDangerClass,
  noteMenuItemClass,
  noteMenuSeparatorClass,
} from '@/components/notebook/noteMenu';
import {
  RiAddLine,
  RiDraggable,
  RiFileCopyLine,
  RiLink,
  RiParagraph,
  RiH1,
  RiH2,
  RiH3,
  RiListUnordered,
  RiListOrdered,
  RiListCheck,
  RiDoubleQuotesL,
  RiPaletteLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { toast } from '@/lib/toast';
import { ColorPanel } from './EditorColorMenu';

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'متن', Icon: RiParagraph },
  { type: 'heading', label: 'عنوان ۱', Icon: RiH1, props: { level: 1 } },
  { type: 'heading', label: 'عنوان ۲', Icon: RiH2, props: { level: 2 } },
  { type: 'heading', label: 'عنوان ۳', Icon: RiH3, props: { level: 3 } },
  { type: 'bulletListItem', label: 'لیست نقطه‌ای', Icon: RiListUnordered },
  { type: 'numberedListItem', label: 'لیست شماره‌دار', Icon: RiListOrdered },
  { type: 'checkListItem', label: 'چک‌لیست', Icon: RiListCheck },
  { type: 'quote', label: 'نقل‌قول', Icon: RiDoubleQuotesL },
];

interface HoverState {
  id: string;
  /** Handles position (editor gutter). */
  left: number;
  top: number;
  /** Selection rectangle of the block itself. */
  blockLeft: number;
  width: number;
  height: number;
  blockTop: number;
}

/**
 * Our own block controls: a "+" and a drag handle at the start of whichever
 * block the pointer is over, a selection overlay on that same block, and a rich
 * menu behind the handle. BlockNote's floating side menu is hidden.
 */
export const BlockHoverHandles: React.FC = () => {
  const editor = useBlockNoteEditor<any, any, any>();
  const sideMenu = useExtension(SideMenuExtension as any) as any;

  const [hover, setHover] = useState<HoverState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selection, setSelection] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpenRef = useRef(false);
  const dragActiveRef = useRef(false);
  const draggedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingEventRef = useRef<MouseEvent | null>(null);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    const scheduleHide = () => {
      if (menuOpenRef.current || dragActiveRef.current) return;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setHover(null), 150);
    };

    const processMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Moving onto the handles keeps them alive.
      if (target.closest('.bn-custom-handles')) return;

      const editorRoot = target.closest('.bn-editor') as HTMLElement | null;
      if (!editorRoot) {
        scheduleHide();
        return;
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      const blockEl = target.closest('.bn-block-outer') as HTMLElement | null;
      if (!blockEl) return;

      let id = '';
      try {
        const view = editor.prosemirrorView;
        const posInfo = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (posInfo) {
          const $pos = view.state.doc.resolve(posInfo.pos);
          for (let depth = $pos.depth; depth > 0; depth--) {
            const node = $pos.node(depth);
            if (node.attrs?.id) {
              id = String(node.attrs.id);
              break;
            }
          }
        }
      } catch {
        // pointer outside the document: keep the last target
      }
      if (!id) return;

      const rect = blockEl.getBoundingClientRect();
      const rootRect = editorRoot.getBoundingClientRect();
      const gutterLeft = rootRect.left + 4;

      setHover((prev) => {
        if (
          prev &&
          prev.id === id &&
          prev.top === rect.top &&
          prev.blockTop === rect.top &&
          prev.left === gutterLeft &&
          prev.width === rect.width &&
          prev.height === rect.height
        ) {
          return prev;
        }
        return {
          id,
          left: gutterLeft,
          top: rect.top,
          blockLeft: rect.left,
          width: rect.width,
          height: rect.height,
          blockTop: rect.top,
        };
      });
    };

    // Throttled to one frame and completely skipped while the pointer is down,
    // so selecting text stays smooth.
    const onMove = (event: MouseEvent) => {
      if (event.buttons !== 0) return;

      pendingEventRef.current = event;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const pending = pendingEventRef.current;
        if (pending) processMove(pending);
      });
    };

    document.addEventListener('mousemove', onMove);

    return () => {
      document.removeEventListener('mousemove', onMove);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [editor]);

  const block = hover ? editor.getBlock(hover.id) : undefined;

  const keepVisible = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleOverlayLeave = () => {
    if (menuOpen || dragActiveRef.current) return;
    hideTimerRef.current = setTimeout(() => setHover(null), 150);
  };

  /** One exit path for the menu: the highlight must never outlive it. */
  const closeMenu = () => {
    setMenuOpen(false);
    setSelection(null);
    if (!dragActiveRef.current) setHover(null);
  };

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (open) {
      keepVisible();
      if (hover) {
        setSelection({
          left: hover.blockLeft,
          top: hover.blockTop,
          width: hover.width,
          height: hover.height,
        });
      }
    } else {
      closeMenu();
    }
  };

  const openMenu = () => {
    if (hover) {
      setSelection({
        left: hover.blockLeft,
        top: hover.blockTop,
        width: hover.width,
        height: hover.height,
      });
      keepVisible();
    }
    setMenuOpen(true);
  };

  const insertBelow = () => {
    if (!block) return;
    try {
      const inserted = editor.insertBlocks([{ type: 'paragraph' }], block, 'after');
      if (inserted?.[0]) {
        editor.setTextCursorPosition(inserted[0], 'start');
        editor.focus();
      }
    } catch (err) {
      console.error('Failed to insert a block:', err);
    }
  };

  const turnInto = (type: string, props?: Record<string, unknown>) => {
    if (!block) return;
    editor.updateBlock(block, { type, props } as any);
    closeMenu();
  };

  const setBlockColor = (kind: 'text' | 'background', color: string) => {
    if (!block) return;
    editor.updateBlock(
      block,
      {
        props: kind === 'text' ? { textColor: color } : { backgroundColor: color },
      } as any
    );
  };

  const duplicateBlock = () => {
    if (!block) return;
    try {
      editor.insertBlocks(
        [
          {
            type: block.type,
            props: { ...block.props },
            content: block.content,
          } as any,
        ],
        block,
        'after'
      );
    } catch (err) {
      console.error('Failed to duplicate block:', err);
    }
    closeMenu();
  };

  const copyLink = async () => {
    if (!block) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}#${block.id}`
      );
      toast.show('لینک بلوک کپی شد');
    } catch {
      toast.show('کپی لینک ممکن نشد');
    }
    closeMenu();
  };

  const removeBlock = () => {
    if (!block) return;
    editor.removeBlocks([block]);
    closeMenu();
  };

  if (!hover || !block) return null;

  return (
    <>
      {/* Selection rectangle appears only when the handle is clicked or dragged */}
      {selection && (
        <div
          dir="rtl"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: selection.top,
            left: selection.left,
            width: selection.width,
            height: selection.height,
            zIndex: 30,
            pointerEvents: 'none',
            borderRadius: 6,
            backgroundColor: 'hsl(var(--primary) / 0.16)',
            boxShadow: '0 0 0 1.5px hsl(var(--primary) / 0.35)',
          }}
        />
      )}

      <div
        dir="rtl"
        style={{ position: 'fixed', top: hover.top + 1, left: hover.left, zIndex: 40 }}
        className="bn-custom-handles relative flex items-center gap-0.5 rounded-lg bg-card/80 px-0.5 py-0.5 shadow-sm backdrop-blur-sm"
        onMouseEnter={keepVisible}
        onMouseLeave={handleOverlayLeave}
      >
        <button
          type="button"
          onClick={insertBelow}
          onMouseDown={(e) => e.preventDefault()}
          title="افزودن بلوک"
          aria-label="افزودن بلوک"
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RiAddLine className="size-3.5" />
        </button>

        <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
          {/* Invisible anchor: the visible handle stays a real draggable element. */}
          <DropdownMenuTrigger asChild>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 end-0 w-px"
            />
          </DropdownMenuTrigger>

          <button
            type="button"
            draggable
            onDragStart={(e) => {
              dragActiveRef.current = true;
              draggedRef.current = true;
              setSelection({
                left: hover.blockLeft,
                top: hover.blockTop,
                width: hover.width,
                height: hover.height,
              });
              if (!block) return;
              sideMenu?.blockDragStart(e as unknown as DragEvent, block);
            }}
            onDragEnd={(e) => {
              sideMenu?.blockDragEnd(e as unknown as DragEvent);
              dragActiveRef.current = false;
              setSelection(null);
              setTimeout(() => {
                draggedRef.current = false;
              }, 80);
              setHover(null);
            }}
            onClick={() => {
              if (draggedRef.current) return;
              openMenu();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="جابه‌جایی بلوک"
            aria-label="جابه‌جایی بلوک"
            className="flex size-5 cursor-grab items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing"
          >
            <RiDraggable className="size-4" />
          </button>

          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className={`${noteMenuContentClass} !z-[130] w-52`}
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={`${noteMenuItemClass} data-[state=open]:bg-secondary`}
              >
                <RiParagraph className="size-3.5 text-muted-foreground" />
                <span>تبدیل به</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="!z-[130] w-44 border border-border/70 bg-popover text-popover-foreground">
                {BLOCK_TYPES.map(({ type, label, Icon, props }) => (
                  <DropdownMenuItem
                    key={`${type}-${label}`}
                    className={noteMenuItemClass}
                    onClick={() => turnInto(type, props)}
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span>{label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={`${noteMenuItemClass} data-[state=open]:bg-secondary`}
              >
                <RiPaletteLine className="size-3.5 text-muted-foreground" />
                <span>رنگ</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="!z-[130] w-auto border border-border/70 bg-popover p-1 text-popover-foreground">
                <ColorPanel
                  textColor={(block.props as any)?.textColor}
                  backgroundColor={(block.props as any)?.backgroundColor}
                  onPickText={(value) => setBlockColor('text', value)}
                  onPickBackground={(value) => setBlockColor('background', value)}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className={noteMenuSeparatorClass} />

            <DropdownMenuItem className={noteMenuItemClass} onClick={duplicateBlock}>
              <RiFileCopyLine className="size-3.5 text-muted-foreground" />
              <span>تکثیر</span>
            </DropdownMenuItem>

            <DropdownMenuItem className={noteMenuItemClass} onClick={copyLink}>
              <RiLink className="size-3.5 text-muted-foreground" />
              <span>کپی لینک بلوک</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className={noteMenuSeparatorClass} />

            <DropdownMenuItem
              className={`${noteMenuItemClass} ${noteMenuDangerClass}`}
              onClick={removeBlock}
            >
              <RiDeleteBinLine className="size-3.5" />
              <span>حذف بلوک</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};
