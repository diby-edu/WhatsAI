import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wazzapai.app',
  appName: 'WazzapAI',
  webDir: 'out',
  server: {
    url: 'https://wazzapai.com',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
