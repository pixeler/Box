import type { FocusSession, Task } from '@/types/models';
import {
  addJalaliDays,
  formatJalaliKey,
  getIranianDayOfWeek,
  getJalaliDate,
  getTodayJalaliKey,
  jalaliToDate,
  parseJalaliKey,
  PERSIAN_FULL_WEEKDAY_NAMES,
  toPersianDigits,
} from './jalali';

/** One day of the heatmap: what moved, what was planned, how long you focused. */
export interface ReviewDay {
  key: string;
  date: Date;
  weekday: number;
  done: number;
  planned: number;
  focus: number;
  isFuture: boolean;
}

/** Which icon a card shows. The view owns the mapping, so this stays UI-free. */
export type InsightIcon =
  | 'seed'
  | 'spark'
  | 'calendar'
  | 'clock'
  | 'target'
  | 'inbox'
  | 'flame'
  | 'trend'
  | 'timer'
  | 'moon'
  | 'chart';

/** `green` is a good sign, `care` is something to look at, `quiet` is neutral. */
export type InsightTone = 'bright' | 'quiet' | 'care';

export interface Insight {
  title: string;
  body: string;
  icon: InsightIcon;
  tone: InsightTone;
}

export interface ReviewReport {
  todayKey: string;
  weekStartKey: string;
  weekDays: ReviewDay[];
  /** Oldest week first; every week is exactly شنبه..جمعه. */
  weeks: ReviewDay[][];
  weekDone: number;
  weekPlanned: number;
  weekFocus: number;
  weekActiveDays: number;
  prevWeekDone: number;
  prevWeekFocus: number;
  totalDone: number;
  totalFocus: number;
  doneTasks: number;
  openTasks: number;
  /** Completions per Iranian weekday (0 = شنبه) over the whole range. */
  byWeekday: number[];
  /** Focus minutes per start hour. */
  byHour: number[];
  /** Completions per week, oldest first; the last entry is the running week. */
  weeklyDone: number[];
  weeklyFocus: number[];
  bestWeekday: number | null;
  quietestWeekday: number | null;
  bestWindow: { start: number; end: number; minutes: number } | null;
  peakHour: number | null;
  busiestDay: { key: string; done: number } | null;
  doneThisMonth: number;
  focusThisMonth: number;
  focusDayCount: number;
  sessionCount: number;
  longestSession: number;
  avgSession: number;
  streakDays: number;
  parkedCount: number;
  firstRun: boolean;
}

export const HEATMAP_WEEKS = 26;

/** Any date-ish string (Jalali key, ISO timestamp, Jalali+time) → "1404/08/11". */
export const toJalaliKey = (value?: string | null): string => {
  if (!value) return '';
  const match = value.match(/(\d{3,4})[/\\-](\d{1,2})[/\\-](\d{1,2})/);
  if (!match) return '';
  const year = Number(match[1]);
  if (year > 1700) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatJalaliKey(getJalaliDate(parsed));
  }
  return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
};

/** Days a task was actually finished. `updated_at` is the closest stamp we keep. */
const completionKeys = (task: Task): string[] => {
  const keys = (task.done_dates || []).map(toJalaliKey).filter(Boolean);
  if (task.status === 'done') {
    const finished = toJalaliKey(task.updated_at) || toJalaliKey(task.due_date);
    if (finished) keys.push(finished);
  }
  return keys;
};

const emptyDay = (date: Date, todayKey: string): ReviewDay => ({
  key: formatJalaliKey(getJalaliDate(date)),
  date,
  weekday: getIranianDayOfWeek(date),
  done: 0,
  planned: 0,
  focus: 0,
  isFuture: formatJalaliKey(getJalaliDate(date)) > todayKey,
});

/**
 * Everything the review screen shows, derived from what already exists on the
 * device. Deliberately free of scores and streaks that can "break": the numbers
 * only ever describe a rhythm, never a pass/fail judgement.
 */
