import { NativeModules, Platform } from 'react-native';

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

  getUsageStats(days: number = 1): Promise<AppUsage[]> {
    if (Platform.OS !== 'android' || !ScreenTime) return notSupported([]);
    return ScreenTime.getUsageStats(days);
  },
};
