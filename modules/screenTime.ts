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
    if (Platform.OS !== 'android') return notSupported(false);
    return ScreenTime.hasPermission();
  },

  requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return notSupported(false);
    return ScreenTime.requestPermission();
  },

  // days: quantos dias para trás buscar (1 = só hoje)
  getUsageStats(days: number = 1): Promise<AppUsage[]> {
    if (Platform.OS !== 'android') return notSupported([]);
    return ScreenTime.getUsageStats(days);
  },
};
