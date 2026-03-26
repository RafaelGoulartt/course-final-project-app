import { Platform, StyleSheet, Text, View } from 'react-native';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api');

export default function AjudaScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>Configuracao</Text>
        <Text style={styles.heroTitle}>Ajuda de conexao</Text>
        <Text style={styles.heroText}>Use esta aba para ajustar a URL da API e validar a comunicacao com o backend.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>URL atual</Text>
        <Text style={styles.mono}>{API_BASE_URL}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Android Emulator</Text>
        <Text style={styles.cardText}>http://10.0.2.2:3001/api</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>iOS Simulator</Text>
        <Text style={styles.cardText}>http://localhost:3001/api</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Celular fisico</Text>
        <Text style={styles.cardText}>http://SEU_IP_LOCAL:3001/api</Text>
        <Text style={styles.helper}>Dica: use EXPO_PUBLIC_API_BASE_URL para configurar sem editar codigo.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 24,
    padding: 18,
  },
  heroTag: {
    color: '#67e8f9',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 6,
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#e2e8f0',
    fontSize: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  cardText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  helper: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
});
