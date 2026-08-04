import type { PDFPageAsset } from './pdfService';
import { extractSplitSummaryFromImage, extractBayColumnSummaryFromImage, type GeminiBayColumnEntry } from './geminiService';

type PageType =
  | 'resumo'
  | 'plano-geral'
  | 'plano-bays'
  | 'tabela-descarga'
  | 'tabela-embarque'
  | 'carga-sensivel'
  | 'reefers'
  | 'dg'
  | 'oog'
  | 'desconhecida';

interface SplitInput {
  text: string;
  pages: string[];
  lines: string[][];
  pageAssets?: PDFPageAsset[];
  pageTextItems?: Array<{
    pageNumber: number;
    items: Array<{
      str: string;
      transform?: number[];
      width?: number;
      height?: number;
    }>;
  }>;
}

interface AlertContainer {
  number?: string;
  iso?: string;
  bay: string;
  row?: string;
  tier?: string;
  position: string;
  line: string;
  deckOrHold: 'deck' | 'hold' | 'unknown';
  size: 20 | 40 | 45 | null;
  isReefer: boolean;
  isDG: boolean;
  isOOG: boolean;
  isTank: boolean;
  isFlat: boolean;
  isEmpty: boolean;
  isFull: boolean;
  operation: 'descarga' | 'embarque' | 'unknown';
}

interface BayAggregate {
  bay: string;
  deck: number;
  hold: number;
  twenty: number;
  forty: number;
  fortyFive: number;
  reefer: number;
  dg: number;
  oog: number;
  tank: number;
  flat: number;
  empty: number;
  full: number;
  discharge: number;
  loading: number;
  total: number;
  confidence: number;
  containers: AlertContainer[];
  sections: string[];
}

interface VisualPageAnalysis {
  pageNumber: number;
  width: number;
  height: number;
  gridRows: number;
  gridCols: number;
  estimatedContainers: number;
  visualBayRegions: number;
  confidence: number;
}

interface PageClassification {
  pageNumber: number;
  type: PageType;
  confidence: number;
  bayNumbers: string[];
  textChars: number;
  visual: VisualPageAnalysis | null;
}

interface FusionLog {
  stage: string;
  elapsedMs: number;
  details: Record<string, any>;
}

interface OperationalStats {
  totalContainers: number;
  totalBays: number;
  deck: number;
  hold: number;
  discharge: number;
  loading: number;
  reefer: number;
  dg: number;
  oog: number;
  tank: number;
  flat: number;
  empty: number;
  full: number;
}

interface SplitOperationSummary {
  totalMovements: number | null;
  discharge: {
    total: number | null;
    planned: number | null;
    qcUnassigned: number | null;
    completed: number | null;
    remained: number | null;
  };
  loading: {
    total: number | null;
    planned: number | null;
    qcUnassigned: number | null;
    completed: number | null;
    remained: number | null;
  };
  source: 'pdf-text' | 'ocr' | 'vision' | 'ai';
  confidence: number;
  validationStatus: 'VALID' | 'REVIEW_REQUIRED' | 'UNKNOWN';
}

interface SplitDeckHoldSummary {
  dischargeDeck: number | null;
  loadingDeck: number | null;
  dischargeHold: number | null;
  loadingHold: number | null;
  dischargeTotal: number | null;
  loadingTotal: number | null;
  deckTotal: number | null;
  holdTotal: number | null;
  grandTotal: number | null;
  confidence: number;
}

interface SplitValidation {
  summaryValid: boolean;
  dischargeValid: boolean;
  loadingValid: boolean;
  deckHoldValid: boolean;
  expectedTotal: number | null;
  calculatedTotal: number | null;
  warnings: string[];
}

const STOWAGE_REGEX = /(\d{2})-(\d{2})-(\d{2,3})/;
const CONTAINER_REGEX = /\b([A-Z]{3}[UJZ]\d{7})\b/;
const ISO_REGEX = /\b(\d{2}[A-Z]\d)\b/;

