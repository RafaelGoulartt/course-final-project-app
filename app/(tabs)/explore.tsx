import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api');

export default function AjudaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>Configuracao</Text>
        </View>
        <Text style={styles.heroTitle}>Ajuda de conexao</Text>
        <Text style={styles.heroText}>Use esta aba para ajustar a URL da API e validar a comunicacao com o backend.</Text>
      </View>

      <View style={styles.highlightPanel}>
        <Text style={styles.highlightLabel}>URL atual</Text>
        <Text style={styles.highlightMono}>{API_BASE_URL}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.iconBox}>
          <IconSymbol name="desktopcomputer" size={20} color={c.accent} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Android Emulator</Text>
          <Text style={styles.cardText}>http://10.0.2.2:3001/api</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.iconBox}>
          <IconSymbol name="desktopcomputer" size={20} color={c.accent} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>iOS Simulator</Text>
          <Text style={styles.cardText}>http://localhost:3001/api</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.iconBox}>
          <IconSymbol name="iphone" size={20} color={c.accent} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Celular fisico</Text>
          <Text style={styles.cardText}>http://SEU_IP_LOCAL:3001/api</Text>
          <Text style={styles.helper}>Dica: use EXPO_PUBLIC_API_BASE_URL para configurar sem editar codigo.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      width: '100%',
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 40,
      gap: 14,
    },
    hero: {
      paddingVertical: 4,
      alignItems: 'flex-start',
    },
    eyebrow: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.control,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    eyebrowText: {
      color: c.accent,
      fontSize: 11,
      textTransform: 'uppercase',
      fontWeight: '800',
      letterSpacing: 1,
    },
    heroTitle: {
      color: c.text,
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 12,
    },
    heroText: {
      color: c.textMuted,
      fontSize: 14,
      marginTop: 8,
      lineHeight: 20,
    },
    highlightPanel: {
      backgroundColor: c.accent,
      borderRadius: Radius.card,
      padding: 16,
      gap: 6,
    },
    highlightLabel: {
      color: c.onAccent,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      opacity: 0.85,
    },
    highlightMono: {
      fontFamily: mono,
      color: c.onAccent,
      fontSize: 13,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 16,
    },
    cardBody: {
      flex: 1,
      gap: 4,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: Radius.control,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    cardText: {
      fontFamily: mono,
      color: c.textMuted,
      fontSize: 13,
    },
    helper: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};
