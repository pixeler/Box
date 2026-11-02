import type { Note, Task } from '@/types/models';
import { boxRepo, noteRepo } from '@/repositories';
import {
  formatJalaliDisplay,
  PERSIAN_MONTH_NAMES,
  parseJalaliKey,
  toPersianDigits,
} from './jalali';
import { JOURNAL_TEMPLATE_ID, loadNoteTemplates, pickTemplateFor } from './noteTemplates';

export const JOURNAL_FOLDER_TITLE = 'روزنوشت';

const ensureFolder = async (title: string, parentId: string | null) => {
  const boxes = await boxRepo.list();
  const existing = boxes.find(
    (box) => box.title === title && (box.parent_id ?? null) === parentId
  );
  if (existing) return existing;
  return boxRepo.create({ parent_id: parentId, title, image: 'Box 1.png' });
};

/** Journal folders are year → month: روزنوشت > ۱۴۰۵ > آبان */
export async function ensureJournalFolder(dateKey: string): Promise<string> {
  const { jy, jm } = parseJalaliKey(dateKey);
  const root = await ensureFolder(JOURNAL_FOLDER_TITLE, null);
  const year = await ensureFolder(toPersianDigits(jy), root.id);
  const month = await ensureFolder(PERSIAN_MONTH_NAMES[jm - 1] || 'نامشخص', year.id);
  return month.id;
}

/** Creates today's entry from the chosen template and hands it back to edit. */
export async function createJournalNote(opts: {
  dateKey: string;
  tasks: Task[];
  overdueTasks: Task[];
  templateId?: string;
}): Promise<Note> {
  const templates = await loadNoteTemplates();
  // The template marked for journal entries wins; the placeholders inside it
  // become live task blocks when the note opens in the editor.
  const template =
    (opts.templateId ? templates.find((item) => item.id === opts.templateId) : null) ??
    pickTemplateFor(templates, { kind: 'journal' }) ??
    templates.find((item) => item.id === JOURNAL_TEMPLATE_ID) ??
    templates[0];
  const boxId = await ensureJournalFolder(opts.dateKey);

  const body = template?.body || '';

  return noteRepo.create({
    entry_id: null,
    box_id: boxId,
    type: 'note',
    title: formatJalaliDisplay(parseJalaliKey(opts.dateKey)),
    body,
    date_key: opts.dateKey,
    tag_ids: [],
    ...(template?.icon ? { icon: template.icon } : {}),
    ...(template?.cover ? { cover: template.cover } : {}),
    ...(template?.cover && !template.cover.startsWith('data:')
      ? { color: template.cover }
      : {}),
  });
}