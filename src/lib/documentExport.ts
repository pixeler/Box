import type { Note } from '@/types/models';
import { stripMarkdownForPreview } from '@/lib/markdown';
import { toast } from '@/lib/toast';

/**
 * Export formats a text document is expected to offer. Markdown is the base
 * because the editor already produces it; the rest is a rendering of it.
 */
export type NoteExportFormat = 'md' | 'html' | 'txt' | 'json' | 'pdf';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeFileName = (title: string): string =>
  (title.trim() || 'یادداشت').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);

const inline = (text: string): string =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

/** Deliberately small: headings, lists, quotes, code fences and paragraphs. */
const markdownToHtml = (markdown: string): string =>
  markdown
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      const code = trimmed.match(/^```[a-z0-9_-]*\n([\s\S]*?)```$/i);
      if (code) return `<pre><code>${escapeHtml(code[1])}</code></pre>`;
      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      const lines = trimmed.split('\n');
      if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }
      if (lines.every((line) => /^\s*>\s?/.test(line))) {
        return `<blockquote>${inline(lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' '))}</blockquote>`;
      }
      return `<p>${lines.map(inline).join('<br />')}</p>`;
    })
    .join('\n');

export const noteToMarkdown = (note: Note): string => {
  const title = note.title?.trim();
  const body = (note.description ?? note.body ?? '').trim();
  return `${title ? `# ${title}\n\n` : ''}${body}\n`;
};

export const noteToPlainText = (note: Note): string => {
  const title = note.title?.trim();
  const body = stripMarkdownForPreview(note.description ?? note.body ?? '');
  return `${title ? `${title}\n\n` : ''}${body}\n`;
};

export const noteToJson = (note: Note): string =>
  JSON.stringify(
    {
      id: note.id,
      title: note.title,
      body: note.body,
      description: note.description,
      body_json: note.body_json,
      icon: note.icon,
      cover: note.cover,
      color: note.color,
      box_id: note.box_id,
      tag_ids: note.tag_ids,
      created_at: note.created_at,
      updated_at: note.updated_at,
    },
    null,
    2
  );

/** A standalone, right-to-left document that prints cleanly to A4. */
export const noteToHtmlDocument = (note: Note): string => {
  const title = escapeHtml(note.title?.trim() || 'بدون عنوان');
  const body = markdownToHtml(note.description ?? note.body ?? '');
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: Vazirmatn, Tahoma, sans-serif; line-height: 1.9; color: #1a1a1a; margin: 0 auto; padding: 32px; max-width: 820px; }
  h1 { font-size: 30px; margin: 0 0 24px; }
  h2 { font-size: 22px; margin: 28px 0 12px; }
  h3 { font-size: 18px; margin: 24px 0 10px; }
  p, li { font-size: 15px; }
  blockquote { margin: 16px 0; padding-inline-start: 14px; border-inline-start: 3px solid #d4d4d8; color: #52525b; }
  pre { background: #f4f4f5; padding: 12px; border-radius: 8px; overflow-x: auto; }
  code { background: #f4f4f5; padding: 1px 4px; border-radius: 4px; font-size: 13px; }
  img { max-width: 100%; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${note.title?.trim() ? `<h1>${title}</h1>` : ''}
${body}
</body>
</html>`;
};

const download = (fileName: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * PDF is written straight to a file in the desktop app. A browser tab has no
 * filesystem, so it falls back to the platform print dialog, which can still
 * save as PDF. Either way only the note document is exported, never the UI.
 */
export const printNoteAsPdf = async (note: Note) => {
  const bridge = typeof window !== 'undefined' ? window.desktop : undefined;
  if (bridge?.savePdfAsFile) {
    const result = await bridge.savePdfAsFile(noteToHtmlDocument(note), safeFileName(note.title));
    if (result.saved) {
      toast.show('PDF ذخیره شد');
    } else if (!result.canceled) {
      toast.show('ذخیرهٔ PDF انجام نشد');
    }
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(frame);

  const frameDoc = frame.contentDocument;
  if (!frameDoc) {
    frame.remove();
    return;
  }
  frameDoc.open();
  frameDoc.write(noteToHtmlDocument(note));
  frameDoc.close();

  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 1000);
    }
  }, 150);
};

export const downloadNote = (note: Note, format: Exclude<NoteExportFormat, 'pdf'>) => {
  const base = safeFileName(note.title);
  if (format === 'md') download(`${base}.md`, noteToMarkdown(note), 'text/markdown');
  else if (format === 'html') download(`${base}.html`, noteToHtmlDocument(note), 'text/html');
  else if (format === 'txt') download(`${base}.txt`, noteToPlainText(note), 'text/plain');
  else download(`${base}.json`, noteToJson(note), 'application/json');
};
