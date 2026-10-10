import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { HomeDashboard, type PermissaoPendente } from '@/components/home-dashboard';
import { ParentMessageModal } from '@/components/parent-message-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_BASE_URL } from '@/constants/api';
import { Colors, MaxContentWidth, NoWebFocusRing, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ScreenTime, { AppUsage } from '@/modules/screenTime';
import {
  carregarEstado,
  enviarTempoUso,
  marcarMensagemLida,
  type MensagemPais,
} from '@/services/device-api';
import { diferencaEmDias, hojeIso } from '@/utils/periodo';

const CHAVE_TOKEN = 'token';
const CHAVE_ULTIMA_SYNC_DATA = 'ultimaSyncData';
const CHAVE_ULTIMA_SYNC_TEXTO = 'ultimaSyncTexto';
const INTERVALO_SYNC_MS = 60 * 60 * 1000; // 1 hora
const INTERVALO_MENSAGENS_MS = 60 * 1000; // 1 minuto

const PERMISSAO_NOTIFICACAO = 'android.permission.POST_NOTIFICATIONS' as const;
const precisaPedirNotificacao = Platform.OS === 'android' && Number(Platform.Version) >= 33;

/**
 * Na primeira sincronização manda só o dia de hoje (00:00 até agora).
 * Nas seguintes, manda desde o dia da última sincronização, para não perder o uso do fim da noite.
 */
async function coletarDadosReais(): Promise<AppUsage[]> {
  if (!(await ScreenTime.hasPermission())) return [];
  const ultima = await ScreenTime.getItem(CHAVE_ULTIMA_SYNC_DATA);
  const dias = ultima ? Math.min(7, Math.max(1, diferencaEmDias(ultima, hojeIso()) + 1)) : 1;
  return ScreenTime.getUsageStats(dias);
}

function agoraTexto() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LoginTokenScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];
  const [tokenFocused, setTokenFocused] = useState(false);
  const [token, setToken] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [restaurando, setRestaurando] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusSync, setStatusSync] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [versaoDados, setVersaoDados] = useState(0);
  const [temPermissao, setTemPermissao] = useState<boolean | null>(null);
  const [temSobreposicao, setTemSobreposicao] = useState(true);
  const [temNotificacao, setTemNotificacao] = useState(true);
  const [mensagens, setMensagens] = useState<MensagemPais[]>([]);
  // Modal de permissão: aberto ao tentar entrar sem permissão, ou pelo link discreto.
  const [modalPermissao, setModalPermissao] = useState<'entrar' | 'link' | null>(null);
  const [permissaoAdiada, setPermissaoAdiada] = useState(false);
  const tokenRef = useRef('');

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const verificarPermissoes = useCallback(async () => {
    setTemPermissao(await ScreenTime.hasPermission());
    setTemSobreposicao(await ScreenTime.hasOverlayPermission());
    if (precisaPedirNotificacao) {
      setTemNotificacao(await PermissionsAndroid.check(PERMISSAO_NOTIFICACAO));
    }
  }, []);

  // Restaura o vínculo salvo: quem já entrou uma vez não precisa colar o token de novo.
  useEffect(() => {
    (async () => {
      await verificarPermissoes();
      const salvo = await ScreenTime.getItem(CHAVE_TOKEN);
      if (salvo) {
        setToken(salvo);
        setLastSyncAt((await ScreenTime.getItem(CHAVE_ULTIMA_SYNC_TEXTO)) ?? '');
        setIsLogged(true);
        ScreenTime.startMonitor(salvo, API_BASE_URL).catch(() => {});
        sincronizarEmSegundoPlano(salvo);
      }
      setRestaurando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronização automática a cada hora enquanto o app está aberto.
  useEffect(() => {
    if (!isLogged) return;
    const id = setInterval(() => {
      const t = tokenRef.current.trim();
      if (t) sincronizarEmSegundoPlano(t);
    }, INTERVALO_SYNC_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged]);

  // Mensagens dos pais: busca ao abrir o app e a cada minuto.
  const buscarMensagens = useCallback(async () => {
    const t = tokenRef.current.trim();
    if (!t) return;
    try {
      const estado = await carregarEstado(t);
      setMensagens(estado.mensagens);
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        setStatusSync('O código de conexão expirou. Peça um novo no site e vincule de novo.');
      }
    }
  }, []);

  useEffect(() => {
    if (!isLogged) return;
    buscarMensagens();
    const id = setInterval(buscarMensagens, INTERVALO_MENSAGENS_MS);
    return () => clearInterval(id);
  }, [isLogged, buscarMensagens]);

  // Ao voltar para o app (das configurações ou de uma notificação), atualiza permissões e mensagens.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      verificarPermissoes();
      buscarMensagens();
    });
    return () => sub.remove();
  }, [verificarPermissoes, buscarMensagens]);

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
      dados = [{ package_name: 'sem.dados', tempo_minutos: 0, data_uso: hojeIso() }];
    }

    const result = await enviarTempoUso(tokenValue, dados);

    const texto = agoraTexto();
    setLastSyncAt(texto);
    setStatusSync('');
    setVersaoDados((v) => v + 1);
    await ScreenTime.setItem(CHAVE_ULTIMA_SYNC_DATA, hojeIso());
    await ScreenTime.setItem(CHAVE_ULTIMA_SYNC_TEXTO, texto);
    return result;
  }

  async function sincronizarEmSegundoPlano(tokenValue: string) {
    setLoading(true);
    try {
      await sincronizar(tokenValue);
    } catch (error) {
      setStatusSync(error instanceof Error ? error.message : 'Erro ao sincronizar.');
    } finally {
      setLoading(false);
    }
  }

  async function pedirNotificacao() {
    if (!precisaPedirNotificacao) return;
    const resultado = await PermissionsAndroid.request(PERMISSAO_NOTIFICACAO);
    setTemNotificacao(resultado === PermissionsAndroid.RESULTS.GRANTED);
  }

  async function handleEntendiMensagem() {
    const [atual, ...resto] = mensagens;
    setMensagens(resto);
    if (atual) {
      marcarMensagemLida(tokenRef.current.trim(), atual.id).catch(() => {});
    }
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
    setStatusSync('');

    try {
      // Novo vínculo: a primeira sincronização manda só o dia de hoje.
      await ScreenTime.removeItem(CHAVE_ULTIMA_SYNC_DATA);
      await sincronizar(tokenNormalizado);
      await ScreenTime.setItem(CHAVE_TOKEN, tokenNormalizado);
      await ScreenTime.startMonitor(tokenNormalizado, API_BASE_URL).catch(() => {});
      setIsLogged(true);
      await pedirNotificacao();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar token.';
      setIsLogged(false);
      Alert.alert('Falha no login', message);
    } finally {
      setLoading(false);
    }
  }

  function handleSair() {
    Alert.alert(
      'Desvincular este celular?',
      'O tempo de uso deixa de ser enviado e as mensagens e bloqueios dos responsáveis param de funcionar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            await ScreenTime.stopMonitor();
            await ScreenTime.removeItem(CHAVE_TOKEN);
            await ScreenTime.removeItem(CHAVE_ULTIMA_SYNC_DATA);
            await ScreenTime.removeItem(CHAVE_ULTIMA_SYNC_TEXTO);
            setIsLogged(false);
            setToken('');
            setStatusSync('');
            setLastSyncAt('');
            setMensagens([]);
          },
        },
      ],
    );
  }

  const permissoesPendentes: PermissaoPendente[] = [
    temPermissao === false && {
      id: 'uso',
      titulo: 'Acesso ao uso',
      descricao: 'Para contar o tempo de cada app.',
      onConceder: () => ScreenTime.requestPermission(),
    },
    !temSobreposicao && {
      id: 'sobreposicao',
      titulo: 'Sobrepor a outros apps',
      descricao: 'Para mostrar o aviso quando um app for suspenso.',
      onConceder: () => ScreenTime.requestOverlayPermission(),
    },
    !temNotificacao && {
      id: 'notificacao',
      titulo: 'Notificações',
      descricao: 'Para avisar das mensagens dos responsáveis.',
      onConceder: pedirNotificacao,
    },
  ].filter(Boolean) as PermissaoPendente[];

  if (restaurando) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (isLogged) {
    return (
      <View style={styles.root}>
        <HomeDashboard
          token={token.trim()}
          versaoDados={versaoDados}
          ultimaSync={lastSyncAt}
          sincronizando={loading}
          statusSync={statusSync}
          permissoesPendentes={permissoesPendentes}
          onSincronizar={() => sincronizarEmSegundoPlano(token.trim())}
          onSair={handleSair}
        />
        <ParentMessageModal
          mensagem={mensagens[0] ?? null}
          restantes={Math.max(0, mensagens.length - 1)}
          onEntendi={handleEntendiMensagem}
        />
      </View>
    );
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
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      gap: 12,
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
