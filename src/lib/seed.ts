import { taskRepo, noteRepo, eventRepo, tagRepo, entryRepo, boxRepo } from '@/repositories';
import {
  getTodayJalaliKey,
  parseJalaliKey,
  jalaliToDate,
  getJalaliDate,
  formatJalaliKey,
} from './jalali';

export async function checkAndSeedDemoBoxes() {
  try {
    const existingBoxes = await boxRepo.list();
    if (existingBoxes.length === 0) {
      const b1 = await boxRepo.create({
        title: 'روزنوشت‌ها',
        image: 'Box 5.png',
        order: 1,
      });

      await boxRepo.create({
        title: 'یوتیوب',
        image: 'Bix 2.png',
        icon: 'RiYoutubeFill',
        order: 2,
      });

      await boxRepo.create({
        title: 'دستور غذا',
        image: 'Box6.png',
        order: 3,
      });


      const b4 = await boxRepo.create({
        title: 'روزا',
        image: 'Box 1.png',
        icon: 'RiSunLine',
        badge_icon: 'RiGroupLine',
        order: 4,
      });

      // Link existing tasks/notes to boxes if appropriate
      const allTasks = await taskRepo.list();
      const taskRoza = allTasks.find((t) => t.title.includes('روزا'));
      if (taskRoza && !taskRoza.box_id) {
        await taskRepo.update(taskRoza.id, { box_id: b4.id });
      }

      const allNotes = await noteRepo.list();
      if (allNotes.length > 0 && !allNotes[0].box_id) {
        await noteRepo.update(allNotes[0].id, { box_id: b1.id });
      }
    }
  } catch (err) {
    console.warn('Failed to seed demo boxes:', err);
  }
}


export async function checkAndSeedDesignDemoData() {
  await checkAndSeedDemoBoxes();

  const todayKey = getTodayJalaliKey();

  const todayJ = parseJalaliKey(todayKey);
  const nowDate = jalaliToDate(todayJ.jy, todayJ.jm, todayJ.jd);

  // Overdue date: 2 days before today
  const overdueDate = new Date(nowDate);
  overdueDate.setDate(nowDate.getDate() - 2);
  const overdueKey = formatJalaliKey(getJalaliDate(overdueDate));

  // Future date: 5 days after today
  const futureDate = new Date(nowDate);
  futureDate.setDate(nowDate.getDate() + 5);
  const futureKey = formatJalaliKey(getJalaliDate(futureDate));

  // Migration for previously seeded data using hardcoded 1404/10/30
  const migratedKey = 'second_brain_demo_migrated_to_dynamic_v1';
  if (!localStorage.getItem(migratedKey)) {
    try {
      const oldTodayTasks = await taskRepo.list({ due_date: '1404/10/30' });
      for (const t of oldTodayTasks) {
        await taskRepo.update(t.id, { due_date: todayKey });
      }
      const oldOverdueTasks = await taskRepo.list({ due_date: '1404/10/28' });
      for (const t of oldOverdueTasks) {
        await taskRepo.update(t.id, { due_date: overdueKey });
      }
      const oldFutureTasks = await taskRepo.list({ due_date: '1404/11/05' });
      for (const t of oldFutureTasks) {
        await taskRepo.update(t.id, { due_date: futureKey });
      }
    } catch (e) {
      console.warn('Seed migration error:', e);
    }
    localStorage.setItem(migratedKey, 'true');
  }

  const seeded = localStorage.getItem('second_brain_demo_seeded');
  if (seeded) return;

  try {
    const existingTasks = await taskRepo.list();
    if (existingTasks.length > 0) return;

    // 1. Create Tag
    const tag = await tagRepo.getOrCreate('دیزاین', 'manual');

    // 2. Task 1 (تکمیل دیزاین تسک در روزا)
    const entry1 = await entryRepo.create({
      raw_text: 'تکمیل دیزاین تسک در روزا #دیزاین',
      source: 'text',
      processed: true,
    });
    await taskRepo.create({
      entry_id: entry1.id,
      title: 'تکمیل دیزاین تسک در روزا',
      description: 'اگر تکمیل نکنیم، جواب محمد را چی بدهیم.',
      status: 'open',
      due_date: todayKey,
      tag_ids: [tag.id],
    });

    // 3. Note 1 (گاهی وقت‌ها احساس می‌کنم...)
    const entry2 = await entryRepo.create({
      raw_text: 'گاهی وقت‌ها احساس می‌کنم که نباید بلیچ را شروع می‌کردم. چون ۲۰ ساله که هنوز تمام نشده.',
      source: 'text',
      processed: true,
    });
    await noteRepo.create({
      entry_id: entry2.id,
      type: 'note',
      title: 'گاهی وقت‌ها احساس می‌کنم که نباید بلیچ را شروع می‌کردم. چون ۲۰ ساله که هنوز تمام نشده.',
      body: 'گاهی وقت‌ها احساس می‌کنم که نباید بلیچ را شروع می‌کردم. چون ۲۰ ساله که هنوز تمام نشده.',
      tag_ids: [],
    });

    // 4. Overdue Task (از روزهای قبل)
    await taskRepo.create({
      entry_id: null,
      title: 'بررسی فیدبک‌های کاربر',
      description: 'موارد یادداشت‌شده در جلسه دیروز',
      status: 'open',
      due_date: overdueKey,
      tag_ids: [],
    });

    // 5. Future Task (برای بعدا)
    await taskRepo.create({
      entry_id: null,
      title: 'آماده‌سازی خروجی نهایی',
      description: '',
      status: 'open',
      due_date: futureKey,
      tag_ids: [],
    });

    localStorage.setItem('second_brain_demo_seeded', 'true');
  } catch (err) {
    console.warn('Failed to seed design demo data:', err);
  } finally {
    await cleanupDuplicatesAndObsoleteItems();
  }
}

