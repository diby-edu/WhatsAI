import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whatsai.app',
  appName: 'WhatsAI',
  webDir: 'out',
  server: {
    url: 'https://wazzapai.com',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
