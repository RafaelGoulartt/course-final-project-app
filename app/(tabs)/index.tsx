import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenTime, { AppUsage } from '../../modules/screenTime';

type TempoUsoPayload = {
  token: string;
  dados: AppUsage[];
  dispositivo_id: string;
  nome_filho: string;
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://course-final-project-eta.vercel.app/api';

async function coletarDadosReais(): Promise<AppUsage[]> {
  const temPermissao = await ScreenTime.hasPermission();

  if (!temPermissao) {
    return [];
  }

  const dados = await ScreenTime.getUsageStats(1);
  return dados;
}

async function enviarDados(payload: TempoUsoPayload) {
  const response = await fetch(`${API_BASE_URL}/dashboard/tempo-uso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Falha ao enviar dados.');
  }

  return data;
}

export default function LoginTokenScreen() {
  const [token, setToken] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [temPermissao, setTemPermissao] = useState<boolean | null>(null);
  const [appsColetados, setAppsColetados] = useState(0);
  const [modalPermissao, setModalPermissao] = useState(false);
  const [proximaSync, setProximaSync] = useState('');
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef('');

  useEffect(() => {
    ScreenTime.hasPermission().then(setTemPermissao);
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (isLogged) {
      const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

      const calcularProxima = () => {
        const proxima = new Date(Date.now() + INTERVAL_MS);
        setProximaSync(proxima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      };

      calcularProxima();

      syncIntervalRef.current = setInterval(async () => {
        const t = tokenRef.current.trim();
        if (!t) return;
        try {
          const data = await sincronizar(t);
          setLastResponse(data?.message || 'Sincronizado automaticamente.');
          setLastSyncAt(new Date().toLocaleString('pt-BR'));
          calcularProxima();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro na sync automática.';
          setLastResponse(message);
        }
      }, INTERVAL_MS);
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      setProximaSync('');
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isLogged]);

  async function handleSolicitarPermissao() {
    setModalPermissao(true);
  }

  async function handleConfirmarPermissao() {
    setModalPermissao(false);
    await ScreenTime.requestPermission();
    setTimeout(async () => {
      const ok = await ScreenTime.hasPermission();
      setTemPermissao(ok);
      if (ok) Alert.alert('Pronto!', 'Permissao concedida com sucesso.');
    }, 2000);
  }

  async function sincronizar(tokenValue: string) {
    let dados = await coletarDadosReais();

    if (dados.length === 0) {
      dados = [{ package_name: 'sem.dados', tempo_minutos: 0, data_uso: getToday() }];
    }

    setAppsColetados(dados.length);

    const payload: TempoUsoPayload = {
      token: tokenValue,
      dados,
      dispositivo_id: 'app-mobile-android',
      nome_filho: 'Meu celular',
    };

    const result = await enviarDados(payload);
    return result;
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
      const data = await sincronizar(tokenNormalizado);
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
      const data = await sincronizar(tokenNormalizado);
      setLastResponse(data?.message || 'Dados enviados com sucesso.');
      setLastSyncAt(new Date().toLocaleString('pt-BR'));
      Alert.alert('Sucesso', 'Nova sincronizacao enviada.');
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
    setAppsColetados(0);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <Modal transparent animationType="fade" visible={modalPermissao} onRequestClose={() => setModalPermissao(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>🔒</Text>
            <Text style={styles.modalTitle}>Permissao necessaria</Text>
            <Text style={styles.modalSubtitle}>Siga os passos abaixo para liberar o acesso:</Text>
            {['Toque em "Ir para Configuracoes"', 'Encontre "App-Tcc" na lista', 'Toque nele e ligue a chave', 'Volte para o app'].map((step, i) => (
              <View key={i} style={styles.modalStep}>
                <View style={styles.modalStepBadge}><Text style={styles.modalStepNum}>{i + 1}</Text></View>
                <Text style={styles.modalStepText}>{step}</Text>
              </View>
            ))}
            <Pressable onPress={handleConfirmarPermissao} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Ir para Configuracoes</Text>
            </Pressable>
            <Pressable onPress={() => setModalPermissao(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

        {/* Banner de permissao */}
        {Platform.OS === 'android' && temPermissao === false && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Permissao necessaria</Text>
            <Text style={styles.warningText}>
              Para coletar o tempo de uso real de cada app, autorize o acesso nas configuracoes do celular.
            </Text>
            <Pressable onPress={handleSolicitarPermissao} style={styles.warningButton}>
              <Text style={styles.warningButtonText}>Conceder permissao</Text>
            </Pressable>
          </View>
        )}

        {Platform.OS === 'android' && temPermissao === true && (
          <View style={styles.okPermissionCard}>
            <Text style={styles.okPermissionText}>Permissao de uso concedida</Text>
          </View>
        )}

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

            <Text style={styles.helper}>
              {temPermissao
                ? 'Dados reais de uso serao coletados e enviados.'
                : 'Conceda a permissao para coletar dados reais de uso.'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.okTitle}>Conectado com sucesso</Text>
            <Text style={styles.infoText}>Ultima sincronizacao: {lastSyncAt || '-'}</Text>
            {proximaSync !== '' && (
              <Text style={styles.infoText}>Proxima sync automatica: {proximaSync}</Text>
            )}
            {appsColetados > 0 && (
              <Text style={styles.infoText}>{appsColetados} app(s) coletados</Text>
            )}

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
  warningCard: {
    borderWidth: 1,
    borderColor: '#854d0e',
    backgroundColor: 'rgba(120,53,15,0.3)',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  warningTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
  },
  warningText: {
    color: '#fde68a',
    fontSize: 13,
    lineHeight: 18,
  },
  warningButton: {
    marginTop: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#1c1917',
    fontWeight: '800',
    fontSize: 13,
  },
  okPermissionCard: {
    borderWidth: 1,
    borderColor: '#166534',
    backgroundColor: 'rgba(20,83,45,0.3)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  okPermissionText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    gap: 10,
  },
  modalIcon: {
    fontSize: 36,
    textAlign: 'center',
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 10,
  },
  modalStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStepNum: {
    color: '#082f49',
    fontWeight: '900',
    fontSize: 13,
  },
  modalStepText: {
    color: '#e2e8f0',
    fontSize: 13,
    flex: 1,
  },
  modalButton: {
    marginTop: 8,
    backgroundColor: '#06b6d4',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#082f49',
    fontWeight: '900',
    fontSize: 15,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 13,
  },
  evidenceTitle: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  evidenceSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 6,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 5,
  },
  appName: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  appTime: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  payloadScroll: {
    marginTop: 6,
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 8,
    maxHeight: 220,
  },
  payloadText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
