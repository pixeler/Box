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

export interface HighlightSpan {
  start: number;
  end: number;
  type: 'date' | 'priority' | 'tag' | 'time';
  text: string;
  label?: string;
  value?: any;
}

export interface QuickTokensResult {
  rawText: string;
  cleanTitle: string;
  tokens: HighlightSpan[];
  dueDate?: string;
  priority?: 1 | 2 | 3;
  tags: string[];
  time?: string;
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

/**
 * Extract tokens with exact start/end indices for inline highlighting and clean title generation.
 */
export function extractQuickTokens(
  text: string,
  currentSelectedDate?: string
): QuickTokensResult {
  if (!text) {
    return {
      rawText: '',
      cleanTitle: '',
      tokens: [],
      tags: [],
    };
  }

  const todayKey = getTodayJalaliKey();
  let detectedDueDate: string | undefined = undefined;
  let detectedPriority: 1 | 2 | 3 | undefined = undefined;
  let detectedTime: string | undefined = undefined;
  const detectedTags: string[] = [];

  const foundSpans: HighlightSpan[] = [];

  // Helper to test regex matches while recording start & end
  const scanPattern = (
    regex: RegExp,
    type: HighlightSpan['type'],
    handler: (match: RegExpExecArray) => { value: any; label?: string } | null
  ) => {
    // Clone regex with 'g' flag
    const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
    const r = new RegExp(regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const matchIndex = m.index;
      // If there's a capture group for boundary like (?:^|[\s،,])(word), offset appropriately
      let tokenText = m[0];
      let startIndex = matchIndex;
      let endIndex = matchIndex + tokenText.length;

      // Handle leading separator if matched
      if (m[1] !== undefined && m[0] !== m[1]) {
        const prefixLen = m[0].indexOf(m[1]);
        startIndex += prefixLen;
        tokenText = m[1];
        endIndex = startIndex + tokenText.length;
      }

      const res = handler(m);
      if (res) {
        foundSpans.push({
          start: startIndex,
          end: endIndex,
          type,
          text: tokenText,
          label: res.label,
          value: res.value,
        });
      }
    }
  };

  // 1. Tags (#tag)
  scanPattern(/(?:^|[\s])(#[\p{L}\w_-]+)/gu, 'tag', (m) => {
    const rawTag = (m[1] || m[0]).trim();
    const cleanTag = rawTag.replace(/^#/, '');
    if (cleanTag && !detectedTags.includes(cleanTag)) {
      detectedTags.push(cleanTag);
    }
    return { value: cleanTag, label: `#${cleanTag}` };
  });

  // 2. Priority: p1/p2/p3 or !1/!2/!3 or !فوری/!متوسط/!کم
  scanPattern(
    /(?:^|[\s])(!{1,3}|![123]|![فوریزاید]+|!متوسط|!کم|[pP][123])(?=$|[\s،,])/gu,
    'priority',
    (m) => {
      const token = (m[1] || m[0]).trim();
      let p: 1 | 2 | 3 = 1;
      let label = 'کم';
      if (/!{3}|!3|!(?:فوری|زیاد)|[pP]1/.test(token)) {
        p = 3;
        label = 'فوری (P1)';
      } else if (/!{2}|!2|!متوسط|[pP]2/.test(token)) {
        p = 2;
        label = 'متوسط (P2)';
      } else if (/!{1}|!1|!کم|[pP]3/.test(token)) {
        p = 1;
        label = 'کم (P3)';
      }
      detectedPriority = p;
      return { value: p, label };
    }
  );

  // 3. Time: ساعت N:MM or ساعت N
  scanPattern(
    /(?:^|[\s])((?:ساعت\s*)\d{1,2}(?::\d{2})?)(?=$|[\s،,])/giu,
    'time',
    (m) => {
      const fullTimeStr = (m[1] || m[0]).trim();
      const timeParts = fullTimeStr.match(/(?:ساعت\s*)(\d{1,2})(?::(\d{2}))?/i);
      if (timeParts) {
        const hour = timeParts[1].padStart(2, '0');
        const min = (timeParts[2] || '00').padStart(2, '0');
        detectedTime = `${hour}:${min}`;
        return { value: detectedTime, label: detectedTime };
      }
      return null;
    }
  );

  // 4. Dates: امروز، فردا، پس‌فردا، آخر هفته، هفته بعد، روزهای هفته
  scanPattern(
    /(?:^|[\s،,])(امروز|فردا|پس‌?فردا|پس\s+فردا|آخر\s*هفته|آخرهفته|هفته\s*(?:بعد|آینده)|شنبه|یکشنبه|دوشنبه|سه‌شنبه|سه\s+شنبه|چهارشنبه|پنج‌شنبه|پنج\s+شنبه|جمعه)(?=$|[\s،,])/giu,
    'date',
    (m) => {
      const word = (m[1] || m[0]).trim();
      let d = todayKey;
      let label = word;

      if (word === 'امروز') {
        d = todayKey;
        label = 'امروز';
      } else if (word === 'فردا') {
        d = addJalaliDays(todayKey, 1);
        label = 'فردا';
      } else if (/^پس‌?فردا$|^پس\s+فردا$/.test(word)) {
        d = addJalaliDays(todayKey, 2);
        label = 'پس‌فردا';
      } else if (/^آخر\s*هفته$|^آخرهفته$/.test(word)) {
        d = nextWeekendFrom(todayKey);
        label = 'آخر هفته';
      } else if (/^هفته\s*(?:بعد|آینده)$/.test(word)) {
        d = addJalaliDays(todayKey, 7);
        label = 'هفته بعد';
      } else {
        const normalized = word.replace(/\s+/g, ' ');
        for (const [name, dow] of Object.entries(WEEKDAY_MAP)) {
          if (name === normalized || name === word) {
            d = getNextWeekdayDate(todayKey, dow);
            label = name;
            break;
          }
        }
      }

      detectedDueDate = d;
      return { value: d, label };
    }
  );

  // Sort spans by startIndex and eliminate any overlaps
  foundSpans.sort((a, b) => a.start - b.start);
  const resolvedSpans: HighlightSpan[] = [];
  let lastEnd = 0;
  for (const span of foundSpans) {
    if (span.start >= lastEnd) {
      resolvedSpans.push(span);
      lastEnd = span.end;
    }
  }

  // Generate clean title by removing all matched spans
  let cleanTitle = '';
  let cursor = 0;
  for (const span of resolvedSpans) {
    if (span.start > cursor) {
      cleanTitle += text.substring(cursor, span.start);
    }
    cursor = span.end;
  }
  if (cursor < text.length) {
    cleanTitle += text.substring(cursor);
  }

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return {
    rawText: text,
    cleanTitle: cleanTitle || text.trim(),
    tokens: resolvedSpans,
    dueDate: detectedDueDate || currentSelectedDate,
    priority: detectedPriority,
    tags: detectedTags,
    time: detectedTime,
  };
}

export function parseQuickInput(
  text: string,
  currentSelectedDate?: string
): ParsedQuickEntry {
  const tokenized = extractQuickTokens(text, currentSelectedDate);
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

  // Recurrence rule (هر روز، هر هفته...)
  let recurrenceRule: string | undefined;
  const recurrenceMatch = trimmed.match(RECURRENCE_REGEX);
  if (recurrenceMatch) {
    recurrenceRule = recurrenceMatch[0].trim();
  }

  // Mentions (@name)
  const mentions: string[] = [];
  const mentionMatches = trimmed.match(/@([\p{L}\w_-]+)/gu);
  if (mentionMatches) {
    mentionMatches.forEach((m) => {
      const cleanMention = m.replace('@', '').trim();
      if (cleanMention && !mentions.includes(cleanMention)) {
        mentions.push(cleanMention);
      }
    });
  }

  // 7. Type detection
  let detectedType: 'task' | 'note' | 'event' = 'note';
  if (
    recurrenceRule ||
    (tokenized.time &&
      (tokenized.cleanTitle.includes('جلسه') ||
        tokenized.cleanTitle.includes('دکتر') ||
        tokenized.cleanTitle.includes('دارو') ||
        tokenized.cleanTitle.includes('قرار')))
  ) {
    detectedType = 'event';
  } else if (
    tokenized.priority !== undefined ||
    ACTION_VERBS_REGEX.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.includes('باید')
  ) {
    detectedType = 'task';
  }

  return {
    rawText: trimmed,
    cleanTitle: tokenized.cleanTitle || trimmed,
    detectedType,
    priority: tokenized.priority,
    dueDate: tokenized.dueDate,
    time: tokenized.time,
    recurrenceRule,
    tags: tokenized.tags,
    mentions,
  };
}
