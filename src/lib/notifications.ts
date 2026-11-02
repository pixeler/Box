import { Capacitor } from '@capacitor/core';
import { toPersianDigits } from './jalali';

const FOCUS_NOTIFICATION_ID = 1001;
const FOCUS_EVENT_ID = 1002;
/** White silhouette icon used for the Android status bar. */
const SMALL_ICON = 'ic_stat_focus';

async function nativeNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

export const NotificationService = {
  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const LocalNotifications = await nativeNotifications();
        const res = await LocalNotifications.requestPermissions();
        return res.display === 'granted';
      } catch (err) {
        console.warn('Native notification requestPermission error:', err);
        return false;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch {
        return false;
      }
    }
    return false;
  },

  /** Immediate notification for a focus session starting or finishing. */
  async showFocusEvent(
    title: string,
    body: string,
    options: { sound?: boolean } = {}
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const LocalNotifications = await nativeNotifications();
      const permission = await LocalNotifications.checkPermissions();
      const granted =
        permission.display === 'granted' ||
        (await LocalNotifications.requestPermissions()).display === 'granted';
      if (!granted) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: FOCUS_EVENT_ID,
            title,
            body,
            sound: options.sound ? 'default' : undefined,
            smallIcon: SMALL_ICON,
            schedule: { at: new Date(Date.now() + 400) },
          },
        ],
      });
    } catch (err) {
      console.warn('Native focus notification error:', err);
    }
  },

  async scheduleFocusCompletion(durationMinutes: number): Promise<void> {
    const triggerAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    if (Capacitor.isNativePlatform()) {
      try {
        const LocalNotifications = await nativeNotifications();
        // Cancel existing timer notification if any
        await LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFICATION_ID }] });

        await LocalNotifications.schedule({
          notifications: [
            {
              id: FOCUS_NOTIFICATION_ID,
              title: 'تمرکز تکمیل شد! 🎉',
              body: `جلسه تمرکز ${toPersianDigits(durationMinutes)} دقیقه‌ای شما با موفقیت به پایان رسید.`,
              schedule: { at: triggerAt },
              sound: 'default',
              smallIcon: SMALL_ICON,
              actionTypeId: '',
              extra: { type: 'focus_completed' },
            },
          ],
        });
      } catch (err) {
        console.warn('Native notification schedule error:', err);
      }
    }
  },

  async cancelFocusCompletion(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const LocalNotifications = await nativeNotifications();
        await LocalNotifications.cancel({
          notifications: [{ id: FOCUS_NOTIFICATION_ID }, { id: FOCUS_EVENT_ID }],
        });
      } catch (err) {
        console.warn('Native notification cancel error:', err);
      }
    }
  },
};
