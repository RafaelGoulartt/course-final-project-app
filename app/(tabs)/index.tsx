import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TempoUsoPayload = {
  token: string;
  dados: {
    package_name: string;
    tempo_minutos: number;
    data_uso: string;
  }[];
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createAutomaticPayload(token: string): TempoUsoPayload {
  const dataUso = getToday();
  return {
    token,
    dados: [
      { package_name: 'com.whatsapp', tempo_minutos: 42, data_uso: dataUso },
      { package_name: 'com.google.android.youtube', tempo_minutos: 58, data_uso: dataUso },
      { package_name: 'com.roblox.client', tempo_minutos: 35, data_uso: dataUso },
    ],
  };
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api');

export default function LoginTokenScreen() {
  const [token, setToken] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');

  async function enviarAutomatico(tokenValue: string) {
    const payload = createAutomaticPayload(tokenValue);

    const response = await fetch(`${API_BASE_URL}/dashboard/tempo-uso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Falha ao enviar dados automaticamente.');
    }

    return data;
  }

  async function handleEntrar() {
    const tokenNormalizado = token.trim();

    if (!tokenNormalizado) {
      Alert.alert('Token obrigatorio', 'Informe o token gerado no dashboard do pai.');
      return;
    }

    setLoading(true);
    setLastResponse('');

    try {
      const data = await enviarAutomatico(tokenNormalizado);
      setIsLogged(true);
      setLastResponse(data?.message || 'Dados enviados com sucesso.');
      setLastSyncAt(new Date().toLocaleString('pt-BR'));
      Alert.alert('Login realizado', 'Token valido. Dados enviados automaticamente.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar token.';
      setIsLogged(false);
      setLastResponse(message);
      Alert.alert('Falha no login', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSincronizarAgora() {
    const tokenNormalizado = token.trim();
    if (!tokenNormalizado) return;

    setLoading(true);

    try {
      const data = await enviarAutomatico(tokenNormalizado);
      setLastResponse(data?.message || 'Dados enviados com sucesso.');
      setLastSyncAt(new Date().toLocaleString('pt-BR'));
      Alert.alert('Sucesso', 'Nova sincronizacao enviada para a API.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar.';
      setLastResponse(message);
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  }

  function handleSair() {
    setIsLogged(false);
    setToken('');
    setLastResponse('');
    setLastSyncAt('');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.bgBlobLeft} />
      <View style={styles.bgBlobRight} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.heroTag}>Acesso da familia</Text>
          <Text style={styles.heroTitle}>Entrar com token</Text>
          <Text style={styles.heroText}>
            Use o token gerado pelo responsavel no dashboard web. Ao entrar, o envio para a API acontece automaticamente.
          </Text>
        </View>

        {!isLogged ? (
          <View style={styles.card}>
            <Text style={styles.label}>Token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Cole o token aqui"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Pressable onPress={handleEntrar} disabled={loading} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{loading ? 'Entrando...' : 'Entrar e sincronizar'}</Text>
            </Pressable>

            <Text style={styles.helper}>Fluxo: valida token e envia dados de uso automaticamente.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.okTitle}>Conectado com sucesso</Text>
            <Text style={styles.infoText}>Ultima sincronizacao: {lastSyncAt || '-'}</Text>

            <View style={styles.actionsRow}>
              <Pressable onPress={handleSincronizarAgora} disabled={loading} style={[styles.primaryButton, styles.actionButton]}>
                <Text style={styles.primaryButtonText}>{loading ? 'Sincronizando...' : 'Sincronizar agora'}</Text>
              </Pressable>
              <Pressable onPress={handleSair} style={[styles.ghostButton, styles.actionButton]}>
                <Text style={styles.ghostButtonText}>Sair</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>API base</Text>
          <Text style={styles.mono}>{API_BASE_URL}</Text>

          <Text style={[styles.label, { marginTop: 10 }]}>Ultima resposta</Text>
          <Text style={styles.response}>{lastResponse || 'Nenhuma tentativa ainda.'}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  bgBlobLeft: {
    position: 'absolute',
    left: -80,
    top: 0,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.2)',
  },
  bgBlobRight: {
    position: 'absolute',
    right: -100,
    top: 100,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 14,
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
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#e2e8f0',
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#082f49',
    fontWeight: '800',
    fontSize: 14,
  },
  helper: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
  },
  okTitle: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '800',
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 3,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
  ghostButton: {
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#e2e8f0',
    fontSize: 12,
  },
  response: {
    color: '#e2e8f0',
    fontSize: 14,
  },
});
