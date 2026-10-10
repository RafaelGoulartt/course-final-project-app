import { NativeModules, Platform } from 'react-native';

const { ScreenTime } = NativeModules;

export type AppUsage = {
  package_name: string;
  nome?: string;
  tempo_minutos: number;
  data_uso: string;
};

function notSupported<T>(fallback: T): Promise<T> {
  return Promise.resolve(fallback);
}

const disponivel = () => Platform.OS === 'android' && Boolean(ScreenTime);

// Fora do Android (web), o armazenamento cai no localStorage do navegador.
const webStorage = typeof localStorage !== 'undefined' ? localStorage : null;

export default {
  hasPermission(): Promise<boolean> {
    if (!disponivel()) return notSupported(false);
    return ScreenTime.hasPermission();
  },

  requestPermission(): Promise<boolean> {
    if (!disponivel()) return notSupported(false);
    return ScreenTime.requestPermission();
  },

  /** Permissão de "sobrepor a outros apps", usada para mostrar a tela de app suspenso. */
  hasOverlayPermission(): Promise<boolean> {
    if (!disponivel()) return notSupported(true);
    return ScreenTime.hasOverlayPermission();
  },

  requestOverlayPermission(): Promise<boolean> {
    if (!disponivel()) return notSupported(false);
    return ScreenTime.requestOverlayPermission();
  },

  /**
   * Uso por app em dias do calendário (00:00 às 23:59; hoje vai até agora).
   * days = 1 traz só hoje; days = 2 traz ontem e hoje. Máximo 7.
   */
  getUsageStats(days: number = 1): Promise<AppUsage[]> {
    if (!disponivel()) return notSupported([]);
    return ScreenTime.getUsageStats(days);
  },

  /** Liga o serviço em segundo plano que recebe mensagens e bloqueia apps suspensos. */
  startMonitor(token: string, apiUrl: string): Promise<boolean> {
    if (!disponivel()) return notSupported(false);
    return ScreenTime.startMonitor(token, apiUrl);
  },

  stopMonitor(): Promise<boolean> {
    if (!disponivel()) return notSupported(false);
    return ScreenTime.stopMonitor();
  },

  getItem(key: string): Promise<string | null> {
    if (!disponivel()) return notSupported(webStorage?.getItem(key) ?? null);
    return ScreenTime.getItem(key);
  },

  setItem(key: string, value: string): Promise<boolean> {
    if (!disponivel()) {
      webStorage?.setItem(key, value);
      return notSupported(true);
    }
    return ScreenTime.setItem(key, value);
  },

  removeItem(key: string): Promise<boolean> {
    if (!disponivel()) {
      webStorage?.removeItem(key);
      return notSupported(true);
    }
    return ScreenTime.removeItem(key);
  },
};
