import { Stack } from 'expo-router';
import React from 'react';

// Sem barra de abas: o app abre direto na tela de login (index).
export default function TabLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
