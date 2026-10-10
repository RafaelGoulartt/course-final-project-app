import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Radius, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { carregarResumo, type Periodo, type Resumo } from '@/services/device-api';
import {
  PERIODOS,
  diaDaSemanaCurto,
  diaMes,
  diasDecorridos,
  formatarHora,
  formatarMinutos,
  hojeIso,
  moverPeriodo,
  periodoIncluiHoje,
  rotuloPeriodo,
} from '@/utils/periodo';

export type PermissaoPendente = {
  id: string;
  titulo: string;
  descricao: string;
  onConceder: () => void;
};

type Props = {
  token: string;
  /** Muda depois de cada sincronização, para recarregar os números. */
  versaoDados: number;
  ultimaSync: string;
  sincronizando: boolean;
  statusSync: string;
  permissoesPendentes: PermissaoPendente[];
  onSincronizar: () => void;
  onSair: () => void;
};

const MAX_APPS_LISTA = 8;

export function HomeDashboard({
  token,
  versaoDados,
  ultimaSync,
  sincronizando,
  statusSync,
  permissoesPendentes,
  onSincronizar,
  onSair,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const styles = themedStyles[scheme];

  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [dataRef, setDataRef] = useState(hojeIso);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setResumo(await carregarResumo(token, periodo, dataRef));
      setErro('');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar seus dados.');
    } finally {
      setCarregando(false);
    }
  }, [token, periodo, dataRef]);

  useEffect(() => {
    carregar();
  }, [carregar, versaoDados]);

  function trocarPeriodo(novo: Periodo) {
    setPeriodo(novo);
    setDataRef(hojeIso());
  }

  const info = resumo?.periodo ?? null;
  const tipo = info?.tipo ?? periodo;
  const apps = resumo?.tempoPorApp ?? [];
  const dias = resumo?.tempoPorDia ?? [];
  const total = apps.reduce((acc, app) => acc + Number(app.total), 0);
  const maisUsado = apps[0];
  const media =
    tipo === 'dia'
      ? Math.round(dias.reduce((acc, d) => acc + Number(d.total), 0) / Math.max(1, dias.length))
      : Math.round(total / diasDecorridos(info));
  const maiorApp = Math.max(1, ...apps.map((a) => Number(a.total)));
  const maiorDiaReal = Math.max(0, ...dias.map((d) => Number(d.total)));
  const maiorDia = Math.max(1, maiorDiaReal);
  const nomePeriodo = { dia: 'hoje', semana: 'nesta semana', mes: 'neste mês' }[tipo];
  const ehPeriodoAtual = periodoIncluiHoje(info);
  const textoPeriodo = ehPeriodoAtual ? nomePeriodo : 'no período';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onSincronizar} colors={[c.accent]} />}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Seu tempo de tela</Text>
          <Text style={styles.muted}>
            {sincronizando ? 'Sincronizando...' : `Última sincronização: ${ultimaSync || '—'}`}
          </Text>
        </View>
        <Pressable
          onPress={onSincronizar}
          disabled={sincronizando}
          accessibilityLabel="Sincronizar agora"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          {sincronizando ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : (
            <IconSymbol name="arrow.clockwise" size={20} color={c.accent} />
          )}
        </Pressable>
      </View>
      {statusSync !== '' && <Text style={styles.warning}>{statusSync}</Text>}

      {/* Permissões que faltam */}
      {permissoesPendentes.length > 0 && (
        <View style={[styles.card, styles.cardWarning]}>
          <View style={styles.row}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={c.warning} />
            <Text style={styles.cardTitle}>Falta liberar no celular</Text>
          </View>
          {permissoesPendentes.map((p) => (
            <View key={p.id} style={styles.permissionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{p.titulo}</Text>
                <Text style={styles.muted}>{p.descricao}</Text>
              </View>
              <Pressable
                onPress={p.onConceder}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                <Text style={styles.smallButtonText}>Liberar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Apps suspensos pelos pais */}
      {(resumo?.suspensoes?.length ?? 0) > 0 && (
        <View style={[styles.card, styles.cardDanger]}>
          <View style={styles.row}>
            <IconSymbol name="nosign" size={18} color={c.danger} />
            <Text style={styles.cardTitle}>Apps suspensos pelos seus responsáveis</Text>
          </View>
          {resumo!.suspensoes.map((s) => (
            <View key={s.package_name} style={styles.suspensaoRow}>
              <Text style={styles.itemTitle}>{s.nome}</Text>
              <Text style={styles.muted}>{s.fim ? `até ${formatarHora(s.fim)}` : 'até liberarem'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Seletor de período */}
      <View style={styles.segmented} accessibilityRole="tablist">
        {PERIODOS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => trocarPeriodo(p.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: periodo === p.id }}
            style={[styles.segment, periodo === p.id && styles.segmentActive]}>
            <Text style={[styles.segmentText, periodo === p.id && styles.segmentTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.periodNav}>
        <Pressable
          onPress={() => setDataRef(moverPeriodo(periodo, dataRef, -1))}
          accessibilityLabel="Período anterior"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <IconSymbol name="chevron.left" size={20} color={c.text} />
        </Pressable>
        <Text style={styles.periodLabel}>{rotuloPeriodo(info)}</Text>
        <Pressable
          onPress={() => setDataRef(moverPeriodo(periodo, dataRef, 1))}
          disabled={ehPeriodoAtual}
          accessibilityLabel="Próximo período"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, ehPeriodoAtual && styles.disabled, pressed && styles.pressed]}>
          <IconSymbol name="chevron.right" size={20} color={c.text} />
        </Pressable>
      </View>

      {erro !== '' && <Text style={styles.error}>{erro}</Text>}

      {carregando && !resumo ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={c.accent} />
      ) : (
        <View style={[styles.sections, carregando && styles.loadingFade]}>
          {/* Números principais */}
          <View style={styles.kpiGrid}>
            <Kpi styles={styles} label="Tempo de tela" valor={formatarMinutos(total)} sub={textoPeriodo} destaque />
            <Kpi
              styles={styles}
              label="Média por dia"
              valor={formatarMinutos(media)}
              sub={tipo === 'dia' ? 'últimos 7 dias' : textoPeriodo}
            />
            <Kpi styles={styles} label="Apps usados" valor={String(apps.length)} sub={textoPeriodo} />
            <Kpi
              styles={styles}
              label="Mais usado"
              valor={maisUsado?.nome ?? '—'}
              sub={maisUsado ? formatarMinutos(maisUsado.total) : 'sem uso'}
            />
          </View>

          {/* Apps mais usados */}
          <View style={styles.card}>
            <View style={styles.row}>
              <IconSymbol name="square.grid.2x2.fill" size={18} color={c.accent} />
              <Text style={styles.cardTitle}>Apps mais usados</Text>
            </View>
            {apps.length === 0 ? (
              <Text style={styles.muted}>Nenhum uso registrado {textoPeriodo}.</Text>
            ) : (
              apps.slice(0, MAX_APPS_LISTA).map((app) => {
                const pct = total > 0 ? Math.round((Number(app.total) / total) * 100) : 0;
                return (
                  <View key={app.app_id} style={styles.appRow}>
                    <View style={styles.appAvatar}>
                      <Text style={styles.appAvatarText}>{app.nome.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.appRowTop}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {app.nome}
                        </Text>
                        <Text style={styles.appTime}>{formatarMinutos(app.total)}</Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.bar, { width: `${(Number(app.total) / maiorApp) * 100}%` }]} />
                      </View>
                      <Text style={styles.mutedSmall}>{pct}% do tempo</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Uso por dia */}
          <View style={styles.card}>
            <View style={styles.row}>
              <IconSymbol name="chart.bar.fill" size={18} color={c.accent} />
              <Text style={styles.cardTitle}>Uso por dia</Text>
            </View>
            <Text style={styles.muted}>
              {tipo === 'dia' ? 'Últimos 7 dias' : `Maior dia: ${formatarMinutos(maiorDiaReal)}`}
            </Text>
            <View style={styles.chart}>
              {dias.map((d, i) => {
                const destaque = tipo !== 'dia' || d.data_uso === info?.inicio;
                const mostrarRotulo = tipo !== 'mes' || i % 5 === 0 || i === dias.length - 1;
                return (
                  <View key={d.data_uso} style={styles.chartCol}>
                    <View style={styles.chartBarArea}>
                      <View
                        style={[
                          styles.chartBar,
                          !destaque && styles.chartBarMuted,
                          { height: `${Math.max(Number(d.total) > 0 ? 3 : 0, (Number(d.total) / maiorDia) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel} numberOfLines={1}>
                      {mostrarRotulo ? (tipo === 'mes' ? String(Number(d.data_uso.slice(8))) : diaDaSemanaCurto(d.data_uso)) : ''}
                    </Text>
                    {tipo !== 'mes' && <Text style={styles.chartSubLabel}>{diaMes(d.data_uso)}</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      <Pressable onPress={onSair} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
        <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={c.text} />
        <Text style={styles.outlineButtonText}>Desvincular este celular</Text>
      </Pressable>
    </ScrollView>
  );
}

function Kpi({
  styles,
  label,
  valor,
  sub,
  destaque = false,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  valor: string;
  sub: string;
  destaque?: boolean;
}) {
  return (
    <View style={[styles.kpi, destaque && styles.kpiHighlight]}>
      <Text style={[styles.kpiLabel, destaque && styles.kpiTextHighlight]}>{label}</Text>
      <Text style={[styles.kpiValue, destaque && styles.kpiTextHighlight]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={[styles.mutedSmall, destaque && styles.kpiTextHighlight]}>{sub}</Text>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    content: {
      width: '100%',
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 40,
      gap: 12,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hello: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    muted: { color: c.textMuted, fontSize: 13 },
    mutedSmall: { color: c.textMuted, fontSize: 11 },
    warning: { color: c.warning, fontSize: 13 },
    error: { color: c.danger, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.3 },
    loadingFade: { opacity: 0.5 },
    sections: { gap: 12 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.control,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 16,
      gap: 10,
    },
    cardWarning: { borderColor: c.warning },
    cardDanger: { borderColor: c.danger },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
    itemTitle: { color: c.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    suspensaoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    smallButton: {
      backgroundColor: c.accent,
      borderRadius: Radius.control,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    smallButtonText: { color: c.onAccent, fontWeight: '800', fontSize: 13 },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.control,
      padding: 3,
      marginTop: 4,
    },
    segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: Radius.control - 2 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { color: c.textMuted, fontWeight: '700', fontSize: 14 },
    segmentTextActive: { color: c.onAccent },
    periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    periodLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    kpi: {
      flexBasis: '47%',
      flexGrow: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      padding: 14,
      gap: 2,
    },
    kpiHighlight: { backgroundColor: c.accent, borderColor: c.accent },
    kpiLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    kpiValue: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    kpiTextHighlight: { color: c.onAccent },
    appRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    appAvatar: {
      width: 36,
      height: 36,
      borderRadius: Radius.control,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appAvatarText: { color: c.accent, fontWeight: '800', fontSize: 16 },
    appRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    appTime: { color: c.text, fontSize: 13, fontWeight: '700' },
    track: { height: 6, borderRadius: Radius.full, backgroundColor: c.border, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: Radius.full, backgroundColor: c.accent },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 170, gap: 3, marginTop: 4 },
    chartCol: { flex: 1, alignItems: 'center', height: '100%' },
    chartBarArea: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    chartBar: { width: '80%', maxWidth: 28, backgroundColor: c.accent, borderRadius: 3 },
    chartBarMuted: { opacity: 0.35 },
    chartLabel: { color: c.textMuted, fontSize: 10, marginTop: 4 },
    chartSubLabel: { color: c.textMuted, fontSize: 9 },
    outlineButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.control,
      paddingVertical: 13,
      marginTop: 8,
    },
    outlineButtonText: { color: c.text, fontSize: 14, fontWeight: '700' },
  });
}

const themedStyles = {
  light: createStyles(Colors.light),
  dark: createStyles(Colors.dark),
};
