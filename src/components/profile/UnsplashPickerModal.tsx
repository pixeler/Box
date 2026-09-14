import React, { useState, useEffect, useRef } from 'react';
import {
  RiCloseLine,
  RiSearchLine,
  RiDownload2Line,
  RiCheckLine,
  RiSparklingLine,
  RiRefreshLine,
} from '@remixicon/react';
import { toast } from '@/lib/toast';

export interface UnsplashPhoto {
  id: string;
  title: string;
  thumbUrl: string;
  regularUrl: string;
  author: string;
  authorUrl?: string;
}

// Common Persian search terms mapped to effective Unsplash search terms
const PERSIAN_TRANSLATION_MAP: Record<string, string> = {
  طبیعت: 'nature landscape',
  مینیمال: 'minimal aesthetic wallpaper',
  تاریک: 'dark aesthetic wallpaper',
  تیره: 'dark obsidian wallpaper',
  کوه: 'mountains landscape moody',
  کوهستان: 'mountains moody',
  دریا: 'calm ocean waves',
  اقیانوس: 'deep ocean',
  فضا: 'space galaxy stars cosmos',
  کهکشان: 'galaxy nebula stars',
  جنگل: 'misty forest moody',
  معماری: 'architecture minimal',
  کویر: 'desert sand dunes',
  غروب: 'sunset golden hour',
  پاییز: 'autumn moody',
  باران: 'rain moody dark',
  آسمان: 'sky clouds aesthetic',
  قهوه: 'coffee cozy mood',
  کتاب: 'books aesthetic library',
  هنر: 'abstract art texture',
};

const POPULAR_SUGGESTIONS = [
  'مینیمال',
  'طبیعت',
  'تاریک',
  'کهکشان',
  'معماری',
  'کوهستان',
  'کویر',
  'غروب',
];

interface UnsplashPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndCacheWallpaper: (dataUrl: string, title: string) => void;
}

export const UnsplashPickerModal: React.FC<UnsplashPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectAndCacheWallpaper,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Translate Persian input or use clean English query
  const getSearchTerm = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return 'aesthetic minimal wallpaper';

    const words = trimmed.split(/\s+/);
    const translatedWords = words.map((w) => PERSIAN_TRANSLATION_MAP[w] || w);
    return translatedWords.join(' ');
  };

  // Perform search against Unsplash
  const fetchPhotos = async (query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    const effectiveTerm = getSearchTerm(query);

    try {
      // First try local proxy configured in vite.config.ts
      let response: Response | null = null;
      try {
        response = await fetch(
          `/api/unsplash/search/photos?query=${encodeURIComponent(
            effectiveTerm
          )}&per_page=18`,
          { signal: controller.signal }
        );
      } catch {
        // Fallback to direct unsplash napi
        response = await fetch(
          `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(
            effectiveTerm
          )}&per_page=18`,
          { signal: controller.signal }
        );
      }

      if (response && response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.results)) {
          const mapped: UnsplashPhoto[] = data.results.map((p: any) => ({
            id: p.id,
            title: p.description || p.alt_description || 'تصویر Unsplash',
            thumbUrl: p.urls?.small || p.urls?.thumb || p.urls?.regular,
            regularUrl: p.urls?.regular || p.urls?.full || p.urls?.raw,
            author: p.user?.name || 'عکاس Unsplash',
            authorUrl: p.user?.links?.html,
          }));
          setPhotos(mapped);
          return;
        }
      }
      setPhotos([]);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Failed fetching Unsplash photos in real-time:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // On open or when searchQuery changes, trigger real-time debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPhotos(searchQuery);
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isOpen]);

  // Download & cache photo as base64 Data URL
  const handleSelectPhoto = async (photo: UnsplashPhoto) => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadingId(photo.id);

    try {
      toast.show('در حال دانلود و کش کردن تصویر...');

      const response = await fetch(photo.regularUrl, { mode: 'cors' });
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        if (base64Data) {
          onSelectAndCacheWallpaper(base64Data, photo.title);
          toast.show('پس‌زمینه با موفقیت در دستگاه کش و اعمال شد');
          setIsDownloading(false);
          setDownloadingId(null);
          onClose();
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn('Fallback: direct URL applied:', err);
      onSelectAndCacheWallpaper(photo.regularUrl, photo.title);
      toast.show('پس‌زمینه Unsplash اعمال شد');
      setIsDownloading(false);
      setDownloadingId(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-backdrop-in select-none"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] bg-card text-card-foreground rounded-3xl border border-border/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-sheet-up"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 dark:border-white/10">
          <div className="flex items-center gap-2">
            <RiSparklingLine className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-bold text-foreground">جستجوی زنده در Unsplash</h2>
              <p className="text-[11px] text-muted-foreground">دانلود و کش دائمی در دستگاه</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Search Input & Suggestions */}
        <div className="px-5 pt-3 pb-2 space-y-2">
          <div className="relative flex items-center">
            <RiSearchLine className="absolute right-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="تایپ کنید (مثلاً: طبیعت، مینیمال، کهکشان، dark)..."
              className="w-full bg-muted/40 dark:bg-white/5 border border-border/70 dark:border-white/10 rounded-2xl pr-10 pl-10 py-2.5 text-xs text-foreground outline-none focus:border-foreground/30 transition-all placeholder:text-muted-foreground/50"
            />
            {isLoading && (
              <RiRefreshLine className="absolute left-3.5 w-4 h-4 text-muted-foreground animate-spin pointer-events-none" />
            )}
          </div>

          {/* Quick Suggestion Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-1">
            <span className="text-[10px] text-muted-foreground shrink-0 pl-1">پیشنهاد:</span>
            {POPULAR_SUGGESTIONS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchQuery(term)}
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all shrink-0 cursor-pointer ${
                  searchQuery === term
                    ? 'bg-foreground text-background font-semibold shadow-2xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border border-border/50'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Photos Grid Area */}
        <div className="flex-1 overflow-y-auto p-5 pt-2 min-h-[320px]">
          {isLoading && photos.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-4/3 rounded-2xl bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <RiSearchLine className="w-8 h-8 opacity-40" />
              <span>نتیجه‌ای برای «{searchQuery}» پیدا نشد.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => {
                const isThisDownloading = isDownloading && downloadingId === photo.id;

                return (
                  <button
                    key={photo.id}
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleSelectPhoto(photo)}
                    className="group relative aspect-4/3 rounded-2xl overflow-hidden border border-border/60 dark:border-white/10 hover:border-foreground/40 transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <img
                      src={photo.thumbUrl}
                      alt={photo.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                    {/* Bottom Metadata */}
                    <div className="absolute inset-x-0 bottom-0 p-2.5 text-right flex flex-col justify-end">
                      <span className="text-[11px] font-bold text-white truncate drop-shadow-xs">
                        {photo.title}
                      </span>
                      <span className="text-[9.5px] text-white/70 truncate">
                        {photo.author}
                      </span>
                    </div>

                    {/* Downloading Spinner */}
                    {isThisDownloading && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-2xs flex flex-col items-center justify-center gap-1.5 text-white">
                        <RiDownload2Line className="w-5 h-5 animate-bounce" />
                        <span className="text-[10px] font-medium">در حال کش...</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 dark:border-white/10 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
          <span className="flex items-center gap-1">
            <RiCheckLine className="w-3.5 h-3.5 text-emerald-500" />
            <span>تصویر انتخابی در حافظه مرورگر کش شده و دفعات بعد آفلاین لود می‌شود</span>
          </span>
          <span className="text-[10px] opacity-70">Unsplash Realtime</span>
        </div>
      </div>
    </div>
  );
};
