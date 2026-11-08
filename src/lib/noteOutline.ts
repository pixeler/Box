/** One heading of a note, as the outline panel lists it. */
export interface OutlineEntry {
  /** Block id, used to scroll the editor to it. */
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

/** Text of an inline-content array, whatever shapes the block holds. */
const inlineText = (nodes: unknown): string => {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (!node || typeof node !== 'object') return '';
      const inline = node as { type?: string; text?: string };
      // Links and other wrappers carry their own inline content.
      if (inline.text) return inline.text;
      return inlineText((node as { content?: unknown }).content);
    })
    .join('');
};

/**
 * The headings of a note, depth first. Blocks are the source of truth; the
 * markdown body is only parsed for notes saved before blocks were stored.
 * An empty list means the note has no outline to show.
 */
export function buildNoteOutline(bodyJson?: string, markdown?: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  if (bodyJson) {
    try {
      const blocks = JSON.parse(bodyJson) as unknown;
      const walk = (nodes: unknown) => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (!node || typeof node !== 'object') continue;
          const block = node as {
            id?: string;
            type?: string;
            props?: { level?: number };
            content?: unknown;
            children?: unknown;
          };
          if (block.type === 'heading') {
            const text = inlineText(block.content).trim();
            const level = block.props?.level === 2 || block.props?.level === 3 ? block.props.level : 1;
            if (text) entries.push({ id: block.id ?? '', level, text });
          }
          walk(block.children);
        }
      };
      walk(blocks);
    } catch {
      /* A half-written save falls back to the markdown body below. */
    }
  }

  if (entries.length) return entries;

  (markdown ?? '')
    .split('\n')
    .forEach((line, index) => {
      const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
      if (!match) return;
      entries.push({
        id: `md-${index}`,
        level: match[1].length as 1 | 2 | 3,
        text: match[2].replace(/[*_`]/g, '').trim(),
      });
    });

  return entries.filter((entry) => entry.text);
}
