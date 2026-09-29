import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function buildNavigationTheme(base: Theme, c: (typeof Colors)['light']): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
      notification: c.accent,
    },
  };
}

const LightNavigationTheme = buildNavigationTheme(DefaultTheme, Colors.light);
const DarkNavigationTheme = buildNavigationTheme(DarkTheme, Colors.dark);

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkNavigationTheme : LightNavigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export const unstable_settings = {
  anchor: '(tabs)',
};
