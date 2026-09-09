import { taskRepo, noteRepo, eventRepo, tagRepo, entryRepo } from '@/repositories';
import {
  getTodayJalaliKey,
  parseJalaliKey,
  jalaliToDate,
  getJalaliDate,
  formatJalaliKey,
} from './jalali';

export async function checkAndSeedDesignDemoData() {
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

    // 4. Event 1 (مصرف دارو)
    const entry3 = await entryRepo.create({
      raw_text: 'مصرف دارو ۱۲:۰۰ هرروز',
      source: 'text',
      processed: true,
    });
    await eventRepo.create({
      entry_id: entry3.id,
      title: 'مصرف دارو',
      start_at: '12:00',
      recurrence_rule: 'هرروز',
      tag_ids: [],
    });

    // 5. Overdue Task (از روزهای قبل)
    await taskRepo.create({
      entry_id: null,
      title: 'بررسی فیدبک‌های کاربر',
      description: 'موارد یادداشت‌شده در جلسه دیروز',
      status: 'open',
      due_date: overdueKey,
      tag_ids: [],
    });

    // 6. Future Task (برای بعدا)
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
    console.error('Failed to seed design demo data:', err);
  }
}
