import { useEffect, useState } from 'react';
import type { BtpScheduleRecord } from './btpScheduleService';

export interface BtpOperationalShipSnapshot extends BtpScheduleRecord {
  displayBerco: string;
  atracacaoDate?: string;
  atracacaoTime?: string;
  previsaoSaidaDate?: string;
  previsaoSaidaTime?: string;
  telemetry: {
    movimentosTotais?: number;
    movimentosConcluidos?: number;
    movimentosRestantes?: number;
  };
}

export interface SharedBtpScheduleState {
  records: BtpScheduleRecord[];
  lastUpdate: Date | null;
  loading: boolean;
  error: string | null;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let sharedState: SharedBtpScheduleState = {
  records: [],
  lastUpdate: null,
  loading: false,
  error: null,
};

let inflightPromise: Promise<BtpScheduleRecord[]> | null = null;
const listeners = new Set<(state: SharedBtpScheduleState) => void>();

function emit(next: SharedBtpScheduleState) {
  sharedState = next;
  listeners.forEach((listener) => listener(next));
}

export function getSharedBtpScheduleState(): SharedBtpScheduleState {
  return sharedState;
}

export function subscribeToBtpSchedule(listener: (state: SharedBtpScheduleState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasValue(value?: string): boolean {
  return Boolean((value || '').trim());
}

export function normalizeBercoLabel(value?: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const match = upper.match(/BTP\s*[- ]?([123])/);
  if (match) return `BTP ${match[1]}`;

  return raw;
}

export function getDisplayBerco(record: BtpScheduleRecord): string {
  return normalizeBercoLabel(record.pontoAtracacao) || normalizeBercoLabel(record.berco) || '-';
}

export function parsePortalDateTime(raw?: string): Date | null {
  const value = (raw || '').trim();
  if (!value) return null;

  const brWithTime = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (brWithTime) {
    const day = Number(brWithTime[1]);
    const month = Number(brWithTime[2]);
    const year = Number(brWithTime[3]);
    const hours = Number(brWithTime[4]);
    const minutes = Number(brWithTime[5]);
    const seconds = Number(brWithTime[6] || 0);
    return new Date(year, month - 1, day, hours, minutes, seconds, 0);
  }

  const brDateOnly = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDateOnly) {
    const day = Number(brDateOnly[1]);
    const month = Number(brDateOnly[2]);
    const year = Number(brDateOnly[3]);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  return null;
}

export function formatPortalDateTime(value?: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  const brWithTime = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (brWithTime) {
    return `${brWithTime[1]}/${brWithTime[2]}/${brWithTime[3]} ${brWithTime[4]}:${brWithTime[5]}`;
  }

  const isoWithTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoWithTime) {
    return `${isoWithTime[3]}/${isoWithTime[2]}/${isoWithTime[1]} ${isoWithTime[4]}:${isoWithTime[5]}`;
  }

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    return `${timeOnly[1].padStart(2, '0')}:${timeOnly[2]}`;
  }

  return trimmed;
}

export function getPortalStatusLabel(record: BtpScheduleRecord): string {
  const rawPortalStatus = (record.status || '').toLowerCase();
  const sourceText = [record.status, record.operacao, record.movimento, record.situacao]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const now = new Date();
  const hasExplicitPrevisto = rawPortalStatus.includes('previst') || sourceText.includes('previst');

  if (sourceText.includes('desatrac')) return 'Desatracado';
  if (hasValue(record.datasaida) || hasValue(record.horasaida)) return 'Desatracado';

  // Confirmação REAL de atracação (não estimativa) é o sinal mais confiável
  // que existe. Checar isso antes do ETB evita que um navio nunca-atracado
  // (ETB estimado que só ficou no passado) seja contado como atracado.
  const hasRealAtracacao = hasValue(record.dataatracacao) || hasValue(record.horaatracacao);

  if (hasRealAtracacao) {
    // Rede de segurança: se a saída PREVISTA já passou há bastante tempo e
    // não há dado de saída real (o que pode acontecer se o enriquecimento
    // via RAP falhar silenciosamente), é mais seguro considerar que o navio
    // já saiu do que deixá-lo acumular como "Atracado" indefinidamente —
    // já que o terminal tem só 3 berços, um navio "preso" na lista por bug
    // de dado ausente é pior do que um falso-negativo ocasional.
    const etdDate = parsePortalDateTime(record.etd) || parsePortalDateTime(record.saidaPrevista);
    const staleThresholdMs = 12 * 60 * 60 * 1000; // 12 horas
    if (etdDate && now.getTime() - etdDate.getTime() > staleThresholdMs) {
      return 'Desatracado';
    }
    return 'Atracado';
  }

  if (sourceText.includes('atracad')) return 'Atracado';
  if (hasExplicitPrevisto) return 'Previsto';
  if (sourceText.includes('barra') || sourceText.includes('fundeado')) return 'Na Barra';

  const etbDate = parsePortalDateTime(record.etb);
  if (etbDate && etbDate.getTime() <= now.getTime()) {
    // ETB estimado já passou, mas SEM confirmação real de atracação. Trata
    // como "Na Barra" (chegou/previsto, ainda não confirmadamente atracado)
    // em vez de "Atracado", para não inflar a contagem com estimativas.
    return 'Na Barra';
  }

  if (hasValue(record.datachegada) || hasValue(record.horachegada)) {
    return hasExplicitPrevisto ? 'Previsto' : 'Na Barra';
  }

  return 'Previsto';
}

export function getStatusClass(status: string): string {
  const key = status.toLowerCase();
  if (key.includes('desatracado')) return 'bg-green-200 text-green-900 border-green-400';
  if (key.includes('atracado')) return 'bg-orange-200 text-orange-900 border-orange-400';
  if (key.includes('na barra')) return 'bg-yellow-200 text-yellow-900 border-yellow-400';
  if (key.includes('previsto')) return 'bg-white text-slate-800 border-slate-400';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getPrevistoArrivalProgress(record: BtpScheduleRecord): number | null {
  const referenceDate = parsePortalDateTime(record.etb) || parsePortalDateTime(record.eta);
  if (!referenceDate) return null;

  const now = new Date();
  const remainingMs = referenceDate.getTime() - now.getTime();

  if (remainingMs <= 0) return 99;

  const horizonMs = 5 * 24 * 60 * 60 * 1000;
  const progress = ((horizonMs - remainingMs) / horizonMs) * 100;
  return Math.max(8, Math.min(99, Math.round(progress)));
}

export function getAtracadoRemainingProgress(record: BtpScheduleRecord): number | null {
  const endDate = parsePortalDateTime(record.etd);
  if (!endDate) return null;

  const startDate =
    parsePortalDateTime(`${record.dataatracacao || ''} ${record.horaatracacao || ''}`.trim()) ||
    parsePortalDateTime(record.etb);

  const now = new Date();

  if (startDate && endDate.getTime() > startDate.getTime()) {
    const totalMs = endDate.getTime() - startDate.getTime();
    const remainingMs = endDate.getTime() - now.getTime();

    if (remainingMs <= 0) return 0;
    if (remainingMs >= totalMs) return 100;

    return Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)));
  }

  const remainingMs = endDate.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  const horizonMs = 48 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, Math.round((remainingMs / horizonMs) * 100)));
}

