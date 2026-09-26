import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isWeb = () => Capacitor.getPlatform() === 'web';

export async function updateStatusBarTheme(mode: 'dark' | 'light', cardColor?: string) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Style.Dark: white text/icons (for dark background)
    // Style.Light: dark text/icons (for light background)
    await StatusBar.setStyle({
      style: mode === 'dark' ? Style.Dark : Style.Light,
    }).catch(() => {});

    if (cardColor) {
      await StatusBar.setBackgroundColor({
        color: cardColor,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('StatusBar theme update failed:', err);
  }
}

export async function updateKeyboardTheme(mode: 'dark' | 'light') {
  if (!isNative()) return;
  try {
    const { Keyboard, KeyboardStyle } = await import('@capacitor/keyboard');
    await Keyboard.setStyle({
      style: mode === 'dark' ? KeyboardStyle.Dark : KeyboardStyle.Light,
    }).catch(() => {});
  } catch (err) {
    console.warn('Keyboard theme update failed:', err);
  }
}

export async function initNativePlugins() {
  if (!isNative()) return;

  const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('second_brain_theme')) || 'default-light';
  const isDark = savedTheme.includes('dark');
  const initialMode = isDark ? 'dark' : 'light';

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    await StatusBar.setStyle({
      style: initialMode === 'dark' ? Style.Dark : Style.Light,
    }).catch(() => {});
  } catch (err) {
    console.warn('StatusBar plugin initialization failed:', err);
  }

  try {
    const { Keyboard, KeyboardStyle } = await import('@capacitor/keyboard');
    await Keyboard.setStyle({
      style: initialMode === 'dark' ? KeyboardStyle.Dark : KeyboardStyle.Light,
    }).catch(() => {});
  } catch (err) {
    console.warn('Keyboard plugin initialization failed:', err);
  }
}

export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative()) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const impactMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: impactMap[style] });
  } catch {
    // Ignore haptic errors on unsupported environments
  }
}
