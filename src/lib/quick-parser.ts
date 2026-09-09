import {
  getTodayJalaliKey,
  addJalaliDays,
  nextWeekendFrom,
  parseJalaliKey,
  jalaliToDate,
  getIranianDayOfWeek,
} from './jalali';

export interface ParsedQuickEntry {
  rawText: string;
  cleanTitle: string;
  detectedType: 'task' | 'note' | 'event';
  priority?: 1 | 2 | 3;
  dueDate?: string; // YYYY/MM/DD
  time?: string; // HH:MM
  recurrenceRule?: string;
  tags: string[];
  mentions: string[];
}

const ACTION_VERBS_REGEX =
  /^(باید|بخر|خرید|تماس|زنگ|بزن|بگیر|انجام|برو|ارسال|بفرست|فرستادن|جلسه|پیگیری|پرداخت|چک|کامل|تکمیل|حل|بنویس|آماده|یادآوری|ورزش|تمرین|کار|بررسی|مصرف)\b/i;

const RECURRENCE_REGEX =
  /(هر\s*(?:روز|هفته|ماه|سال|شنبه|یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنج‌شنبه|پنج شنبه|جمعه))/i;

const WEEKDAY_MAP: Record<string, number> = {
  شنبه: 0,
  یکشنبه: 1,
  دوشنبه: 2,
  'سه‌شنبه': 3,
  'سه شنبه': 3,
  چهارشنبه: 4,
  'پنج‌شنبه': 5,
  'پنج شنبه': 5,
  جمعه: 6,
};

function getNextWeekdayDate(baseKey: string, targetIranianDay: number): string {
  const curJ = parseJalaliKey(baseKey);
  const curDate = jalaliToDate(curJ.jy, curJ.jm, curJ.jd);
  const curDay = getIranianDayOfWeek(curDate);
  const diff = (targetIranianDay - curDay + 7) % 7 || 7;
  return addJalaliDays(baseKey, diff);
}