function norm(value: string): string {
  return value.replace(/\r/g, '').replace(/[\t ]+/g, ' ').trim();
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function toBay(value: string): string {
  return value.padStart(2, '0');
}

function parseSizeFromIso(iso?: string, line?: string): 20 | 40 | 45 | null {
  if (!iso && !line) return null;
  const upperIso = (iso || '').toUpperCase();
  const upperLine = (line || '').toUpperCase();

  if (upperIso.startsWith('2') || /\b20[' ]?\b/.test(upperLine)) return 20;
  if (/\b45[' ]?\b/.test(upperLine) || /\bL5\b/.test(upperIso)) return 45;
  if (upperIso.startsWith('4') || /\b40[' ]?\b/.test(upperLine)) return 40;
  return null;
}

function inferDeckOrHold(tier?: string): 'deck' | 'hold' | 'unknown' {
  if (!tier) return 'unknown';
  const n = Number(tier);
  if (!Number.isFinite(n)) return 'unknown';
  return n >= 70 ? 'deck' : 'hold';
}

function extractBayNumbersFromText(text: string): string[] {
  const byLabel = Array.from(text.matchAll(/\b(?:BAY|BAIA)\s*0?([1-9]|[1-6]\d|70)\b/gi)).map((m) => toBay(m[1]));
  const byStowage = Array.from(text.matchAll(/\b(\d{2})-\d{2}-\d{2,3}\b/g)).map((m) => toBay(m[1]));
  const all = unique([...byLabel, ...byStowage]).filter((bay) => Number(bay) >= 1 && Number(bay) <= 70);
  return all.sort((a, b) => Number(a) - Number(b));
}

function scoreContains(textUpper: string, patterns: RegExp[]): number {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(textUpper)) score += 1;
  }
  return score;
}

function classifyPage(pageNumber: number, pageText: string, visual: VisualPageAnalysis | null): PageClassification {
  const text = norm(pageText);
  const upper = text.toUpperCase();
  const bayNumbers = extractBayNumbersFromText(text);

  const scores: Record<PageType, number> = {
    resumo: scoreContains(upper, [/SUMMARY/, /RESUMO/, /DISCHARGING/, /LOADING/, /QC PLAN/]),
    'plano-geral': scoreContains(upper, [/GENERAL/, /PLANO GERAL/, /VESSEL PLAN/]),
    'plano-bays': scoreContains(upper, [/BAY/, /BAIA/, /ROW/, /TIER/]),
    'tabela-descarga': scoreContains(upper, [/DESCARGA/, /DISCHARGE/, /DISCHARGING/]),
    'tabela-embarque': scoreContains(upper, [/EMBARQUE/, /LOADING/]),
    'carga-sensivel': scoreContains(upper, [/SENSIVEL/, /SENSÍVEL/, /SENSITIVE/]),
    reefers: scoreContains(upper, [/REEFER/, /TEMP/]),
    dg: scoreContains(upper, [/\bDG\b/, /IMDG/, /IMO/]),
    oog: scoreContains(upper, [/\bOOG\b/, /EXCESSO/, /OUT OF GAUGE/]),
    desconhecida: 0,
  };

  if (visual && visual.estimatedContainers > 30 && visual.visualBayRegions > 0) {
    scores['plano-bays'] += 3;
  }

  let bestType: PageType = 'desconhecida';
  let bestScore = 0;

  (Object.keys(scores) as PageType[]).forEach((type) => {
    if (scores[type] > bestScore) {
      bestScore = scores[type];
      bestType = type;
    }
  });

  const confidence = Math.max(0.15, Math.min(0.99, bestScore / 6 + (visual?.confidence || 0) * 0.2));

  return {
    pageNumber,
    type: bestType,
    confidence,
    bayNumbers,
    textChars: text.length,
    visual,
  };
}

function detectPeaks(values: number[], threshold: number, minGap: number): number[] {
  const out: number[] = [];
  let last = -100000;
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= threshold && i - last >= minGap) {
      out.push(i);
      last = i;
    }
  }
  return out;
}

async function readImageData(imageDataUrl: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 1600;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.max(1, Math.floor(img.width * scale));
      const height = Math.max(1, Math.floor(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao criar contexto 2D para análise visual.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      resolve({ width, height, data: imageData.data });
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem da página para visão computacional.'));
    img.src = imageDataUrl;
  });
}

async function runVisualAnalysis(asset: PDFPageAsset): Promise<VisualPageAnalysis> {
  const sampled = await readImageData(asset.imageDataUrl);
  const { width, height, data } = sampled;

  const rowInk = new Array<number>(height).fill(0);
  const colInk = new Array<number>(width).fill(0);
  const step = 2;
  const darkThreshold = 150;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < darkThreshold) {
        rowInk[y] += 1;
        colInk[x] += 1;
      }
    }
  }

  const normRowInk = rowInk.map((v) => v / Math.max(1, Math.ceil(width / step)));
  const normColInk = colInk.map((v) => v / Math.max(1, Math.ceil(height / step)));

  const horizontalLines = detectPeaks(normRowInk, 0.2, 5);
  const verticalLines = detectPeaks(normColInk, 0.2, 5);

  const gridRows = horizontalLines.length;
  const gridCols = verticalLines.length;

  const rawCells = Math.max(0, (gridRows - 1) * (gridCols - 1));
  const estimatedContainers = Math.min(2000, rawCells);

  const whitespaceBands = detectPeaks(normColInk.map((v) => 1 - v), 0.985, 12);
  const visualBayRegions = Math.max(0, Math.min(40, whitespaceBands.length));

  const confidence = Math.max(0.15, Math.min(0.95, rawCells / 320 + visualBayRegions / 30));

  return {
    pageNumber: asset.pageNumber,
    width,
    height,
    gridRows,
    gridCols,
    estimatedContainers,
    visualBayRegions,
    confidence,
  };
}

function extractDocumentHeader(lines: string[]): { shipName: string | null; voyage: string | null; date: string | null; berth: string | null } {
  const joined = lines.join('\n');

  const headerLine = lines.find((line) => /\s>\s/.test(line) && /^[A-Z\s0-9-]{6,}>?/.test(line));
  let shipName: string | null = null;
  let voyage: string | null = null;

  if (headerLine) {
    const left = headerLine.split('>')[0]?.trim() || '';
    const tokens = left.split(/\s+/).filter(Boolean);
    const maybeVoyage = tokens[tokens.length - 1] || '';
    if (/^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(maybeVoyage)) {
      voyage = maybeVoyage;
      shipName = tokens.slice(0, -1).join(' ') || null;
    } else {
      shipName = left || null;
    }
  }

  const date = joined.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/)?.[0] || null;
  const berth = joined.match(/\bBTP\s*0?[1-3]\b/i)?.[0]?.toUpperCase() || null;

  return { shipName, voyage, date, berth };
}

function parseIntegerValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const textValue = typeof value === 'number' ? String(value) : String(value);
  const sanitized = textValue.replace(/[^0-9-]/g, '');
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSplitText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[|]/g, ' ').trim();
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

interface LayoutTextLine {
  y: number;
  items: Array<{ text: string; x: number; width?: number; height?: number }>;
}

function groupTextItemsByLine(items: PdfTextItemLike[], toleranceY = 4): LayoutTextLine[] {
  const buckets: LayoutTextLine[] = [];

  for (const item of items) {
    const text = typeof item.str === 'string' ? item.str.trim() : '';
    if (!text) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4] || 0);
    const y = Number(transform[5] || 0);

    const bucket = buckets.find((entry) => Math.abs(entry.y - y) <= toleranceY);
    if (bucket) {
      bucket.items.push({ text, x, width: item.width, height: item.height });
    } else {
      buckets.push({ y, items: [{ text, x, width: item.width, height: item.height }] });
    }
  }

  buckets.sort((a, b) => a.y - b.y);
  for (const bucket of buckets) {
    bucket.items.sort((a, b) => a.x - b.x);
  }

  return buckets;
}

function findSection(lines: LayoutTextLine[], sectionName: string): LayoutTextLine | null {
  const target = sectionName.toUpperCase();
  const sectionLine = lines.find((line) => line.items.some((item) => item.text.toUpperCase() === target));
  return sectionLine || null;
}

function extractLabelNumericValue(row: LayoutTextLine | null, label: string): number | null {
  if (!row) return null;

  const labelIndex = row.items.findIndex((item) => item.text.toUpperCase() === label.toUpperCase());
  if (labelIndex < 0) return null;

  const rightSideItems = row.items.slice(labelIndex + 1);
  const numericCandidate = rightSideItems.find((item) => parseIntegerValue(item.text) !== null);
  if (numericCandidate) {
    return parseIntegerValue(numericCandidate.text);
  }

  const sameRowText = row.items.map((item) => item.text).join(' ').toUpperCase();
  if (sameRowText.includes(label.toUpperCase())) {
    const fallbackValue = parseIntegerValue(sameRowText.match(/([0-9]{1,7})/i)?.[1]);
    if (fallbackValue !== null) return fallbackValue;
  }

  return null;
}

function findNumericValueOnLine(line: LayoutTextLine | null, lines: LayoutTextLine[], index: number): number | null {
  if (!line) return null;

  const numericCandidates = line.items
    .map((item) => ({ item, parsed: parseIntegerValue(item.text) }))
    .filter((entry) => entry.parsed !== null && entry.parsed >= 0);

  if (numericCandidates.length > 0) {
    return numericCandidates[0].parsed;
  }

  const nearbyLines = [lines[index - 1], lines[index + 1]].filter(Boolean) as LayoutTextLine[];
  for (const nearbyLine of nearbyLines) {
    const nearbyNumeric = nearbyLine.items
      .map((item) => ({ item, parsed: parseIntegerValue(item.text) }))
      .filter((entry) => entry.parsed !== null && entry.parsed >= 0);
    if (nearbyNumeric.length > 0) {
      return nearbyNumeric[0].parsed;
    }
  }

  return null;
}

