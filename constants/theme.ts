/**
 * Design system do app — mesma paleta do site (React web).
 * Paleta única: os temas claro e escuro apenas invertem fundo e texto.
 * O acento azul é o mesmo nos dois temas.
 */

import { Platform } from 'react-native';

const slate50 = '#F8FAFC';
const slate900 = '#0F172A';

export const Accent = '#3B82F6';
export const AccentPressed = '#2563EB';
export const OnAccent = '#FFFFFF';

export const Colors = {
  light: {
    text: slate900,
    background: slate50,
    tint: Accent,
    accent: Accent,
    accentPressed: AccentPressed,
    onAccent: OnAccent,
    textMuted: '#64748B',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    success: '#16A34A',
    danger: '#DC2626',
    overlay: 'rgba(15,23,42,0.6)',
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: Accent,
  },
  dark: {
    text: slate50,
    background: slate900,
    tint: Accent,
    accent: Accent,
    accentPressed: AccentPressed,
    onAccent: OnAccent,
    textMuted: '#94A3B8',
    border: '#1E293B',
    borderStrong: '#334155',
    success: '#22C55E',
    danger: '#EF4444',
    overlay: 'rgba(15,23,42,0.8)',
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: Accent,
  },
};

export type ThemeColors = (typeof Colors)['light'];

/** Raios de borda (flat design): nunca quadrado, nunca redondo demais. */
export const Radius = {
  control: 6, // botões, inputs, badges, ícones em caixinha
  card: 10, // cards, painéis, modais
  full: 999, // barras de progresso e spinners
};

/** Remove o anel de foco do navegador (web); o foco é indicado pela borda azul. */
export const NoWebFocusRing = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;

/** Largura máxima do conteúdo em telas grandes (tablets/web). */
export const MaxContentWidth = 480;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
