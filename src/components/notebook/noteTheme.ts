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
