import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  source?: string;
}

const PERSIAN_SEARCH_EXPANSIONS: Record<string, string> = {
  ایران: 'iran landscape architecture',
  تهران: 'tehran landscape city',
  اصفهان: 'isfahan architecture iran',
  شیراز: 'shiraz persepolis iran',
  طبیعت: 'nature landscape scenery',
  ماشین: 'sports car automobile',
  خودرو: 'car automobile',
  کهکشان: 'milky way galaxy space',
  فضا: 'deep space nebula stars',
  کوه: 'mountain landscape alps',
  کوهستان: 'mountains landscape',
  دریا: 'ocean sea calm water',
  اقیانوس: 'deep ocean waves blue',
  جنگل: 'forest trees greenery',
  غروب: 'sunset golden hour sky',
  مینیمال: 'minimalist architecture landscape wallpaper',
  معماری: 'architecture minimalist modern',
  کویر: 'desert sand dunes',
  تاریک: 'dark obsidian wallpaper black',
  تیره: 'dark aesthetic wallpaper',
  باران: 'rain moody aesthetic',
  آسمان: 'sky clouds aesthetic',
  گل: 'flowers blossom nature',
  برف: 'snow winter landscape',
  پاییز: 'autumn fall landscape leaves',
};

const POPULAR_SUGGESTIONS = [
  'ایران',
  'مینیمال',
  'طبیعت',
  'تهران',
  'کهکشان',
  'تاریک',
  'کوهستان',
  'دریا',
  'معماری',
  'خودرو',
];

const toPersianNum = (n: number) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

interface UnsplashPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndCacheWallpaper: (dataUrl: string, title: string) => void;
}

// Compresses image blob to max 1920x1080 JPEG at 82% quality to fit effortlessly into localStorage
async function blobToCompressedDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      } catch (err) {
        console.warn('Canvas compression error, reading blob directly:', err);
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    };

    img.src = objectUrl;
  });
}

