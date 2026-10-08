import React, { useState, useEffect, useRef } from 'react';
import { taskRepo, noteRepo, tagRepo, entryRepo, eventRepo, boxRepo, type ExportData } from '@/repositories';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiShieldCheckLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDropLine,
  RiImageAddLine,
  RiComputerLine,
  RiLogoutBoxRLine,
  RiTimeLine,
  RiEqualizerLine,
  RiPaletteLine,
  RiImageLine,
  RiInformationLine,
  RiHashtag,
  RiHeart3Line,
  RiUserLine,
  RiCheckLine,
  RiSparklingLine,
  RiSendPlane2Line,
  RiHeadphoneLine,
  RiDownload2Line,
  RiUpload2Line,
  RiSearchLine,
  RiVolumeUpLine,
} from '@remixicon/react';
import { useAuth } from '@/lib/auth';
import {
  type ThemeId,
  type ThemeMode,
  DARK_THEMES,
  LIGHT_THEMES,
  isDarkMode,
} from '@/lib/theme';
import { useIsMobile } from '@/lib/device';
import { AMBIENT_SOUNDS } from '@/components/focus/ambientSounds';

export interface WallpaperItem {
  id: string;
  title: string;
  url?: string;
  thumbUrl?: string;
  bgColor?: string;
  bgGradient?: string;
  isCustomImage?: boolean;
}

export const WALLPAPER_LIST: WallpaperItem[] = [
  // --- پس‌زمینه‌های ویژه و داینامیک ---
  {
    id: 'wafer-sky',
    title: 'ابر و آسمان اسکی (Ascii Magic)',
    url: '/wallpapers/wafer-sky.jpg',
  },
  {
    id: 'morning-live',
    title: 'صبح بخیر (آسمان زنده)',
    bgGradient:
      'radial-gradient(circle at 78% 20%, rgba(255,246,215,0.9) 0%, rgba(255,246,215,0) 45%), radial-gradient(ellipse at 25% 90%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 40%), linear-gradient(180deg, #3a8fe0 0%, #78baf0 50%, #fff0d6 100%)',
  },

  // --- پالت‌های روشن و لطیف (Light Tones & Gradients) ---
  {
    id: 'clean-snow',
    title: 'مینیمال برفی',
    bgColor: '#f8fafc',
  },
  {
    id: 'parchment-sand',
    title: 'کاغذ کرافت',
    bgColor: '#f6f1e8',
  },
  {
    id: 'soft-lavender',
    title: 'یاس پاستلی',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)',
  },
  {
    id: 'morning-sky',
    title: 'افق سپیده‌دم',
    bgGradient: 'linear-gradient(135deg, #e0f2fe 0%, #e8f5e9 50%, #f0f9ff 100%)',
  },
  {
    id: 'rose-dawn',
    title: 'رز صبحگاهی',
    bgGradient: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 50%, #fef2f2 100%)',
  },
  {
    id: 'warm-peach',
    title: 'هلویی ملایم',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fef3c7 100%)',
  },
  {
    id: 'misty-sage',
    title: 'مریم‌گلی مه‌آلود',
    bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f1f5f9 100%)',
  },
  {
    id: 'nordic-frost',
    title: 'یخبندان قطبی',
    bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
  },

  // --- پالت‌های تیره و عمیق (Dark Tones & Gradients) ---
  {
    id: 'dark-obsidian',
    title: 'آبسیدین خالص',
    bgColor: '#09090b',
  },
  {
    id: 'midnight-navy',
    title: 'سورمه‌ای نیمه‌شب',
    bgColor: '#0b132b',
  },
  {
    id: 'deep-emerald',
    title: 'زمرد شبانه',
    bgColor: '#061a14',
  },
  {
    id: 'espresso-noir',
    title: 'قهوه تیره',
    bgColor: '#16110e',
  },
  {
    id: 'cosmic-nebula',
    title: 'سحابی کیهانی',
    bgGradient: 'linear-gradient(135deg, #0f0c20 0%, #1e1338 50%, #0d1b2a 100%)',
  },
  {
    id: 'aurora-night',
    title: 'شفق شمالی عمیق',
    bgGradient: 'linear-gradient(135deg, #051412 0%, #0d2a24 50%, #081e1a 100%)',
  },
  {
    id: 'sunset-noir',
    title: 'شامگاه ارغوانی',
    bgGradient: 'linear-gradient(135deg, #180d1e 0%, #281424 50%, #110b14 100%)',
  },
  {
    id: 'slate-dusk',
    title: 'سربی گرافیت',
    bgGradient: 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #0f172a 100%)',
  },
];

