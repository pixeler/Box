import type { WallpaperItem } from '@/types/wallpaper';

/**
 * Wallpaper catalogue. Lives outside ProfileView so the settings screen can
 * stay lazy-loaded without dragging the list into the boot bundle.
 */
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
