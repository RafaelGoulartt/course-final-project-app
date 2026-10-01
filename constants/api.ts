import { Platform } from 'react-native';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const defaultApiBaseUrl = Platform.select({
  android: 'http://10.205.251.243:3001/api',
  default: 'http://localhost:3001/api',
});

let apiBaseUrl = (configuredApiBaseUrl || defaultApiBaseUrl || '').replace(/\/$/, '');

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function setApiBaseUrl(value: string) {
  apiBaseUrl = value.trim().replace(/\/$/, '');
  return apiBaseUrl;
}
