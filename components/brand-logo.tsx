import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand } from '@/constants/brand';
import { Colors, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Logo flat (ícone em caixa azul sólida) + nome e slogan do projeto. */
export function BrandLogo({ showTagline = true }: { showTagline?: boolean }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];

  return (
    <View style={styles.root} accessibilityRole="header">
      <View style={styles.mark}>
        <IconSymbol name="hourglass" size={32} color={c.onAccent} />
      </View>
      <Text style={styles.name}>{Brand.name}</Text>
      {showTagline && <Text style={styles.tagline}>{Brand.tagline}</Text>}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      gap: 6,
    },
    mark: {
      width: 64,
      height: 64,
      borderRadius: Radius.card,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    name: {
      color: c.text,
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.8,
    },
    tagline: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};
