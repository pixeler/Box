export interface TaskEmojiInfo {
  emoji: string;
  bgClass: string;
}

const KEYWORD_MAP: Array<{ keywords: string[]; emoji: string; bgClass: string }> = [
  {
    keywords: ['homework', 'study', 'read', 'book', 'exam', 'درس', 'مشق', 'مطالعه', 'کتاب', 'امتحان', 'دانشگاه', 'مدرسه', 'تحقیق'],
    emoji: '📚',
    bgClass: 'bg-blue-100/70 dark:bg-blue-950/60 text-blue-600',
  },
  {
    keywords: ['rent', 'house', 'home', 'bill', 'room', 'اجاره', 'خانه', 'منزل', 'قبض', 'اتاق', 'تعمیر'],
    emoji: '🏠',
    bgClass: 'bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-600',
  },
  {
    keywords: ['meal', 'food', 'cook', 'dinner', 'lunch', 'breakfast', 'eat', 'غذا', 'ناهار', 'شام', 'صبحانه', 'آشپزی', 'رستوران', 'پخت'],
    emoji: '🍽️',
    bgClass: 'bg-orange-100/70 dark:bg-orange-950/60 text-orange-600',
  },
  {
    keywords: ['laundry', 'wash', 'clothes', 'iron', 'لباس', 'شستن', 'لباسشویی', 'اتو', 'خشکشویی', 'نظافت'],
    emoji: '🧺',
    bgClass: 'bg-sky-100/70 dark:bg-sky-950/60 text-sky-600',
  },
  {
    keywords: ['gym', 'workout', 'sport', 'run', 'exercise', 'fitness', 'باشگاه', 'ورزش', 'تمرین', 'دویدن', 'بدنسازی', 'پیاده‌روی', 'یوگا'],
    emoji: '🏋️',
    bgClass: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600',
  },
  {
    keywords: ['work', 'code', 'meeting', 'project', 'bug', 'deploy', 'کار', 'کد', 'برنامه', 'جلسه', 'پروژه', 'گزارش', 'میتینگ'],
    emoji: '💻',
    bgClass: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-600',
  },
  {
    keywords: ['buy', 'shop', 'grocery', 'market', 'خرید', 'فروشگاه', 'سوپر', 'میوه'],
    emoji: '🛒',
    bgClass: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-600',
  },
  {
    keywords: ['call', 'phone', 'talk', 'تماس', 'تلفن', 'زنگ', 'پیگیری', 'صحبت'],
    emoji: '📞',
    bgClass: 'bg-teal-100/70 dark:bg-teal-950/60 text-teal-600',
  },
  {
    keywords: ['doctor', 'med', 'hospital', 'dentist', 'health', 'دکتر', 'پزشک', 'دارو', 'دندانپزشک', 'بیمارستان', 'درمانگاه', 'آزمایش'],
    emoji: '💊',
    bgClass: 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-600',
  },
  {
    keywords: ['car', 'drive', 'fuel', 'ماشین', 'خودرو', 'بنزین', 'تعویض روغن', 'تعمیرگاه', 'رانندگی'],
    emoji: '🚗',
    bgClass: 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700',
  },
  {
    keywords: ['money', 'bank', 'pay', 'پول', 'بانک', 'واریز', 'کارت', 'انتقال'],
    emoji: '💳',
    bgClass: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600',
  },
  {
    keywords: ['sleep', 'rest', 'خواب', 'استراحت', 'چرت'],
    emoji: '🛌',
    bgClass: 'bg-violet-100/70 dark:bg-violet-950/60 text-violet-600',
  },
  {
    keywords: ['music', 'podcast', 'song', 'موزیک', 'آهنگ', 'موسیقی', 'پادکست'],
    emoji: '🎵',
    bgClass: 'bg-fuchsia-100/70 dark:bg-fuchsia-950/60 text-fuchsia-600',
  },
  {
    keywords: ['plant', 'garden', 'flower', 'گل', 'گلدان', 'آبیاری', 'باغچه'],
    emoji: '🌱',
    bgClass: 'bg-lime-100/70 dark:bg-lime-950/60 text-lime-600',
  },
  {
    keywords: ['email', 'mail', 'ایمیل', 'نامه', 'پیام'],
    emoji: '✉️',
    bgClass: 'bg-sky-100/70 dark:bg-sky-950/60 text-sky-600',
  },
];

export function getTaskEmoji(title: string): TaskEmojiInfo {
  if (!title) return { emoji: '✨', bgClass: 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600' };

  // Check if title already starts with an emoji
  const emojiRegex = /^\p{Extended_Pictographic}/u;
  const match = title.match(emojiRegex);
  if (match) {
    return { emoji: match[0], bgClass: 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600' };
  }

  const lower = title.toLowerCase();
  for (const item of KEYWORD_MAP) {
    for (const kw of item.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { emoji: item.emoji, bgClass: item.bgClass };
      }
    }
  }

  return { emoji: '📝', bgClass: 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600' };
}
