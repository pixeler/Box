import type { Task } from '@/types/models';
import {
  addJalaliDays,
  extractDateOnly,
  formatJalaliKey,
  getJalaliDate,
  getTodayJalaliKey,
} from './jalali';
import { isTaskOccurringOnDate } from './recurrence';

export const isRecurringTask = (task: Task) =>
  !!task.recurrence_rule && task.recurrence_rule !== 'none';

/** The task's due date as a Jalali key (YYYY/MM/DD), whatever format it was stored in. */
export const taskDueKey = (task: Task): string | null => {
  const raw = task.due_date?.trim();
  if (!raw) return null;

  const key = extractDateOnly(raw);
  const year = parseInt(key.slice(0, 4), 10);
  if (!year) return null;

  // Stored as a Gregorian date: convert it to the app's Jalali keys.
  if (year >= 1900) {
    const date = new Date(raw);
    if (isNaN(date.getTime())) return null;
    return formatJalaliKey(getJalaliDate(date));
  }

  return key;
};

export const taskOccursOn = (task: Task, dateKey: string) =>
  isRecurringTask(task) ? isTaskOccurringOnDate(task, dateKey) : taskDueKey(task) === dateKey;

export interface TaskGroups {
  todayKey: string;
  tomorrowKey: string;
  today: Task[];
  tomorrow: Task[];
  overdue: Task[];
  future: Task[];
}

/**
 * The day buckets the app shows in more than one place: the today view, the
 * task picker inside a note and the journal template's placeholder blocks.
 */
export function buildTaskGroups(tasks: Task[]): TaskGroups {
  const today = getTodayJalaliKey();
  const tomorrow = addJalaliDays(today, 1);
  const open = tasks.filter((task) => task.status !== 'done');

  return {
    todayKey: today,
    tomorrowKey: tomorrow,
    today: open.filter((task) => taskOccursOn(task, today)),
    tomorrow: open.filter((task) => taskOccursOn(task, tomorrow)),
    overdue: open.filter((task) => {
      if (isRecurringTask(task)) return false;
      const key = taskDueKey(task);
      return !!key && key < today;
    }),
    future: open.filter((task) => {
      if (isRecurringTask(task)) return false;
      const key = taskDueKey(task);
      return !!key && key > tomorrow;
    }),
  };
}
