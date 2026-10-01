import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '../constants/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getEasProjectId() {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || Constants.easConfig?.projectId
    || Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerPushDevice(connectionToken: string) {
  if (Platform.OS === 'web') throw new Error('Notificacoes push estao disponiveis somente no app nativo.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Mensagens do painel',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#06b6d4',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Permissao de notificacoes nao concedida.');

  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error('Projeto EAS nao configurado. Defina EXPO_PUBLIC_EAS_PROJECT_ID antes de gerar a build.');
  }

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const response = await fetch(`${getApiBaseUrl()}/dashboard/notificacoes/registrar-dispositivo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: connectionToken, expo_push_token: expoPushToken }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.detail || result?.message || 'Falha ao registrar notificacoes push.');
  }
}

export async function showLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });
}