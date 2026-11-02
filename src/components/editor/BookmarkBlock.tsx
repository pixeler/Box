import React, { useEffect, useRef, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import { RiExternalLinkLine, RiLinkM } from '@remixicon/react';
import { keepKeyboardInTheNote, swallowTypingKeys } from './keyGuards';

/** "www.notion.so/page" -> "notion.so", used as the card's caption. */
const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Anything that cannot be opened is not worth a card. */
export const isBareUrl = (text: string) => {
  const value = text.trim();
  return /^https?:\/\/[^\s]+$/i.test(value) && !/\s/.test(value);
};

/**
 * Best-effort page metadata. Most sites refuse the cross-origin read, in which
 * case the card falls back to the address itself, so it always stays useful.
 */
const fetchMetadata = async (url: string): Promise<{ title?: string; description?: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return {};
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content') || '';
    const title =
      meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || doc.title?.trim();
    const description =
      meta('meta[property="og:description"]') ||
      meta('meta[name="description"]') ||
      meta('meta[name="twitter:description"]');
    return { title: title?.trim() || undefined, description: description?.trim() || undefined };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
};

interface BookmarkCardProps {
  url: string;
  title: string;
  description: string;
  onChange: (props: { url?: string; title?: string; description?: string }) => void;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({ url, title, description, onChange }) => {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const askedRef = useRef('');

  useEffect(() => {
    if (!url) {
      inputRef.current?.focus();
      return;
    }
    // Fill in a page title once, so the card reads like a bookmark, not a URL.
    if (title || askedRef.current === url) return;
    askedRef.current = url;
    void fetchMetadata(url).then((meta) => {
      if (meta.title || meta.description) onChange(meta);
    });
  }, [url, title, onChange]);

  if (!url) {
    return (
      <div
        contentEditable={false}
        dir="rtl"
        className="my-1"
        onKeyDownCapture={swallowTypingKeys}
        onMouseDownCapture={keepKeyboardInTheNote}
      >
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/20 px-3 py-2">
          <RiLinkM className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const next = draft.trim();
              if (isBareUrl(next)) onChange({ url: next });
            }}
            placeholder="نشانی سایت را بچسبان و Enter بزن"
            className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
    );
  }

  const domain = domainOf(url);

  return (
    <div
      contentEditable={false}
      dir="rtl"
      className="my-1"
      onKeyDownCapture={swallowTypingKeys}
      onMouseDownCapture={keepKeyboardInTheNote}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2.5 no-underline transition-colors hover:border-border hover:bg-secondary/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card">
          <img
            src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
            alt=""
            className="size-5"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-right">
          <span className="truncate text-[12.5px] font-medium text-foreground">
            {title?.trim() || domain}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {description?.trim() || url}
          </span>
        </span>
        <RiExternalLinkLine className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
      </a>
    </div>
  );
};

export const BookmarkBlock = createReactBlockSpec(
  {
    type: 'bookmark',
    propSchema: {
      url: { default: '' },
      /** Cached page title, so the card survives going offline. */
      title: { default: '' },
      description: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      // The block's own editor type only knows this block; the note schema has the rest.
      const noteEditor = editor as unknown as BlockNoteEditor<any, any, any>;
      return (
        <BookmarkCard
          url={block.props.url}
          title={block.props.title}
          description={block.props.description}
          onChange={(props) => {
            try {
              noteEditor.updateBlock(block.id, { props });
            } catch (err) {
              console.error('Failed to update the bookmark card:', err);
            }
          }}
        />
      );
    },
    /** Markdown keeps the link itself, never the card's rendering. */
    toExternalHTML: ({ block }) => {
      const label = block.props.title || block.props.url;
      return (
        <p dir="rtl">
          <a href={block.props.url}>{label}</a>
        </p>
      );
    },
  }
);
