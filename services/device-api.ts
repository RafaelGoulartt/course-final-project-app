import { API_BASE_URL } from '@/constants/api';
import type { AppUsage } from '@/modules/screenTime';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
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

export function enviarTempoUso(token: string, dados: AppUsage[]) {
  return request<{ message?: string }>('/dashboard/tempo-uso', {
    method: 'POST',
    body: JSON.stringify({
      token,
      dados,
      dispositivo_id: 'app-mobile-android',
      nome_filho: 'Meu celular',
    }),
  });
}

export function carregarResumo(token: string, periodo: Periodo, data: string) {
  const query = `token=${encodeURIComponent(token)}&periodo=${periodo}&data=${data}`;
  return request<Resumo>(`/dashboard/dispositivo/resumo?${query}`);
}

export function carregarEstado(token: string) {
  return request<Estado>(`/dashboard/dispositivo/estado?token=${encodeURIComponent(token)}`);
}

export function marcarMensagemLida(token: string, mensagemId: number) {
  return request<{ ok: boolean }>(`/dashboard/dispositivo/mensagens/${mensagemId}/lida`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
