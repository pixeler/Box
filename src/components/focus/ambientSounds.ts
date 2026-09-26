export type AmbientSoundId = 'none' | 'rain' | 'waves' | 'forest' | 'cafe';

export interface AmbientSoundMeta {
  id: AmbientSoundId;
  label: string;
  sublabel: string;
  audioSrc: string;
  imageSrc: string;
}

export const AMBIENT_SOUNDS: AmbientSoundMeta[] = [
  {
    id: 'none',
    label: 'بدون صدا',
    sublabel: 'سکوت',
    audioSrc: '',
    imageSrc: '',
  },
  {
    id: 'rain',
    label: 'باران',
    sublabel: 'بارش یکنواخت',
    audioSrc: '/sounds/rain.mp3',
    imageSrc: '/sounds/Rain.png',
  },
  {
    id: 'waves',
    label: 'امواج دریا',
    sublabel: 'آرامش ساحل',
    audioSrc: '/sounds/waves.mp3',
    imageSrc: '/sounds/Sea.png',
  },
  {
    id: 'forest',
    label: 'جنگل',
    sublabel: 'طبیعت و پرندگان',
    audioSrc: '/sounds/forest.mp3',
    imageSrc: '/sounds/Jungle.png',
  },
  {
    id: 'cafe',
    label: 'کافه',
    sublabel: 'فضای دنج کاری',
    audioSrc: '/sounds/cafe.mp3',
    imageSrc: '/sounds/Cafe.png',
  },
];
