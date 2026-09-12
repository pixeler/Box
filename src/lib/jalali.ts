import jalaali from 'jalaali-js';

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const PERSIAN_WEEKDAY_NAMES = [
  'شنبه',
  '۱شنبه',
  '۲شنبه',
  '۳شنبه',
  '۴شنبه',
  '۵شنبه',
  'جمعه',
];

export const PERSIAN_WEEKDAY_SHORT_NAMES = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
];

export const PERSIAN_FULL_WEEKDAY_NAMES = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

export function getFullPersianWeekdayName(date: Date): string {
  // getIranianDayOfWeek returns 0 for شنبه ... 6 for جمعه
  const iranianDay = getIranianDayOfWeek(date);
  return PERSIAN_FULL_WEEKDAY_NAMES[iranianDay] || 'روز';
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface WeekDayInfo {
  date: Date;
  jalali: JalaliDate;
  dayName: string;
  dayShortName: string;
  dayNumber: number; // e.g. 30
  formattedDate: string; // "1404/10/30"
  isToday: boolean;
  isFriday: boolean;
}

/**
 * تبدیل ارقام انگلیسی به فارسی
 */
export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n
    .toString()
    .replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

/**
 * تبدیل Date جاوااسکریپت به تاریخ شمسی
 */
export function getJalaliDate(date: Date = new Date()): JalaliDate {
  return jalaali.toJalaali(date);
}

/**
 * تبدیل تاریخ شمسی به شیء Date گرگوریان
 */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/**
 * رشته استاندارد شمسی: "1404/10/30"
 */
export function formatJalaliKey(j: JalaliDate): string {
  const mm = j.jm.toString().padStart(2, '0');
  const dd = j.jd.toString().padStart(2, '0');
  return `${j.jy}/${mm}/${dd}`;
}

/**
 * تبدیل کلید "1404/10/30" به شیء JalaliDate
 */
export function parseJalaliKey(key: string): JalaliDate {
  const parts = key.split(/[/\\-]/).map((p) => parseInt(p, 10));
  return {
    jy: parts[0] || 1404,
    jm: parts[1] || 1,
    jd: parts[2] || 1,
  };
}

/**
 * نمایش تاریخ کامل مثل «۳۰ دی ۱۴۰۴»
 */
export function formatJalaliDisplay(j: JalaliDate): string {
  const monthName = PERSIAN_MONTH_NAMES[j.jm - 1] || '';
  return `${toPersianDigits(j.jd)} ${monthName} ${toPersianDigits(j.jy)}`;
}

/**
 * اندیس روز هفته بر اساس تقویم ایران (شنبه = 0 تا جمعه = 6)
 */
export function getIranianDayOfWeek(date: Date): number {
  const day = date.getDay(); // Sunday is 0, Monday is 1, ..., Saturday is 6
  // We want Saturday to be 0, Sunday to be 1, ..., Friday to be 6
  return (day + 1) % 7;
}

/**
 * دریافت ۷ روز هفته‌ی متناظر با یک تاریخ خاص (شنبه تا جمعه)
 */
export function getWeekDaysForDate(targetDate: Date): WeekDayInfo[] {
  const currentIranianDay = getIranianDayOfWeek(targetDate);
  // Calculate the Saturday (start of this week)
  const saturdayDate = new Date(targetDate);
  saturdayDate.setDate(targetDate.getDate() - currentIranianDay);
  saturdayDate.setHours(0, 0, 0, 0);

  const today = new Date();
  const todayJ = jalaali.toJalaali(today);
  const todayKey = formatJalaliKey(todayJ);

  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(saturdayDate);
    d.setDate(saturdayDate.getDate() + i);

    const j = jalaali.toJalaali(d);
    const key = formatJalaliKey(j);

    days.push({
      date: d,
      jalali: j,
      dayName: PERSIAN_WEEKDAY_NAMES[i],
      dayShortName: PERSIAN_WEEKDAY_SHORT_NAMES[i],
      dayNumber: j.jd,
      formattedDate: key,
      isToday: key === todayKey,
      isFriday: i === 6,
    });
  }

  return days;
}

/**
 * تاریخ امروز به صورت کلید جلالی
 */
export function getTodayJalaliKey(): string {
  return formatJalaliKey(getJalaliDate(new Date()));
}

/**
 * افزودن N روز به یک کلید جلالی
 */
export function addJalaliDays(key: string, days: number): string {
  const j = parseJalaliKey(key);
  const d = jalaliToDate(j.jy, j.jm, j.jd);
  d.setDate(d.getDate() + days);
  return formatJalaliKey(getJalaliDate(d));
}

/**
 * دریافت جمعه بعدی نسبت به تاریخ ورودی
 */
