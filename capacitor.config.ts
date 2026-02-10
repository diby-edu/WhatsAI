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
    webContentsDebuggingEnabled: false,
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
    }
  }
};

export default config;