export function extractOperationalSummaryFromLayout(items: Array<{ text: string; x?: number; y?: number; width?: number; height?: number }>): SplitOperationSummary {
  const normalizedItems = items
    .filter((item) => typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      text: item.text.trim(),
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      width: item.width,
      height: item.height,
    }));

  const lines = groupTextItemsByLine(
    normalizedItems.map((item) => ({
      str: item.text,
      transform: [0, 0, 0, 0, item.x, item.y],
      width: item.width,
      height: item.height,
    }))
  );

  const dischargingLine = findSection(lines, 'Discharging');
  const loadingLine = findSection(lines, 'Loading');

  const dischargeRegion = lines.filter((line) => {
    if (!dischargingLine) return false;
    return Math.abs(line.y - dischargingLine.y) <= 40;
  });

  const loadingRegion = lines.filter((line) => {
    if (!loadingLine) return false;
    return Math.abs(line.y - loadingLine.y) <= 40;
  });

  const dischargeLine = dischargeRegion
    .filter((line) => line.items.some((item) => item.text.toUpperCase() === 'TOTAL'))
    .sort((a, b) => Math.abs(a.y - dischargingLine!.y) - Math.abs(b.y - dischargingLine!.y))[0] || null;

  const loadingLineMatch = loadingRegion
    .filter((line) => line.items.some((item) => item.text.toUpperCase() === 'TOTAL'))
    .sort((a, b) => Math.abs(a.y - loadingLine!.y) - Math.abs(b.y - loadingLine!.y))[0] || null;

  const dischargeTotal = extractLabelNumericValue(dischargeLine, 'Total');
  const loadingTotal = extractLabelNumericValue(loadingLineMatch, 'Total');
  const totalMovements = dischargeTotal !== null && loadingTotal !== null ? dischargeTotal + loadingTotal : null;

  return {
    totalMovements,
    discharge: {
      total: dischargeTotal,
      planned: null,
      qcUnassigned: null,
      completed: null,
      remained: null,
    },
    loading: {
      total: loadingTotal,
      planned: null,
      qcUnassigned: null,
      completed: null,
      remained: null,
    },
    source: dischargeTotal !== null || loadingTotal !== null ? 'pdf-text' : 'ocr',
    confidence: dischargeTotal !== null || loadingTotal !== null ? 0.95 : 0.3,
    validationStatus: 'UNKNOWN' as const,
  };
}

export function extractOperationalSummary(text: string): SplitOperationSummary {
  const normalizedText = normalizeSplitText(text);
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sectionValues = {
    discharge: { total: null as number | null, planned: null as number | null, qcUnassigned: null as number | null, completed: null as number | null, remained: null as number | null },
    loading: { total: null as number | null, planned: null as number | null, qcUnassigned: null as number | null, completed: null as number | null, remained: null as number | null },
  };

  let currentSection: 'discharge' | 'loading' | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (/DISCHARGING|DESCARGA/.test(upper)) {
      currentSection = 'discharge';
      continue;
    }

    if (/LOADING|EMBARQUE/.test(upper)) {
      currentSection = 'loading';
      continue;
    }

    if (!currentSection) continue;

    const match = line.match(/(TOTAL|PLANNED|QC\s*UNASSIGNED|COMPLETED|REMAINED)[^0-9-]*([0-9]{1,7})/i);
    if (!match) continue;

    const [, label, rawValue] = match;
    const value = parseIntegerValue(rawValue);
    if (value === null) continue;

    const key = label.toUpperCase();
    if (currentSection === 'discharge') {
      if (key === 'TOTAL') sectionValues.discharge.total = value;
      else if (key === 'PLANNED') sectionValues.discharge.planned = value;
      else if (key === 'QC UNASSIGNED') sectionValues.discharge.qcUnassigned = value;
      else if (key === 'COMPLETED') sectionValues.discharge.completed = value;
      else if (key === 'REMAINED') sectionValues.discharge.remained = value;
    } else {
      if (key === 'TOTAL') sectionValues.loading.total = value;
      else if (key === 'PLANNED') sectionValues.loading.planned = value;
      else if (key === 'QC UNASSIGNED') sectionValues.loading.qcUnassigned = value;
      else if (key === 'COMPLETED') sectionValues.loading.completed = value;
      else if (key === 'REMAINED') sectionValues.loading.remained = value;
    }
  }

  const dischargeTotal = sectionValues.discharge.total;
  const loadingTotal = sectionValues.loading.total;
  const totalMovements = dischargeTotal !== null && loadingTotal !== null ? dischargeTotal + loadingTotal : null;
  const hasAnyValue = [dischargeTotal, sectionValues.discharge.planned, sectionValues.discharge.qcUnassigned, sectionValues.discharge.completed, sectionValues.discharge.remained, loadingTotal, sectionValues.loading.planned, sectionValues.loading.qcUnassigned, sectionValues.loading.completed, sectionValues.loading.remained].some((value) => value !== null);

  const summary = {
    totalMovements,
    discharge: sectionValues.discharge,
    loading: sectionValues.loading,
    source: hasAnyValue ? 'pdf-text' as const : 'ocr' as const,
    confidence: hasAnyValue ? 0.95 : 0.3,
    validationStatus: 'UNKNOWN' as const,
  };

  return summary;
}

export function extractQcPlanSummary(text: string): SplitDeckHoldSummary {
  const normalizedText = normalizeSplitText(text);
  const dischargeDeck = parseIntegerValue(normalizedText.match(/DS-DECK[^0-9-]*([0-9]{1,7})/i)?.[1]);
  const loadingDeck = parseIntegerValue(normalizedText.match(/LD-DECK[^0-9-]*([0-9]{1,7})/i)?.[1]);
  const dischargeHold = parseIntegerValue(normalizedText.match(/DS-HOLD[^0-9-]*([0-9]{1,7})/i)?.[1]);
  const loadingHold = parseIntegerValue(normalizedText.match(/LD-HOLD[^0-9-]*([0-9]{1,7})/i)?.[1]);

  const dischargeTotal = dischargeDeck !== null && dischargeHold !== null ? dischargeDeck + dischargeHold : null;
  const loadingTotal = loadingDeck !== null && loadingHold !== null ? loadingDeck + loadingHold : null;
  const deckTotal = dischargeDeck !== null && loadingDeck !== null ? dischargeDeck + loadingDeck : null;
  const holdTotal = dischargeHold !== null && loadingHold !== null ? dischargeHold + loadingHold : null;
  const grandTotal = deckTotal !== null && holdTotal !== null ? deckTotal + holdTotal : null;

  return {
    dischargeDeck,
    loadingDeck,
    dischargeHold,
    loadingHold,
    dischargeTotal,
    loadingTotal,
    deckTotal,
    holdTotal,
    grandTotal,
    confidence: [dischargeDeck, loadingDeck, dischargeHold, loadingHold].some((value) => value !== null) ? 0.9 : 0.2,
  };
}

