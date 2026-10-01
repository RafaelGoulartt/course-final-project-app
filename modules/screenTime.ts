import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { ScreenTime } = NativeModules;

export type AppUsage = {
  package_name: string;
  tempo_minutos: number;
  data_uso: string;
};

function notSupported<T>(fallback: T): Promise<T> {
  return Promise.resolve(fallback);
}

export default {
  hasPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.hasPermission();
  },

  requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.requestPermission();
  },

  configureBlocker(token: string, apiBaseUrl: string): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.configureBlocker(token, apiBaseUrl);
  },

  isBlockerEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.isBlockerEnabled();
  },

  openBlockerSettings(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.openBlockerSettings();
  },

  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (Number(Platform.Version) < 33) return true;

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  },

  showNotification(id: number, title: string, message: string): Promise<boolean> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported(false);
    return ScreenTime.showNotification(id, title, message);
  },

  getUsageStats(days: number = 1): Promise<AppUsage[]> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported([]);
    return ScreenTime.getUsageStats(days);
  },
};
