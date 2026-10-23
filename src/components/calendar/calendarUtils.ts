import type { Task, TimeOfDay } from '@/types/models';
import {
  PERSIAN_MONTH_NAMES,
  getJalaliMonthFirstDayOfWeek,
  toPersianDigits,
  type WeekDayInfo,
} from '@/lib/jalali';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

const PERSIAN_WEEK_ORDINALS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];

/** "هفته سوم مهر" for the week that starts on the given Saturday. */
export function getWeekOfMonthLabel(weekDays: WeekDayInfo[]): string {
  const start = weekDays[0]?.jalali;
  if (!start) return '';
  const offset = getJalaliMonthFirstDayOfWeek(start.jy, start.jm);
  const weekNumber = Math.floor((offset + start.jd - 1) / 7) + 1;
  const ordinal =
    PERSIAN_WEEK_ORDINALS[weekNumber - 1] ?? toPersianDigits(weekNumber);
  return `هفته ${ordinal} ${PERSIAN_MONTH_NAMES[start.jm - 1]}`;
}

/** "۲۵ مهر تا ۱ آبان", adding both years only when the week crosses one. */
export function formatWeekRange(weekDays: WeekDayInfo[]): string {
  if (!weekDays.length) return '';
  const start = weekDays[0].jalali;
  const end = weekDays[weekDays.length - 1].jalali;
  const startMonth = PERSIAN_MONTH_NAMES[start.jm - 1];
  const endMonth = PERSIAN_MONTH_NAMES[end.jm - 1];

  if (start.jy === end.jy && start.jm === end.jm) {
    return `${toPersianDigits(start.jd)} تا ${toPersianDigits(end.jd)} ${endMonth}`;
  }

  const startYear =
    start.jy === end.jy ? '' : ` ${toPersianDigits(start.jy)}`;
  return `${toPersianDigits(start.jd)} ${startMonth}${startYear} تا ${toPersianDigits(
    end.jd
  )} ${endMonth} ${toPersianDigits(end.jy)}`;
}

export function getTaskSection(task: Task): TimeOfDay {
  if (task.time_of_day) return task.time_of_day;
  const match = task.due_time?.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = parseInt(match[1], 10);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'day';
    if (hour >= 17 && hour < 24) return 'evening';
  }
  return 'anytime';
}

export function getTaskTimeMinutes(task: Task): number {
  const match = task.due_time?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function sortTasksForAgenda(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const aDone = a.status === 'done';
    const bDone = b.status === 'done';
    if (aDone !== bDone) return aDone ? 1 : -1;
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    const timeDiff = getTaskTimeMinutes(a) - getTaskTimeMinutes(b);
    if (timeDiff !== 0) return timeDiff;
    return a.title.localeCompare(b.title);
  });
}

export function priorityDotClass(priority?: Task['priority']): string {
  switch (priority) {
    case 3:
      return 'bg-rose-500';
    case 2:
      return 'bg-amber-500';
    case 1:
      return 'bg-blue-500';
    default:
      return 'bg-muted-foreground/40';
  }
}

export function priorityBorderClass(priority?: Task['priority']): string {
  switch (priority) {
    case 3:
      return 'border-rose-500 hover:border-rose-600';
    case 2:
      return 'border-amber-500 hover:border-amber-600';
    case 1:
      return 'border-blue-500 hover:border-blue-600';
    default:
      return 'border-muted-foreground/40 hover:border-foreground';
  }
}
