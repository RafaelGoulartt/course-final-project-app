// Datas no formato YYYY-MM-DD, sempre no fuso do celular.
// Os nomes são escritos à mão para não depender do suporte a Intl de cada Android.

import type { Periodo, Resumo } from '@/services/device-api';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
];

function toIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hojeIso() {
  return toIso(new Date());
}

export function addDias(iso: string, dias: number) {
  const date = fromIso(iso);
  date.setDate(date.getDate() + dias);
  return toIso(date);
}

export function diferencaEmDias(de: string, ate: string) {
  return Math.round((fromIso(ate).getTime() - fromIso(de).getTime()) / 86400000);
}

export function moverPeriodo(periodo: Periodo, iso: string, direcao: 1 | -1) {
  if (periodo === 'dia') return addDias(iso, direcao);
  if (periodo === 'semana') return addDias(iso, 7 * direcao);
  const date = fromIso(iso);
  return toIso(new Date(date.getFullYear(), date.getMonth() + direcao, 1));
}

export function diaMes(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function diaDaSemanaCurto(iso: string) {
  return DIAS_SEMANA[fromIso(iso).getDay()];
}

export function rotuloPeriodo(periodo: Resumo['periodo']) {
  if (!periodo) return '';
  const { tipo, inicio, fim } = periodo;
  const hoje = hojeIso();

  if (tipo === 'dia') {
    if (inicio === hoje) return 'Hoje';
    if (inicio === addDias(hoje, -1)) return 'Ontem';
    return `${diaDaSemanaCurto(inicio)}, ${diaMes(inicio)}`;
  }
  if (tipo === 'semana') return `${diaMes(inicio)} a ${diaMes(addDias(fim, -1))}`;
  const date = fromIso(inicio);
  const mes = MESES[date.getMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${date.getFullYear()}`;
}

export function periodoIncluiHoje(periodo: Resumo['periodo']) {
  if (!periodo) return true;
  const hoje = hojeIso();
  return periodo.inicio <= hoje && hoje < periodo.fim;
}

/** Dias do período que já passaram (até hoje), para a média diária. */
export function diasDecorridos(periodo: Resumo['periodo']) {
  if (!periodo) return 1;
  const hoje = hojeIso();
  const fim = hoje < periodo.fim ? addDias(hoje, 1) : periodo.fim;
  return Math.max(1, diferencaEmDias(periodo.inicio, fim));
}

export function formatarMinutos(minutos: number) {
  const total = Math.round(Number(minutos) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatarHora(iso: string) {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return toIso(date) === hojeIso() ? `${hh}:${mm}` : `${diaMes(toIso(date))} ${hh}:${mm}`;
}
