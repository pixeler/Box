import { boxRepo, eventRepo, noteRepo, tagRepo, taskRepo } from '@/repositories';
import { getTodayJalaliKey } from './jalali';

/**
 * Guest onboarding.
 *
 * The app is offline-first, so a first-time guest gets a small, honest starter
 * set that teaches the product instead of a pile of unrelated "demo" content.
 * Signed-in users (including someone who is currently offline) never get it:
 * their local database is their own data.
 */

const LEGACY_SEED_FLAG = 'second_brain_demo_seeded';
const ONBOARDING_FLAG = 'second_brain_onboarding_seeded_v1';

const LEGACY_TASK_TITLES = new Set([
  'تکمیل دیزاین تسک در روزا',
  'بررسی فیدبک‌های کاربر',
  'تمدید اشتراک سرور و هاست',
  'آماده‌سازی خروجی نهایی',
]);

const LEGACY_NOTE_TITLE_PREFIXES = ['گاهی وقت‌ها احساس می‌کنم'];

const LEGACY_BOX_TITLES = new Set(['روزنوشت‌ها', 'یوتیوب', 'دستور غذا', 'روزا']);

const hasStoredAuthSession = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return Object.keys(localStorage).some(
      (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
    );
  } catch {
    return false;
  }
};

const isSignedIn = async (): Promise<boolean> => {
  // The storage check works offline and covers an expired token; getSession()
  // is the authoritative local answer when storage is readable.
  if (hasStoredAuthSession()) return true;

  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
};

/**
 * Earlier builds seeded a personal-looking demo set for guests. Remove only
 * those exact records once, so real content the user added is untouched.
 */
const removeLegacyDemoData = async (): Promise<boolean> => {
  if (typeof localStorage === 'undefined') return false;
  const flagged = localStorage.getItem(LEGACY_SEED_FLAG) === 'true';

  try {
    const [tasks, notes, boxes] = await Promise.all([
      taskRepo.list(),
      noteRepo.list(),
      boxRepo.list(),
    ]);

    const legacyTasks = tasks.filter((task) => LEGACY_TASK_TITLES.has(task.title));
    const legacyNotes = notes.filter((note) =>
      LEGACY_NOTE_TITLE_PREFIXES.some((prefix) => note.title.startsWith(prefix))
    );
    const legacyBoxes = boxes.filter((box) => LEGACY_BOX_TITLES.has(box.title));

    // The saved flag is the normal path. The title set is a fallback for a
    // profile whose localStorage was reset while the old records remained.
    const looksSeeded = legacyTasks.length >= 4 && legacyBoxes.length >= 3;
    if (!flagged && !looksSeeded) return false;

    await Promise.all([
      ...legacyTasks.map((task) => taskRepo.softDelete(task.id)),
      ...legacyNotes.map((note) => noteRepo.softDelete(note.id)),
      ...legacyBoxes.map((box) => boxRepo.delete(box.id)),
    ]);

    localStorage.removeItem(LEGACY_SEED_FLAG);

    return legacyTasks.length + legacyNotes.length + legacyBoxes.length > 0;
  } catch (error) {
    console.warn('Failed to clear legacy demo data:', error);
    return false;
  }
};

let onboardingRun: Promise<boolean> | null = null;

/**
 * Guard against two mounts (or two windows) racing through the empty-database
 * check and seeding the same starter set twice.
 */
export function checkAndSeedOnboarding(): Promise<boolean> {
  if (!onboardingRun) {
    onboardingRun = runOnboardingSeed().finally(() => {
      onboardingRun = null;
    });
  }
  return onboardingRun;
}

