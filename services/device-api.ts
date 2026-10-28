import { API_BASE_URL } from '@/constants/api';
import ScreenTime, { type AppUsage } from '@/modules/screenTime';

export type Periodo = 'dia' | 'semana' | 'mes';

export type TempoPorApp = { app_id: number; nome: string; package_name: string; total: number };
export type TempoPorDia = { data_uso: string; total: number };
export type SuspensaoAtiva = { id?: number; nome: string; package_name: string; fim: string | null };
export type MensagemPais = { id: number; texto: string; criada_em: string };

export type Resumo = {
  hasData: boolean;
  filho?: { id: number; nome: string };
  periodo: { tipo: Periodo; dataRef: string; inicio: string; fim: string } | null;
  tempoPorApp: TempoPorApp[];
  tempoPorDia: TempoPorDia[];
  suspensoes: SuspensaoAtiva[];
};

export type Estado = { mensagens: MensagemPais[]; suspensoes: SuspensaoAtiva[] };

/** Mesma chave lida pelo MonitorService (ScreenTimeModule.KEY_DISPOSITIVO_ID). */
const CHAVE_DISPOSITIVO_ID = 'dispositivoId';

// Identificador deste celular, criado uma vez e guardado. Vai para filhos.dispositivo_id.
async function obterDispositivoId() {
  const salvo = await ScreenTime.getItem(CHAVE_DISPOSITIVO_ID);
  if (salvo) return salvo;
  const novo = `android-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await ScreenTime.setItem(CHAVE_DISPOSITIVO_ID, novo);
  return novo;
}

// O código de conexão vai no cabeçalho Authorization, nunca na URL (a URL aparece nos logs do servidor).
async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail ? ` (${data.detail})` : '';
    const erro = new Error((data?.message || 'Falha ao falar com o servidor.') + detail) as Error & { status?: number };
    erro.status = response.status;
    throw erro;
  }
  return data as T;
}

export async function enviarTempoUso(token: string, dados: AppUsage[]) {
  return request<{ message?: string }>('/dashboard/tempo-uso', token, {
    method: 'POST',
    body: JSON.stringify({ dados, dispositivo_id: await obterDispositivoId() }),
  });
}

export function carregarResumo(token: string, periodo: Periodo, data: string) {
  return request<Resumo>(`/dashboard/dispositivo/resumo?periodo=${periodo}&data=${data}`, token);
}

export function carregarEstado(token: string) {
  return request<Estado>('/dashboard/dispositivo/estado', token);
}

export function marcarMensagemLida(token: string, mensagemId: number) {
  return request<{ ok: boolean }>(`/dashboard/dispositivo/mensagens/${mensagemId}/lida`, token, { method: 'POST' });
}
