import { toPersianDigits } from '@/lib/jalali';

/** ۲۵ دقیقه · ۱ ساعت و ۱۰ دقیقه */
export function formatFocusDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${toPersianDigits(total)} دقیقه`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0
    ? `${toPersianDigits(hours)} ساعت`
    : `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`;
}

/** Countdown as Persian MM:SS, clamped at zero. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${toPersianDigits(String(minutes).padStart(2, '0'))}:${toPersianDigits(
    String(rest).padStart(2, '0')
  )}`;
}