async function runOnboardingSeed(): Promise<boolean> {
  if (typeof localStorage === 'undefined') return false;
  if (await isSignedIn()) return false;

  const cleaned = await removeLegacyDemoData();

  if (localStorage.getItem(ONBOARDING_FLAG) === 'true') return cleaned;

  try {
    const [tasks, notes, boxes, events] = await Promise.all([
      taskRepo.list(),
      noteRepo.list(),
      boxRepo.list(),
      eventRepo.list(),
    ]);

    // A guest who already made something is not a first-time guest anymore.
    if (tasks.length > 0 || notes.length > 0 || boxes.length > 0 || events.length > 0) {
      return cleaned;
    }

    const todayKey = getTodayJalaliKey();
    const tag = await tagRepo.getOrCreate('شروع', 'manual');

    const guideBox = await boxRepo.create({
      title: 'راهنمای جعبه',
      image: 'Box 2.png',
      order: 0,
    });

    const guideNote = await noteRepo.create({
      entry_id: null,
      box_id: guideBox.id,
      type: 'note',
      title: 'جعبه چطور کار می‌کند؟',
      body: [
        'این یادداشت را باز نگه دار و قدم‌به‌قدم امتحان کن:',
        '',
        '• در «امروز» دکمه + یا میان‌بر T یک کار تازه می‌سازد.',
        '• هر کار را باز کن تا زیرکار، یادداشت پیوندشده و یادآور داشته باشد.',
        '• در «تقویم» بین نمای هفته، ماه و سال جابه‌جا شو.',
        '• در «همه کارها» و «تمرکز» از سایدبار دنبال کارهای دیگر برو.',
        '• یادداشت‌ها را می‌توانی داخل جعبه‌ها دسته‌بندی کنی.',
      ].join('\n'),
      icon: '👋',
      tag_ids: [tag.id],
    });

    await noteRepo.create({
      entry_id: null,
      type: 'note',
      title: 'سه قدم برای شروع',
      body: [
        '۱. سه کار مهم امروزت را بنویس.',
        '۲. برای هر کار یک قدم کوچک تعریف کن.',
        '۳. آخر شب یک یادداشت کوتاه از روزت بنویس.',
      ].join('\n'),
      pinned: true,
      icon: '🌱',
      tag_ids: [tag.id],
    });

    await taskRepo.create({
      entry_id: null,
      title: 'این کار انجام شده است',
      description: 'تیک کنار عنوان را بردار تا ببینی چطور به حالت باز برمی‌گردد.',
      status: 'done',
      done_dates: [todayKey],
      due_date: todayKey,
      time_of_day: 'anytime',
      priority: 1,
      tag_ids: [tag.id],
      subtasks: [],
    });

    await taskRepo.create({
      entry_id: null,
      title: 'یک کار تازه برای امروز بساز',
      description:
        'از دکمه + بالای «امروز» یا میان‌بر T استفاده کن. کارها را می‌شود برای صبح، طول روز یا عصر ساخت.',
      status: 'open',
      due_date: todayKey,
      time_of_day: 'morning',
      priority: 3,
      tag_ids: [tag.id],
      subtasks: [],
    });

    await taskRepo.create({
      entry_id: null,
      title: 'برای این کار یک زیرکار اضافه کن',
      description:
        'کار را باز کن و در بخش «زیرکارها» اولین قدم کوچک را بنویس. زیرکارها همین‌جا داخل خود کار زندگی می‌کنند.',
      status: 'open',
      due_date: todayKey,
      time_of_day: 'day',
      priority: 2,
      tag_ids: [tag.id],
      subtasks: [{ id: crypto.randomUUID(), title: 'یک قدم کوچک بنویس', done: false }],
    });

    await taskRepo.create({
      entry_id: null,
      title: 'یادداشت راهنما را باز کن',
      description:
        'این کار به یادداشت «جعبه چطور کار می‌کند؟» پیوند خورده است. روی عنوان یادداشت در کارت کار بزن.',
      status: 'open',
      due_date: todayKey,
      time_of_day: 'evening',
      priority: 1,
      tag_ids: [tag.id],
      linked_note_ids: [guideNote.id],
      subtasks: [],
    });

    localStorage.setItem(ONBOARDING_FLAG, 'true');
    return true;
  } catch (error) {
    console.warn('Failed to seed guest onboarding:', error);
    return cleaned;
  }
}