export const buildReviewReport = (
  tasks: Task[],
  sessions: FocusSession[],
  weeks = HEATMAP_WEEKS
): ReviewReport => {
  const todayKey = getTodayJalaliKey();
  const today = parseJalaliKey(todayKey);
  const todayDate = jalaliToDate(today.jy, today.jm, today.jd);
  const weekdayIndex = getIranianDayOfWeek(todayDate);
  const weekStartKey = addJalaliDays(todayKey, -weekdayIndex);

  const weekBuckets: ReviewDay[][] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const startKey = addJalaliDays(weekStartKey, -7 * w);
    const start = parseJalaliKey(startKey);
    const startDate = jalaliToDate(start.jy, start.jm, start.jd);
    const week: ReviewDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + d);
      week.push(emptyDay(date, todayKey));
    }
    weekBuckets.push(week);
  }

  const byKey = new Map<string, ReviewDay>();
  weekBuckets.forEach((week) => week.forEach((day) => byKey.set(day.key, day)));

  tasks.forEach((task) => {
    completionKeys(task).forEach((key) => {
      const day = byKey.get(key);
      if (day) day.done += 1;
    });

    const dueKey = toJalaliKey(task.due_date);
    if (dueKey && !task.recurrence_rule) {
      const day = byKey.get(dueKey);
      if (day) day.planned += 1;
    }
  });

  sessions.forEach((session) => {
    const key = toJalaliKey(session.date_key) || toJalaliKey(session.start_at);
    const day = byKey.get(key);
    if (day) day.focus += session.duration_minutes || 0;
  });

  const weekDays = weekBuckets[weekBuckets.length - 1] || [];
  const prevWeek = weekBuckets[weekBuckets.length - 2] || [];
  const allDays = weekBuckets.flat();

  const inWeek = new Set(weekDays.map((day) => day.key));
  const inPrevWeek = new Set(prevWeek.map((day) => day.key));

  let weekDone = 0;
  let weekFocus = 0;
  let weekPlanned = 0;
  let weekActiveDays = 0;
  let prevWeekDone = 0;
  let prevWeekFocus = 0;
  let totalDone = 0;
  let totalFocus = 0;
  const byWeekday = new Array(7).fill(0) as number[];
  const byHour = new Array(24).fill(0) as number[];

  allDays.forEach((day) => {
    totalDone += day.done;
    totalFocus += day.focus;
    byWeekday[day.weekday] += day.done;
    if (inWeek.has(day.key)) {
      weekDone += day.done;
      weekFocus += day.focus;
      weekPlanned += day.planned;
      if (day.done > 0 || day.focus > 0) weekActiveDays += 1;
    }
    if (inPrevWeek.has(day.key)) {
      prevWeekDone += day.done;
      prevWeekFocus += day.focus;
    }
  });

  const weeklyDone = weekBuckets.map((week) => week.reduce((sum, day) => sum + day.done, 0));
  const weeklyFocus = weekBuckets.map((week) => week.reduce((sum, day) => sum + day.focus, 0));

  sessions.forEach((session) => {
    const start = new Date(session.start_at);
    if (!Number.isNaN(start.getTime())) {
      byHour[start.getHours()] += session.duration_minutes || 0;
    }
  });

  const weekdayTotals = byWeekday.map((count, index) => ({ count, index }));
  const bestWeekdayEntry = [...weekdayTotals].sort((a, b) => b.count - a.count)[0];
  const quietestWeekdayEntry = [...weekdayTotals].sort((a, b) => a.count - b.count)[0];
  const hasWeekdayData = byWeekday.some((count) => count > 0);

  // A three-hour window reads better than a single "best hour" and matches how
  // people actually describe their day.
  let bestWindow: ReviewReport['bestWindow'] = null;
  for (let start = 0; start < 24; start += 3) {
    const minutes = byHour[start] + byHour[start + 1] + byHour[start + 2];
    if (minutes > 0 && (!bestWindow || minutes > bestWindow.minutes)) {
      bestWindow = { start, end: start + 3, minutes };
    }
  }

  let peakHour: number | null = null;
  let peakMinutes = 0;
  byHour.forEach((minutes, hour) => {
    if (minutes > peakMinutes) {
      peakMinutes = minutes;
      peakHour = hour;
    }
  });

  const pastDays = allDays.filter((day) => !day.isFuture);
  let streakDays = 0;
  for (let i = pastDays.length - 1; i >= 0; i -= 1) {
    const day = pastDays[i];
    const active = day.done > 0 || day.focus > 0;
    if (active) streakDays += 1;
    else if (i === pastDays.length - 1) continue;
    else break;
  }

  const parkedCount = tasks.filter((task) => {
    if (task.status !== 'open') return false;
    const dueKey = toJalaliKey(task.due_date);
    return Boolean(dueKey) && dueKey < todayKey;
  }).length;

  const doneTasks = tasks.filter((task) => task.status === 'done').length;

  const monthPrefix = todayKey.slice(0, 7);
  let doneThisMonth = 0;
  let focusThisMonth = 0;
  let focusDayCount = 0;
  let busiestDay: ReviewReport['busiestDay'] = null;

  for (const day of allDays) {
    if (day.isFuture) continue;
    if (day.focus > 0) focusDayCount += 1;
    if (day.key.startsWith(monthPrefix)) {
      doneThisMonth += day.done;
      focusThisMonth += day.focus;
    }
    if (day.done > 0 && (!busiestDay || day.done > busiestDay.done)) {
      busiestDay = { key: day.key, done: day.done };
    }
  }

  const durations = sessions.map((session) => session.duration_minutes || 0).filter((m) => m > 0);
  const sessionCount = durations.length;
  const longestSession = sessionCount ? Math.max(...durations) : 0;
  const avgSession = sessionCount
    ? Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / sessionCount)
    : 0;

  return {
    todayKey,
    weekStartKey,
    weekDays,
    weeks: weekBuckets,
    weekDone,
    weekPlanned,
    weekFocus,
    weekActiveDays,
    prevWeekDone,
    prevWeekFocus,
    totalDone,
    totalFocus,
    doneTasks,
    openTasks: tasks.filter((task) => task.status === 'open').length,
    byWeekday,
    byHour,
    weeklyDone,
    weeklyFocus,
    bestWeekday:
      hasWeekdayData && bestWeekdayEntry && bestWeekdayEntry.count > 0
        ? bestWeekdayEntry.index
        : null,
    quietestWeekday:
      hasWeekdayData && quietestWeekdayEntry && quietestWeekdayEntry.index !== bestWeekdayEntry?.index
        ? quietestWeekdayEntry.index
        : null,
    bestWindow,
    peakHour,
    busiestDay,
    doneThisMonth,
    focusThisMonth,
    focusDayCount,
    sessionCount,
    longestSession,
    avgSession,
    streakDays,
    parkedCount,
    firstRun: totalDone === 0 && totalFocus === 0 && doneTasks === 0,
  };
};

