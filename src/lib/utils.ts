import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns one of the 5 realistic hand-drawn pencil strikethrough pattern classes:
 * - pencil-strike-1: Classic organic pencil line
 * - pencil-strike-2: Textured 4B sketch / crayon strike
 * - pencil-strike-3: Lively wavy / zigzag pencil scratch (زیگزاگی و مواج)
 * - pencil-strike-4: Double scratch / crossing pencil strokes
 * - pencil-strike-5: Smooth undulating natural hand wave
 */
export function getTaskPencilPattern(id?: string): string {
  if (!id) return 'pencil-strike-1';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const variant = (Math.abs(hash) % 5) + 1; // 1..5
  return `pencil-strike-${variant}`;
}
