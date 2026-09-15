import React, { useState, useEffect, useRef } from 'react';
import { taskRepo, noteRepo, eventRepo, entryRepo, tagRepo, type ExportData } from '@/repositories';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiPaletteLine,
  RiDownload2Line,
  RiUpload2Line,
  RiSearchLine,
  RiShieldCheckLine,
  RiCheckLine,
  RiCloseLine,
  RiMoonLine,
  RiSunLine,
  RiContrastLine,
  RiArrowLeftSLine,
  RiCheckDoubleLine,
  RiDropLine,
  RiImageAddLine,
} from '@remixicon/react';

import {
  type ThemeId,
  type ThemeMode,
  DARK_THEMES,
  LIGHT_THEMES,
  isDarkMode,
} from '@/lib/theme';

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
  {
    id: 'birmingham-museums-trust-5EUh-tq31eA-unsplash.jpg',
    title: 'نقاشی کلاسیک ۱',
    url: '/backgrounds/birmingham-museums-trust-5EUh-tq31eA-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust-5EUh-tq31eA-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-HEEvYhNzpEo-unsplash.jpg',
    title: 'نقاشی کلاسیک ۲',
    url: '/backgrounds/birmingham-museums-trust-HEEvYhNzpEo-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust-HEEvYhNzpEo-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-HslbEeUauYA-unsplash.jpg',
    title: 'نقاشی کلاسیک ۳',
    url: '/backgrounds/birmingham-museums-trust-HslbEeUauYA-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust-HslbEeUauYA-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust--9yyKm-aXP8-unsplash.jpg',
    title: 'نقاشی کلاسیک ۴',
    url: '/backgrounds/birmingham-museums-trust--9yyKm-aXP8-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust--9yyKm-aXP8-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-nbneQlI2M1A-unsplash.jpg',
    title: 'نقاشی کلاسیک ۵',
    url: '/backgrounds/birmingham-museums-trust-nbneQlI2M1A-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust-nbneQlI2M1A-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-_fXZDGdrYZk-unsplash.jpg',
    title: 'نقاشی کلاسیک ۶',
    url: '/backgrounds/birmingham-museums-trust-_fXZDGdrYZk-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/birmingham-museums-trust-_fXZDGdrYZk-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'abolfazl-ranjbar-KuDGjdwft9o-unsplash.jpg',
    title: 'هنر و عکاسی ۱',
    url: '/backgrounds/abolfazl-ranjbar-KuDGjdwft9o-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/abolfazl-ranjbar-KuDGjdwft9o-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'fatemeh-behvandi-eJRuC6UY7wU-unsplash.jpg',
    title: 'هنر و عکاسی ۲',
    url: '/backgrounds/fatemeh-behvandi-eJRuC6UY7wU-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/fatemeh-behvandi-eJRuC6UY7wU-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'niloofar-kanani-VPb7abByEK4-unsplash.jpg',
    title: 'هنر و عکاسی ۳',
    url: '/backgrounds/niloofar-kanani-VPb7abByEK4-unsplash.jpg',
    thumbUrl: '/backgrounds/thumbs/niloofar-kanani-VPb7abByEK4-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'parchment',
    title: 'کاغذ کرافت',
    bgColor: '#f5ebe0',
  },
  {
    id: 'clean-light',
    title: 'مینیمال استودیو',
    bgColor: '#f1f5f9',
  },
  {
    id: 'dark-obsidian',
    title: 'آبسیدین شب',
    bgColor: '#0f172a',
  },
  {
    id: 'sunset',
    title: 'پاستلی غروب',
    bgGradient: 'linear-gradient(135deg, #ffe4e6 0%, #ede9fe 50%, #e0e7ff 100%)',
  },
  {
    id: 'aurora-borealis',
    title: 'شفق قطبی عمیق',
    bgGradient: 'linear-gradient(135deg, #070d18 0%, #0d2827 50%, #1a102f 100%)',
  },
  {
    id: 'cosmic-nebula',
    title: 'سحابی کیهانی',
    bgGradient: 'linear-gradient(135deg, #13091e 0%, #1f1138 45%, #0b1c31 100%)',
  },
  {
    id: 'emerald-night',
    title: 'زمرد شبانه',
    bgGradient: 'linear-gradient(135deg, #051410 0%, #0c2b23 60%, #081a17 100%)',
  },
  {
    id: 'desert-sand',
    title: 'شن‌های کویر',
    bgGradient: 'linear-gradient(135deg, #fdf8f0 0%, #f4ebd9 50%, #eae0c8 100%)',
  },
  {
    id: 'sakura-spring',
    title: 'شکوفه بهاری',
    bgGradient: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 50%, #f3e8ff 100%)',
  },
  {
    id: 'nordic-frost',
    title: 'یخبندان قطبی',
    bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
  },
];