export const UnsplashPickerModal: React.FC<UnsplashPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectAndCacheWallpaper,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep live refs to avoid stale closures during infinite scroll
  const nextOffsetRef = useRef<number | null>(null);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const currentQueryRef = useRef('');

  useEffect(() => {
    nextOffsetRef.current = nextOffset;
  }, [nextOffset]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  const getEffectiveQuery = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return 'scenic wallpaper landscape 4k';
    const lower = trimmed.toLowerCase();
    if (PERSIAN_SEARCH_EXPANSIONS[lower]) {
      return PERSIAN_SEARCH_EXPANSIONS[lower];
    }
    const words = trimmed.split(/\s+/);
    const translated = words.map((w) => PERSIAN_SEARCH_EXPANSIONS[w.toLowerCase()] || w);
    return translated.join(' ');
  };

  const parseWikiPages = (pages: Record<string, any>): UnsplashPhoto[] => {
    return Object.values(pages)
      .filter((p: any) => {
        if (!p.imageinfo || !p.imageinfo[0]?.thumburl) return false;
        const title = (p.title || '').toLowerCase();
        // Exclude diagrams, flags, maps, SVG vector graphics, coats of arms, PDFs, icons
        if (
          title.endsWith('.svg') ||
          title.endsWith('.pdf') ||
          title.endsWith('.djvu') ||
          title.includes('map') ||
          title.includes('flag') ||
          title.includes('diagram') ||
          title.includes('coat_of_arms') ||
          title.includes('icon')
        ) {
          return false;
        }
        const info = p.imageinfo[0];
        // Enforce strict landscape orientation for desktop/screen wallpapers (ratio >= 1.25)
        const ratio = info.width / info.height;
        return ratio >= 1.25;
      })
      .map((p: any) => {
        const info = p.imageinfo[0];
        const rawTitle = (p.title || '')
          .replace(/^File:/i, '')
          .replace(/\.[^/.]+$/, '')
          .replace(/_/g, ' ')
          .trim();

        return {
          id: `wiki-${p.pageid}`,
          title: rawTitle.length > 55 ? rawTitle.slice(0, 52) + '...' : rawTitle,
          thumbUrl: info.thumburl,
          regularUrl:
            info.thumburl.replace(/\/\d+px-/, '/1920px-') || info.url,
          author: 'عکاس آرشیو جهانی',
          source: 'Wikimedia Commons',
        };
      });
  };

  // Perform initial search
  const searchOnlinePhotos = async (query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    currentQueryRef.current = query;
    setIsLoading(true);
    setHasMore(true);
    setNextOffset(null);

    const effectiveTerm = getEffectiveQuery(query);

    try {
      const results: UnsplashPhoto[] = [];

      // 1. Query Wikimedia Commons (limit 28, offset 0, sorted by relevance/popularity)
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=28&gsrsort=relevance&gsroffset=0&gsrsearch=${encodeURIComponent(
        effectiveTerm
      )}&prop=imageinfo&iiprop=url|size&iiurlwidth=720`;

      let continueOffset: number | null = null;

      try {
        const wikiRes = await fetch(wikiUrl, {
          signal: controller.signal,
          headers: {
            'Api-User-Agent': 'SecondBrainApp/1.0 (wallpaper-search)',
          },
        });

        if (wikiRes.ok) {
          const data = await wikiRes.json();
          const pages = data.query?.pages || {};
          const wikiPhotos = parseWikiPages(pages);
          results.push(...wikiPhotos);

          if (data.continue && typeof data.continue.gsroffset === 'number') {
            continueOffset = data.continue.gsroffset;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }

      // 2. Concurrently attempt Unsplash via public CORS proxy (orientation=landscape, order_by=relevant)
      if (results.length < 10) {
        try {
          const unsplashProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(
            `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(
              effectiveTerm
            )}&orientation=landscape&order_by=relevant&per_page=12`
          )}`;

          const unsplashRes = await fetch(unsplashProxyUrl, {
            signal: controller.signal,
          });

          if (unsplashRes.ok) {
            const data = await unsplashRes.json();
            if (Array.isArray(data?.results)) {
              const unsplashPhotos: UnsplashPhoto[] = data.results.map((p: any) => ({
                id: `unsplash-${p.id}`,
                title: p.description || p.alt_description || 'تصویر Unsplash',
                thumbUrl: p.urls?.small || p.urls?.thumb,
                regularUrl: p.urls?.regular || p.urls?.full,
                author: p.user?.name || 'عکاس Unsplash',
                authorUrl: p.user?.links?.html,
                source: 'Unsplash',
              }));

              results.unshift(...unsplashPhotos);
            }
          }
        } catch {
          // Unsplash proxy skipped if blocked
        }
      }

      setPhotos(results);
      setNextOffset(continueOffset);
      setHasMore(continueOffset !== null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to search photos:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load next batch when scrolling to bottom
  const loadMorePhotos = useCallback(async () => {
    if (
      isLoadingRef.current ||
      isLoadingMoreRef.current ||
      !hasMoreRef.current ||
      nextOffsetRef.current === null
    ) {
      return;
    }

    setIsLoadingMore(true);
    const offset = nextOffsetRef.current;
    const query = currentQueryRef.current;
    const effectiveTerm = getEffectiveQuery(query);

    try {
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=28&gsrsort=relevance&gsroffset=${offset}&gsrsearch=${encodeURIComponent(
        effectiveTerm
      )}&prop=imageinfo&iiprop=url|size&iiurlwidth=720`;

      const wikiRes = await fetch(wikiUrl, {
        headers: {
          'Api-User-Agent': 'SecondBrainApp/1.0 (wallpaper-search)',
        },
      });

      if (wikiRes.ok) {
        const data = await wikiRes.json();
        const pages = data.query?.pages || {};
        const newPhotos = parseWikiPages(pages);

        setPhotos((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newPhotos.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });

        if (data.continue && typeof data.continue.gsroffset === 'number') {
          setNextOffset(data.continue.gsroffset);
          setHasMore(true);
        } else {
          setNextOffset(null);
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more photos:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // IntersectionObserver for infinite scrolling sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMorePhotos();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '240px', // Pre-fetch 240px before user hits bottom
        threshold: 0.1,
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loadMorePhotos, photos.length]);

  // Scroll event fallback to guarantee trigger
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 280) {
      loadMorePhotos();
    }
  };

  // Real-time debounced search on input change
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchOnlinePhotos(searchQuery);
    }, 320);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isOpen]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen && photos.length === 0) {
      searchOnlinePhotos(searchQuery || 'ایران');
    }
  }, [isOpen]);

  const handleSelectTag = (tag: string) => {
    setActiveTag(tag);
    setSearchQuery(tag);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveTag(null);
  };

  // Download & compress photo with live percentage progress, store in localStorage, and apply
  const handleSelectPhoto = async (photo: UnsplashPhoto) => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadingId(photo.id);
    setDownloadProgress(5);
    setDownloadStatusText('شروع اتصال و دریافت تصویر...');

    try {
      const response = await fetch(photo.regularUrl);
      if (!response.ok) throw new Error('Network error during image download');

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      let blob: Blob;

      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.length;
          const percent = Math.min(Math.round((receivedBytes / totalBytes) * 85), 85);
          setDownloadProgress(percent);
          setDownloadStatusText(`در حال دانلود تصویر (${toPersianNum(percent)}٪)...`);
        }

        blob = new Blob(chunks);
      } else {
        // Fallback simulation if content-length is not exposed
        let sim = 15;
        const timer = setInterval(() => {
          sim = Math.min(sim + 12, 80);
          setDownloadProgress(sim);
          setDownloadStatusText(`در حال دریافت تصویر (${toPersianNum(sim)}٪)...`);
        }, 90);

        blob = await response.blob();
        clearInterval(timer);
      }

      setDownloadProgress(90);
      setDownloadStatusText('در حال بهینه‌سازی و فشرده‌سازی برای ذخیره آفلاین (۹۰٪)...');

      // Compress and convert to base64 Data URL
      const dataUrl = await blobToCompressedDataUrl(blob);

      setDownloadProgress(100);
      setDownloadStatusText('اعمال نهایی پس‌زمینه (۱۰۰٪)...');

      // Short pause so the user clearly sees 100%
      await new Promise((r) => setTimeout(r, 350));

      onSelectAndCacheWallpaper(dataUrl, photo.title);
      toast.show('پس‌زمینه با موفقیت دانلود، کش و اعمال شد');
      setIsDownloading(false);
      setDownloadingId(null);
      setDownloadProgress(0);
      onClose();
    } catch (err) {
      console.warn('Could not stream download, falling back to direct URL:', err);
      onSelectAndCacheWallpaper(photo.regularUrl, photo.title);
      toast.show('پس‌زمینه اعمال شد');
      setIsDownloading(false);
      setDownloadingId(null);
      setDownloadProgress(0);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-backdrop-in"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[86vh] max-h-[660px] bg-card text-card-foreground rounded-3xl border border-border/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-sheet-up"
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-border/60 dark:border-white/10">
          <div className="flex items-center gap-2">
            <RiSparklingLine className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-bold text-foreground">جستجوی زنده تصویر پس‌زمینه</h2>
              <p className="text-[11px] text-muted-foreground">
                جستجو در آرشیو عکاسی جهانی با اسکرول نامحدود و کش آفلاین
              </p>
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

        {/* Real-time Search Bar & Suggestion Chips */}
        <div className="shrink-0 px-5 pt-3 pb-2 space-y-2 border-b border-border/40">
          <div className="relative flex items-center">
            <RiSearchLine className="absolute right-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveTag(null);
              }}
              placeholder="جستجوی زنده (مثلاً: ایران، تهران، مینیمال، طبیعت، کهکشان، ماشین)..."
              className="w-full bg-muted/40 dark:bg-white/5 border border-border/70 dark:border-white/10 rounded-2xl pr-10 pl-16 py-2.5 text-xs text-foreground outline-none focus:border-foreground/30 transition-all placeholder:text-muted-foreground/50"
            />
            <div className="absolute left-3 flex items-center gap-1.5">
              {isLoading && (
                <RiRefreshLine className="w-4 h-4 text-muted-foreground animate-spin" />
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <RiCloseLine className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-1">
            <span className="text-[10px] text-muted-foreground shrink-0 pl-1">محبوب:</span>
            {POPULAR_SUGGESTIONS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleSelectTag(term)}
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all shrink-0 cursor-pointer ${
                  activeTag === term || searchQuery === term
                    ? 'bg-foreground text-background font-semibold shadow-2xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border border-border/50'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Photos Scrollable Grid Area with bounded min-h-0 and Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pt-3 select-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading && photos.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-4/3 rounded-2xl bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <RiSearchLine className="w-8 h-8 opacity-30" />
              <span className="font-medium">تصویری برای این عبارت پیدا نشد.</span>
              <span className="text-[11px] opacity-75">
                کلمه کلیدی دیگری تایپ کنید یا از موضوعات محبوب بالا انتخاب کنید.
              </span>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-2.5 text-[10.5px] text-muted-foreground">
                <span>{toPersianNum(photos.length)} تصویر باکیفیت لود شده (اسکرول نامحدود)</span>
                {isLoading && (
                  <span className="flex items-center gap-1">
                    <RiRefreshLine className="w-3 h-3 animate-spin" />
                    <span>در حال جستجو...</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                      {/* Bottom Metadata */}
                      <div className="absolute inset-x-0 bottom-0 p-2.5 text-right flex flex-col justify-end">
                        <span className="text-[11px] font-bold text-white truncate drop-shadow-xs">
                          {photo.title}
                        </span>
                        <span className="text-[9.5px] text-white/70 truncate">
                          {photo.author}
                        </span>
                      </div>

                      {/* Live Downloading Progress Overlay on the Card */}
                      {isThisDownloading && (
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-3">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            {/* Circular progress track */}
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="15.5"
                                fill="none"
                                className="stroke-white/20"
                                strokeWidth="3"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="15.5"
                                fill="none"
                                className="stroke-white transition-all duration-200"
                                strokeWidth="3"
                                strokeDasharray="97.4"
                                strokeDashoffset={97.4 - (97.4 * downloadProgress) / 100}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-xs font-bold font-mono">
                              {toPersianNum(downloadProgress)}٪
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-white/90 text-center leading-tight">
                            {downloadProgress === 100 ? 'اعمال شد!' : 'در حال کش...'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sentinel trigger for infinite scroll */}
              <div ref={sentinelRef} className="py-4 flex items-center justify-center">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RiRefreshLine className="w-4 h-4 animate-spin" />
                    <span>در حال بارگذاری تصاویر بیشتر...</span>
                  </div>
                ) : !hasMore && photos.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground/60">
                    تمام نتایج این جستجو بارگذاری شدند
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Live Progress Bar during download */}
        {isDownloading ? (
          <div className="shrink-0 px-5 py-3 border-t border-border/60 dark:border-white/10 bg-muted/40 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <RiDownload2Line className="w-3.5 h-3.5 animate-bounce text-foreground" />
                <span>{downloadStatusText}</span>
              </span>
              <span className="font-bold text-foreground font-mono">
                {toPersianNum(downloadProgress)}٪
              </span>
            </div>
            {/* Progress Bar Track */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/30">
              <div
                className="h-full bg-foreground transition-all duration-200 rounded-full"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="shrink-0 px-5 py-3 border-t border-border/60 dark:border-white/10 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
            <span className="flex items-center gap-1.5">
              <RiCheckLine className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>تصویر انتخابی با کیفیت بالا دانلود شده و در حافظه کش می‌شود</span>
            </span>
            <span className="text-[10px] opacity-70">اسکرول نامحدود</span>
          </div>
        )}
      </div>
    </div>
  );
};
