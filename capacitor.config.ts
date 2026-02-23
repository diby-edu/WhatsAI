import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wazzapai.app',
  appName: 'WazzapAI',
  webDir: 'out',
  server: {
    url: 'https://wazzapai.com',
    cleartext: true,
    androidScheme: 'https'
  },
  android: {
    // Enable hardware acceleration for smooth scrolling
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Enable for debugging - set to false in production
    // Better scroll behavior
    overrideUserAgent: 'WazzapAI Android App',
    backgroundColor: '#0f172a'
  },
  plugins: {
    // Keyboard plugin to handle soft keyboard better
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    // Status bar: dark background with white icons (same as mobile browser)
    StatusBar: {
      backgroundColor: '#0f172a',
      style: 'LIGHT',
      overlaysWebView: false
    },
    // Splash screen: Use native Android 12+ splash (disable Capacitor's)
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true
    },
    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    // Google Auth Natif
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '519109526767-1rfcfigbutf9217uuc69fosqjp6mis05.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;

