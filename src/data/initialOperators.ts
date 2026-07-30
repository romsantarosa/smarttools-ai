export interface Operador {
  mat: string;
  nome: string;
}

import { COLABORADORES_BORDO_BASE } from './colaboradoresBordo';

const STORAGE_KEY = 'btp-colaboradores-bordo';

function normalizeOperators(operators: Operador[]): Operador[] {
  const seen = new Set<string>();
  const normalized: Operador[] = [];

  operators.forEach((op) => {
    const mat = String(op?.mat || '').trim();
    const nome = String(op?.nome || '').trim().replace(/\s+/g, ' ');
    if (!mat || !nome) return;
    if (seen.has(mat)) return;
    seen.add(mat);
    normalized.push({ mat, nome });
  });

  return normalized;
}

function readStoredOperators(): Operador[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const operators = normalizeOperators(parsed as Operador[]);
    return operators.length > 0 ? operators : null;
  } catch {
    return null;
  }
}

function persistOperators(operators: Operador[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operators));
}

function getDefaultOperators(): Operador[] {
  return normalizeOperators(COLABORADORES_BORDO_BASE);
}

export const OPERADORES_INICIAIS: Operador[] = readStoredOperators() ?? getDefaultOperators();

export function setOperadoresIniciais(operators: Operador[]) {
  const normalized = normalizeOperators(operators);
  OPERADORES_INICIAIS.splice(0, OPERADORES_INICIAIS.length, ...normalized);
  persistOperators(normalized);
}

export function resetOperadoresIniciais() {
  const defaults = getDefaultOperators();
  OPERADORES_INICIAIS.splice(0, OPERADORES_INICIAIS.length, ...defaults);
  persistOperators(defaults);
}
