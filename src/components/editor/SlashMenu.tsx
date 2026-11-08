import React, { useEffect, useRef } from 'react';
import type { SuggestionMenuProps } from '@blocknote/react';

/** Element kinds the menu draws a miniature preview for. */
type SlashKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'check'
  | 'toggle'
  | 'quote'
  | 'code'
  | 'divider'
  | 'table'
  | 'task'
  | 'bookmark'
  | 'other';

/**
 * A slash-menu row. `key` is BlockNote's own block key, which is what the
 * preview and the markdown shortcut are derived from — titles are translated,
 * keys are not.
 */
export interface SlashItem {
  key?: string;
  title: string;
  onItemClick: () => void;
  subtext?: string;
  badge?: string;
  aliases?: string[];
  group?: string;
  icon?: React.ReactElement;
  /** Markdown the block can also be written with. */
  shortcut?: string;
  /** Set explicitly by the app's own rows (task lists, bookmarks). */
  kind?: SlashKind;
}

const KIND_BY_KEY: Record<string, SlashKind> = {
  paragraph: 'paragraph',
  heading_1: 'h1',
  heading_2: 'h2',
  heading_3: 'h3',
  bullet_list: 'bullet',
  numbered_list: 'numbered',
  check_list: 'check',
  toggle_list: 'toggle',
  quote: 'quote',
  code_block: 'code',
  divider: 'divider',
  table: 'table',
};

const SHORTCUT_BY_KEY: Record<string, string> = {
  heading_1: '#',
  heading_2: '##',
  heading_3: '###',
  bullet_list: '-',
  numbered_list: '1.',
  check_list: '[]',
  toggle_list: '>',
  quote: '>',
  code_block: '```',
  divider: '---',
};

const kindOf = (item: SlashItem): SlashKind =>
  item.kind ?? (item.key ? KIND_BY_KEY[item.key] : undefined) ?? 'other';

/** A tiny rendering of the block, so a row reads before its label is read. */
const Preview: React.FC<{ kind: SlashKind; icon?: React.ReactElement }> = ({ kind, icon }) => {
  const bar = (width: string, height = 3, opacity = 0.32) => (
    <span
      className="block rounded-full bg-foreground"
      style={{ width, height, opacity }}
      aria-hidden="true"
    />
  );

  const row = (lead: React.ReactNode, width: string) => (
    <span className="flex w-full items-center gap-[3px]">
      {lead}
      {bar(width)}
    </span>
  );

  const dot = <span className="size-[3px] shrink-0 rounded-full bg-foreground/45" aria-hidden="true" />;

  let shape: React.ReactNode;
  switch (kind) {
    case 'h1':
      shape = bar('100%', 5, 0.6);
      break;
    case 'h2':
      shape = bar('82%', 4, 0.52);
      break;
    case 'h3':
      shape = bar('64%', 3.5, 0.45);
      break;
    case 'bullet':
      shape = (
        <>
          {row(dot, '88%')}
          {row(dot, '66%')}
        </>
      );
      break;
    case 'numbered':
      shape = (
        <>
          {row(<span className="shrink-0 text-[7px] leading-none text-foreground/50">1</span>, '84%')}
          {row(<span className="shrink-0 text-[7px] leading-none text-foreground/50">2</span>, '62%')}
        </>
      );
      break;
    case 'check':
      shape = (
        <>
          {row(
            <span className="size-[6px] shrink-0 rounded-[1.5px] border border-foreground/45" aria-hidden="true" />,
            '86%'
          )}
          {row(
            <span className="size-[6px] shrink-0 rounded-[1.5px] border border-foreground/45 bg-foreground/20" aria-hidden="true" />,
            '58%'
          )}
        </>
      );
      break;
    case 'toggle':
      shape = row(<span className="shrink-0 text-[7px] leading-none text-foreground/50">▸</span>, '80%');
      break;
    case 'quote':
      shape = (
        <span className="flex w-full items-center gap-1">
          <span className="block h-[13px] w-[2px] rounded-full bg-foreground/40" aria-hidden="true" />
          <span className="flex flex-1 flex-col gap-[3px]">
            {bar('100%')}
            {bar('70%')}
          </span>
        </span>
      );
      break;
    case 'code':
      shape = <span className="font-mono text-[9px] leading-none text-foreground/55">&lt;/&gt;</span>;
      break;
    case 'divider':
      shape = (
        <span className="flex w-full flex-col gap-[3px]">
          <span className="block h-[1.5px] w-full rounded-full bg-foreground/45" aria-hidden="true" />
        </span>
      );
      break;
    case 'table':
      shape = (
        <span className="grid w-full grid-cols-3 gap-[2px]" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="block h-[5px] rounded-[1px] border border-foreground/25" />
          ))}
        </span>
      );
      break;
    case 'paragraph':
      shape = (
        <>
          {bar('100%')}
          {bar('72%', 3, 0.24)}
        </>
      );
      break;
    default:
      shape = icon ? (
        <span className="flex text-muted-foreground [&_svg]:size-[13px]">{icon}</span>
      ) : (
        bar('80%')
      );
  }

  return (
    <span className="flex size-[20px] shrink-0 items-center justify-center rounded-[5px] border border-border/50 bg-muted/40 px-[4px]">
      <span className="flex w-full flex-col items-start justify-center gap-[3px]">{shape}</span>
    </span>
  );
};