export function nextWeekendFrom(key: string): string {
  const j = parseJalaliKey(key);
  const d = jalaliToDate(j.jy, j.jm, j.jd);
  const dow = d.getDay(); // Sunday=0, ..., Friday=5, Saturday=6
  const daysUntilFri = ((5 - dow + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntilFri);
  return formatJalaliKey(getJalaliDate(d));
}

/**
 * تعداد روزهای ماه جلالی
 */
export function getJalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

/**
 * روز هفته برای روز اول ماه (شنبه = 0 تا جمعه = 6)
 */
export function getJalaliMonthFirstDayOfWeek(jy: number, jm: number): number {
  const d = jalaliToDate(jy, jm, 1);
  return getIranianDayOfWeek(d);
}

/**
 * فرمت تاریخ و زمان تسک به سبک Todoist
 * اگر تسک برای روزِ در حال نمایش باشد و ساعتی نداشته باشد، null برمی‌گرداند.
 */
export function formatTaskDateDisplay(
  dueDateStr?: string,
  viewDateKey: string = getTodayJalaliKey(),
  alwaysShowRelative: boolean = false
): string | null {
  if (!dueDateStr || !dueDateStr.trim()) return null;

  const raw = dueDateStr.trim();
  let datePart = '';
  let timePart: string | null = null;

  // استخراج زمان (مانند ۱۲:۳۰)
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const h = timeMatch[1].padStart(2, '0');
    const m = timeMatch[2];
    timePart = `${toPersianDigits(h)}:${toPersianDigits(m)}`;
  }

  // استخراج تاریخ جلالی
  const jalaliMatch = raw.match(/(\d{4})[/\\-](\d{1,2})[/\\-](\d{1,2})/);
  let taskJalali: JalaliDate;
  if (jalaliMatch) {
    taskJalali = {
      jy: parseInt(jalaliMatch[1], 10),
      jm: parseInt(jalaliMatch[2], 10),
      jd: parseInt(jalaliMatch[3], 10),
    };
    datePart = formatJalaliKey(taskJalali);
  } else {
    // تلاش برای پارس به عنوان فرمت استاندارد میلادی
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    taskJalali = getJalaliDate(d);
    datePart = formatJalaliKey(taskJalali);
    if (!timePart && raw.includes(':')) {
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      timePart = `${toPersianDigits(h)}:${toPersianDigits(m)}`;
    }
  }

  const todayKey = getTodayJalaliKey();
  const isViewDate = datePart === viewDateKey;

  // اگر تسک متعلق به همان روز در حال نمایش است، فقط ساعت (در صورت وجود) نمایش داده می‌شود مگر اینکه نمایش تاریخ الزامی باشد
  if (isViewDate && !alwaysShowRelative) {
    return timePart || null;
  }

  // محاسبه اختلاف روزها نسبت به امروز واقعی
  const todayJ = parseJalaliKey(todayKey);
  const todayDate = jalaliToDate(todayJ.jy, todayJ.jm, todayJ.jd);
  const taskDate = jalaliToDate(taskJalali.jy, taskJalali.jm, taskJalali.jd);

  const utcToday = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const utcTask = Date.UTC(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
  const diffDays = Math.round((utcTask - utcToday) / (1000 * 60 * 60 * 24));

  let dateLabel = '';
  if (diffDays === 0) {
    dateLabel = 'امروز';
  } else if (diffDays === -1) {
    dateLabel = 'دیروز';
  } else if (diffDays === -2) {
    dateLabel = '۲ روز قبل';
  } else if (diffDays < -2 && diffDays >= -7) {
    dateLabel = `${toPersianDigits(Math.abs(diffDays))} روز قبل`;
  } else if (diffDays === 1) {
    dateLabel = 'فردا';
  } else if (diffDays === 2) {
    dateLabel = 'پس‌فردا';
  } else if (diffDays > 2 && diffDays <= 6) {
    dateLabel = getFullPersianWeekdayName(taskDate);
  } else {
    const monthName = PERSIAN_MONTH_NAMES[taskJalali.jm - 1] || '';
    dateLabel = `${toPersianDigits(taskJalali.jd)} ${monthName} ${toPersianDigits(taskJalali.jy)}`;
  }

  if (timePart) {
    return `${dateLabel}/ ${timePart}`;
  }
  return dateLabel;
}

/**
 * برچسب روز نسبی (امروز، فردا، پس‌فردا، دیروز)
 * اگر خارج از این ۴ روز باشد، مقدار null برمی‌گرداند تا فقط نام روز هفته نشان داده شود.
 */
export function getRelativeDayPrefix(targetDateKey: string, todayKey: string): string | null {
  if (targetDateKey === todayKey) return 'امروز';
  try {
    const targetJ = parseJalaliKey(targetDateKey);
    const todayJ = parseJalaliKey(todayKey);
    const targetDate = jalaliToDate(targetJ.jy, targetJ.jm, targetJ.jd);
    const todayDate = jalaliToDate(todayJ.jy, todayJ.jm, todayJ.jd);

    const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const utcToday = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const diffDays = Math.round((utcTarget - utcToday) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'فردا';
    if (diffDays === 2) return 'پس‌فردا';
    if (diffDays === -1) return 'دیروز';
  } catch {
    return null;
  }
  return null;
}