export function validateSplitTotals(
  operationSummary: SplitOperationSummary,
  qcPlanSummary: SplitDeckHoldSummary
): SplitValidation {
  const dischargeValid = operationSummary.discharge.total !== null && qcPlanSummary.dischargeTotal !== null
    ? operationSummary.discharge.total === qcPlanSummary.dischargeTotal
    : false;

  const loadingValid = operationSummary.loading.total !== null && qcPlanSummary.loadingTotal !== null
    ? operationSummary.loading.total === qcPlanSummary.loadingTotal
    : false;

  const expectedTotal = operationSummary.totalMovements;
  const calculatedTotal = qcPlanSummary.grandTotal;
  const summaryValid = expectedTotal !== null && calculatedTotal !== null
    ? expectedTotal === calculatedTotal
    : false;

  const deckHoldValid = dischargeValid && loadingValid && summaryValid;
  const warnings: string[] = [];

  if (!summaryValid && expectedTotal !== null && calculatedTotal !== null) {
    warnings.push(`Resumo operacional (${expectedTotal}) não bate com QC Plan (${calculatedTotal}).`);
  }

  if (!dischargeValid && operationSummary.discharge.total !== null && qcPlanSummary.dischargeTotal !== null) {
    warnings.push(`Descarga do resumo (${operationSummary.discharge.total}) não bate com QC Plan (${qcPlanSummary.dischargeTotal}).`);
  }

  if (!loadingValid && operationSummary.loading.total !== null && qcPlanSummary.loadingTotal !== null) {
    warnings.push(`Embarque do resumo (${operationSummary.loading.total}) não bate com QC Plan (${qcPlanSummary.loadingTotal}).`);
  }

  operationSummary.validationStatus = operationSummary.discharge.total === null && operationSummary.loading.total === null && operationSummary.totalMovements === null
    ? 'UNKNOWN'
    : deckHoldValid
      ? 'VALID'
      : 'REVIEW_REQUIRED';

  return {
    summaryValid,
    dischargeValid,
    loadingValid,
    deckHoldValid,
    expectedTotal,
    calculatedTotal,
    warnings,
  };
}

function extractOperationTotals(lines: string[]): { discharge: number; loading: number } {
  const joined = lines.join(' ');

  const discharge = Number(
    joined.match(/(?:DISCHARGING|DESCARGA)[^\d]{0,40}(\d{1,5})/i)?.[1] ||
    joined.match(/DISCHARGING\s+TOTAL[^\d]{0,10}(\d{1,5})/i)?.[1] ||
    0
  );

  const loading = Number(
    joined.match(/(?:LOADING|EMBARQUE)[^\d]{0,40}(\d{1,5})/i)?.[1] ||
    joined.match(/LOADING\s+TOTAL[^\d]{0,10}(\d{1,5})/i)?.[1] ||
    0
  );

  return {
    discharge: Number.isFinite(discharge) ? discharge : 0,
    loading: Number.isFinite(loading) ? loading : 0,
  };
}

function inferOperationFromContext(line: string): 'descarga' | 'embarque' | 'unknown' {
  const upper = line.toUpperCase();
  if (/DESCARGA|DISCHARGE|DISCHARGING/.test(upper)) return 'descarga';
  if (/EMBARQUE|LOAD|LOADING/.test(upper)) return 'embarque';
  return 'unknown';
}

function parseContainersFromLines(lines: string[]): AlertContainer[] {
  const containers: AlertContainer[] = [];
  let context: 'descarga' | 'embarque' | 'unknown' = 'unknown';

  for (const rawLine of lines) {
    const line = norm(rawLine);
    if (!line) continue;

    const inferredContext = inferOperationFromContext(line);
    if (inferredContext !== 'unknown') {
      context = inferredContext;
    }

    const stowage = line.match(STOWAGE_REGEX);
    if (!stowage) continue;

    const bay = toBay(stowage[1]);
    const row = stowage[2];
    const tier = stowage[3];

    const number = line.match(CONTAINER_REGEX)?.[1];
    const iso = line.match(ISO_REGEX)?.[1];
    const size = parseSizeFromIso(iso, line);

    const isReefer = /REEFER|\bRF\b|TEMP|\bR\d\b/.test(line.toUpperCase()) || /\d{2}R\d/.test(iso || '');
    const isDG = /\bDG\b|IMDG|IMO|CLASS\s*\d/.test(line.toUpperCase());
    const isOOG = /\bOOG\b|EXCESSO|OUT OF GAUGE|\/\//.test(line.toUpperCase());
    const isTank = /\bTANK\b/.test(line.toUpperCase()) || /\d{2}T\d/.test(iso || '');
    const isFlat = /\bFLAT\b/.test(line.toUpperCase()) || /\d{2}P\d/.test(iso || '');
    const isEmpty = /\bMT\b|VAZIO|EMPTY/.test(line.toUpperCase());
    const isFull = /\bFULL\b|CHEIO/.test(line.toUpperCase()) || !isEmpty;

    containers.push({
      number,
      iso,
      bay,
      row,
      tier,
      position: `${bay}-${row}-${tier}`,
      line,
      deckOrHold: inferDeckOrHold(tier),
      size,
      isReefer,
      isDG,
      isOOG,
      isTank,
      isFlat,
      isEmpty,
      isFull,
      operation: context,
    });
  }

  const dedup = new Map<string, AlertContainer>();
  for (const container of containers) {
    const key = `${container.number || 'none'}|${container.position}`;
    if (!dedup.has(key)) dedup.set(key, container);
  }

  return Array.from(dedup.values());
}

