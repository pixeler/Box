import { db } from './db/dexie';

/**
 * A reusable note body. Journal entries and note creation both start from one
 * of these, so the shape lives here instead of in two components.
 */
export interface NoteTemplate {
  id: string;
  name: string;
  body: string;
  /**
   * Where this template is used without asking: a journal entry, every new
   * note, or a specific folder. `folder:<id>` is the folder form.
   */
  usage?: string;
  /** Appearance that travels with the template into every note it creates. */
  icon?: string;
  cover?: string;
}

/* Stored in the local settings table: a template is local preference, not
   user content, so it does not travel through cloud sync. */
const TEMPLATES_KEY = 'note_templates';
const TEMPLATES_VERSION_KEY = 'note_templates_version';
/** v2 restores the journal template's intended body and unlocks editing. */
const TEMPLATES_VERSION = 2;

export const JOURNAL_TEMPLATE_ID = 'journal-default';

/**
 * `{{today_tasks}}` and `{{overdue_tasks}}` become the live task list block
 * when a note opens; any other text is used as written.
 */
export const DEFAULT_JOURNAL_TEMPLATE: NoteTemplate = {
  id: JOURNAL_TEMPLATE_ID,
  name: 'روزنوشت',
  usage: 'journal',
  body: [
    '### امروز چه خبر؟',
    '',
    '',
    '### چه چیزی خوب پیش رفت؟',
    '',
    '',
    '### فردا چه چیزی مهم‌تر است؟',
    '',
    '',
    '### تسک‌های امروز',
    '{{today_tasks}}',
    '',
    '### تسک‌های عقب‌افتاده',
    '{{overdue_tasks}}',
    '',
  ].join('\n'),
};

export async function saveNoteTemplates(templates: NoteTemplate[]): Promise<void> {
  await db.settings.put({ key: TEMPLATES_KEY, value: JSON.stringify(templates) });
}

/**
 * The journal template was locked in an earlier build, yet its body could still
 * be overwritten. Version 2 puts the intended content back once; from then on
 * the person owns it and can reset it from the template editor.
 */
async function upgradeTemplates(templates: NoteTemplate[]): Promise<NoteTemplate[]> {
  try {
    const version = await db.settings.get(TEMPLATES_VERSION_KEY);
    if (version?.value === String(TEMPLATES_VERSION)) return templates;

    const next = templates.map((template) =>
      template.id === JOURNAL_TEMPLATE_ID
        ? {
            ...template,
            name: DEFAULT_JOURNAL_TEMPLATE.name,
            body: DEFAULT_JOURNAL_TEMPLATE.body,
            usage: 'journal',
          }
        : template
    );
    await saveNoteTemplates(next);
    await db.settings.put({ key: TEMPLATES_VERSION_KEY, value: String(TEMPLATES_VERSION) });
    return next;
  } catch {
    /* A read-only storage keeps whatever is stored. */
    return templates;
  }
}

export async function loadNoteTemplates(): Promise<NoteTemplate[]> {
  let templates: NoteTemplate[] = [DEFAULT_JOURNAL_TEMPLATE];
  try {
    const row = await db.settings.get(TEMPLATES_KEY);
    const parsed = row ? (JSON.parse(row.value) as NoteTemplate[]) : [];
    if (Array.isArray(parsed) && parsed.length > 0) templates = parsed;
  } catch {
    /* A damaged row falls back to the built-in template. */
  }

  templates = await upgradeTemplates(templates);

  // The journal always needs a template to start from.
  if (!templates.some((template) => template.id === JOURNAL_TEMPLATE_ID)) {
    templates = [DEFAULT_JOURNAL_TEMPLATE, ...templates];
    try {
      await saveNoteTemplates(templates);
    } catch {
      /* An unsaved default still works for this session. */
    }
  }

  return templates;
}

/** A new, empty template, stored right away so the editor can autosave into it. */
export async function createNoteTemplate(): Promise<NoteTemplate> {
  const templates = await loadNoteTemplates();
  const draft: NoteTemplate = { id: crypto.randomUUID(), name: '', body: '' };
  await saveNoteTemplates([...templates, draft]);
  return draft;
}

export async function duplicateNoteTemplate(templateId: string): Promise<NoteTemplate | null> {
  const templates = await loadNoteTemplates();
  const source = templates.find((template) => template.id === templateId);
  if (!source) return null;
  const copy: NoteTemplate = {
    id: crypto.randomUUID(),
    name: `${source.name?.trim() || 'بدون نام'} (کپی)`,
    body: source.body,
    usage: undefined,
    icon: source.icon,
    cover: source.cover,
  };
  await saveNoteTemplates([...templates, copy]);
  return copy;
}

export async function deleteNoteTemplate(templateId: string): Promise<NoteTemplate[]> {
  if (templateId === JOURNAL_TEMPLATE_ID) return loadNoteTemplates();
  const templates = await loadNoteTemplates();
  const next = templates.filter((template) => template.id !== templateId);
  await saveNoteTemplates(next);
  return next;
}

/** One place, one template: assigning a place frees it from any other template. */
export async function setTemplateUsage(
  templateId: string,
  usage: string | null
): Promise<NoteTemplate[]> {
  const templates = await loadNoteTemplates();
  const next = templates.map((template) => {
    if (template.id === templateId) return { ...template, usage: usage || undefined };
    if (usage && template.usage === usage) return { ...template, usage: undefined };
    return template;
  });
  await saveNoteTemplates(next);
  return next;
}

/** Puts the journal template's name and body back to the app's own version. */
export async function resetJournalTemplate(): Promise<NoteTemplate[]> {
  const templates = await loadNoteTemplates();
  const next = templates.map((template) =>
    template.id === JOURNAL_TEMPLATE_ID ? { ...DEFAULT_JOURNAL_TEMPLATE } : template
  );
  await saveNoteTemplates(next);
  return next;
}

export type TemplateUsageKind = 'manual' | 'journal' | 'new-note' | 'folder';

const FOLDER_USAGE_PREFIX = 'folder:';

export const folderUsage = (folderId: string) => `${FOLDER_USAGE_PREFIX}${folderId}`;

export const templateUsageKind = (template: NoteTemplate): TemplateUsageKind => {
  const usage = template.usage || '';
  if (usage === 'journal' || usage === 'new-note') return usage;
  return usage.startsWith(FOLDER_USAGE_PREFIX) ? 'folder' : 'manual';
};

export const templateFolderId = (template: NoteTemplate): string | null => {
  const usage = template.usage || '';
  if (!usage.startsWith(FOLDER_USAGE_PREFIX)) return null;
  return usage.slice(FOLDER_USAGE_PREFIX.length) || null;
};

/**
 * The template that applies to a place by itself, if the person assigned one.
 * A folder template wins over the general "new note" one where both exist.
 */
export function pickTemplateFor(
  templates: NoteTemplate[],
  where: { kind: 'journal' } | { kind: 'new-note' } | { kind: 'folder'; folderId: string | null }
): NoteTemplate | null {
  if (where.kind === 'folder') {
    if (!where.folderId) return null;
    return (
      templates.find(
        (template) =>
          templateUsageKind(template) === 'folder' && templateFolderId(template) === where.folderId
      ) ?? null
    );
  }
  return templates.find((template) => templateUsageKind(template) === where.kind) ?? null;
}