const weekdayName = (index: number | null) =>
  index === null ? '—' : PERSIAN_FULL_WEEKDAY_NAMES[index] || '—';

/**
 * Short, non-judgemental observations. No "you should", no red numbers: the
 * point is to make a pattern visible, not to grade the week.
 */
export const buildInsights = (report: ReviewReport): Insight[] => {
  const insights: Insight[] = [];

  if (report.firstRun) {
    return [
      {
        title: 'تازه شروع کرده‌ای',
        body: 'هنوز داده‌ای برای گزارش نیست. چند کار را تیک بزن یا یک جلسهٔ تمرکز ثبت کن؛ همین هفته نقشهٔ روزهایت شکل می‌گیرد.',
        icon: 'seed',
        tone: 'quiet',
      },
    ];
  }

  if (report.weekDone > 0 || report.weekFocus > 0) {
    insights.push({
      title: `${toPersianDigits(report.weekDone)} کار در ${toPersianDigits(
        report.weekActiveDays
      )} روز این هفته`,
      body: 'همه‌ی روزها لازم نیست پر باشند؛ همان روزهایی که چیزی تکان خورد کافی است.',
      icon: 'spark',
      tone: 'bright',
    });
  } else {
    insights.push({
      title: 'این هفته هنوز چیزی ثبت نشده',
      body: 'بعضی هفته‌ها فقط برای نفس کشیدن‌اند. اگر هفتهٔ سختی بوده، از یک کار کوچک شروع کن؛ اگر فقط جا افتاده، همین امروز یک تیک کافی است.',
      icon: 'seed',
      tone: 'care',
    });
  }

  // Three completed weeks against the three before them: a trend reads calmer
  // than a single week-to-week jump, which is mostly noise.
  const recent = report.weeklyDone.slice(-4, -1);
  const earlier = report.weeklyDone.slice(-7, -4);
  if (recent.length === 3 && earlier.length === 3) {
    const recentAvg = recent.reduce((sum, value) => sum + value, 0) / 3;
    const earlierAvg = earlier.reduce((sum, value) => sum + value, 0) / 3;
    if (earlierAvg > 0 && Math.abs(recentAvg - earlierAvg) >= 1.5) {
      const up = recentAvg > earlierAvg;
      insights.push({
        title: up ? 'ریتم سه هفتهٔ اخیر پررنگ‌تر شده' : 'ریتم سه هفتهٔ اخیر آرام‌تر شده',
        body: up
          ? 'میانگین کارهای سه هفتهٔ اخیر از سه هفتهٔ قبلش بیشتر است؛ اگر این حالت را دوست داری، همان شرایط را تکرار کن.'
          : 'بعضی وقت‌ها کم‌شدن یعنی انرژی جای دیگری رفته. اگر این آرامش عمدی بوده، خوب است؛ اگر نه، فقط یک کار کوچک دوباره ریتم را برمی‌گرداند.',
        icon: 'trend',
        tone: up ? 'bright' : 'quiet',
      });
    }
  }

  if (report.bestWeekday !== null) {
    const busiest = report.byWeekday[report.bestWeekday];
    insights.push({
      title: `روز پرثمرت ${weekdayName(report.bestWeekday)} بود`,
      body: `${toPersianDigits(busiest)} کار در این روز از هفته‌ها بسته شد. اگر برنامه‌ی سنگین داری، شاید همان روز جای بهتری برایش باشد.`,
      icon: 'calendar',
      tone: 'bright',
    });
  }

  if (report.bestWindow) {
    const { start, end, minutes } = report.bestWindow;
    const window = `${toPersianDigits(start)} تا ${toPersianDigits(end)}`;
    insights.push({
      title: `تمرکزت بیشتر در بازهٔ ${window} بود`,
      body: `${toPersianDigits(minutes)} دقیقه تمرکز در این بازه ثبت شده. کار سختت را برای همین بازه بگذار و بقیهٔ روز را سبک‌تر بگیر.`,
      icon: 'clock',
      tone: 'bright',
    });
  }

  if (report.sessionCount > 0) {
    insights.push({
      title: `میانگین جلسه‌های تمرکزت ${toPersianDigits(report.avgSession)} دقیقه است`,
      body:
        report.longestSession > report.avgSession * 2
          ? `بلندترین جلسه ${toPersianDigits(
              report.longestSession
            )} دقیقه بوده؛ جلسه‌های کوتاه‌تر و پرتکرار معمولاً راحت‌تر ادامه پیدا می‌کنند.`
          : `${toPersianDigits(
              report.sessionCount
            )} جلسه ثبت کرده‌ای. همین اندازه و همین ریتم، لنگر خوبی برای روزهای شلوغ است.`,
      icon: 'timer',
      tone: 'quiet',
    });
  }

  if (report.weekPlanned > 0) {
    const ratio = Math.round((report.weekDone / report.weekPlanned) * 100);
    if (ratio < 40) {
      insights.push({
        title: 'برنامه‌ات از واقعیت جلوتر بود',
        body: `این هفته ${toPersianDigits(report.weekPlanned)} کار برای این روزها در نظر گرفته شده بود. برای هفتهٔ بعد، دو یا سه کار مهم را نگه دار و بقیه را «اگر شد» بدان؛ برنامه‌ی سبک‌تر انجام می‌شود.`,
        icon: 'target',
        tone: 'care',
      });
    } else {
      insights.push({
        title: 'برنامه و واقعیت نزدیک بودند',
        body: 'مقدار کاری که در نظر گرفته بودی با کاری که شد هم‌خوان بود؛ همین تعادل را نگه دار.',
        icon: 'target',
        tone: 'bright',
      });
    }
  }

  if (report.parkedCount > 0) {
    insights.push({
      title: `${toPersianDigits(report.parkedCount)} کار از روزهای قبل باز مانده`,
      body: 'لازم نیست همه را جلو بکشی. یکی را بردار، بقیه را عمداً رها کن یا به تاریخ دیگری ببر؛ فهرست بلند انرژی می‌گیرد.',
      icon: 'inbox',
      tone: 'care',
    });
  }

  if (report.streakDays >= 2) {
    insights.push({
      title: `${toPersianDigits(report.streakDays)} روز پیاپی`,
      body: 'چند روز پشت‌سرهم چیزی تکان خورده. اگر فردا نشد هم چیزی خراب نمی‌شود؛ همین‌که برگردی کافی است.',
      icon: 'flame',
      tone: 'bright',
    });
  }

  if (report.quietestWeekday !== null && report.totalDone >= 7) {
    insights.push({
      title: `${weekdayName(report.quietestWeekday)} سبک‌ترین روزت است`,
      body: `در این روزها کمتر تیکی خورده. اگر می‌خواهی هفته نرم‌تر شود، سنگین‌ترین کارها را عمداً از این روز بردار.`,
      icon: 'moon',
      tone: 'quiet',
    });
  }

  if (report.prevWeekDone > 0 || report.weekDone > 0) {
    const delta = report.weekDone - report.prevWeekDone;
    insights.push({
      title:
        delta === 0
          ? 'همان ریتم هفتهٔ قبل'
          : delta > 0
            ? `${toPersianDigits(Math.abs(delta))} کار بیشتر از هفتهٔ قبل`
            : `${toPersianDigits(Math.abs(delta))} کار کمتر از هفتهٔ قبل`,
      body:
        delta < 0
          ? 'کم‌شدن هم بخشی از ریتم است؛ هفتهٔ قبل چه چیزی انرژی‌ات را گرفت که این هفته نبود؟'
          : 'این مقایسه فقط برای دیدن الگوست، نه برای بستن نمره.',
      icon: 'chart',
      tone: delta > 0 ? 'bright' : 'quiet',
    });
  }

  if (report.busiestDay) {
    insights.push({
      title: `پرکارترین روزت ${toPersianDigits(report.busiestDay.done)} کار داشت`,
      body: `در ${weekdayName(
        report.weeks.flat().find((day) => day.key === report.busiestDay?.key)?.weekday ?? null
      )} بیشترین تیک‌ها ثبت شد. روزهای خوب را می‌شود عمداً تکرار کرد.`,
      icon: 'chart',
      tone: 'quiet',
    });
  }

  if (report.doneThisMonth > 0) {
    insights.push({
      title: `این ماه ${toPersianDigits(report.doneThisMonth)} کار بسته شد`,
      body:
        report.focusThisMonth > 0
          ? `در همین ماه ${toPersianDigits(
              report.focusThisMonth
            )} دقیقه تمرکز هم ثبت شده است.`
          : 'حتی بدون ثبت تمرکز هم ماه پرکاری داشته‌ای.',
      icon: 'chart',
      tone: 'quiet',
    });
  }

  // Six is the point where the list stops being a glance and becomes reading.
  return insights.slice(0, 6);
};