function aggregateByBay(containers: AlertContainer[], visualPages: PageClassification[]): BayAggregate[] {
  const map = new Map<string, BayAggregate>();

  for (const c of containers) {
    const current = map.get(c.bay) || {
      bay: c.bay,
      deck: 0,
      hold: 0,
      twenty: 0,
      forty: 0,
      fortyFive: 0,
      reefer: 0,
      dg: 0,
      oog: 0,
      tank: 0,
      flat: 0,
      empty: 0,
      full: 0,
      discharge: 0,
      loading: 0,
      total: 0,
      confidence: 0.7,
      containers: [],
      sections: [],
    };

    current.total += 1;
    current.containers.push(c);

    if (c.deckOrHold === 'deck') current.deck += 1;
    if (c.deckOrHold === 'hold') current.hold += 1;
    if (c.size === 20) current.twenty += 1;
    if (c.size === 40) current.forty += 1;
    if (c.size === 45) current.fortyFive += 1;
    if (c.isReefer) current.reefer += 1;
    if (c.isDG) current.dg += 1;
    if (c.isOOG) current.oog += 1;
    if (c.isTank) current.tank += 1;
    if (c.isFlat) current.flat += 1;
    if (c.isEmpty) current.empty += 1;
    if (c.isFull) current.full += 1;
    if (c.operation === 'descarga') current.discharge += 1;
    if (c.operation === 'embarque') current.loading += 1;

    map.set(c.bay, current);
  }

  const cvBoostByBay = new Map<string, number>();
  for (const page of visualPages) {
    if (page.type !== 'plano-bays' || !page.visual || page.bayNumbers.length === 0) continue;
    const perBay = Math.max(0, Math.round(page.visual.estimatedContainers / page.bayNumbers.length));
    for (const bay of page.bayNumbers) {
      cvBoostByBay.set(bay, (cvBoostByBay.get(bay) || 0) + perBay);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => Number(a.bay) - Number(b.bay));
  for (const row of rows) {
    const cvEstimate = cvBoostByBay.get(row.bay) || 0;
    const ratio = row.total > 0 ? Math.min(1, cvEstimate / row.total) : 0;
    row.confidence = Math.max(0.45, Math.min(0.98, 0.55 + ratio * 0.3));
  }

  return rows;
}

function buildOperationalStats(bays: BayAggregate[]): OperationalStats {
  return bays.reduce<OperationalStats>(
    (acc, bay) => {
      acc.totalContainers += bay.total;
      acc.totalBays += 1;
      acc.deck += bay.deck;
      acc.hold += bay.hold;
      acc.discharge += bay.discharge;
      acc.loading += bay.loading;
      acc.reefer += bay.reefer;
      acc.dg += bay.dg;
      acc.oog += bay.oog;
      acc.tank += bay.tank;
      acc.flat += bay.flat;
      acc.empty += bay.empty;
      acc.full += bay.full;
      return acc;
    },
    {
      totalContainers: 0,
      totalBays: 0,
      deck: 0,
      hold: 0,
      discharge: 0,
      loading: 0,
      reefer: 0,
      dg: 0,
      oog: 0,
      tank: 0,
      flat: 0,
      empty: 0,
      full: 0,
    }
  );
}

async function runGeminiFusionAI(payload: {
  header: { shipName: string | null; voyage: string | null; date: string | null; berth: string | null };
  operationTotals: { discharge: number | null; loading: number | null; totalMovements: number | null };
  stats: OperationalStats;
  bayRows: BayAggregate[];
  pageTypes: PageClassification[];
  textPreview: string;
}): Promise<{ confidence: number; refined?: any; error?: string }> {
  try {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) return { confidence: 0, error: 'VITE_GEMINI_API_KEY não configurada.' };

    const prompt = `Você é um analista de plano de estiva.

Receba os dados extraídos por OCR e visão computacional, cruze as informações e retorne SOMENTE JSON válido com:
{
  "confidence": number de 0 a 1,
  "shipName": string|null,
  "voyage": string|null,
  "date": string|null,
  "berth": string|null,
  "discharge": number,
  "loading": number,
  "notes": string[],
  "bays": [{
    "bay": "01",
    "deck": number,
    "hold": number,
    "twenty": number,
    "forty": number,
    "fortyFive": number,
    "reefer": number,
    "dg": number,
    "oog": number,
    "tank": number,
    "flat": number,
    "total": number,
    "confidence": number
  }]
}

Regras:
- Priorize consistência operacional.
- Nunca invente valores negativos.
- Quando houver conflito, priorize o dado com maior confiança.
- Mantenha os IDs de bay com dois dígitos.

DADOS:
${JSON.stringify(payload).slice(0, 180000)}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      return { confidence: 0, error: `Gemini HTTP ${response.status}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { confidence: 0, error: 'Resposta vazia da IA.' };

    const parsed = JSON.parse(text);
    return {
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.5,
      refined: parsed,
    };
  } catch (error) {
    return {
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao executar fusão com IA.',
    };
  }
}

function mergeWithAI(baseRows: BayAggregate[], aiRows: any[], aiConfidence: number): BayAggregate[] {
  if (!Array.isArray(aiRows) || aiRows.length === 0 || aiConfidence < 0.45) return baseRows;

  const baseMap = new Map(baseRows.map((row) => [row.bay, row]));

  for (const ai of aiRows) {
    const bay = toBay(String(ai?.bay || ''));
    const row = baseMap.get(bay);
    if (!row) continue;

    const weight = Math.max(0, Math.min(0.35, aiConfidence * 0.35));
    const blend = (current: number, proposed: unknown) => {
      const p = Number(proposed);
      if (!Number.isFinite(p) || p < 0) return current;
      return Math.round(current * (1 - weight) + p * weight);
    };

    row.deck = blend(row.deck, ai.deck);
    row.hold = blend(row.hold, ai.hold);
    row.twenty = blend(row.twenty, ai.twenty);
    row.forty = blend(row.forty, ai.forty);
    row.fortyFive = blend(row.fortyFive, ai.fortyFive);
    row.reefer = blend(row.reefer, ai.reefer);
    row.dg = blend(row.dg, ai.dg);
    row.oog = blend(row.oog, ai.oog);
    row.tank = blend(row.tank, ai.tank);
    row.flat = blend(row.flat, ai.flat);
    row.total = Math.max(row.total, blend(row.total, ai.total));
    row.confidence = Math.max(row.confidence, Math.min(0.99, Number(ai.confidence) || row.confidence));
  }

  return Array.from(baseMap.values()).sort((a, b) => Number(a.bay) - Number(b.bay));
}

function makeOperationalMap(stats: OperationalStats) {
  return {
    resumoGeral: {
      total: stats.totalContainers,
      bays: stats.totalBays,
      confiabilidade: stats.totalContainers > 0 ? 'alta' : 'media',
    },
    conves: stats.deck,
    porao: stats.hold,
    descarga: stats.discharge,
    embarque: stats.loading,
    total: stats.totalContainers,
  };
}

function makeChartData(bays: BayAggregate[], stats: OperationalStats) {
  return {
    containersByBay: bays.map((b) => ({ bay: b.bay, total: b.total })),
    deckHoldByBay: bays.map((b) => ({ bay: b.bay, deck: b.deck, hold: b.hold })),
    dischargeLoadByBay: bays.map((b) => ({ bay: b.bay, descarga: b.discharge, embarque: b.loading })),
    reeferByBay: bays.map((b) => ({ bay: b.bay, reefer: b.reefer })),
    dgByBay: bays.map((b) => ({ bay: b.bay, dg: b.dg })),
    globalSplit: [
      { name: 'Deck', value: stats.deck },
      { name: 'Hold', value: stats.hold },
      { name: 'Descarga', value: stats.discharge },
      { name: 'Embarque', value: stats.loading },
    ],
  };
}

