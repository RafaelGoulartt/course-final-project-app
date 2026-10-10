import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MensagemPais } from '@/services/device-api';
import { formatarHora } from '@/utils/periodo';

type Props = {
  /** Mensagem mostrada agora (a mais antiga ainda não lida), ou null para esconder. */
  mensagem: MensagemPais | null;
  restantes: number;
  onEntendi: () => void;
};

export function ParentMessageModal({ mensagem, restantes, onEntendi }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];

  return (
    <Modal transparent animationType="fade" visible={mensagem !== null} onRequestClose={onEntendi}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.iconBox}>
            <IconSymbol name="message.fill" size={22} color={c.onAccent} />
          </View>
          <Text style={styles.title}>Mensagem dos seus responsáveis</Text>
          {mensagem && <Text style={styles.time}>Enviada às {formatarHora(mensagem.criada_em)}</Text>}
          <View style={styles.bubble}>
            <Text style={styles.text}>{mensagem?.texto}</Text>
          </View>
          <Pressable onPress={onEntendi} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>{restantes > 0 ? `Ok, entendi (mais ${restantes})` : 'Ok, entendi'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    box: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 20,
      width: '100%',
      maxWidth: MaxContentWidth,
      gap: 10,
      alignItems: 'center',
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: Radius.control,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    time: { color: c.textMuted, fontSize: 12 },
    bubble: {
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 16,
      marginVertical: 4,
    },
    text: { color: c.text, fontSize: 17, lineHeight: 24, textAlign: 'center' },
    button: {
      alignSelf: 'stretch',
      backgroundColor: c.accent,
      borderRadius: Radius.control,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonPressed: { backgroundColor: c.accentPressed },
    buttonText: { color: c.onAccent, fontWeight: '800', fontSize: 15 },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};
