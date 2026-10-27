import React, { useState, useEffect, useRef } from 'react';
import { taskRepo, noteRepo, tagRepo, entryRepo, eventRepo, boxRepo, type ExportData } from '@/repositories';
import { toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';
import {
  RiShieldCheckLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDropLine,
  RiImageAddLine,
  RiComputerLine,
  RiLogoutBoxRLine,
  RiTimeLine,
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

import { WALLPAPER_LIST } from '@/lib/wallpapers';

export type { WallpaperItem } from '@/types/wallpaper';
export { WALLPAPER_LIST };


export type SettingsSection =
  | 'main'
  | 'theme'
  | 'wallpaper'
  | 'ambient'
  | 'backup'
  | 'about'
  | 'changelog'
  | 'feedback'
  | 'account';

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
  /** Opens the settings window directly on one of its sub-pages. */
  initialSection?: SettingsSection;
  /** 'page' fills the mobile tab; 'panel' is the desktop settings side panel. */
  variant?: 'page' | 'panel';
}

type SubPage = SettingsSection;

const SettingsGroup: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="px-1 text-[10.5px] font-semibold text-muted-foreground/80">{title}</h3>
    <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/55">
      {children}
    </div>
  </section>
);

interface SettingsRowProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  trailing,
}) => {
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold leading-snug text-foreground">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {trailing ??
        (onClick ? (
          <RiArrowLeftSLine className="size-4 shrink-0 text-muted-foreground/50" />
        ) : null)}
    </>
  );

  if (!onClick) {
    return <div className="flex w-full items-center gap-3 px-3 py-2.5 text-right">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-right outline-none transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer"
    >
      {content}
    </button>
  );
};

const SettingsSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative h-6 w-11 shrink-0 rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card cursor-pointer',
      checked ? 'bg-primary' : 'bg-muted-foreground/30'
    )}
  >
    <span
      className={cn(
        'block size-5 rounded-full bg-primary-foreground shadow-md transition-transform duration-200',
        checked ? '-translate-x-5' : 'translate-x-0'
      )}
    />
  </button>
);

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentWallpaper,
  onWallpaperChange,
  currentTheme = 'claude-dark',
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
  initialSection = 'main',
  variant = 'page',
}) => {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();

  // Active sub-page state. The settings window unmounts when closed, so the
  // initial section only needs to be read once.
  const [activeSubPage, setActiveSubPage] = useState<SubPage>(initialSection);

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

  const subPageShellClass =
    variant === 'panel'
      ? 'w-full select-none space-y-4 px-4 py-4 animate-in fade-in duration-200 sm:px-5'
      : 'w-full max-w-md mx-auto flex-1 select-none space-y-4 px-4 pb-28 pt-4 animate-in fade-in duration-200';

  const mainShellClass =
    variant === 'panel'
      ? 'w-full select-none space-y-5 px-4 py-4 animate-in fade-in duration-200 sm:px-5'
      : 'w-full max-w-md mx-auto flex-1 select-none space-y-5 px-4 pb-28 pt-4 animate-in fade-in duration-200';

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
    <div className="flex items-center gap-2 border-b border-border/60 pb-3">
      <button
        type="button"
        onClick={() => setActiveSubPage('main')}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 cursor-pointer"
        aria-label="بازگشت به تنظیمات"
        title="بازگشت به تنظیمات"
      >
        <RiArrowRightSLine className="size-5" />
      </button>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
    </div>
  );

  // ----------------------------------------------------------------------------------
  // 1. Sub-page: تم و رنگ (Theme & Palette)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'theme') {
    const listThemes = themeTab === 'dark' ? DARK_THEMES : LIGHT_THEMES;
    return (
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('تم و رنگ‌بندی')}

        {/* Dark/Light Mode Segmented Switch */}
        <SettingsGroup title="حالت نمایش">
          <div className="flex items-center gap-0.5 bg-secondary/30 p-2">
            {(['dark', 'light'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={themeTab === mode}
                onClick={() => {
                  setThemeTab(mode);
                  const targetThemes = mode === 'dark' ? DARK_THEMES : LIGHT_THEMES;
                  if (!targetThemes.some((t) => t.id === currentTheme)) {
                    onThemeChange?.(targetThemes[0].id);
                  }
                }}
                className={cn(
                  'h-8 flex-1 rounded-lg text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                  themeTab === mode
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode === 'dark' ? 'تیره' : 'روشن'}
              </button>
            ))}
          </div>
        </SettingsGroup>

        {/* Theme List */}
        <div className="grid grid-cols-1 gap-2">
          {listThemes.map((th) => {
            const isSelected = currentTheme === th.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => onThemeChange?.(th.id)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border p-3 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 bg-card/55 hover:bg-secondary/40'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="relative size-10 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: th.previewColors.bg }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 h-1/2"
                      style={{ backgroundColor: th.previewColors.card }}
                    />
                    <div
                      className="absolute bottom-1 right-1 size-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: th.previewColors.accent }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{th.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                      {th.description}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <RiCheckLine className="size-3.5 stroke-[3]" />
                  </span>
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('تصویر زمینه')}

        {/* Custom Upload Card */}
        <div className="p-3.5 rounded-2xl border border-dashed border-border/70 bg-card/55 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-foreground">انتخاب تصویر از کامپیوتر</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">بارگذاری عکس دلخواه از گالری محلی</p>
          </div>
          <button
            type="button"
            onClick={() => customImageInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
          >
            <RiImageAddLine className="w-4 h-4" />
            <span>انتخاب فایل</span>
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (customWallpaperUrl) {
                onWallpaperChange(`custom-image:${Date.now()}`);
              } else {
                customImageInputRef.current?.click();
              }
            }}
            className={`h-24 rounded-2xl overflow-hidden border text-right transition relative flex flex-col cursor-pointer shadow-2xs ${
              currentWallpaper.startsWith('custom') ||
              currentWallpaper.startsWith('data:') ||
              currentWallpaper.startsWith('http')
                ? 'border-primary ring-2 ring-primary/20 shadow-xs'
                : 'border-dashed border-border/80 hover:border-foreground/40'
            }`}
          >
            {customWallpaperUrl ? (
              <>
                <img
                  src={customWallpaperUrl}
                  alt={customWallpaperTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/0 flex items-end p-2.5">
                  <p className="text-[10.5px] font-medium text-white drop-shadow-xs truncate">
                    {customWallpaperTitle}
                  </p>
                </div>
                {(currentWallpaper.startsWith('custom') ||
                  currentWallpaper.startsWith('data:') ||
                  currentWallpaper.startsWith('http')) && (
                  <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow z-20">
                    <RiCheckLine className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-secondary/30">
                <RiImageAddLine className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10.5px] font-medium text-muted-foreground">از گالری</span>
              </div>
            )}
          </button>

          {WALLPAPER_LIST.map((wp) => {
            const isSelected = currentWallpaper === wp.id;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => onWallpaperChange(wp.id)}
                className={`h-24 rounded-2xl overflow-hidden border text-right transition relative flex flex-col cursor-pointer shadow-2xs ${
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
  // 4. Sub-page: صداهای تمرکز و پس‌زمینه (Ambient Sounds)
  // ----------------------------------------------------------------------------------
  if (activeSubPage === 'ambient') {
    return (
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('صداهای تمرکز و پس‌زمینه')}

        <div className="rounded-2xl border border-border/60 bg-card/55 p-3.5 space-y-3 shadow-2xs">
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('پشتیبان‌گیری و بازگردانی')}

        <div className="rounded-2xl border border-border/60 bg-card/55 p-4 space-y-4 shadow-2xs">
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
              className="flex-1 py-2.5 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
            >
              <RiDownload2Line className="w-4 h-4" />
              <span>دانلود نسخه پشتیبان (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => backupImportInputRef.current?.click()}
              className="flex-1 py-2.5 px-3.5 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-border active:scale-95"
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('درباره اسپیس')}

        <div className="p-4 rounded-2xl border border-border/60 bg-card/55 space-y-3.5 shadow-2xs">
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('تغییرات اخیر')}

        <div className="p-4 rounded-2xl border border-border/60 bg-card/55 space-y-3.5 shadow-2xs">
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('ارسال بازخورد')}

        <div className="p-4 rounded-2xl border border-border/60 bg-card/55 space-y-3.5 shadow-2xs">
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
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
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
      <div className={subPageShellClass} dir="rtl">
        {renderSubPageHeader('حساب کاربری')}

        <div className="p-4 rounded-2xl border border-border/60 bg-card/55 space-y-4 shadow-2xs">
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
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
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
  const currentThemeConfig = [...DARK_THEMES, ...LIGHT_THEMES].find(
    (theme) => theme.id === currentTheme
  );
  const currentWallpaperTitle =
    currentWallpaper.startsWith('custom') ||
    currentWallpaper.startsWith('data:') ||
    currentWallpaper.startsWith('http')
      ? customWallpaperTitle
      : WALLPAPER_LIST.find((item) => item.id === currentWallpaper)?.title ||
        'انتخاب تصویر';

  const renderDarkModeSwitch = () => (
    <SettingsSwitch
      checked={themeTab === 'dark'}
      label="حالت تیره"
      onChange={(checked) => {
        const nextMode: ThemeMode = checked ? 'dark' : 'light';
        setThemeTab(nextMode);
        const targetThemes = checked ? DARK_THEMES : LIGHT_THEMES;
        if (!targetThemes.some((theme) => theme.id === currentTheme)) {
          onThemeChange?.(targetThemes[0].id);
        }
      }}
    />
  );

  return (
    <div className={mainShellClass} dir="rtl">
      {variant === 'page' && (
        <div className="flex items-center justify-between pb-1">
          <h1 className="font-darvish text-xl font-bold leading-tight text-foreground">
            تنظیمات
          </h1>
          {onBackToToday && (
            <button
              type="button"
              onClick={onBackToToday}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer active:scale-95"
              aria-label="بازگشت به امروز"
              title="بازگشت به امروز"
            >
              <RiArrowLeftSLine className="size-5" />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (user) {
            setActiveSubPage('account');
          } else {
            onOpenAuthModal?.();
          }
        }}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/55 p-3 text-right outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-secondary/70 text-foreground">
          {user ? (
            <span className="font-mono text-xs font-bold uppercase">
              {user.email ? user.email.slice(0, 2) : 'SP'}
            </span>
          ) : (
            <RiUserLine className="size-5 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-foreground">
            {user ? user.email?.split('@')[0] || 'حساب کاربری' : 'ورود یا ثبت‌نام'}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
            {user
              ? 'همگام‌سازی ابری فعال است'
              : 'برای همگام‌سازی اطلاعات وارد شوید'}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold',
            user
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-foreground text-background'
          )}
        >
          {user ? 'فعال' : 'ورود'}
        </span>
      </button>

      <SettingsGroup title="ظاهر">
        <SettingsRow
          icon={RiPaletteLine}
          title="تم و رنگ"
          description="پالت رنگی برنامه"
          onClick={() => setActiveSubPage('theme')}
          trailing={
            <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: currentThemeConfig?.previewColors.accent }}
              />
              {currentThemeConfig?.name}
            </span>
          }
        />

        <SettingsRow
          icon={RiImageLine}
          title="تصویر زمینه"
          description={currentWallpaperTitle}
          onClick={() => setActiveSubPage('wallpaper')}
        />

        <SettingsRow
          icon={RiDropLine}
          title="پس‌زمینه شیشه‌ای"
          description="افکت شیشه مایع روی کادر برنامه و داک"
          trailing={
            <SettingsSwitch
              checked={glassBackground}
              onChange={(checked) => onGlassBackgroundChange?.(checked)}
              label="پس‌زمینه شیشه‌ای"
            />
          }
        />

        {glassBackground && (
          <div className="space-y-2 px-3 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground">درجه شفافیت</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {toPersianDigits(Math.round((glassOpacity ?? 0.18) * 100))}٪
              </span>
            </div>
            <input
              type="range"
              min="0.04"
              max="0.75"
              step="0.02"
              value={glassOpacity ?? 0.18}
              onChange={(e) => onGlassOpacityChange?.(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              dir="ltr"
              aria-label="درجه شفافیت شیشه"
            />
            <div className="flex justify-between text-[9.5px] text-muted-foreground/80">
              <span>شفاف‌تر</span>
              <span>مات‌تر</span>
            </div>
          </div>
        )}

        <SettingsRow
          icon={RiSparklingLine}
          title="حالت تیره"
          description="استفاده از پالت تیره در سراسر برنامه"
          trailing={renderDarkModeSwitch()}
        />

        {!isMobile && (
          <SettingsRow
            icon={RiComputerLine}
            title="موقعیت پنجره"
            description="محل قرارگیری کادر برنامه روی نمایشگر"
            trailing={
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
                {(
                  [
                    { value: 'right', label: 'راست' },
                    { value: 'center', label: 'وسط' },
                    { value: 'left', label: 'چپ' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onDesktopPositionChange?.(option.value)}
                    aria-pressed={desktopPosition === option.value}
                    className={cn(
                      'rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors cursor-pointer',
                      desktopPosition === option.value
                        ? 'bg-foreground text-background shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="کارها">
        <SettingsRow
          icon={RiTimeLine}
          title="بخش‌بندی روزانه"
          description="تفکیک کارها به صبح، ظهر، عصر و شب"
          trailing={
            <SettingsSwitch
              checked={enableDaySections}
              onChange={(checked) => onEnableDaySectionsChange?.(checked)}
              label="بخش‌بندی روزانه"
            />
          }
        />

        <SettingsRow
          icon={RiSparklingLine}
          title="هدف روزانه"
          description="تعداد کارها برای جشن موفقیت روزانه"
          trailing={
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => onDailyTaskGoalChange?.(Math.max(1, dailyTaskGoal - 1))}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                aria-label="کاهش هدف روزانه"
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {toPersianDigits(dailyTaskGoal)}
              </span>
              <button
                type="button"
                onClick={() => onDailyTaskGoalChange?.(dailyTaskGoal + 1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                aria-label="افزایش هدف روزانه"
              >
                +
              </button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
          <span className="text-[10px] text-muted-foreground">پیشنهادی:</span>
          {[3, 5, 7, 10].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onDailyTaskGoalChange?.(preset)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer',
                dailyTaskGoal === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {toPersianDigits(preset)} کار
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="داده و امکانات">
        <SettingsRow
          icon={RiSearchLine}
          title="جستجوی جامع"
          description="جستجو در کارها، یادداشت‌ها و پوشه‌ها"
          onClick={onOpenSearch}
        />
        <SettingsRow
          icon={RiDownload2Line}
          title="پشتیبان‌گیری و بازگردانی"
          description="خروجی JSON و بازگردانی اطلاعات"
          onClick={() => setActiveSubPage('backup')}
        />
        <SettingsRow
          icon={RiHeadphoneLine}
          title="صداهای تمرکز"
          description="صوت‌های محیطی برای تمرکز بیشتر"
          onClick={() => setActiveSubPage('ambient')}
        />
      </SettingsGroup>

      <SettingsGroup title="اسپیس">
        <SettingsRow
          icon={RiInformationLine}
          title="درباره اسپیس"
          onClick={() => setActiveSubPage('about')}
        />
        <SettingsRow
          icon={RiHashtag}
          title="تغییرات اخیر"
          onClick={() => setActiveSubPage('changelog')}
        />
        <SettingsRow
          icon={RiHeart3Line}
          title="ارسال بازخورد"
          onClick={() => setActiveSubPage('feedback')}
        />
      </SettingsGroup>

      <p className="pb-1 text-center text-[9.5px] text-muted-foreground/70">
        اسپیس · نسخه ۱.۰.۰
      </p>

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