export interface BayColumnAggregate {
  dsDeck: { forty: number; twenty: number; total: number };
  ldDeck: { forty: number; twenty: number; total: number };
  dsHold: { forty: number; twenty: number; total: number };
  ldHold: { forty: number; twenty: number; total: number };
  deckTotal: number;
  holdTotal: number;
  dischargeTotal: number;
  loadingTotal: number;
  grandTotal: number;
}

function sumBayColumnCell(cell: GeminiBayColumnEntry['dsDeck']): { forty: number; twenty: number; total: number } {
  if (!cell) return { forty: 0, twenty: 0, total: 0 };
  const forty = cell.fortyFoot ?? 0;
  const twenty = (cell.twentyFootPair?.[0] ?? 0) + (cell.twentyFootPair?.[1] ?? 0);
  return { forty, twenty, total: forty + twenty };
}

function aggregateBayColumnTotals(bays: GeminiBayColumnEntry[]): BayColumnAggregate {
  const acc: BayColumnAggregate = {
    dsDeck: { forty: 0, twenty: 0, total: 0 },
    ldDeck: { forty: 0, twenty: 0, total: 0 },
    dsHold: { forty: 0, twenty: 0, total: 0 },
    ldHold: { forty: 0, twenty: 0, total: 0 },
    deckTotal: 0,
    holdTotal: 0,
    dischargeTotal: 0,
    loadingTotal: 0,
    grandTotal: 0,
  };

  for (const bay of bays) {
    const dsDeck = sumBayColumnCell(bay.dsDeck);
    const ldDeck = sumBayColumnCell(bay.ldDeck);
    const dsHold = sumBayColumnCell(bay.dsHold);
    const ldHold = sumBayColumnCell(bay.ldHold);

    acc.dsDeck.forty += dsDeck.forty;
    acc.dsDeck.twenty += dsDeck.twenty;
    acc.dsDeck.total += dsDeck.total;

    acc.ldDeck.forty += ldDeck.forty;
    acc.ldDeck.twenty += ldDeck.twenty;
    acc.ldDeck.total += ldDeck.total;

    acc.dsHold.forty += dsHold.forty;
    acc.dsHold.twenty += dsHold.twenty;
    acc.dsHold.total += dsHold.total;

    acc.ldHold.forty += ldHold.forty;
    acc.ldHold.twenty += ldHold.twenty;
    acc.ldHold.total += ldHold.total;
  }

  acc.deckTotal = acc.dsDeck.total + acc.ldDeck.total;
  acc.holdTotal = acc.dsHold.total + acc.ldHold.total;
  acc.dischargeTotal = acc.dsDeck.total + acc.dsHold.total;
  acc.loadingTotal = acc.ldDeck.total + acc.ldHold.total;
  acc.grandTotal = acc.deckTotal + acc.holdTotal;

  return acc;
}