/**
 * The slash menu, drawn like Notion's: one row per element, grouped, every row
 * carrying a small preview of what it inserts and the markdown it can be typed
 * as. Arrow keys and Enter are handled by BlockNote, which owns `selectedIndex`.
 */
export const SlashMenu: React.FC<SuggestionMenuProps<SlashItem>> = ({
  items,
  selectedIndex,
  onItemClick,
  loadingState,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the keyboard selection visible in a menu taller than its window.
  useEffect(() => {
    if (selectedIndex === undefined) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `#bn-suggestion-menu-item-${selectedIndex}`
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (loadingState === 'loading-initial' && !items.length) {
    return (
      <div
        dir="rtl"
        id="bn-suggestion-menu"
        className="w-[320px] max-w-[86vw] rounded-xl border border-border/70 bg-popover p-2 shadow-xl"
      >
        <p className="px-2 py-1.5 text-[11.5px] text-muted-foreground">در حال بارگذاری…</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        dir="rtl"
        id="bn-suggestion-menu"
        className="w-[320px] max-w-[86vw] rounded-xl border border-border/70 bg-popover p-2 shadow-xl"
      >
        <p className="px-2 py-1.5 text-[11.5px] text-muted-foreground">چیزی پیدا نشد</p>
      </div>
    );
  }

  let lastGroup: string | undefined;

  return (
    <div
      dir="rtl"
      id="bn-suggestion-menu"
      role="listbox"
      aria-label="دستورات ویرایشگر"        className="w-[300px] max-w-[86vw] overflow-hidden rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
    >
      <div ref={listRef} className="max-h-[342px] overflow-y-auto overscroll-contain">
        {items.map((item, index) => {
          const group = item.group;
          const showGroup = Boolean(group) && group !== lastGroup;
          lastGroup = group;

          const kind = kindOf(item);
          const shortcut = item.shortcut ?? (item.key ? SHORTCUT_BY_KEY[item.key] : undefined);
          const selected = selectedIndex === index;

          return (
            <React.Fragment key={`${item.key ?? item.title}-${index}`}>
              {showGroup && (
                <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-medium tracking-tight text-muted-foreground/75">
                  {group}
                </div>
              )}
              <button
                type="button"
                id={`bn-suggestion-menu-item-${index}`}
                role="option"
                aria-selected={selected}
                title={item.subtext}
                // BlockNote keeps the caret in the editor; the row must not
                // steal focus before the click handler runs.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onItemClick?.(item)}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-right transition-colors ${
                  selected ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.04]'
                }`}
              >
                <Preview kind={kind} icon={item.icon} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] leading-5 text-foreground">
                  {item.title}
                </span>
                {shortcut && (
                  <span className="shrink-0 rounded border border-border/60 px-1 py-0.5 font-mono text-[9.5px] leading-none text-muted-foreground/80">
                    {shortcut}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
