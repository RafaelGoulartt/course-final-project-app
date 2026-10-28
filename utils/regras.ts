// Regras definidas pelos responsáveis: limite diário por app e horários bloqueados.
// A mesma conta do horário é feita no MonitorService (Horario.fimSeAtivo), que é quem bloqueia.

import type { HorarioBloqueado } from '@/services/device-api';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** O horário vale agora? dias conta o dia em que o horário começa (0 = domingo). */
export function horarioAtivo(h: HorarioBloqueado, agora = new Date()) {
  const minuto = agora.getHours() * 60 + agora.getMinutes();
  const hoje = agora.getDay();
  const ontem = (hoje + 6) % 7;
  const inicio = minutosDe(h.inicio);
  const fim = minutosDe(h.fim);
  if (inicio < fim) return h.dias.includes(hoje) && minuto >= inicio && minuto < fim;
  return (h.dias.includes(hoje) && minuto >= inicio) || (h.dias.includes(ontem) && minuto < fim);
}

export function descreverDias(dias: number[]) {
  const chave = [...dias].sort().join();
  if (chave === '0,1,2,3,4,5,6') return 'todos os dias';
  if (chave === '1,2,3,4,5') return 'segunda a sexta';
  if (chave === '0,6') return 'fim de semana';
  return [...dias].sort().map((d) => DIAS_CURTOS[d]).join(', ');
}