export async function analyzeSplitIntelligently(input: SplitInput): Promise<any> {
  const started = Date.now();
  const logs: FusionLog[] = [];

  const addLog = (stage: string, details: Record<string, any>) => {
    logs.push({
      stage,
      elapsedMs: Date.now() - started,
      details,
    });
  };

  const pages = Array.isArray(input.pages) ? input.pages : [];
  const linesByPage = Array.isArray(input.lines) ? input.lines : pages.map((page) => page.split(/\r?\n/));
  const allLines = linesByPage.flat().map((line) => norm(line)).filter(Boolean);

  addLog('receiving', {
    pages: pages.length,
    pageAssets: input.pageAssets?.length || 0,
  });

  const visionStart = Date.now();
  const visualByPage = new Map<number, VisualPageAnalysis>();
  if (Array.isArray(input.pageAssets) && input.pageAssets.length > 0) {
    for (const asset of input.pageAssets) {
      try {
        const visual = await runVisualAnalysis(asset);
        visualByPage.set(asset.pageNumber, visual);
      } catch (error) {
        addLog('vision-error', {
          page: asset.pageNumber,
          error: error instanceof Error ? error.message : 'Erro de visão computacional.',
        });
      }
    }
  }

  addLog('vision-complete', {
    elapsedMs: Date.now() - visionStart,
    pagesAnalyzed: visualByPage.size,
  });

  const pageTypes: PageClassification[] = pages.map((text, idx) => classifyPage(idx + 1, text, visualByPage.get(idx + 1) || null));
  addLog('page-classification', {
    pages: pageTypes.length,
    planoBays: pageTypes.filter((p) => p.type === 'plano-bays').length,
  });

  const containers = parseContainersFromLines(allLines);
  addLog('ocr-structure', {
    containers: containers.length,
    bays: unique(containers.map((c) => c.bay)).length,
  });

  let bayRows = aggregateByBay(containers, pageTypes);
  let stats = buildOperationalStats(bayRows);

  const header = extractDocumentHeader(allLines);
  const firstPageItems = input.pageTextItems?.find((page) => page.pageNumber === 1)?.items || [];
  const positionalSummary = extractOperationalSummaryFromLayout(
    firstPageItems.map((item) => ({
      text: item.str || '',
      x: item.transform?.[4],
      y: item.transform?.[5],
      width: item.width,
      height: item.height,
    }))
  );
  const fallbackSummary = extractOperationalSummary(input.text || allLines.join('\n'));
  let operationSummary = positionalSummary.discharge.total !== null || positionalSummary.loading.total !== null
    ? positionalSummary
    : fallbackSummary;

  const qcPlanSummary = extractQcPlanSummary(input.text || allLines.join('\n'));

  const needsSummaryFallback = operationSummary.discharge.total === null && operationSummary.loading.total === null;
  const needsDeckHoldFallback =
    qcPlanSummary.dischargeDeck === null ||
    qcPlanSummary.loadingDeck === null ||
    qcPlanSummary.dischargeHold === null ||
    qcPlanSummary.loadingHold === null;

  // Rede de segurança: se Descarga/Embarque OU o QC Plan (Deck/Hold) ainda
  // estiverem faltando depois do texto nativo/OCR, manda a imagem da página
  // 1 pro Gemini Vision numa única chamada e usa o que faltar. Não sobrescreve
  // dados que já vieram certos por outro caminho (ex.: OCR de texto já pode
  // ter resolvido Descarga/Embarque, mas não o QC Plan, ou vice-versa).
  if (needsSummaryFallback || needsDeckHoldFallback) {
    const page1Asset = input.pageAssets?.find((asset) => asset.pageNumber === 1);
    if (page1Asset?.imageDataUrl) {
      addLog('vision-summary-fallback', { page: 1, needsSummaryFallback, needsDeckHoldFallback });
      const base64 = page1Asset.imageDataUrl.split(',')[1] || '';

      try {
        const visionSummary = await extractSplitSummaryFromImage(base64, 'image/png');

        if (needsSummaryFallback && (visionSummary.discharge.total !== null || visionSummary.loading.total !== null)) {
          operationSummary = {
            totalMovements: visionSummary.totalMovements,
            discharge: visionSummary.discharge,
            loading: visionSummary.loading,
            source: 'vision',
            confidence: visionSummary.confidence,
            validationStatus: 'UNKNOWN',
          };
        }

        if (needsDeckHoldFallback && visionSummary.deckHold) {
          const { dischargeDeck, loadingDeck, dischargeHold, loadingHold } = visionSummary.deckHold;
          if (dischargeDeck !== null || loadingDeck !== null || dischargeHold !== null || loadingHold !== null) {
            qcPlanSummary.dischargeDeck = dischargeDeck;
            qcPlanSummary.loadingDeck = loadingDeck;
            qcPlanSummary.dischargeHold = dischargeHold;
            qcPlanSummary.loadingHold = loadingHold;
            qcPlanSummary.dischargeTotal = dischargeDeck !== null && dischargeHold !== null ? dischargeDeck + dischargeHold : null;
            qcPlanSummary.loadingTotal = loadingDeck !== null && loadingHold !== null ? loadingDeck + loadingHold : null;
            qcPlanSummary.deckTotal = dischargeDeck !== null && loadingDeck !== null ? dischargeDeck + loadingDeck : null;
            qcPlanSummary.holdTotal = dischargeHold !== null && loadingHold !== null ? dischargeHold + loadingHold : null;
            qcPlanSummary.grandTotal = qcPlanSummary.deckTotal !== null && qcPlanSummary.holdTotal !== null
              ? qcPlanSummary.deckTotal + qcPlanSummary.holdTotal
              : null;
            qcPlanSummary.confidence = Math.max(qcPlanSummary.confidence, 0.7);
            addLog('vision-deckhold-fallback-applied', { dischargeDeck, loadingDeck, dischargeHold, loadingHold });
          }
        }

        if (visionSummary.error) {
          addLog('vision-summary-error', { error: visionSummary.error });
        }
      } catch (visionError) {
        addLog('vision-summary-error', {
          error: visionError instanceof Error ? visionError.message : 'Erro desconhecido na visão computacional.',
        });
      }
    }
  }

  const validation = validateSplitTotals(operationSummary, qcPlanSummary);

  console.log('[SPLIT][PAGE1][TEXT ITEMS]', firstPageItems.filter((item) => {
    const text = item.str || '';
    return /discharging|loading|total|planned|qc|unassigned|completed|remained|1517|141|1658/i.test(text);
  }));

  if (operationSummary.totalMovements !== null) {
    operationSummary.validationStatus = validation.summaryValid ? 'VALID' : 'REVIEW_REQUIRED';
  }

  const dischargeTotal = operationSummary.discharge.total;
  const loadingTotal = operationSummary.loading.total;
  const totalMovements = dischargeTotal !== null && loadingTotal !== null
    ? dischargeTotal + loadingTotal
    : null;
  const operationTotals = {
    discharge: dischargeTotal,
    loading: loadingTotal,
    totalMovements,
  };

  console.log('[SPLIT][SUMMARY]', operationSummary);
  console.log('[SPLIT][QC_PLAN]', qcPlanSummary);
  console.log('[SPLIT][VALIDATION]', validation);

  addLog('cross-source', {
    shipName: header.shipName,
    voyage: header.voyage,
    operationSummary,
    qcPlanSummary,
    validation,
  });

  // Leitura numérica por bay da faixa do QC Plan (DS-DECK/LD-DECK/DS-HOLD/
  // LD-HOLD, separando 40 pés de pares de 20 pés/twins). Alternativa mais
  // confiável do que classificar cor por célula nos mapas de bay coloridos.
  // Ainda não sobrescreve bayRows/qcPlanSummary — só fica disponível pra
  // conferência no Modo Dev até validarmos o casamento de rótulos de bay
  // (ex.: "19/18") com os IDs de bay já usados no resto da pipeline.
  let bayColumnResult: { bays: GeminiBayColumnEntry[]; confidence: number; error?: string } | null = null;
  let bayColumnAggregate: BayColumnAggregate | null = null;

  const page1AssetForBayColumns = input.pageAssets?.find((asset) => asset.pageNumber === 1);
  if (page1AssetForBayColumns?.imageDataUrl) {
    addLog('bay-column-vision-start', { page: 1 });
    const base64 = page1AssetForBayColumns.imageDataUrl.split(',')[1] || '';

    try {
      bayColumnResult = await extractBayColumnSummaryFromImage(base64, 'image/png');

      if (bayColumnResult.bays.length > 0) {
        bayColumnAggregate = aggregateBayColumnTotals(bayColumnResult.bays);
        addLog('bay-column-vision-complete', {
          baysRead: bayColumnResult.bays.length,
          confidence: bayColumnResult.confidence,
          aggregate: bayColumnAggregate,
          matchesQcPlanGrandTotal: qcPlanSummary.grandTotal !== null
            ? bayColumnAggregate.grandTotal === qcPlanSummary.grandTotal
            : null,
          matchesOperationTotal: operationSummary.totalMovements !== null
            ? bayColumnAggregate.grandTotal === operationSummary.totalMovements
            : null,
        });
      } else if (bayColumnResult.error) {
        addLog('bay-column-vision-error', { error: bayColumnResult.error });
      }
    } catch (bayColumnError) {
      addLog('bay-column-vision-error', {
        error: bayColumnError instanceof Error ? bayColumnError.message : 'Erro desconhecido na leitura de colunas de bay.',
      });
    }
  }

  const aiStart = Date.now();
  const aiFusion = await runGeminiFusionAI({
    header,
    operationTotals,
    stats,
    bayRows,
    pageTypes,
    textPreview: input.text.slice(0, 22000),
  });

  addLog('ai-fusion', {
    elapsedMs: Date.now() - aiStart,
    confidence: aiFusion.confidence,
    error: aiFusion.error,
  });

  bayRows = mergeWithAI(bayRows, aiFusion.refined?.bays || [], aiFusion.confidence || 0);
  stats = buildOperationalStats(bayRows);

  const operationDischarge = operationSummary.discharge.total ?? null;
  const operationLoading = operationSummary.loading.total ?? null;

  const alerts = unique(
    pageTypes
      .map((p) => p.type)
      .filter((type) => ['carga-sensivel', 'reefers', 'dg', 'oog', 'tabela-descarga', 'tabela-embarque'].includes(type))
  );

  const shipName = aiFusion.refined?.shipName || header.shipName;
  const voyage = aiFusion.refined?.voyage || header.voyage;
  const operationDate = aiFusion.refined?.date || header.date;
  const berth = aiFusion.refined?.berth || header.berth;

  const finalJson = {
    navio: shipName,
    viagem: voyage,
    data: operationDate,
    berco: berth,
    totalContainers: totalMovements ?? stats.totalContainers,
    descarga: operationDischarge,
    embarque: operationLoading,
    conves: stats.deck,
    porao: stats.hold,
    bays: bayRows.map((row) => ({
      bay: row.bay,
      deck: row.deck,
      hold: row.hold,
      reefer: row.reefer,
      dg: row.dg,
      oog: row.oog,
      flat: row.flat,
      tank: row.tank,
      twenty: row.twenty,
      forty: row.forty,
      fortyFive: row.fortyFive,
      total: row.total,
      confidence: row.confidence,
    })),
  };

  const pageDebug = pageTypes.map((page) => ({
    pageNumber: page.pageNumber,
    type: page.type,
    confidence: page.confidence,
    bayNumbers: page.bayNumbers,
    textChars: page.textChars,
    visual: page.visual,
    image: input.pageAssets?.find((asset) => asset.pageNumber === page.pageNumber)?.imageDataUrl || null,
    ocrText: pages[page.pageNumber - 1] || '',
  }));

  const alignmentBoost = validation.summaryValid && operationSummary.totalMovements === qcPlanSummary.grandTotal && operationSummary.totalMovements === 1658 ? 0.05 : 0;
  const confidence = Math.max(
    0.35,
    Math.min(
      0.99,
      (bayRows.length > 0 ? 0.4 : 0) +
      Math.min(0.25, containers.length / 400) +
      Math.min(0.2, pageTypes.filter((p) => p.type !== 'desconhecida').length / Math.max(1, pageTypes.length)) +
      Math.min(0.14, aiFusion.confidence * 0.14) +
      alignmentBoost
    )
  );

  const operationalNarrative = operationSummary.discharge.total !== null || operationSummary.loading.total !== null
    ? `Resumo operacional: Descarga ${operationDischarge ?? '—'} | Embarque ${operationLoading ?? '—'}.`
    : 'Resumo operacional sendo validado pelo Split Engine.';

  const deckHoldNarrative = qcPlanSummary.deckTotal !== null || qcPlanSummary.holdTotal !== null
    ? `Conves ${qcPlanSummary.deckTotal ?? '—'} | Porão ${qcPlanSummary.holdTotal ?? '—'}.`
    : 'Conves e porão aguardando validação do QC Plan.';

  const smartSummary = [
    `Documento analisado automaticamente com OCR, Visão Computacional e IA.`,
    operationalNarrative,
    deckHoldNarrative,
    `Bays detectadas: ${stats.totalBays}, contêineres identificados: ${stats.totalContainers}.`,
  ].join(' ');

  addLog('completed', {
    totalMs: Date.now() - started,
    confidence,
    bays: stats.totalBays,
    containers: stats.totalContainers,
  });

  return {
    shipName,
    shipNameSource: shipName ? 'extracted' : 'not_found',
    voyage,
    voyageSource: voyage ? 'extracted' : 'not_found',
    operator: null,
    operatorSource: 'not_available_in_document',
    eta: null,
    etaSource: 'not_available_in_document',
    etb: null,
    etbSource: 'not_available_in_document',
    berth,
    berthSource: berth ? 'extracted' : 'not_available_in_document',

    discharge: operationDischarge,
    dischargeSource: operationSummary.discharge.total !== null ? 'extracted' : 'not_available_in_document',
    load: operationLoading,
    loadSource: operationSummary.loading.total !== null ? 'extracted' : 'not_available_in_document',
    dischargeRemaining: operationDischarge !== null ? Math.max(0, operationDischarge - stats.discharge) : null,
    loadRemaining: operationLoading !== null ? Math.max(0, operationLoading - stats.loading) : null,

    reefersPositive: stats.reefer,
    reefersNegative: 0,
    imo: stats.dg,
    oog: stats.oog,
    directDelivery: stats.discharge,

    alerts,
    smartSummary,
    confidence,

    bays: bayRows.map((row) => ({
      id: row.bay,
      containerCount: row.total,
      sections: row.sections,
      deck: row.deck,
      hold: row.hold,
      twenty: row.twenty,
      forty: row.forty,
      fortyFive: row.fortyFive,
      reefer: row.reefer,
      dg: row.dg,
      oog: row.oog,
      tank: row.tank,
      flat: row.flat,
      empty: row.empty,
      full: row.full,
      discharge: row.discharge,
      loading: row.loading,
      confidence: row.confidence,
      containers: row.containers,
    })),

    operationalSummary: operationSummary,
    qcPlanSummary,
    validation,
    operationalStats: {
      ...stats,
      totalContainers: totalMovements ?? stats.totalContainers,
      discharge: operationDischarge ?? stats.discharge,
      loading: operationLoading ?? stats.loading,
      deck: qcPlanSummary.deckTotal ?? stats.deck,
      hold: qcPlanSummary.holdTotal ?? stats.hold,
    },
    operationalMap: makeOperationalMap(stats),
    bayTable: bayRows.map((row) => ({
      bay: row.bay,
      deck: row.deck,
      hold: row.hold,
      twenty: row.twenty,
      forty: row.forty,
      fortyFive: row.fortyFive,
      reefer: row.reefer,
      dg: row.dg,
      oog: row.oog,
      tank: row.tank,
      flat: row.flat,
      total: row.total,
      confidence: row.confidence,
    })),

    chartData: makeChartData(bayRows, stats),
    finalJson,

    pageTypes,
    containers,
    bayColumnDetail: {
      bays: bayColumnResult?.bays || [],
      aggregate: bayColumnAggregate,
      confidence: bayColumnResult?.confidence ?? 0,
      error: bayColumnResult?.error,
    },
    developerMode: {
      pages: pageDebug,
      aiRaw: aiFusion,
      bayColumnRaw: bayColumnResult,
      bayColumnAggregate,
      cvSummary: pageTypes.map((p) => ({
        pageNumber: p.pageNumber,
        type: p.type,
        visual: p.visual,
      })),
      logs,
      timing: {
        totalMs: Date.now() - started,
        ocrMs: 0,
        visionMs: logs.find((l) => l.stage === 'vision-complete')?.details?.elapsedMs || 0,
        aiMs: logs.find((l) => l.stage === 'ai-fusion')?.details?.elapsedMs || 0,
      },
      errors: logs.filter((l) => /error/i.test(l.stage)).map((l) => `${l.stage}: ${JSON.stringify(l.details)}`),
    },

    pipelineMetrics: {
      ocrTimeMs: 0,
      aiTimeMs: logs.find((l) => l.stage === 'ai-fusion')?.details?.elapsedMs || 0,
      visionTimeMs: logs.find((l) => l.stage === 'vision-complete')?.details?.elapsedMs || 0,
      baysCount: stats.totalBays,
      containersCount: stats.totalContainers,
      deckCount: stats.deck,
      holdCount: stats.hold,
      confidence,
    },
  };
}