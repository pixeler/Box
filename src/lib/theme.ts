import { updateStatusBarTheme, updateKeyboardTheme } from './capacitor';

export type ThemeId =
  // Dark themes
  | 'default-dark'
  | 'github-dark'
  | 'miku-dark'
  | 'caffeine-dark'
  | 'rose-pine-dark'
  | 'dracula-dark'
  | 'one-dark'
  | 'nord-dark'
  | 'tokyo-night'
  // Light themes
  | 'default-light'
  | 'sky-light'
  | 'github-light'
  | 'retro-keyboard'
  | 'solarized-light'
  | 'one-light'
  | 'nord-light'
  | 'rose-pine-dawn';

export type ThemeMode = 'dark' | 'light';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  nameEn: string;
  mode: ThemeMode;
  description: string;
  previewColors: {
    bg: string;
    card: string;
    border: string;
    text: string;
    accent: string;
  };
}

export const THEMES: ThemeConfig[] = [
  // --- Dark Themes ---
  {
    id: 'default-dark',
    name: 'پیش‌فرض (shadcn)',
    nameEn: 'Default Dark',
    mode: 'dark',
    description: 'تم خنثی، بدون اکسنت رنگی با کانتراست استاندارد مونوکروم',
    previewColors: {
      bg: '#09090b',
      card: '#18181b',
      border: '#27272a',
      text: '#fafafa',
      accent: '#f4f4f5',
    },
  },
  {
    id: 'github-dark',
    name: 'گیت‌هاب دارک',
    nameEn: 'GitHub Dark',
    mode: 'dark',
    description: 'تم کلاسیک VS Code گیت‌هاب با پس‌زمینه زغالی و اکسنت آبی',
    previewColors: {
      bg: '#0d1117',
      card: '#161b22',
      border: '#30363d',
      text: '#e6edf3',
      accent: '#58a6ff',
    },
  },
  {
    id: 'miku-dark',
    name: 'هاتسونه میکو',
    nameEn: 'Hatsune Miku',
    mode: 'dark',
    description: 'تم سایبری الهام‌گرفته از میکو با اکسنت آبی فیروزه‌ای تند و صورتی',
    previewColors: {
      bg: '#12161f',
      card: '#1b2230',
      border: '#2a354b',
      text: '#e6f7f6',
      accent: '#39c5bb',
    },
  },
  {
    id: 'caffeine-dark',
    name: 'کافئین',
    nameEn: 'Caffeine',
    mode: 'dark',
    description: 'پالت گرم دانه قهوه رست‌شده و اسپرسو با اکسنت کاراملی',
    previewColors: {
      bg: '#181412',
      card: '#241e1a',
      border: '#3c322b',
      text: '#f2eae4',
      accent: '#d48b46',
    },
  },
  {
    id: 'rose-pine-dark',
    name: 'رز پاپپن',
    nameEn: 'Rosé Pine',
    mode: 'dark',
    description: 'تم محبوب رُز پاین با بیس ملایم کاجی، متن مه‌آلود و اکسنت صورتی',
    previewColors: {
      bg: '#191724',
      card: '#1f1d2e',
      border: '#393552',
      text: '#e0def4',
      accent: '#eb6f92',
    },
  },
  {
    id: 'dracula-dark',
    name: 'دراکولا',
    nameEn: 'Dracula Official',
    mode: 'dark',
    description: 'پالت بنفش گوتیک و نمادین دراکولا با کنتراست شبانه چشم‌نواز',
    previewColors: {
      bg: '#21222c',
      card: '#282a36',
      border: '#44475a',
      text: '#f8f8f2',
      accent: '#bd93f9',
    },
  },
  {
    id: 'one-dark',
    name: 'وان دارک پرو',
    nameEn: 'One Dark Pro',
    mode: 'dark',
    description: 'تم افسانه‌ای اتم با خاکستری دقیق، متن مخملی و اکسنت آبی فیروزه‌ای',
    previewColors: {
      bg: '#21252b',
      card: '#282c34',
      border: '#3a3f4b',
      text: '#abb2bf',
      accent: '#61afef',
    },
  },
  {
    id: 'nord-dark',
    name: 'نورد قطبی',
    nameEn: 'Nord Arctic',
    mode: 'dark',
    description: 'مینیمالیسم قطبی اسکاندیناوی با سایه‌های یخچالی و آبی شفق',
    previewColors: {
      bg: '#242933',
      card: '#2e3440',
      border: '#434c5e',
      text: '#eceff4',
      accent: '#88c0d0',
    },
  },
  {
    id: 'tokyo-night',
    name: 'توکیو نایت',
    nameEn: 'Tokyo Night',
    mode: 'dark',
    description: 'شب‌های درخشان نئونی توکیو با بنفش لوندر و حس فوق مدرن',
    previewColors: {
      bg: '#16161e',
      card: '#1f2335',
      border: '#292e42',
      text: '#c0caf5',
      accent: '#bb9af7',
    },
  },

  // --- Light Themes ---
  {
    id: 'default-light',
    name: 'پیش‌فرض (shadcn)',
    nameEn: 'Default Light',
    mode: 'light',
    description: 'تم مینیمال خنثی سفید و مشکی استاندارد',
    previewColors: {
      bg: '#ffffff',
      card: '#ffffff',
      border: '#e4e4e7',
      text: '#09090b',
      accent: '#18181b',
    },
  },
  {
    id: 'sky-light',
    name: 'آسمانی روشن',
    nameEn: 'Sky Light',
    mode: 'light',
    description: 'هوای تازه و آسمان آبی با سطوح ملایم و اکسنت فیروزه‌ای لاجوردی',
    previewColors: {
      bg: '#f0f7ff',
      card: '#ffffff',
      border: '#bae6fd',
      text: '#0c2a4d',
      accent: '#0284c7',
    },
  },
  {
    id: 'github-light',
    name: 'گیت‌هاب روشن',
    nameEn: 'GitHub Light',
    mode: 'light',
    description: 'پالت روشن رسمی گیت‌هاب با خاکستری دقیق و اکسنت آبی توسعه‌دهنده',
    previewColors: {
      bg: '#f6f8fa',
      card: '#ffffff',
      border: '#d0d7de',
      text: '#1f2328',
      accent: '#0969da',
    },
  },
  {
    id: 'retro-keyboard',
    name: 'کیبورد رترو',
    nameEn: 'Retro Keyboard',
    mode: 'light',
    description: 'نوستالژی کیبوردهای مکانیکی دهه ۹۰ با رنگ پاتی، کِرم و کلید قرمز',
    previewColors: {
      bg: '#ede8dd',
      card: '#f8f5ee',
      border: '#d3cab9',
      text: '#2e2a25',
      accent: '#c0392b',
    },
  },
  {
    id: 'solarized-light',
    name: 'سولارایزد روشن',
    nameEn: 'Solarized Light',
    mode: 'light',
    description: 'پالت مشهور برای استراحت چشم با کانتراست استاندارد و زرد کاهی',
    previewColors: {
      bg: '#fdf6e3',
      card: '#eee8d5',
      border: '#d33682',
      text: '#073642',
      accent: '#2aa198',
    },
  },
  {
    id: 'one-light',
    name: 'وان لایت',
    nameEn: 'One Light',
    mode: 'light',
    description: 'تم روشن و شاداب اتم با پس‌زمینه تمیز نقره‌ای و اکسنت آبی درباری',
    previewColors: {
      bg: '#f9f9fb',
      card: '#ffffff',
      border: '#e5e5e6',
      text: '#383a42',
      accent: '#4078f2',
    },
  },
  {
    id: 'nord-light',
    name: 'نورد برفی',
    nameEn: 'Nord Snow',
    mode: 'light',
    description: 'نسیم خنک برف شمالگان با خاکستری لطیف و آبی قطبی عمیق',
    previewColors: {
      bg: '#f2f4f8',
      card: '#ffffff',
      border: '#d8dee9',
      text: '#2e3440',
      accent: '#5e81ac',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'رز پاین سحرگاهی',
    nameEn: 'Rosé Pine Dawn',
    mode: 'light',
    description: 'کاغذ کرم پاستلی با حس ارگانیک صبحگاهی و اکسنت تمشکی مات',
    previewColors: {
      bg: '#faf4ed',
      card: '#ffffff',
      border: '#f2e9de',
      text: '#575279',
      accent: '#b4637a',
    },
  },
];

export const DARK_THEMES = THEMES.filter((t) => t.mode === 'dark');
export const LIGHT_THEMES = THEMES.filter((t) => t.mode === 'light');

const STORAGE_KEY = 'second_brain_theme';

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'default-light';
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (saved && THEMES.some((t) => t.id === saved)) {
    return saved;
  }
  return 'default-light';
}

export function applyTheme(themeId: ThemeId) {
  if (typeof document === 'undefined') return;
  const config = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;

  // Set data-theme attribute
  root.setAttribute('data-theme', themeId);

  // Toggle .dark class
  if (config.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update browser & mobile address bar / system chrome color
  try {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', config.previewColors.card);
  } catch {}

  // Update native status bar (icons and background) and keyboard theme
  updateStatusBarTheme(config.mode, config.previewColors.card).catch(() => {});
  updateKeyboardTheme(config.mode).catch(() => {});

  // Save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch (e) {
    console.error('Failed to save theme to localStorage', e);
  }
}

export function isDarkMode(themeId: ThemeId): boolean {
  const config = THEMES.find((t) => t.id === themeId);
  return config?.mode === 'dark';
}