export function parseQuickInput(
  text: string,
  currentSelectedDate?: string
): ParsedQuickEntry {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      rawText: '',
      cleanTitle: '',
      detectedType: 'note',
      tags: [],
      mentions: [],
    };
  }

  let workText = trimmed;
  const todayKey = getTodayJalaliKey();
  let dueDate: string | undefined = currentSelectedDate || todayKey;

  // 1. Priority: !3 / !!! / !فوری / p1 / p2 / p3
  let priority: 1 | 2 | 3 | undefined;
  if (
    /\b!{3}\b/.test(workText) ||
    workText.endsWith('!!!') ||
    /\b!3\b/.test(workText) ||
    /\b!(?:فوری|زیاد)\b/.test(workText) ||
    /\b[pP]1\b/.test(workText)
  ) {
    priority = 3;
    workText = workText
      .replace(/!{3}/g, '')
      .replace(/\b!3\b/g, '')
      .replace(/\b!(?:فوری|زیاد)\b/g, '')
      .replace(/\b[pP]1\b/g, '')
      .trim();
  } else if (
    /\b!{2}\b/.test(workText) ||
    workText.endsWith('!!') ||
    /\b!2\b/.test(workText) ||
    /\b!متوسط\b/.test(workText) ||
    /\b[pP]2\b/.test(workText)
  ) {
    priority = 2;
    workText = workText
      .replace(/!{2}/g, '')
      .replace(/\b!2\b/g, '')
      .replace(/\b!متوسط\b/g, '')
      .replace(/\b[pP]2\b/g, '')
      .trim();
  } else if (
    /\b!{1}\b/.test(workText) ||
    workText.endsWith('!') ||
    /\b!1\b/.test(workText) ||
    /\b!کم\b/.test(workText) ||
    /\b[pP]3\b/.test(workText)
  ) {
    priority = 1;
    workText = workText
      .replace(/!{1}/g, '')
      .replace(/\b!1\b/g, '')
      .replace(/\b!کم\b/g, '')
      .replace(/\b[pP]3\b/g, '')
      .trim();
  }

  // 2. Tags (#tag)
  const tags: string[] = [];
  const tagMatches = workText.match(/#([\p{L}\w_-]+)/gu);
  if (tagMatches) {
    tagMatches.forEach((t) => {
      const cleanTag = t.replace('#', '').trim();
      if (cleanTag && !tags.includes(cleanTag)) {
        tags.push(cleanTag);
      }
    });
    workText = workText.replace(/#([\p{L}\w_-]+)/gu, '').trim();
  }

  // 3. Mentions (@name)
  const mentions: string[] = [];
  const mentionMatches = workText.match(/@([\p{L}\w_-]+)/gu);
  if (mentionMatches) {
    mentionMatches.forEach((m) => {
      const cleanMention = m.replace('@', '').trim();
      if (cleanMention && !mentions.includes(cleanMention)) {
        mentions.push(cleanMention);
      }
    });
    workText = workText.replace(/@([\p{L}\w_-]+)/gu, '').trim();
  }

  // 4. Recurrence rule (هر روز، هر هفته...)
  let recurrenceRule: string | undefined;
  const recurrenceMatch = workText.match(RECURRENCE_REGEX);
  if (recurrenceMatch) {
    recurrenceRule = recurrenceMatch[0].trim();
    workText = workText.replace(recurrenceMatch[0], '').trim();
  }

  // 5. Time extraction (ساعت N:MM or HH:MM)
  let time: string | undefined;
  const explicitTimeMatch = workText.match(/(?:ساعت\s*)(\d{1,2})(?::(\d{2}))?/i);
  if (explicitTimeMatch) {
    const hour = explicitTimeMatch[1].padStart(2, '0');
    const minute = (explicitTimeMatch[2] || '00').padStart(2, '0');
    time = `${hour}:${minute}`;
    workText = workText.replace(explicitTimeMatch[0], '').trim();
  }

  // 6. Relative & Specific Date extraction
  if (/\bامروز\b/.test(workText)) {
    dueDate = todayKey;
    workText = workText.replace(/\bامروز\b/g, '').trim();
  } else if (/\bفردا\b/.test(workText)) {
    dueDate = addJalaliDays(todayKey, 1);
    workText = workText.replace(/\bفردا\b/g, '').trim();
  } else if (/\bپس‌?فردا\b/.test(workText)) {
    dueDate = addJalaliDays(todayKey, 2);
    workText = workText.replace(/\bپس‌?فردا\b/g, '').trim();
  } else if (/\bآخر\s*هفته\b/.test(workText) || /\bآخرهفته\b/.test(workText)) {
    dueDate = nextWeekendFrom(todayKey);
    workText = workText.replace(/\b(?:آخر\s*هفته|آخرهفته)\b/g, '').trim();
  } else if (/\bهفته\s*(?:بعد|آینده)\b/.test(workText)) {
    dueDate = addJalaliDays(todayKey, 7);
    workText = workText.replace(/\bهفته\s*(?:بعد|آینده)\b/g, '').trim();
  } else {
    // Check for named weekday (e.g. دوشنبه، سه‌شنبه)
    for (const [name, dow] of Object.entries(WEEKDAY_MAP)) {
      const re = new RegExp(`\\b${name}\\b`);
      if (re.test(workText)) {
        dueDate = getNextWeekdayDate(todayKey, dow);
        workText = workText.replace(re, '').trim();
        break;
      }
    }
  }

  // Clean extra spaces
  const cleanTitle = workText.replace(/\s+/g, ' ').trim() || trimmed;

  // 7. Type detection
  let detectedType: 'task' | 'note' | 'event' = 'note';
  if (
    recurrenceRule ||
    (time &&
      (cleanTitle.includes('جلسه') ||
        cleanTitle.includes('دکتر') ||
        cleanTitle.includes('دارو') ||
        cleanTitle.includes('قرار')))
  ) {
    detectedType = 'event';
  } else if (
    priority !== undefined ||
    ACTION_VERBS_REGEX.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.includes('باید')
  ) {
    detectedType = 'task';
  }

  return {
    rawText: trimmed,
    cleanTitle: cleanTitle || trimmed,
    detectedType,
    priority,
    dueDate,
    time,
    recurrenceRule,
    tags,
    mentions,
  };
}
