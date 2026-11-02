import type { CSSProperties } from 'react';
import { toPersianDigits } from '@/lib/jalali';

export interface NoteColorPreset {
  id: string;
  name: string;
  dot: string;
  lightBg: string;
  lightBorder: string;
  lightText: string;
  lightSubtext: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
  darkSubtext: string;
}

export interface NoteBackgroundPreset {
  id: string;
  name: string;
  kind: 'gradient' | 'pattern';
  style: CSSProperties;
}

/** Gradients and paper textures for the note cover strip. */
export const NOTE_BACKGROUND_PRESETS: NoteBackgroundPreset[] = [
  { id: 'bg-sunrise', name: 'طلوع', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #FFD3A5 0%, #FD6585 100%)' } },
  { id: 'bg-ocean', name: 'اقیانوس', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #89F7FE 0%, #66A6FF 100%)' } },
  { id: 'bg-meadow', name: 'چمن‌زار', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #D4FC79 0%, #96E6A1 100%)' } },
  { id: 'bg-lilac', name: 'یاس', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)' } },
  { id: 'bg-ember', name: 'اخگر', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)' } },
  { id: 'bg-midnight', name: 'نیمه‌شب', kind: 'gradient', style: { backgroundImage: 'linear-gradient(135deg, #2b3038 0%, #4b5563 100%)' } },
  { id: 'bg-kraft', name: 'کاغذ کرافت', kind: 'pattern', style: {
    backgroundColor: '#D8C3A5',
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgba(110,84,56,0.12) 0 2px, transparent 2px 6px)',
  } },
  { id: 'bg-lined', name: 'کاغذ خط‌دار', kind: 'pattern', style: {
    backgroundColor: '#FFFDF6',
    backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 15px, #DCE6EE 15px 16px)',
  } },
  { id: 'bg-grid', name: 'کاغذ شطرنجی', kind: 'pattern', style: {
    backgroundColor: '#FCFDFE',
    backgroundImage:
      'repeating-linear-gradient(to right, #DCE7EF 0 1px, transparent 1px 16px), repeating-linear-gradient(to bottom, #DCE7EF 0 1px, transparent 1px 16px)',
  } },
  { id: 'bg-dots', name: 'کاغذ نقطه‌ای', kind: 'pattern', style: {
    backgroundColor: '#FBFBF9',
    backgroundImage: 'radial-gradient(#CBD5DC 1.1px, transparent 1.1px)',
    backgroundSize: '14px 14px',
  } },
  { id: 'bg-margin', name: 'دفتر یادداشت', kind: 'pattern', style: {
    backgroundColor: '#FFFCF4',
    backgroundImage:
      'linear-gradient(to left, transparent 0 26px, #F3B6B6 26px 27px, transparent 27px), repeating-linear-gradient(to bottom, transparent 0 15px, #E3E9F0 15px 16px)',
  } },
  { id: 'bg-canvas', name: 'بوم هنری', kind: 'pattern', style: {
    backgroundColor: '#F4EFE6',
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(160,140,110,0.10) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(160,140,110,0.10) 0 1px, transparent 1px 3px)',
  } },
];

export const NOTE_COLOR_PRESETS: NoteColorPreset[] = [
  {
    id: 'peach',
    name: 'هلویی / رز',
    dot: '#F472B6',
    lightBg: 'bg-[#F9ECE5]',
    lightBorder: 'border-[#F1D4C6]',
    lightText: 'text-[#4A2D23]',
    lightSubtext: 'text-[#7D5A4F]',
    darkBg: 'dark:bg-[#2C1F1B]',
    darkBorder: 'dark:border-[#4B342C]',
    darkText: 'dark:text-[#F8DDD3]',
    darkSubtext: 'dark:text-[#BEA398]',
  },
  {
    id: 'sky',
    name: 'آبی آسمانی',
    dot: '#38BDF8',
    lightBg: 'bg-[#E1EFF6]',
    lightBorder: 'border-[#C7DFEB]',
    lightText: 'text-[#143B52]',
    lightSubtext: 'text-[#3E657D]',
    darkBg: 'dark:bg-[#152530]',
    darkBorder: 'dark:border-[#243F54]',
    darkText: 'dark:text-[#D7EDF9]',
    darkSubtext: 'dark:text-[#8DB4CB]',
  },
  {
    id: 'lavender',
    name: 'یاسی / بنفش',
    dot: '#A78BFA',
    lightBg: 'bg-[#ECE8F9]',
    lightBorder: 'border-[#D9D1F2]',
    lightText: 'text-[#32235B]',
    lightSubtext: 'text-[#5C4D84]',
    darkBg: 'dark:bg-[#231C33]',
    darkBorder: 'dark:border-[#3D3058]',
    darkText: 'dark:text-[#ECE4FB]',
    darkSubtext: 'dark:text-[#A798C7]',
  },
  {
    id: 'sage',
    name: 'سبز ملایم',
    dot: '#4ADE80',
    lightBg: 'bg-[#E5EFE2]',
    lightBorder: 'border-[#CCDFC7]',
    lightText: 'text-[#1F421D]',
    lightSubtext: 'text-[#446741]',
    darkBg: 'dark:bg-[#1A2619]',
    darkBorder: 'dark:border-[#2C412B]',
    darkText: 'dark:text-[#DCF0DA]',
    darkSubtext: 'dark:text-[#94B891]',
  },
  {
    id: 'lemon',
    name: 'لیمویی روشن',
    dot: '#FACC15',
    lightBg: 'bg-[#FAF8D8]',
    lightBorder: 'border-[#EAE7B6]',
    lightText: 'text-[#474214]',
    lightSubtext: 'text-[#706B33]',
    darkBg: 'dark:bg-[#2B2915]',
    darkBorder: 'dark:border-[#4A4620]',
    darkText: 'dark:text-[#FAF7CB]',
    darkSubtext: 'dark:text-[#BBB67A]',
  },
  {
    id: 'pink',
    name: 'صورتی ملایم',
    dot: '#FB7185',
    lightBg: 'bg-[#F9E2EE]',
    lightBorder: 'border-[#F1C4DD]',
    lightText: 'text-[#561D3D]',
    lightSubtext: 'text-[#854569]',
    darkBg: 'dark:bg-[#2D1B25]',
    darkBorder: 'dark:border-[#4F2C3F]',
    darkText: 'dark:text-[#FBE2F0]',
    darkSubtext: 'dark:text-[#C493AF]',
  },
  {
    id: 'lime',
    name: 'سبز پسته',
    dot: '#A3E635',
    lightBg: 'bg-[#F1F7D6]',
    lightBorder: 'border-[#DEECC0]',
    lightText: 'text-[#354817]',
    lightSubtext: 'text-[#597136]',
    darkBg: 'dark:bg-[#222B13]',
    darkBorder: 'dark:border-[#3A4A1E]',
    darkText: 'dark:text-[#EDF8C8]',
    darkSubtext: 'dark:text-[#A5B884]',
  },
  {
    id: 'sand',
    name: 'شنی / خنثی',
    dot: '#A8A29E',
    lightBg: 'bg-[#F3F0EA]',
    lightBorder: 'border-[#E2DCD3]',
    lightText: 'text-[#3D3833]',
    lightSubtext: 'text-[#69625B]',
    darkBg: 'dark:bg-[#242220]',
    darkBorder: 'dark:border-[#3D3A36]',
    darkText: 'dark:text-[#F1EFEA]',
    darkSubtext: 'dark:text-[#A8A39C]',
  },
];

/**
 * A short, human date for a note: today, yesterday, a few days ago, or the
 * Jalali day and month. Kept in the note layer so every list shows it the same.
 */
export function formatNoteDate(isoDateString?: string): string {
  if (!isoDateString) return '';
  const date = new Date(isoDateString);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (dayDiff <= 0) return 'امروز';
  if (dayDiff === 1) return 'دیروز';
  if (dayDiff < 7) return `${toPersianDigits(dayDiff)} روز پیش`;

  try {
    return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' }).format(date);
  } catch {
    return '';
  }
}

export function getNoteColorPreset(colorId?: string | null, fallbackIndex: number = 0): NoteColorPreset {
  if (colorId) {
    const found = NOTE_COLOR_PRESETS.find((p) => p.id === colorId);
    if (found) return found;
  }
  const idx = Math.abs(fallbackIndex) % NOTE_COLOR_PRESETS.length;
  return NOTE_COLOR_PRESETS[idx];
}

/**
 * Returns a Jalali date badge string (e.g. "۱۴۰۳" or "۱۷ مهر") from created_at
 */
export function formatNoteDateBadge(isoDateString?: string): string {
  if (!isoDateString) return 'امروز';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return '';
    // Format to Jalali:
    const jf = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
    }).format(d);
    return jf;
  } catch {
    return '۱۴۰۵';
  }
}