// --- weekly review ---------------------------------------------------------

export const WEEKLY_ANSWERS_PREFIX = 'box:review:answers:';
export const WEEKLY_SEEN_KEY = 'box:review:week-seen';

export interface WeeklyAnswers {
  wentWell: string;
  drained: string;
  drop: string;
  next: string;
}

const emptyAnswers: WeeklyAnswers = { wentWell: '', drained: '', drop: '', next: '' };

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const loadWeeklyAnswers = (weekStartKey: string): WeeklyAnswers => {
  const stored = readJson(`${WEEKLY_ANSWERS_PREFIX}${weekStartKey}`);
  if (!stored || typeof stored !== 'object') return { ...emptyAnswers };
  const value = stored as Partial<WeeklyAnswers>;
  return {
    wentWell: typeof value.wentWell === 'string' ? value.wentWell : '',
    drained: typeof value.drained === 'string' ? value.drained : '',
    drop: typeof value.drop === 'string' ? value.drop : '',
    next: typeof value.next === 'string' ? value.next : '',
  };
};

export const saveWeeklyAnswers = (weekStartKey: string, answers: WeeklyAnswers) => {
  try {
    localStorage.setItem(`${WEEKLY_ANSWERS_PREFIX}${weekStartKey}`, JSON.stringify(answers));
  } catch {
    /* Storage is full or disabled; the review just will not be remembered. */
  }
};

