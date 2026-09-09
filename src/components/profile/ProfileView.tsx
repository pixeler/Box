import React, { useState, useEffect, useRef } from 'react';
import { taskRepo, noteRepo, eventRepo, entryRepo, tagRepo, type ExportData } from '@/repositories';
import { toPersianDigits } from '@/lib/jalali';
import {
  RiPaletteLine,
  RiDownload2Line,
  RiUpload2Line,
  RiSearchLine,
  RiCheckDoubleLine,
  RiBookletLine,
  RiShieldCheckLine,
  RiCheckLine,
  RiCloseLine,
  RiSettings4Line,
} from '@remixicon/react';

export interface WallpaperItem {
  id: string;
  title: string;
  url?: string;
  bgColor?: string;
  bgGradient?: string;
  isCustomImage?: boolean;
}

export const WALLPAPER_LIST: WallpaperItem[] = [
  {
    id: 'birmingham-museums-trust-5EUh-tq31eA-unsplash.jpg',
    title: 'نقاشی کلاسیک ۱',
    url: '/backgrounds/birmingham-museums-trust-5EUh-tq31eA-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-HEEvYhNzpEo-unsplash.jpg',
    title: 'نقاشی کلاسیک ۲',
    url: '/backgrounds/birmingham-museums-trust-HEEvYhNzpEo-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-HslbEeUauYA-unsplash.jpg',
    title: 'نقاشی کلاسیک ۳',
    url: '/backgrounds/birmingham-museums-trust-HslbEeUauYA-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust--9yyKm-aXP8-unsplash.jpg',
    title: 'نقاشی کلاسیک ۴',
    url: '/backgrounds/birmingham-museums-trust--9yyKm-aXP8-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-nbneQlI2M1A-unsplash.jpg',
    title: 'نقاشی کلاسیک ۵',
    url: '/backgrounds/birmingham-museums-trust-nbneQlI2M1A-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'birmingham-museums-trust-_fXZDGdrYZk-unsplash.jpg',
    title: 'نقاشی کلاسیک ۶',
    url: '/backgrounds/birmingham-museums-trust-_fXZDGdrYZk-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'abolfazl-ranjbar-KuDGjdwft9o-unsplash.jpg',
    title: 'هنر و عکاسی ۱',
    url: '/backgrounds/abolfazl-ranjbar-KuDGjdwft9o-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'fatemeh-behvandi-eJRuC6UY7wU-unsplash.jpg',
    title: 'هنر و عکاسی ۲',
    url: '/backgrounds/fatemeh-behvandi-eJRuC6UY7wU-unsplash.jpg',
    isCustomImage: true,
  },
  {
    id: 'niloofar-kanani-VPb7abByEK4-unsplash.jpg',
    title: 'هنر و عکاسی ۳',
    url: '/backgrounds/niloofar-kanani-VPb7abByEK4-unsplash.jpg',
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
];

interface ProfileViewProps {
  currentWallpaper: string;
  onWallpaperChange: (wpId: string) => void;
  onOpenSearch: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentWallpaper,
  onWallpaperChange,
  onOpenSearch,
  isOpen = true,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [stats, setStats] = useState({
    doneTasks: 0,
    openTasks: 0,
    totalNotes: 0,
    totalEvents: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs select-none ${
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full bg-white rounded-t-[28px] shadow-2xl pb-6 px-5 pt-4 font-sans text-right flex flex-col max-h-[88%] overflow-hidden ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
      >
        {/* Modal Header: Title on Right, Close Button on Left */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-800">
              <RiSettings4Line className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">تنظیمات</h2>
              <p className="text-[11px] text-gray-400 font-normal">شخصی‌سازی و مدیریت داده‌ها</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors font-medium cursor-pointer"
              title="جستجو در تمام یادداشت‌ها و تسک‌ها"
            >
              <RiSearchLine className="w-3.5 h-3.5" />
              <span>جستجو</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
              title="بستن (Esc)"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="w-full flex-1 overflow-y-auto no-scrollbar space-y-4 pt-3 pb-2">

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <RiCheckDoubleLine className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">کارهای تکمیل‌شده</p>
              <p className="text-base font-bold text-gray-900">
                {toPersianDigits(stats.doneTasks)}
              </p>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <RiBookletLine className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">کل یادداشت‌ها</p>
              <p className="text-base font-bold text-gray-900">
                {toPersianDigits(stats.totalNotes)}
              </p>
            </div>
          </div>
        </div>

        {/* Wallpaper Visual Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-gray-700">
              <RiPaletteLine className="w-4 h-4 text-gray-500" />
              <span>پس‌زمینه‌های برنامه ({toPersianDigits(WALLPAPER_LIST.length)} مورد)</span>
            </div>
            <span className="text-[11px] text-gray-400">برای تغییر تپ کنید</span>
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-0.5 pl-0.5">
            {WALLPAPER_LIST.map((wp) => {
              const isSelected = currentWallpaper === wp.id;

              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => onWallpaperChange(wp.id)}
                  className={`group relative rounded-xl overflow-hidden border-2 transition-all text-right flex flex-col ${
                    isSelected
                      ? 'border-black ring-2 ring-black/10 shadow-sm'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-full h-14 bg-cover bg-center relative"
                    style={{
                      backgroundImage: wp.url ? `url(${wp.url})` : wp.bgGradient || undefined,
                      backgroundColor: wp.bgColor || undefined,
                    }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow">
                          <RiCheckLine className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  <div className="p-1 bg-white">
                    <p className="text-[10px] text-gray-700 font-medium truncate">
                      {wp.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700">پشتیبان‌گیری محلی (Local Backup)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium text-gray-800 transition-colors"
            >
              <RiDownload2Line className="w-4 h-4" />
              <span>خروجی گرفتن (JSON)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium text-gray-800 transition-colors"
            >
              <RiUpload2Line className="w-4 h-4" />
              <span>بازگردانی فایل</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Local-first banner */}
        <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 flex items-start gap-2">
          <RiShieldCheckLine className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-emerald-800 leading-relaxed">
            <span className="font-bold">معماری ۱۰۰٪ محلی (Local-first):</span> داده‌های شما درون حافظه مرورگر خودتان (IndexedDB) قرار دارند و بدون نیاز به اینترنت به صورت امن حفظ می‌شوند.
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
