import React from 'react';
import {
  RiYoutubeFill,
  RiYoutubeLine,
  RiSunLine,
  RiSunFill,
  RiCodeSSlashLine,
  RiHeartLine,
  RiHeartFill,
  RiBookOpenLine,
  RiShoppingBag3Line,
  RiCameraLine,
  RiMusic2Line,
  RiStarFill,
  RiStarLine,
  RiBriefcaseLine,
  RiCupLine,
  RiLightbulbLine,
  RiGamepadLine,
  RiRestaurantLine,
  RiRunLine,
  RiPlaneLine,
  RiQuillPenLine,
  RiFolderLine,
  RiGroupLine,
  RiLockLine,
  RiCompass3Line,
  RiPaletteLine,
  RiFilmLine,
  RiPriceTag3Line,
} from '@remixicon/react';

export const BOX_ICONS_LIST = [
  { id: 'RiYoutubeFill', label: 'یوتیوب / ویدیو', Icon: RiYoutubeFill },
  { id: 'RiSunLine', label: 'خورشید / روزانه', Icon: RiSunLine },
  { id: 'RiCodeSSlashLine', label: 'کدنویسی / توسعه', Icon: RiCodeSSlashLine },
  { id: 'RiHeartLine', label: 'سلامت / شخصی', Icon: RiHeartLine },
  { id: 'RiBookOpenLine', label: 'کتاب / مطالعه', Icon: RiBookOpenLine },
  { id: 'RiRestaurantLine', label: 'غذا / دستور پخت', Icon: RiRestaurantLine },
  { id: 'RiShoppingBag3Line', label: 'خرید / بازار', Icon: RiShoppingBag3Line },
  { id: 'RiMusic2Line', label: 'موسیقی / هنر', Icon: RiMusic2Line },
  { id: 'RiCameraLine', label: 'عکس / رسانه', Icon: RiCameraLine },
  { id: 'RiBriefcaseLine', label: 'کار / بیزنس', Icon: RiBriefcaseLine },
  { id: 'RiCupLine', label: 'کافه / نوشیدنی', Icon: RiCupLine },
  { id: 'RiLightbulbLine', label: 'ایده / خلاقیت', Icon: RiLightbulbLine },
  { id: 'RiGamepadLine', label: 'بازی / تفریح', Icon: RiGamepadLine },
  { id: 'RiRunLine', label: 'ورزش / تمرین', Icon: RiRunLine },
  { id: 'RiPlaneLine', label: 'سفر / ماجراجویی', Icon: RiPlaneLine },
  { id: 'RiQuillPenLine', label: 'نوشتن / ژورنال', Icon: RiQuillPenLine },
  { id: 'RiFolderLine', label: 'اسناد / پروژه‌ها', Icon: RiFolderLine },
  { id: 'RiPaletteLine', label: 'طراحی / دیزاین', Icon: RiPaletteLine },
  { id: 'RiFilmLine', label: 'فیلم / سریال', Icon: RiFilmLine },
  { id: 'RiStarLine', label: 'ویژه / علاقه‌مندی', Icon: RiStarLine },
];

export const BOX_BADGES_LIST = [
  { id: '', label: 'بدون نشان', Icon: null },
  { id: 'RiGroupLine', label: 'گروهی / دوستان', Icon: RiGroupLine },
  { id: 'RiLockLine', label: 'شخصی / قفل', Icon: RiLockLine },
  { id: 'RiStarFill', label: 'ستاره‌دار', Icon: RiStarFill },
];

const ICONS_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  RiYoutubeFill,
  RiYoutubeLine,
  RiSunLine,
  RiSunFill,
  RiCodeSSlashLine,
  RiHeartLine,
  RiHeartFill,
  RiBookOpenLine,
  RiShoppingBag3Line,
  RiCameraLine,
  RiMusic2Line,
  RiStarFill,
  RiStarLine,
  RiBriefcaseLine,
  RiCupLine,
  RiLightbulbLine,
  RiGamepadLine,
  RiRestaurantLine,
  RiRunLine,
  RiPlaneLine,
  RiQuillPenLine,
  RiFolderLine,
  RiGroupLine,
  RiLockLine,
  RiCompass3Line,
  RiPaletteLine,
  RiFilmLine,
  RiPriceTag3Line,
};

interface BoxIconProps {
  iconId?: string;
  boxImage?: string;
  className?: string;
}

/**
 * Renders an icon with authentic stamped/embossed styling for box lids.
 */
export const BoxIconRenderer: React.FC<BoxIconProps> = ({
  iconId,
  boxImage,
  className = 'w-6 h-6',
}) => {
  if (!iconId) return null;
  const IconComponent = ICONS_MAP[iconId];
  if (!IconComponent) return null;

  // Determine realistic color/shading based on box material
  const isKraft = boxImage?.toLowerCase().includes('bix 2') || boxImage?.toLowerCase().includes('box 2');
  const isDark = boxImage?.toLowerCase().includes('box 3') || boxImage?.toLowerCase().includes('box 9');

  let styleClasses = 'text-slate-600/85 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]';
  if (isKraft) {
    // Cardboard stamped look (dark sepia with subtle indent)
    styleClasses = 'text-[#614529] opacity-75 mix-blend-multiply drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]';
  } else if (isDark) {
    styleClasses = 'text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]';
  }

  return (
    <div className={`flex items-center justify-center transition-all ${styleClasses}`}>
      <IconComponent className={className} />
    </div>
  );
};

interface BoxBadgeProps {
  badgeId?: string;
  className?: string;
}

export const BoxBadgeRenderer: React.FC<BoxBadgeProps> = ({
  badgeId,
  className = 'w-3 h-3 text-white',
}) => {
  if (!badgeId) return null;
  const IconComponent = ICONS_MAP[badgeId];
  if (!IconComponent) return null;

  return (
    <div className="absolute -top-1 -right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-800/90 dark:bg-zinc-700/90 text-white flex items-center justify-center shadow-md border border-white/20 backdrop-blur-xs">
      <IconComponent className={className} />
    </div>
  );
};
