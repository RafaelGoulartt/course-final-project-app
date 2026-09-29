import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
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

import { BrandLogo } from '@/components/brand-logo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, NoWebFocusRing, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
    const detail = data?.detail ? ` (${data.detail})` : '';
    throw new Error((data?.message || 'Falha ao enviar dados.') + detail);
  }

  return data;
}

export default function LoginTokenScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];
  const [tokenFocused, setTokenFocused] = useState(false);
  const [token, setToken] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [temPermissao, setTemPermissao] = useState<boolean | null>(null);
  const [appsColetados, setAppsColetados] = useState(0);
  // Modal de permissão: aberto ao tentar entrar sem permissão, ou pelo link discreto.
  const [modalPermissao, setModalPermissao] = useState<'entrar' | 'link' | null>(null);
  const [permissaoAdiada, setPermissaoAdiada] = useState(false);
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

  // Rechecar a permissão quando o usuário volta das configurações do sistema.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ScreenTime.hasPermission().then(setTemPermissao);
    });
    return () => sub.remove();
  }, []);

  const precisaPermissao = Platform.OS === 'android' && temPermissao === false;

  async function handleConfirmarPermissao() {
    setModalPermissao(null);
    await ScreenTime.requestPermission();
  }

  function handleAgoraNao() {
    const origem = modalPermissao;
    setModalPermissao(null);
    if (origem === 'entrar') {
      setPermissaoAdiada(true);
      entrar();
    }
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

  function handleEntrar() {
    if (!token.trim()) {
      Alert.alert('Token obrigatorio', 'Informe o token gerado no dashboard do pai.');
      return;
    }

    // Sem permissão, explica e oferece liberar antes de entrar (uma vez).
    if (precisaPermissao && !permissaoAdiada) {
      setModalPermissao('entrar');
      return;
    }

    entrar();
  }

  async function entrar() {
    const tokenNormalizado = token.trim();

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

  const avisoPermissao = precisaPermissao && (
    <Pressable
      onPress={() => setModalPermissao('link')}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [styles.permissionLink, pressed && styles.pressedText]}>
      <IconSymbol name="lock.fill" size={14} color={c.textMuted} />
      <Text style={styles.permissionLinkText}>
        Permissao de uso pendente · <Text style={styles.linkText}>Conceder</Text>
      </Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <Modal transparent animationType="fade" visible={modalPermissao !== null} onRequestClose={() => setModalPermissao(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.iconBox}>
              <IconSymbol name="lock.fill" size={20} color={c.accent} />
            </View>
            <Text style={styles.modalTitle}>Permitir acesso ao uso</Text>
            <Text style={styles.modalSubtitle}>
              Para enviar o tempo de uso de cada app, libere o acesso nas configuracoes:
            </Text>
            {['Toque em "Ir para Configuracoes"', 'Encontre "App-Tcc" na lista', 'Toque nele e ligue a chave', 'Volte para o app'].map((step, i) => (
              <View key={i} style={styles.modalStep}>
                <View style={styles.modalStepBadge}><Text style={styles.modalStepNum}>{i + 1}</Text></View>
                <Text style={styles.modalStepText}>{step}</Text>
              </View>
            ))}
            <Pressable
              onPress={handleConfirmarPermissao}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>Ir para Configuracoes</Text>
            </Pressable>
            <Pressable
              onPress={handleAgoraNao}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}>
              <Text style={styles.outlineButtonText}>
                {modalPermissao === 'entrar' ? 'Agora nao, entrar mesmo assim' : 'Agora nao'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLogo showTagline={false} />

        {!isLogged ? (
          <View style={styles.form}>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Cole o token aqui"
              placeholderTextColor={c.textMuted}
              accessibilityLabel="Token"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleEntrar}
              onFocus={() => setTokenFocused(true)}
              onBlur={() => setTokenFocused(false)}
              style={[styles.input, tokenFocused && styles.inputFocused]}
            />

            <Pressable
              onPress={handleEntrar}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                loading && styles.buttonDisabled,
              ]}>
              <Text style={styles.primaryButtonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
            </Pressable>

            {avisoPermissao}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.statusRowInline}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={c.success} />
              <Text style={styles.okTitle}>Conectado com sucesso</Text>
            </View>
            <Text style={styles.infoText}>Ultima sincronizacao: {lastSyncAt || '-'}</Text>
            {proximaSync !== '' && (
              <Text style={styles.infoText}>Proxima sync automatica: {proximaSync}</Text>
            )}
            {appsColetados > 0 && (
              <Text style={styles.infoText}>{appsColetados} app(s) coletados</Text>
            )}
            {lastResponse !== '' && <Text style={styles.infoText}>{lastResponse}</Text>}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleSincronizarAgora}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.actionButton,
                  pressed && styles.primaryButtonPressed,
                  loading && styles.buttonDisabled,
                ]}>
                <Text style={styles.primaryButtonText}>{loading ? 'Sincronizando...' : 'Sincronizar agora'}</Text>
              </Pressable>
              <Pressable
                onPress={handleSair}
                style={({ pressed }) => [styles.outlineButton, styles.actionButton, pressed && styles.outlineButtonPressed]}>
                <Text style={styles.outlineButtonText}>Sair</Text>
              </Pressable>
            </View>

            {avisoPermissao}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
      gap: 32,
    },
    form: {
      gap: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 16,
      gap: 8,
    },
    statusRowInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    okTitle: {
      color: c.success,
      fontSize: 16,
      fontWeight: '800',
    },
    infoText: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 3,
    },
    input: {
      borderWidth: 1,
      borderColor: c.borderStrong,
      ...NoWebFocusRing,
      backgroundColor: c.background,
      borderRadius: Radius.control,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: c.text,
      fontSize: 15,
    },
    inputFocused: {
      borderColor: c.accent,
    },
    primaryButton: {
      backgroundColor: c.accent,
      borderRadius: Radius.control,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    primaryButtonPressed: {
      backgroundColor: c.accentPressed,
    },
    primaryButtonText: {
      color: c.onAccent,
      fontWeight: '800',
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.control,
      paddingVertical: 13,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    outlineButtonPressed: {
      borderColor: c.borderStrong,
    },
    outlineButtonText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    actionsRow: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionButton: {
      flexGrow: 1,
      flexBasis: 140,
    },
    permissionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
    },
    permissionLinkText: {
      color: c.textMuted,
      fontSize: 13,
    },
    linkText: {
      color: c.accent,
      fontWeight: '700',
    },
    pressedText: {
      opacity: 0.6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    modalBox: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 20,
      width: '100%',
      maxWidth: MaxContentWidth,
      gap: 10,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: Radius.control,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    modalTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    modalSubtitle: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 4,
    },
    modalStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.control,
      padding: 10,
    },
    modalStepBadge: {
      width: 28,
      height: 28,
      borderRadius: Radius.control,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalStepNum: {
      color: c.onAccent,
      fontWeight: '800',
      fontSize: 13,
    },
    modalStepText: {
      color: c.text,
      fontSize: 13,
      flex: 1,
    },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};
