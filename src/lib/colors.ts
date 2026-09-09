export interface PastelColor {
  id: string;
  name: string;
  hex: string;
  barHex: string;
  borderHex: string;
  bgClass: string;
  borderClass: string;
}

export const PASTEL_NOTE_COLORS: PastelColor[] = [
  {
    id: 'default',
    name: 'پیش‌فرض (سفید)',
    hex: '',
    barHex: 'transparent',
    borderHex: '#e5e7eb',
    bgClass: 'bg-white',
    borderClass: 'border-gray-200',
  },
  {
    id: 'amber',
    name: 'کهربایی / خردلی',
    hex: '#fef3c7',
    barHex: '#f59e0b',
    borderHex: '#fde68a',
    bgClass: 'bg-amber-100/60',
    borderClass: 'border-amber-300',
  },
  {
    id: 'rose',
    name: 'صورتی ملایم',
    hex: '#ffe4e6',
    barHex: '#f43f5e',
    borderHex: '#fecdd3',
    bgClass: 'bg-rose-100/60',
    borderClass: 'border-rose-300',
  },
  {
    id: 'emerald',
    name: 'سبز نعنایی',
    hex: '#d1fae5',
    barHex: '#10b981',
    borderHex: '#a7f3d0',
    bgClass: 'bg-emerald-100/60',
    borderClass: 'border-emerald-300',
  },
  {
    id: 'sky',
    name: 'آبی آسمانی',
    hex: '#e0f2fe',
    barHex: '#0ea5e9',
    borderHex: '#bae6fd',
    bgClass: 'bg-sky-100/60',
    borderClass: 'border-sky-300',
  },
  {
    id: 'purple',
    name: 'یاسی / بنفش',
    hex: '#f3e8ff',
    barHex: '#a855f7',
    borderHex: '#e9d5ff',
    bgClass: 'bg-purple-100/60',
    borderClass: 'border-purple-300',
  },
  {
    id: 'orange',
    name: 'هلویی / نارنجی',
    hex: '#ffedd5',
    barHex: '#f97316',
    borderHex: '#fed7aa',
    bgClass: 'bg-orange-100/60',
    borderClass: 'border-orange-300',
  },
];

export function getPastelColorByHex(hex?: string): PastelColor | undefined {
  if (!hex) return undefined;
  return PASTEL_NOTE_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase() || c.barHex.toLowerCase() === hex.toLowerCase()
  );
}