export const WEEKLY_QUESTIONS: Array<{ key: keyof WeeklyAnswers; title: string; hint: string }> = [
  {
    key: 'wentWell',
    title: 'چه چیزی خوب پیش رفت؟',
    hint: 'یک جمله کافی است؛ حتی کوچک‌ترین چیزی که جور شد.',
  },
  {
    key: 'drained',
    title: 'چه چیزی انرژی‌ات را خورد؟',
    hint: 'نه برای سرزنش؛ برای اینکه هفتهٔ بعد بتوانی کنارش بزنی.',
  },
  {
    key: 'drop',
    title: 'چه چیزی را می‌شود رها کرد؟',
    hint: 'حذف‌کردن هم یک تصمیم است، نه شکست.',
  },
  {
    key: 'next',
    title: 'اگر فقط دو کار جلو برود، کدام‌ها؟',
    hint: 'دو تا، نه ده تا. هفته موفق یعنی همین‌ها تکان خورده باشند.',
  },
];

/** شنبه: روز مرور. Every Saturday opens the review once, by itself. */
export const shouldPromptWeeklyReview = (): boolean => {
  if (typeof window === 'undefined') return false;
  const today = new Date();
  if (today.getDay() !== 6) return false; // Saturday
  const todayKey = getTodayJalaliKey();
  const parsed = parseJalaliKey(todayKey);
  const weekKey = addJalaliDays(todayKey, -getIranianDayOfWeek(jalaliToDate(parsed.jy, parsed.jm, parsed.jd)));
  try {
    return localStorage.getItem(WEEKLY_SEEN_KEY) !== weekKey;
  } catch {
    return false;
  }
};

export const currentWeekStartKey = (): string => {
  const todayKey = getTodayJalaliKey();
  const parsed = parseJalaliKey(todayKey);
  return addJalaliDays(todayKey, -getIranianDayOfWeek(jalaliToDate(parsed.jy, parsed.jm, parsed.jd)));
};

export const markWeeklyReviewSeen = () => {
  const weekStartKey = currentWeekStartKey();
  try {
    localStorage.setItem(WEEKLY_SEEN_KEY, weekStartKey);
  } catch {
    /* Nothing to remember without storage. */
  }
};