interface ProfileViewProps {
  currentWallpaper: string;
  onWallpaperChange: (wpId: string) => void;
  currentTheme?: ThemeId;
  onThemeChange?: (themeId: ThemeId) => void;
  onOpenSearch: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  glassBackground?: boolean;
  onGlassBackgroundChange?: (enabled: boolean) => void;
}

// Custom hook for mouse/pointer drag-to-scroll on horizontal rails
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
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setTimeout(() => {
      hasDragged.current = false;
    }, 60);
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp, hasDragged };
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentWallpaper,
  onWallpaperChange,
  currentTheme = 'default-light',
  onThemeChange,
  onOpenSearch,
  isOpen = true,
  onClose,
  glassBackground = false,
  onGlassBackgroundChange,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [themeTab, setThemeTab] = useState<ThemeMode>(() =>
    isDarkMode(currentTheme) ? 'dark' : 'light'
  );
  const [stats, setStats] = useState({
    doneTasks: 0,
    openTasks: 0,
    totalNotes: 0,
    totalEvents: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customImageInputRef = useRef<HTMLInputElement>(null);

  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(() => {
    return (
      localStorage.getItem('second_brain_custom_wallpaper') ||
      localStorage.getItem('second_brain_cached_unsplash_wallpaper') ||
      null
    );
  });
  const [customWallpaperTitle, setCustomWallpaperTitle] = useState<string>(() => {
    return (
      localStorage.getItem('second_brain_custom_wallpaper_title') ||
      'تصویر دلخواه'
    );
  });

  // Drag hooks for horizontal theme & wallpaper rails
  const themeDrag = useHorizontalDrag();
  const wallpaperDrag = useHorizontalDrag();

  // Smooth slide-up on open
  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => {
        setMounted(true);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose?.();
    }, 220);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.code === 'Escape') && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const loadStats = async () => {
    const allTasks = await taskRepo.list();
    const allNotes = await noteRepo.list();
    const allEvents = await eventRepo.list();

    setStats({
      doneTasks: allTasks.filter((t) => t.status === 'done').length,
      openTasks: allTasks.filter((t) => t.status === 'open').length,
      totalNotes: allNotes.length,
      totalEvents: allEvents.length,
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) {
    return null;
  }

  // Export JSON backup
  const handleExportBackup = async () => {
    const allEntries = await entryRepo.listAll();
    const allTasks = await taskRepo.list();
    const allNotes = await noteRepo.list();
    const allEvents = await eventRepo.list();
    const allTags = await tagRepo.listAll();

    const data: ExportData = {
      entries: allEntries,
      tasks: allTasks,
      notes: allNotes,
      events: allEvents,
      tags: allTags,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `second-brain-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      loadStats();
    } catch (err) {
      alert('خطا در بارگذاری فایل پشتیبان.');
      console.error(err);
    }
  };

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
          onWallpaperChange('custom-image');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const activeWallpaperItem =
    currentWallpaper === 'custom-image' || currentWallpaper === 'custom-unsplash'
      ? {
          id: currentWallpaper,
          title: customWallpaperTitle,
          url: customWallpaperUrl || undefined,
        }
      : WALLPAPER_LIST.find((w) => w.id === currentWallpaper) || WALLPAPER_LIST[0];

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs select-none transition-opacity duration-300 ${
        mounted && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={handleClose}
      dir="rtl"
    >
      {/* Bottom Sheet Card sliding up from bottom */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full bg-card text-card-foreground rounded-t-[28px] shadow-2xl px-4 pt-2.5 pb-5 font-sans text-right flex flex-col max-h-[88%] border-t border-border transition-transform duration-300 ease-out ${
          mounted && !isClosing ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle indicator */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0 cursor-grab active:cursor-grabbing" />

        {/* 1. Header: Title on Right, Close on Left */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">تنظیمات</h2>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">شخصی‌سازی ظاهر و مدیریت داده‌ها</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="بستن (Esc)"
          >
            <RiCloseLine className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pt-3 pb-1 space-y-4 no-scrollbar">
          {/* Section: Themes Horizontal Rail (Draggable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <RiContrastLine className="w-4 h-4 text-muted-foreground" />
                <span>تم برنامه</span>
              </div>

              {/* Monochrome Dark / Light Toggle */}
              <div className="flex items-center bg-secondary/80 p-0.5 rounded-full text-[10.5px] font-medium border border-border/80">
                <button
                  type="button"
                  onClick={() => setThemeTab('dark')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    themeTab === 'dark'
                      ? 'bg-card text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiMoonLine className="w-3 h-3" />
                  <span>دارک ({toPersianDigits(DARK_THEMES.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeTab('light')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    themeTab === 'light'
                      ? 'bg-card text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <RiSunLine className="w-3 h-3" />
                  <span>روشن ({toPersianDigits(LIGHT_THEMES.length)})</span>
                </button>
              </div>
            </div>

            {/* Draggable Theme Rail */}
            <div
              ref={themeDrag.ref}
              onPointerDown={themeDrag.onPointerDown}
              onPointerMove={themeDrag.onPointerMove}
              onPointerUp={themeDrag.onPointerUp}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth cursor-grab active:cursor-grabbing select-none"
            >
              {(themeTab === 'dark' ? DARK_THEMES : LIGHT_THEMES).map((th) => {
                const isSelected = currentTheme === th.id;

                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      if (themeDrag.hasDragged.current) return;
                      onThemeChange?.(th.id);
                    }}
                    className={`w-[112px] shrink-0 p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between h-[64px] cursor-pointer ${
                      isSelected
                        ? 'border-foreground/80 bg-secondary/90 ring-1 ring-foreground/20 shadow-xs'
                        : 'border-border/80 bg-secondary/30 hover:bg-secondary/60'
                    }`}
                  >
                    {/* Top: Swatches + Check */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: th.previewColors.bg }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: th.previewColors.card }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: th.previewColors.accent }}
                        />
                      </div>
                      {isSelected && (
                        <div className="w-3.5 h-3.5 rounded-full bg-foreground text-background flex items-center justify-center shadow-xs">
                          <RiCheckLine className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Bottom: Name */}
                    <div className="min-w-0 pr-0.5">
                      <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                        {th.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate leading-none mt-0.5">
                        {th.nameEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Wallpapers Horizontal Rail (Draggable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <RiPaletteLine className="w-4 h-4 text-muted-foreground" />
                <span>تصویر پس‌زمینه</span>
              </div>
              <span className="text-[10.5px] text-muted-foreground font-medium truncate max-w-[150px]">
                {activeWallpaperItem?.title || 'انتخاب شده'}
              </span>
            </div>

            {/* Draggable Wallpaper Rail */}
            <div
              ref={wallpaperDrag.ref}
              onPointerDown={wallpaperDrag.onPointerDown}
              onPointerMove={wallpaperDrag.onPointerMove}
              onPointerUp={wallpaperDrag.onPointerUp}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth cursor-grab active:cursor-grabbing select-none"
            >
              {/* Custom Computer Image Card */}
              <button
                type="button"
                onClick={() => {
                  if (wallpaperDrag.hasDragged.current) return;
                  if (customWallpaperUrl) {
                    onWallpaperChange('custom-image');
                  } else {
                    customImageInputRef.current?.click();
                  }
                }}
                className={`w-[76px] shrink-0 rounded-xl overflow-hidden border text-right transition-all flex flex-col cursor-pointer ${
                  currentWallpaper === 'custom-image' || currentWallpaper === 'custom-unsplash'
                    ? 'border-foreground/80 ring-1 ring-foreground/20 shadow-xs'
                    : 'border-border/80 hover:border-foreground/40'
                }`}
                title={customWallpaperUrl ? 'انتخاب تصویر شخصی' : 'بارگذاری تصویر از کامپیوتر'}
              >
                <div className="w-full h-12 bg-muted/40 relative overflow-hidden flex flex-col items-center justify-center">
                  {customWallpaperUrl ? (
                    <img
                      src={customWallpaperUrl}
                      alt={customWallpaperTitle}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <RiImageAddLine className="w-4 h-4 text-muted-foreground" />
                  )}

                  {(currentWallpaper === 'custom-image' || currentWallpaper === 'custom-unsplash') && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center shadow">
                        <RiCheckLine className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-1 py-0.5 bg-card border-t border-border/60 text-center">
                  <p className="text-[9px] text-foreground font-medium truncate leading-tight">
                    {customWallpaperUrl ? customWallpaperTitle : 'افزودن عکس'}
                  </p>
                </div>
              </button>
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
                    className={`w-[76px] shrink-0 rounded-xl overflow-hidden border text-right transition-all flex flex-col cursor-pointer ${
                      isSelected
                        ? 'border-foreground/80 ring-1 ring-foreground/20 shadow-xs'
                        : 'border-border/80 hover:border-foreground/40'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-12 bg-muted/40 relative overflow-hidden flex items-center justify-center">
                      {wp.url ? (
                        <img
                          src={wp.thumbUrl || wp.url}
                          alt={wp.title}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{
                            background: wp.bgGradient || undefined,
                            backgroundColor: wp.bgColor || undefined,
                          }}
                        />
                      )}

                      {isSelected && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center shadow">
                            <RiCheckLine className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Caption */}
                    <div className="px-1 py-0.5 bg-card border-t border-border/60 text-center">
                      <p className="text-[9px] text-foreground font-medium truncate leading-tight">
                        {wp.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Button to open file picker for custom wallpaper from computer */}
            <button
              type="button"
              onClick={() => customImageInputRef.current?.click()}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted/60 text-foreground border border-border/60 text-xs font-medium transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <RiImageAddLine className="w-4 h-4 text-primary shrink-0" />
                <span className="font-medium">انتخاب پس‌زمینه دلخواه از کامپیوتر</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal">
                {customWallpaperUrl ? 'تغییر تصویر' : 'آپلود فایل عکس'}
              </span>
            </button>
          </div>

          {/* Section: Glass Background Setting Option */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10.5px] font-semibold text-muted-foreground px-1">شخصی‌سازی ظاهر شیشه‌ای</p>
            <div className="p-3 rounded-2xl border border-border/80 bg-secondary/25 flex items-center justify-between transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                  <RiDropLine className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground">پس‌زمینه شیشه‌ای</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">مشابه داک</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">افکت بلور و شیشه‌ای مایع روی کادر اصلی برنامه</p>
                </div>
              </div>

              {/* Modern iOS / Liquid style Switch Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={glassBackground}
                onClick={() => onGlassBackgroundChange?.(!glassBackground)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 select-none shrink-0 ${
                  glassBackground ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                title="تغییر حالت پس‌زمینه شیشه‌ای"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    glassBackground ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section: Monochrome Grouped Settings Rows */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10.5px] font-semibold text-muted-foreground px-1">مدیریت اطلاعات و گزینه‌ها</p>

            <div className="rounded-2xl border border-border/80 bg-secondary/25 divide-y divide-border/60 overflow-hidden">
              {/* Option 1: Export Backup */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-secondary/60 active:bg-secondary/80 transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                    <RiDownload2Line className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">پشتیبان‌گیری از داده‌ها</p>
                    <p className="text-[10px] text-muted-foreground">خروجی کامل به صورت فایل JSON</p>
                  </div>
                </div>
                <RiArrowLeftSLine className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Option 2: Import Backup */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-secondary/60 active:bg-secondary/80 transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                    <RiUpload2Line className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">بازگردانی اطلاعات</p>
                    <p className="text-[10px] text-muted-foreground">بارگذاری و ادغام فایل پشتیبان</p>
                  </div>
                </div>
                <RiArrowLeftSLine className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Option 3: Advanced Search */}
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onOpenSearch();
                }}
                className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-secondary/60 active:bg-secondary/80 transition-colors text-right cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                    <RiSearchLine className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">جستجوی جامع</p>
                    <p className="text-[10px] text-muted-foreground">جستجو در متن تسک‌ها و یادداشت‌ها</p>
                  </div>
                </div>
                <RiArrowLeftSLine className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Option 4: Stats Summary */}
              <div className="w-full px-3.5 py-2.5 flex items-center justify-between text-right">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/60 shrink-0">
                    <RiCheckDoubleLine className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">خلاصه فعالیت‌ها</p>
                    <p className="text-[10px] text-muted-foreground">
                      {toPersianDigits(stats.doneTasks)} انجام‌شده • {toPersianDigits(stats.openTasks)} باز • {toPersianDigits(stats.totalNotes)} یادداشت
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60">
                  {toPersianDigits(stats.doneTasks + stats.openTasks + stats.totalNotes)} مورد
                </span>
              </div>
            </div>
          </div>

          {/* Section: App Description & Offline Architecture (Last Option / Card) */}
          <div className="p-3 rounded-2xl border border-border/70 bg-secondary/20 flex items-start gap-2.5">
            <RiShieldCheckLine className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-[10.5px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">معماری ۱۰۰٪ محلی (Local-first) • نسخه ۱.۰.۰: </span>
              تمام داده‌ها و تنظیمات منحصراً در حافظه مرورگر دستگاه شما (IndexedDB) نگهداری شده و بدون اینترنت، کاملاً سریع و با حفظ حریم خصوصی کار می‌کنند.
            </div>
          </div>
        </div>

        {/* Hidden File Input for Restore */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />

        {/* Hidden File Input for Custom Wallpaper */}
        <input
          ref={customImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
};