/**
 * پاکسازی موارد تکراری و رویدادهای منسوخ‌شده (مانند مصرف دارو)
 */
export async function cleanupDuplicatesAndObsoleteItems() {
  try {
    const { db } = await import('./db/dexie');
    const { markIdAsDeleted } = await import('./storage');

    // 1. حذف رویدادهای «مصرف دارو»
    const allEvents = await eventRepo.list();
    for (const ev of allEvents) {
      if (ev.title.includes('مصرف دارو')) {
        await db.events.delete(ev.id);
        markIdAsDeleted(ev.id);
      }
    }

    // 2. حذف تسک‌های کاملاً تکراری
    const allTasks = await db.tasks.toArray();

    const seen = new Map<string, typeof allTasks[0]>();
    const idsToDelete: string[] = [];

    for (const t of allTasks) {
      if (t.status === 'dropped') continue;

      // کلید یکتا بر اساس عنوان، قوانین تکرار یا تاریخ
      const cleanTitle = t.title.trim().toLowerCase();
      const normRecurrence = (t.recurrence_rule || 'none').trim();
      const normDate = (t.due_date || '').trim();

      const uniqueKey = `${cleanTitle}|${normRecurrence}|${normRecurrence !== 'none' ? '' : normDate}`;

      if (seen.has(uniqueKey)) {
        const existing = seen.get(uniqueKey)!;
        // نگه‌داشتن تسکی که وضعیت انجام بیشتری دارد یا جدیدتر است
        const existingDoneCount = (existing.done_dates || []).length;
        const currentDoneCount = (t.done_dates || []).length;

        if (currentDoneCount > existingDoneCount || (!existingDoneCount && t.status === 'done' && existing.status !== 'done')) {
          idsToDelete.push(existing.id);
          seen.set(uniqueKey, t);
        } else {
          idsToDelete.push(t.id);
        }
      } else {
        seen.set(uniqueKey, t);
      }
    }

    for (const id of idsToDelete) {
      await db.tasks.delete(id);
      markIdAsDeleted(id);
    }
  } catch (err) {
    console.warn('cleanupDuplicatesAndObsoleteItems failed:', err);
  }
}

