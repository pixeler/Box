import React from 'react';
import { NOTE_ICON_BY_ID } from './noteIconData';

interface NoteGlyphProps {
  icon?: string | null;
  /** Icon size classes, e.g. "size-4". */
  className?: string;
  /** Font size classes for the emoji fallback. */
  emojiClassName?: string;
}

/**
 * A note stores either one of our icon ids or a plain emoji. Every list renders
 * it through this component so the sidebar, the folder tree and the note itself
 * always show the same mark.
 */
export const NoteGlyph: React.FC<NoteGlyphProps> = ({
  icon,
  className = 'size-4',
  emojiClassName = 'text-[13px]',
}) => {
  if (!icon) return null;

  const definition = NOTE_ICON_BY_ID[icon];
  if (definition) {
    const Icon = definition.Icon;
    return <Icon className={className} />;
  }

  // Older notes may hold an id we no longer ship; only paint real glyphs.
  if (/^[A-Za-z0-9_-]+$/.test(icon)) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${emojiClassName}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
};
