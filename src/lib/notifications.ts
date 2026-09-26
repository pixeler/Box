import { Capacitor } from '@capacitor/core';

const FOCUS_NOTIFICATION_ID = 1001;

export const NotificationService = {
  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
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

  async scheduleFocusCompletion(durationMinutes: number): Promise<void> {
    const triggerAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    if (Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        // Cancel existing timer notification if any
        await LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFICATION_ID }] });

        await LocalNotifications.schedule({
          notifications: [
            {
              id: FOCUS_NOTIFICATION_ID,
              title: 'تمرکز تکمیل شد! 🎉',
              body: `جلسه تمرکز ${durationMinutes} دقیقه‌ای شما با موفقیت به پایان رسید.`,
              schedule: { at: triggerAt },
              sound: 'default',
              smallIcon: 'ic_stat_name',
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
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFICATION_ID }] });
      } catch (err) {
        console.warn('Native notification cancel error:', err);
      }
    }
  },
};
