import { Capacitor } from '@capacitor/core';
import { toPersianDigits } from './jalali';
import { NotificationService } from './notifications';
import { desktop } from './desktop';

let lastBadgeMinutes: number | null = null;

/**
 * Native notification for focus start/finish. The Electron shell shows a real
 * Windows toast (silent, because the app plays its own chime); Android uses a
 * local notification so it also arrives while the app is in the background.
 */
export function notifyFocus(
  title: string,
  body: string,
  options: { sound?: boolean } = {}
): void {
  if (desktop?.notify) {
    desktop.notify(title, body);
    return;
  }

  if (Capacitor.isNativePlatform()) {
    void NotificationService.showFocusEvent(title, body, options);
    return;
  }

  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState !== 'visible'
  ) {
    try {
      new Notification(title, { body });
    } catch {
      /* notifications are best effort */
    }
  }
}

/**
 * Windows taskbar badge with the remaining focus minutes.
 *
 * Windows 11 ignores window-icon changes on an existing taskbar button, so the
 * only badge the shell really refreshes is the overlay icon — which it always
 * paints in the button's corner. The image is drawn in the renderer because the
 * main process has no canvas. Repeated calls in the same minute are ignored.
 */
export function setTaskbarTimerBadge(minutes: number | null): void {
  if (!desktop?.setFocusBadge) return;

  const next = minutes === null ? null : Math.min(99, Math.max(1, Math.round(minutes)));
  if (next === lastBadgeMinutes) return;
  lastBadgeMinutes = next;

  if (next === null) {
    desktop.setFocusBadge(null);
    return;
  }

  // Drawn at 2x so the shell has enough pixels for high-DPI taskbars.
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) return;

  const center = size / 2;

  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, center - 0.5, 0, Math.PI * 2);
  context.fillStyle = '#111111';
  context.fill();
  context.lineWidth = 2.5;
  context.strokeStyle = '#34d399';
  context.stroke();

  context.fillStyle = '#ffffff';
  context.font = `700 ${next > 9 ? 18 : 22}px "Segoe UI", system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(toPersianDigits(next), center, center + 1);

  desktop.setFocusBadge(canvas.toDataURL('image/png'), toPersianDigits(next));
}
