/**
 * Persistência do módulo SPLIT.
 *
 * Cada análise confirmada é salva como um registro INDEPENDENTE (nunca
 * sobrescreve outro berço). O hash SHA-256 do arquivo original é usado para
 * detectar quando o mesmo PDF já foi analisado antes, evitando resultados
 * diferentes para o mesmo arquivo passarem despercebidos.
 */

export type SplitBerth = 'BTP 1' | 'BTP 2' | 'BTP 3';

export const SPLIT_BERTHS: SplitBerth[] = ['BTP 1', 'BTP 2', 'BTP 3'];

export interface SplitRecordBayData {
  bay: string;
  dsDeck: number | null;
  ldDeck: number | null;
  dsHold: number | null;
  ldHold: number | null;
  discharge: number;
  load: number;
  total: number;
}

export interface SplitRecord {
  id: string;
  vessel: string;
  voyage: string | null;
  berth: SplitBerth;
  totalContainers: number;
  totalDischarge: number;
  totalLoad: number;
  activeBays: number;
  bayData: SplitRecordBayData[];
  confidence: number;
  createdAt: string;
  /** Presente somente se o registro já foi editado depois de salvo. */
  updatedAt?: string;
  sourceFileHash: string;
  fileName: string;
}

const STORAGE_KEY = 'btp_split_records_v1';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `split-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** SHA-256 do conteúdo bruto do arquivo (não do texto extraído), via Web Crypto API. */
export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getAllSplitRecords(): SplitRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistAllRecords(records: SplitRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function saveSplitRecord(record: Omit<SplitRecord, 'id' | 'createdAt'>): SplitRecord {
  const fullRecord: SplitRecord = {
    ...record,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };

  const records = getAllSplitRecords();
  records.unshift(fullRecord);
  persistAllRecords(records);

  return fullRecord;
}

export function getRecordsByBerth(berth: SplitBerth | 'TODOS'): SplitRecord[] {
  const records = getAllSplitRecords();
  if (berth === 'TODOS') return records;
  return records.filter((record) => record.berth === berth);
}

/** Registro mais recente salvo para cada berço, usado nos 3 cards fixos do painel. */
export function getLatestRecordPerBerth(): Record<SplitBerth, SplitRecord | null> {
  const records = getAllSplitRecords();
  const result: Record<SplitBerth, SplitRecord | null> = {
    'BTP 1': null,
    'BTP 2': null,
    'BTP 3': null,
  };

  for (const berth of SPLIT_BERTHS) {
    const latest = records
      .filter((record) => record.berth === berth)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    result[berth] = latest || null;
  }

  return result;
}

export function findRecordByFileHash(hash: string): SplitRecord | null {
  const records = getAllSplitRecords();
  return records.find((record) => record.sourceFileHash === hash) || null;
}

export function deleteSplitRecord(id: string): void {
  const records = getAllSplitRecords().filter((record) => record.id !== id);
  persistAllRecords(records);
}

/** Edita um registro EXISTENTE no lugar (mesmo id, `createdAt` original preservado, `updatedAt` atualizado). */
export function updateSplitRecord(id: string, updates: Omit<SplitRecord, 'id' | 'createdAt' | 'updatedAt' | 'sourceFileHash' | 'fileName'>): SplitRecord | null {
  const records = getAllSplitRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return null;

  const updated: SplitRecord = {
    ...records[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  records[index] = updated;
  persistAllRecords(records);
  return updated;
}
