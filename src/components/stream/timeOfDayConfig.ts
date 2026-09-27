import {
  Clock01Icon,
  Sun01Icon,
  EggFriedIcon,
  MoonStarIcon,
} from '@hugeicons/core-free-icons';
import type { TimeOfDay } from '@/types/models';

export const MorningSunriseIcon = EggFriedIcon; // EggFriedIcon from Hugeicons Foods
export const EveningMoonIcon = MoonStarIcon; // MoonStarIcon from Hugeicons Islamic
export const DaySunIcon = Sun01Icon;
export const AnytimeClockIcon = Clock01Icon;

export interface TimeOfDaySectionConfig {
  key: TimeOfDay;
  label: string;
  icon: typeof Clock01Icon;
  pillClasses: string;
  emptyHint: string;
}

export const TIME_OF_DAY_SECTIONS: TimeOfDaySectionConfig[] = [
  {
    key: 'anytime',
    label: 'هر زمان',
    icon: AnytimeClockIcon,
    pillClasses: 'tod-pill tod-pill-anytime',
    emptyHint: 'کاری برای هر زمان امروز ثبت نشده',
  },
  {
    key: 'morning',
    label: 'صبح',
    icon: MorningSunriseIcon,
    pillClasses: 'tod-pill tod-pill-morning',
    emptyHint: 'کاری برای صبح برنامه‌ریزی نشده',
  },
  {
    key: 'day',
    label: 'ظهر',
    icon: DaySunIcon,
    pillClasses: 'tod-pill tod-pill-day',
    emptyHint: 'کاری برای ظهر برنامه‌ریزی نشده',
  },
  {
    key: 'evening',
    label: 'عصر و شب',
    icon: EveningMoonIcon,
    pillClasses: 'tod-pill tod-pill-evening',
    emptyHint: 'پایان روز به روش خودت',
  },
];