export interface ProfileViewProps {
  currentWallpaper: string;
  onWallpaperChange: (wpId: string) => void;
  currentTheme?: ThemeId;
  onThemeChange?: (themeId: ThemeId) => void;
  onOpenSearch: () => void;
  glassBackground?: boolean;
  onGlassBackgroundChange?: (enabled: boolean) => void;
  glassOpacity?: number;
  onGlassOpacityChange?: (opacity: number) => void;
  desktopPosition?: 'right' | 'center' | 'left';
  onDesktopPositionChange?: (pos: 'right' | 'center' | 'left') => void;
  enableDaySections?: boolean;
  onEnableDaySectionsChange?: (enabled: boolean) => void;
  dailyTaskGoal?: number;
  onDailyTaskGoalChange?: (goal: number) => void;
  onOpenAuthModal?: () => void;
  onBackToToday?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

type SubPage =
  | 'main'
  | 'general'
  | 'theme'
  | 'wallpaper'
  | 'stream'
  | 'ambient'
  | 'backup'
  | 'about'
  | 'changelog'
  | 'feedback'
  | 'account';

// Custom hook for horizontal drag-to-scroll
function useHorizontalDrag() {
  const ref = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    isDown.current = true;
    startX.current = e.clientX;
    startScrollLeft.current = ref.current.scrollLeft;
    hasDragged.current = false;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDown.current || !ref.current) return;
    const deltaX = e.clientX - startX.current;
    if (Math.abs(deltaX) > 4) {
      hasDragged.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    ref.current.scrollLeft = startScrollLeft.current - deltaX;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDown.current) return;
    isDown.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp, hasDragged };
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentWallpaper,
  onWallpaperChange,
  currentTheme = 'default-dark',
  onThemeChange,
  onOpenSearch,
  glassBackground = false,
  onGlassBackgroundChange,
  glassOpacity = 0.18,
  onGlassOpacityChange,
  desktopPosition = 'center',
  onDesktopPositionChange,
  enableDaySections = false,
  onEnableDaySectionsChange,
  dailyTaskGoal = 5,
  onDailyTaskGoalChange,
  onOpenAuthModal,
  onBackToToday,
}) => {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();

  // Active sub-page state
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('main');

  // Theme switch mode: dark vs light
  const [themeTab, setThemeTab] = useState<ThemeMode>(
    isDarkMode(currentTheme) ? 'dark' : 'light'
  );

  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  // Custom wallpaper state
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(() => {
    return (
      localStorage.getItem('second_brain_custom_wallpaper') ||
      localStorage.getItem('second_brain_cached_unsplash_wallpaper')
    );
  });
  const [customWallpaperTitle, setCustomWallpaperTitle] = useState<string>(() => {
    return localStorage.getItem('second_brain_custom_wallpaper_title') || 'تصویر شخصی';
  });

  const customImageInputRef = useRef<HTMLInputElement>(null);
  const backupImportInputRef = useRef<HTMLInputElement>(null);
  const themeDrag = useHorizontalDrag();
  const wallpaperDrag = useHorizontalDrag();

  // Keep themeTab in sync with active theme
  useEffect(() => {
    setThemeTab(isDarkMode(currentTheme) ? 'dark' : 'light');
  }, [currentTheme]);

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const cleanTitle = file.name.replace(/\.[^/.]+$/, '').slice(0, 24);
          try {
            localStorage.setItem('second_brain_custom_wallpaper', optimizedDataUrl);
            localStorage.setItem('second_brain_custom_wallpaper_title', cleanTitle);
          } catch (err) {
            console.warn('LocalStorage quota exceeded:', err);
          }
          setCustomWallpaperUrl(optimizedDataUrl);
          setCustomWallpaperTitle(cleanTitle);
          onWallpaperChange(`custom-image:${Date.now()}`);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Export JSON backup
  const handleExportBackup = async () => {
    try {
      const [tasks, notes, tags, entries, events, boxes] = await Promise.all([
        taskRepo.list(),
        noteRepo.list(),
        tagRepo.listAll(),
        entryRepo.listAll(),
        eventRepo.list(),
        boxRepo.list(),
      ]);
      const data: ExportData = {
        tasks,
        notes,
        tags,
        entries,
        events,
        boxes,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `space-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export backup failed:', err);
      alert('خطا در تهیه نسخه پشتیبان.');
    }
  };

  // Import JSON backup
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: ExportData = JSON.parse(text);

      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        for (const t of parsed.tasks) {
          const exists = await taskRepo.getById(t.id);
          if (!exists) {
            await taskRepo.create(t);
          }
        }
      }
      if (parsed.notes && Array.isArray(parsed.notes)) {
        for (const n of parsed.notes) {
          const exists = await noteRepo.getById(n.id);
          if (!exists) {
            await noteRepo.create(n);
          }
        }
      }
      alert('اطلاعات با موفقیت بازگردانی شد!');
    } catch (err) {
      alert('خطا در بارگذاری فایل پشتیبان.');
      console.error(err);
    }
    e.target.value = '';
  };

  // Helper for subpage top back button
  const renderSubPageHeader = (title: string) => (
    <div className="flex items-center justify-between pb-3 border-b border-border/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSubPage('main')}
          className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95"
          title="بازگشت به تنظیمات"
        >
          <RiArrowRightSLine className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <button
        type="button"
        onClick={() => setActiveSubPage('main')}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        بازگشت
      </button>
    </div>
  );

  // ----------------------------------------------------------------------------------
  // 1. Sub-page: عمومی (General Settings)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'general') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('تنظیمات عمومی')}

        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm divide-y divide-border/60 overflow-hidden shadow-2xs">
          {/* Glass Dock & Container */}
          <div className="p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                  <RiDropLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">پس‌زمینه شیشه‌ای داک و کانتینر</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">افکت انکسار نور، شکست رنگ و شیشه مایع</p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={glassBackground}
                onClick={() => onGlassBackgroundChange?.(!glassBackground)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
                  glassBackground ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    glassBackground ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Glass Opacity Slider - displayed when glassBackground is ON */}
            {glassBackground && (
              <div className="pt-2.5 pb-1 border-t border-border/40 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-foreground/90">درجه شفافیت شیشه</span>
                  <span className="font-mono text-primary font-bold tabular-nums text-xs">
                    {toPersianDigits(Math.round((glassOpacity ?? 0.18) * 100))}٪
                  </span>
                </div>
                <div className="relative flex items-center w-full">
                  <input
                    type="range"
                    min="0.04"
                    max="0.75"
                    step="0.02"
                    value={glassOpacity ?? 0.18}
                    onChange={(e) => onGlassOpacityChange?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <div className="flex justify-between text-[9.5px] text-muted-foreground select-none">
                  <span>شفاف و براق (کم)</span>
                  <span>مات و یخی (زیاد)</span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Position */}
          {!isMobile && (
            <div className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                  <RiComputerLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">موقعیت پنجره دسکتاپ</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">محل قرارگیری کادر برنامه روی مانیتور</p>
                </div>
              </div>

              <div className="flex items-center bg-muted/60 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-border/70 text-[11px] font-medium gap-0.5 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => onDesktopPositionChange?.('right')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    desktopPosition === 'right'
                      ? 'bg-card text-foreground font-semibold shadow-xs ring-1 ring-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  راست
                </button>
                <button
                  type="button"
                  onClick={() => onDesktopPositionChange?.('center')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    desktopPosition === 'center'
                      ? 'bg-card text-foreground font-semibold shadow-xs ring-1 ring-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  وسط
                </button>
                <button
                  type="button"
                  onClick={() => onDesktopPositionChange?.('left')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    desktopPosition === 'left'
                      ? 'bg-card text-foreground font-semibold shadow-xs ring-1 ring-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  چپ
                </button>
              </div>
            </div>
          )}

          {/* Daily Task Goal (هدف روزانه تسک‌ها / کارما) */}
          <div className="p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                  <RiSparklingLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">هدف روزانه تسک‌ها (کارما)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    تعداد تسکی که می‌خواهید هر روز تکمیل کنید تا جشن موفقیت پخش شود
                  </p>
                </div>
              </div>

              {/* Number adjuster with + and - */}
              <div className="flex items-center bg-muted/60 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-border/70 text-[12px] font-medium gap-1 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(Math.max(1, dailyTaskGoal - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 font-bold text-sm"
                  title="کاهش"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-foreground font-mono tabular-nums text-xs">
                  {toPersianDigits(dailyTaskGoal)}
                </span>
                <button
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(dailyTaskGoal + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 font-bold text-sm"
                  title="افزایش"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick preset buttons: 3, 5, 7, 10 */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground ml-1">پیشنهادی:</span>
              {[3, 5, 7, 10].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer ${
                    dailyTaskGoal === preset
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'
                  }`}
                >
                  {toPersianDigits(preset)} تسک
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 2. Sub-page: تم و رنگ (Theme & Palette)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'theme') {
    const listThemes = themeTab === 'dark' ? DARK_THEMES : LIGHT_THEMES;
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('تم و رنگ‌بندی')}

        {/* Dark/Light Mode Switcher */}
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-foreground">حالت تیره (Dark Mode)</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">تغییر بین پالت‌های تیره و روشن</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={themeTab === 'dark'}
            onClick={() => {
              const nextMode = themeTab === 'dark' ? 'light' : 'dark';
              setThemeTab(nextMode);
              const targetThemes = nextMode === 'dark' ? DARK_THEMES : LIGHT_THEMES;
              if (!targetThemes.some((t) => t.id === currentTheme)) {
                onThemeChange?.(targetThemes[0].id);
              }
            }}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
              themeTab === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                themeTab === 'dark' ? '-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Theme List */}
        <div className="grid grid-cols-1 gap-2.5">
          {listThemes.map((th) => {
            const isSelected = currentTheme === th.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => onThemeChange?.(th.id)}
                className={`p-3 rounded-2xl border transition-all text-right flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                    : 'border-border/70 bg-card/70 hover:bg-card hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full border border-black/10 overflow-hidden shrink-0 shadow-2xs relative"
                    style={{ backgroundColor: th.previewColors.bg }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 h-1/2"
                      style={{ backgroundColor: th.previewColors.card }}
                    />
                    <div
                      className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: th.previewColors.accent }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{th.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{th.description}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                    <RiCheckLine className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 3. Sub-page: تصویر زمینه (Wallpapers Full View)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'wallpaper') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('تصویر زمینه')}

        {/* Custom Upload Card */}
        <div className="p-3.5 rounded-2xl border border-dashed border-border/90 bg-card/70 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-foreground">انتخاب تصویر از کامپیوتر</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">بارگذاری عکس دلخواه از گالری محلی</p>
          </div>
          <button
            type="button"
            onClick={() => customImageInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <RiImageAddLine className="w-4 h-4" />
            <span>انتخاب فایل</span>
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {WALLPAPER_LIST.map((wp) => {
            const isSelected = currentWallpaper === wp.id;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => onWallpaperChange(wp.id)}
                className={`h-24 rounded-2xl overflow-hidden border text-right transition-all relative flex flex-col cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 shadow-xs'
                    : 'border-border/80 hover:border-foreground/40'
                }`}
              >
                <div
                  className="w-full h-full flex items-end p-2.5 select-none"
                  style={{
                    background: wp.bgGradient || undefined,
                    backgroundColor: wp.bgColor || undefined,
                  }}
                >
                  <p className="text-[10.5px] font-medium text-foreground/90 dark:text-white/95 drop-shadow-xs truncate z-10">
                    {wp.title}
                  </p>
                </div>

                {isSelected && (
                  <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow z-20">
                    <RiCheckLine className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 4. Sub-page: جریان روزانه و زمان‌بندی (Stream & Sections)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'stream') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('جریان روزانه و زمان‌بندی')}

        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm divide-y divide-border/60 overflow-hidden shadow-2xs">
          {/* Day Sections Switch */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                <RiTimeLine className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">بخش‌بندی روزانه (صبح، ظهر، عصر، شب)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  تفکیک و دسته‌بندی خودکار کارها و یادداشت‌های امروز بر اساس ساعات روز
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enableDaySections}
              onClick={() => onEnableDaySectionsChange?.(!enableDaySections)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
                enableDaySections ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  enableDaySections ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Daily Task Goal (هدف روزانه تسک‌ها / کارما) */}
          <div className="p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                  <RiSparklingLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">هدف روزانه تسک‌ها (کارما)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    تعداد تسکی که می‌خواهید هر روز تکمیل کنید تا جشن موفقیت پخش شود
                  </p>
                </div>
              </div>

              {/* Number adjuster with + and - */}
              <div className="flex items-center bg-muted/60 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-border/70 text-[12px] font-medium gap-1 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(Math.max(1, dailyTaskGoal - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 font-bold text-sm"
                  title="کاهش"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-foreground font-mono tabular-nums text-xs">
                  {toPersianDigits(dailyTaskGoal)}
                </span>
                <button
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(dailyTaskGoal + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 font-bold text-sm"
                  title="افزایش"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick preset buttons: 3, 5, 7, 10 */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground ml-1">پیشنهادی:</span>
              {[3, 5, 7, 10].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onDailyTaskGoalChange?.(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer ${
                    dailyTaskGoal === preset
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'
                  }`}
                >
                  {toPersianDigits(preset)} تسک
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 5. Sub-page: صداهای تمرکز و پس‌زمینه (Ambient Sounds)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'ambient') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('صداهای تمرکز و پس‌زمینه')}

        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm p-3.5 space-y-3 shadow-2xs">
          <p className="text-xs text-muted-foreground leading-relaxed">
            صوت‌های پیوسته و طبیعی برای افزایش تمرکز، کاهش استرس و غوطه‌وری در کارها. در حالت فوکوس می‌توانید صدای دلخواه خود را فعال کنید:
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {AMBIENT_SOUNDS.filter((s) => s.id !== 'none').map((snd) => (
              <div
                key={snd.id}
                className="p-3 rounded-xl border border-border/70 bg-secondary/40 flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <RiVolumeUpLine className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{snd.label}</p>
                  <p className="text-[10px] text-muted-foreground">{snd.sublabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 6. Sub-page: پشتیبان‌گیری و بازگردانی داده‌ها (Backup & Restore)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'backup') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('پشتیبان‌گیری و بازگردانی')}

        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm p-4 space-y-4 shadow-2xs">
          <div>
            <p className="text-xs font-bold text-foreground">پشتیبان‌گیری محلی و آفلاین</p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              تمامی اطلاعات شما به صورت فایل JSON استخراج می‌شود تا همیشه نسخه‌ای امن روی رایانه شخصی‌تان داشته باشید.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex-1 py-2.5 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <RiDownload2Line className="w-4 h-4" />
              <span>دانلود نسخه پشتیبان (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => backupImportInputRef.current?.click()}
              className="flex-1 py-2.5 px-3.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-border active:scale-95"
            >
              <RiUpload2Line className="w-4 h-4" />
              <span>بازگردانی از فایل</span>
            </button>
          </div>

          <input
            ref={backupImportInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 7. Sub-page: درباره اسپیس (About Space)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'about') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('درباره اسپیس')}

        <div className="p-4 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <RiShieldCheckLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">اسپیس (Space) • نسخه ۱.۰.۰</p>
              <p className="text-[10.5px] text-muted-foreground">دستیار شخصی مدیریت کارها و یادداشت‌های روزانه</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            اسپیس با معماری ۱۰۰٪ محلی (Local-first) طراحی شده است؛ تمامی یادداشت‌ها، کارها و داده‌ها ابتدا روی حافظه امن دستگاه شما ذخیره می‌شوند و حتی بدون اتصال به اینترنت، با بالاترین سرعت و حریم خصوصی کامل در دسترس هستند.
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 8. Sub-page: تغییرات اخیر (Changelog)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'changelog') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('تغییرات اخیر')}

        <div className="p-4 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm space-y-3.5 shadow-2xs">
          <div className="border-b border-border/60 pb-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">نسخه ۱.۰.۰</span>
              <span className="text-[10px] text-muted-foreground font-mono">پاییز ۱۴۰۵</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-2 mt-2.5 list-disc list-inside leading-relaxed">
              <li>بازطراحی کامل و مینیمال تنظیمات بر اساس الگوی مدرن اندروید</li>
              <li>همگام‌سازی ابری کاملا خودکار در پس‌زمینه بدون نیاز به دکمه دستی</li>
              <li>افزودن امکان بخش‌بندی روز بر اساس زمان (صبح، ظهر، عصر، شب)</li>
              <li>بهبود و بهینه‌سازی سرعت ذخیره‌سازی داده‌های محلی</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 9. Sub-page: ارسال بازخورد (Feedback)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'feedback') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('ارسال بازخورد')}

        <div className="p-4 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm space-y-3.5 shadow-2xs">
          <p className="text-xs text-muted-foreground leading-relaxed">
            نظرات و پیشنهادات شما به ما در ارتقای اسپیس کمک شایانی می‌کند. لطفاً پیام یا بازخورد خود را در زیر بنویسید:
          </p>

          {feedbackSent ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium text-center space-y-1">
              <RiSparklingLine className="w-6 h-6 mx-auto mb-1 animate-bounce" />
              <p className="font-bold">پیام شما با موفقیت ثبت شد!</p>
              <p className="text-[11px] opacity-80">از اینکه برای بهتر شدن اسپیس وقت گذاشتید سپاسگزاریم.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="نظر یا پیشنهاد شما درباره اسپیس..."
                rows={4}
                className="w-full p-3 rounded-xl bg-secondary/60 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <button
                type="button"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  setFeedbackSent(true);
                  setFeedbackText('');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
              >
                <RiSendPlane2Line className="w-4 h-4" />
                <span>ارسال پیام</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // 10. Sub-page: حساب کاربری (Account)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'account') {
    return (
      <div className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-4 animate-in fade-in duration-200" dir="rtl">
        {renderSubPageHeader('حساب کاربری')}

        <div className="p-4 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm space-y-4 shadow-2xs">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/25 shrink-0 font-bold text-sm uppercase font-mono">
                  {user.email ? user.email.slice(0, 2) : 'SP'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground font-mono truncate" dir="ltr">
                    {user.email}
                  </p>
                  <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    همگام‌سازی ابری فعال است
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setActiveSubPage('main');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-destructive/20 active:scale-95"
                >
                  <RiLogoutBoxRLine className="w-4 h-4" />
                  <span>خروج از حساب کاربری</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-muted-foreground">شما در حال حاضر وارد حساب خود نشده‌اید.</p>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                ورود یا ثبت‌نام
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------------
  // Main Settings Screen
  // ----------------------------------------------------------------------------------
  const activeThemes = themeTab === 'dark' ? DARK_THEMES : LIGHT_THEMES;

  return (
    <div
      className="w-full flex-1 flex flex-col px-4 pt-3 pb-28 max-w-md mx-auto space-y-5 select-none animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* 1. Top Header: User Info & Avatar (Right), Back Arrow (Left) */}
      <div className="flex items-center justify-between pb-1 select-none">
        {/* User Info & Avatar on the FAR RIGHT */}
        <div
          onClick={() => {
            if (user) {
              setActiveSubPage('account');
            } else {
              onOpenAuthModal?.();
            }
          }}
          className="flex items-center gap-3 cursor-pointer group/user"
        >
          {/* Avatar is child 0 -> FAR RIGHT */}
          <div className="w-12 h-12 rounded-full bg-secondary/80 border border-border/80 flex items-center justify-center text-muted-foreground group-hover/user:border-primary/50 transition-colors shadow-2xs shrink-0">
            {user ? (
              <span className="font-bold text-xs uppercase font-mono text-foreground">
                {user.email ? user.email.slice(0, 2) : 'SP'}
              </span>
            ) : (
              <RiUserLine className="w-6 h-6 text-foreground/80 group-hover/user:text-foreground transition-colors" />
            )}
          </div>

          {/* User Status / Text is child 1 -> to the left of Avatar */}
          <div className="text-right">
            <h2 className="text-sm font-bold text-foreground leading-tight group-hover/user:text-primary transition-colors">
              {user ? (user.email?.split('@')[0] || 'حساب کاربری') : 'ثبت‌نام/ ورود'}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
              {user ? 'همگام‌سازی خودکار فعال است' : 'برای هم‌گام‌سازی بوک‌مارک‌ها و.... ثبت‌نام کنید.'}
            </p>
          </div>
        </div>

        {/* Back navigation arrow on FAR LEFT */}
        {onBackToToday ? (
          <button
            type="button"
            onClick={onBackToToday}
            className="w-8 h-8 rounded-full hover:bg-secondary/80 text-foreground/80 hover:text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="بازگشت به امروز"
          >
            <RiArrowLeftSLine className="w-6 h-6 stroke-[2]" />
          </button>
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>

      {/* 2. Color Palette Section with Dark Switch (Bleeds past left padding to cut frame) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          {/* Right: رنگ‌بندی */}
          <span className="text-sm font-bold text-foreground">رنگ‌بندی</span>

          {/* Left: Switch + تیره */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground font-medium">تیره</span>
            <button
              type="button"
              role="switch"
              aria-checked={themeTab === 'dark'}
              onClick={() => {
                const nextMode = themeTab === 'dark' ? 'light' : 'dark';
                setThemeTab(nextMode);
                const targetThemes = nextMode === 'dark' ? DARK_THEMES : LIGHT_THEMES;
                if (!targetThemes.some((t) => t.id === currentTheme)) {
                  onThemeChange?.(targetThemes[0].id);
                }
              }}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
                themeTab === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              title="تغییر حالت تیره یا روشن"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  themeTab === 'dark' ? '-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Android Material-style Segmented Color Circles (Left edge cuts the frame) */}
        <div
          ref={themeDrag.ref}
          onPointerDown={themeDrag.onPointerDown}
          onPointerMove={themeDrag.onPointerMove}
          onPointerUp={themeDrag.onPointerUp}
          className="w-[calc(100%+1rem)] -ml-4 flex items-center gap-3 overflow-x-auto no-scrollbar py-3 pr-1 pl-0 -my-2 scroll-smooth cursor-grab active:cursor-grabbing select-none"
        >
          {activeThemes.map((th) => {
            const isSelected = currentTheme === th.id;

            return (
              <button
                key={th.id}
                type="button"
                onClick={() => {
                  if (themeDrag.hasDragged.current) return;
                  onThemeChange?.(th.id);
                }}
                className={`p-0.5 rounded-full transition-all cursor-pointer relative shrink-0 active:scale-95 ${
                  isSelected
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background shadow-xs'
                    : 'border border-border/80 dark:border-white/20 hover:border-foreground/50'
                }`}
                title={th.name}
              >
                {/* Android 4-quadrant segmented color circle */}
                <svg
                  viewBox="0 0 44 44"
                  className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow-2xs pointer-events-none block"
                >
                  {/* Top-left quadrant */}
                  <path d="M 22 22 L 0 22 A 22 22 0 0 1 22 0 Z" fill={th.previewColors.bg} />
                  {/* Top-right quadrant */}
                  <path d="M 22 22 L 22 0 A 22 22 0 0 1 44 22 Z" fill={th.previewColors.card} />
                  {/* Bottom-left quadrant: Accent */}
                  <path d="M 22 22 L 0 22 A 22 22 0 0 0 22 44 Z" fill={th.previewColors.accent} />
                  {/* Bottom-right quadrant: Light/border */}
                  <path d="M 22 22 L 22 44 A 22 22 0 0 0 44 22 Z" fill={th.previewColors.border} />

                  {/* Clean inner dividing lines */}
                  <line x1="0" y1="22" x2="44" y2="22" stroke="rgba(0,0,0,0.15)" strokeWidth="0.75" />
                  <line x1="22" y1="0" x2="22" y2="44" stroke="rgba(0,0,0,0.15)" strokeWidth="0.75" />

                  {/* Outer subtle circle border */}
                  <circle cx="22" cy="22" r="21.5" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Wallpaper Rail (Desktop Only - Left edge cuts the frame) */}
      {!isMobile && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-sm font-bold text-foreground">تصویرزمینه</span>
            <button
              type="button"
              onClick={() => setActiveSubPage('wallpaper')}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
            >
              دیدن همه ({toPersianDigits(WALLPAPER_LIST.length + 1)})
            </button>
          </div>

          <div
            ref={wallpaperDrag.ref}
            onPointerDown={wallpaperDrag.onPointerDown}
            onPointerMove={wallpaperDrag.onPointerMove}
            onPointerUp={wallpaperDrag.onPointerUp}
            className="w-[calc(100%+1rem)] -ml-4 flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1.5 pr-1 pl-0 scroll-smooth cursor-grab active:cursor-grabbing select-none"
          >
            {/* First Card: Selection from Gallery (از گالری) */}
            <button
              type="button"
              onClick={() => {
                if (wallpaperDrag.hasDragged.current) return;
                if (customWallpaperUrl) {
                  onWallpaperChange(`custom-image:${Date.now()}`);
                } else {
                  customImageInputRef.current?.click();
                }
              }}
              className={`w-[110px] h-[68px] shrink-0 rounded-2xl overflow-hidden border text-center transition-all flex flex-col items-center justify-center cursor-pointer shadow-2xs relative ${
                currentWallpaper.startsWith('custom-image')
                  ? 'border-primary ring-2 ring-primary/20 shadow-xs'
                  : 'border-dashed border-border/90 bg-secondary/40 hover:bg-secondary/70 hover:border-foreground/40'
              }`}
              title={customWallpaperUrl ? 'انتخاب تصویر شخصی (برای تغییر دوباره کلیک کنید)' : 'انتخاب تصویر از کامپیوتر'}
            >
              {customWallpaperUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={customWallpaperUrl}
                    alt={customWallpaperTitle}
                    className="w-full h-full object-cover"
                  />
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      customImageInputRef.current?.click();
                    }}
                    className="absolute inset-0 bg-black/35 hover:bg-black/50 transition-colors flex items-center justify-center text-white"
                    title="تغییر عکس از سیستم"
                  >
                    <RiImageAddLine className="w-4 h-4 drop-shadow" />
                  </div>
                  {currentWallpaper.startsWith('custom-image') && (
                    <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center shadow z-20">
                      <RiCheckLine className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 p-2">
                  <RiImageAddLine className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground leading-tight">از گالری</span>
                </div>
              )}
            </button>

            {/* Curated Wallpaper Colors & Gradients */}
            {WALLPAPER_LIST.map((wp) => {
              const isSelected = currentWallpaper === wp.id;

              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => {
                    if (wallpaperDrag.hasDragged.current) return;
                    onWallpaperChange(wp.id);
                  }}
                  className={`w-[110px] h-[68px] shrink-0 rounded-2xl overflow-hidden border text-right transition-all relative flex flex-col cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-xs'
                      : 'border-border/80 hover:border-foreground/40'
                  }`}
                  title={wp.title}
                >
                  <div
                    className="w-full h-full relative overflow-hidden flex items-end p-2 select-none"
                    style={{
                      background: wp.bgGradient || undefined,
                      backgroundColor: wp.bgColor || undefined,
                    }}
                  >
                    <span className="text-[9.5px] font-medium text-foreground/85 dark:text-white/95 drop-shadow-xs truncate z-10">
                      {wp.title}
                    </span>

                    {isSelected && (
                      <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center shadow z-20">
                        <RiCheckLine className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Categorized List Menu Items (Clean & Relevant to Space) */}
      <div className="space-y-4 pt-1">
        {/* Category: عمومی */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground/80 px-1 text-right">عمومی</p>
          <div className="space-y-1">
            {/* عمومی */}
            <button
              type="button"
              onClick={() => setActiveSubPage('general')}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 hover:opacity-90 active:scale-[0.99] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <RiEqualizerLine className="w-4 h-4 text-white shrink-0" />
              <span>عمومی</span>
            </button>

            {/* تم و رنگ */}
            <button
              type="button"
              onClick={() => setActiveSubPage('theme')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiPaletteLine className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>تم و رنگ</span>
            </button>

            {/* تصویر زمینه (Desktop Only) */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setActiveSubPage('wallpaper')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
              >
                <RiImageLine className="w-4 h-4 text-foreground/80 shrink-0" />
                <span>تصویر زمینه</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-border/50" />

        {/* Category: ابزارک‌ها و امکانات (Real Space features) */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground/80 px-1 text-right">ابزارک‌ها و امکانات</p>
          <div className="space-y-1">
            {/* جریان روزانه و زمان‌بندی */}
            <button
              type="button"
              onClick={() => setActiveSubPage('stream')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiTimeLine className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>جریان روزانه و زمان‌بندی</span>
            </button>

            {/* صداهای تمرکز و پس‌زمینه */}
            <button
              type="button"
              onClick={() => setActiveSubPage('ambient')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiHeadphoneLine className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>صداهای تمرکز و پس‌زمینه</span>
            </button>

            {/* پشتیبان‌گیری و بازگردانی */}
            <button
              type="button"
              onClick={() => setActiveSubPage('backup')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiDownload2Line className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>پشتیبان‌گیری و داده‌ها</span>
            </button>

            {/* جستجوی جامع */}
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiSearchLine className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>جستجوی جامع</span>
            </button>
          </div>
        </div>

        <div className="border-t border-border/50" />

        {/* Category: اسپیس */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground/80 px-1 text-right">اسپیس</p>
          <div className="space-y-1">
            {/* درباره اسپیس */}
            <button
              type="button"
              onClick={() => setActiveSubPage('about')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiInformationLine className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>درباره اسپیس</span>
            </button>

            {/* تغییرات اخیر */}
            <button
              type="button"
              onClick={() => setActiveSubPage('changelog')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiHashtag className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>تغییرات اخیر</span>
            </button>

            {/* ارسال بازخورد */}
            <button
              type="button"
              onClick={() => setActiveSubPage('feedback')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-secondary/60 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RiHeart3Line className="w-4 h-4 text-foreground/80 shrink-0" />
              <span>ارسال بازخورد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input for Custom Background */}
      <input
        ref={customImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomImageUpload}
        className="hidden"
      />
    </div>
  );
};
