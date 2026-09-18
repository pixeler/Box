import type { Task } from '@/types/models';
import {
  extractDateOnly,
  parseJalaliKey,
  jalaliToDate,
  getIranianDayOfWeek,
  PERSIAN_WEEKDAY_SHORT_NAMES,
} from './jalali';

export interface WeekdayOption {
  id: number; // 0=شنبه, 1=۱شنبه, ..., 6=جمعه
  label: string; // 'ش'
  name: string; // 'شنبه'
}

export const PERSIAN_WEEKDAYS: WeekdayOption[] = [
  { id: 0, label: 'ش', name: 'شنبه' },
  { id: 1, label: 'ی', name: 'یک‌شنبه' },
  { id: 2, label: 'د', name: 'دوشنبه' },
  { id: 3, label: 'س', name: 'سه‌شنبه' },
  { id: 4, label: 'چ', name: 'چهارشنبه' },
  { id: 5, label: 'پ', name: 'پنج‌شنبه' },
  { id: 6, label: 'ج', name: 'جمعه' },
];

/**
 * Checks if a task should occur on a given Jalali date string (YYYY/MM/DD)
 */
export function isTaskOccurringOnDate(task: Task, targetDateStr: string): boolean {
  const targetDateKey = extractDateOnly(targetDateStr);
  if (!targetDateKey) return false;

  const rule = task.recurrence_rule?.trim();

  // If no recurrence rule or 'none', exact date match only
  if (!rule || rule === 'none') {
    const taskDate = extractDateOnly(task.due_date);
    return taskDate === targetDateKey;
  }

  // Determine recurrence start date (default to task due_date or task created_at)
  const startDateKey = extractDateOnly(
    task.recurrence_start_date || task.due_date || task.created_at
  );
  if (!startDateKey) return false;

  // If target date is before start date, it does not occur
  if (targetDateKey < startDateKey) return false;

  // Determine recurrence end date (if any)
  if (task.recurrence_end_date) {
    const endDateKey = extractDateOnly(task.recurrence_end_date);
    if (endDateKey && targetDateKey > endDateKey) return false;
  }

  // Convert start and target dates to Gregorian to calculate day difference
  const sJalali = parseJalaliKey(startDateKey);
  const tJalali = parseJalaliKey(targetDateKey);
  const sDate = jalaliToDate(sJalali.jy, sJalali.jm, sJalali.jd);
  const tDate = jalaliToDate(tJalali.jy, tJalali.jm, tJalali.jd);

  // Difference in calendar days
  const diffDays = Math.round((tDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return false;

  const iranianDay = getIranianDayOfWeek(tDate);

  // 1. Every day (هر روز)
  if (rule === 'daily' || rule === 'هر روز' || rule === 'هرروز') {
    return true;
  }

  // 2. Every other day (یک روز در میان)
  if (rule === 'every_other_day' || rule === 'یک روز در میان' || rule === 'یک_روز_در_میان') {
    return diffDays % 2 === 0;
  }

  // 3. Workdays (شنبه تا چهارشنبه)
  if (rule === 'workdays' || rule === 'روزهای کاری' || rule === 'روزهای_کاری') {
    return iranianDay >= 0 && iranianDay <= 4;
  }

  // 4. Custom weekdays (e.g. "weekdays:0,2" or "custom:0,2,4")
  if (rule.startsWith('weekdays:') || rule.startsWith('custom:')) {
    const parts = rule.replace(/^(weekdays:|custom:)/, '').split(',');
    const days = parts.map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n));
    return days.includes(iranianDay);
  }

  // 5. Weekly (هر هفته - همان روز هفته شروع)
  if (rule === 'weekly' || rule === 'هر هفته') {
    return diffDays % 7 === 0;
  }

  // 6. Monthly (هر ماه - همان روز ماه)
  if (rule === 'monthly' || rule === 'هر ماه') {
    return tJalali.jd === sJalali.jd;
  }

  // 7. Yearly (هر سال - همان روز و ماه)
  if (rule === 'yearly' || rule === 'هر سال') {
    return tJalali.jm === sJalali.jm && tJalali.jd === sJalali.jd;
  }

  // Fallback: exact match on start date
  return diffDays === 0;
}

/**
 * Format recurrence rule for human-readable display
 */
export function formatRecurrenceDisplay(rule?: string | null): string {
  if (!rule || rule === 'none') return 'بدون تکرار';
  if (rule === 'daily' || rule === 'هر روز' || rule === 'هرروز') return 'هر روز';
  if (rule === 'every_other_day' || rule === 'یک روز در میان') return 'یک روز در میان';
  if (rule === 'workdays' || rule === 'روزهای کاری') return 'روزهای کاری (ش تا چ)';
  if (rule === 'weekly' || rule === 'هر هفته') return 'هر هفته';
  if (rule === 'monthly' || rule === 'هر ماه') return 'هر ماه';
  if (rule === 'yearly' || rule === 'هر سال') return 'هر سال';

  if (rule.startsWith('weekdays:') || rule.startsWith('custom:')) {
    const parts = rule.replace(/^(weekdays:|custom:)/, '').split(',');
    const days = parts.map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n));
    if (days.length === 0) return 'روزهای هفته';
    if (days.length === 7) return 'هر روز';
    if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) {
      return 'روزهای کاری';
    }
    return days.map((d) => PERSIAN_WEEKDAY_SHORT_NAMES[d] || '').filter(Boolean).join('، ');
  }

  return rule;
}
