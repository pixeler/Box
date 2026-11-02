import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pixeler.box',
  appName: 'Box',
  webDir: 'dist',

  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'none',
      style: 'DARK',
    },
    SplashScreen: {
      launchAutoHide: true,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: '#09090b',
    },
  },

  android: {
    allowMixedContent: false,
    backgroundColor: '#09090b',
  },
};

export default config;