function parseBrDateTime(dateValue?: string, timeValue?: string): number {
  if (!dateValue) return Number.MAX_SAFE_INTEGER;

  const cleanDate = dateValue.trim();
  const cleanTime = (timeValue || '').trim();

  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/;

  let year = 0;
  let month = 0;
  let day = 0;

  if (ddmmyyyy.test(cleanDate)) {
    const match = cleanDate.match(ddmmyyyy);
    if (!match) return Number.MAX_SAFE_INTEGER;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else if (yyyymmdd.test(cleanDate)) {
    const match = cleanDate.match(yyyymmdd);
    if (!match) return Number.MAX_SAFE_INTEGER;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    return Number.MAX_SAFE_INTEGER;
  }

  let hours = 0;
  let minutes = 0;
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

export function getRecordDateRank(record: BtpScheduleRecord): number {
  const atracacao = parseBrDateTime(record.dataatracacao, record.horaatracacao);
  if (atracacao !== Number.MAX_SAFE_INTEGER) return atracacao;

  const chegada = parseBrDateTime(record.datachegada, record.horachegada);
  if (chegada !== Number.MAX_SAFE_INTEGER) return chegada;

  const saida = parseBrDateTime(record.datasaida, record.horasaida);
  if (saida !== Number.MAX_SAFE_INTEGER) return saida;

  return Number.MAX_SAFE_INTEGER;
}

export function getStatusRank(status: string): number {
  if (status === 'Atracado') return 1;
  if (status === 'Na Barra') return 2;
  if (status === 'Previsto') return 3;
  if (status === 'Desatracado') return 4;
  return 5;
}

export const BTP_BERTHS = ['BTP 1', 'BTP 2', 'BTP 3'] as const;

export interface BerthSlot {
  berco: string;
  atracado: BtpScheduleRecord | null;
  proximo: BtpScheduleRecord | null;
}

export function getBerthSlots(records: BtpScheduleRecord[]): BerthSlot[] {
  return BTP_BERTHS.map((berco) => {
    const forThisBerth = records.filter((record) => getDisplayBerco(record) === berco);

    const atracado = forThisBerth.find((record) => getPortalStatusLabel(record) === 'Atracado') || null;

    const proximo =
      forThisBerth
        .filter((record) => {
          const status = getPortalStatusLabel(record);
          return (status === 'Previsto' || status === 'Na Barra') && Boolean(parsePortalDateTime(record.etb));
        })
        .sort((a, b) => parsePortalDateTime(a.etb)!.getTime() - parsePortalDateTime(b.etb)!.getTime())[0] || null;

    return { berco, atracado, proximo };
  });
}

export function toOperationalShipSnapshot(record: BtpScheduleRecord): BtpOperationalShipSnapshot {
  return {
    ...record,
    displayBerco: getDisplayBerco(record),
    atracacaoDate: record.dataatracacao || record.datachegada || '',
    atracacaoTime: record.horaatracacao || record.horachegada || '',
    previsaoSaidaDate: record.etd || record.saidaPrevista || '',
    previsaoSaidaTime: '',
    telemetry: {
      movimentosTotais: undefined,
      movimentosConcluidos: undefined,
      movimentosRestantes: undefined,
    },
  };
}

export async function fetchSharedBtpSchedule(forceRefresh = false): Promise<BtpScheduleRecord[]> {
  const now = Date.now();
  const isFresh = !forceRefresh && sharedState.lastUpdate && now - sharedState.lastUpdate.getTime() < REFRESH_INTERVAL_MS;
  if (isFresh && sharedState.records.length > 0) {
    return sharedState.records;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  emit({ ...sharedState, loading: true, error: null });

  inflightPromise = (async () => {
    const response = await fetch('/api/btp-schedule', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Falha ao buscar dados');
    }

    const records = Array.isArray(result.data) ? result.data : [];
    emit({
      records,
      lastUpdate: new Date(),
      loading: false,
      error: records.length === 0 ? 'Nenhuma programação disponível.' : null,
    });
    return records;
  })()
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao buscar dados';
      emit({ ...sharedState, loading: false, error: message });
      throw err;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function useSharedBtpSchedule() {
  const [state, setState] = useState<SharedBtpScheduleState>(getSharedBtpScheduleState());

  useEffect(() => {
    const unsubscribe = subscribeToBtpSchedule((next) => setState(next));
    void fetchSharedBtpSchedule(false);

    const intervalId = window.setInterval(() => {
      void fetchSharedBtpSchedule(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  return state;
}