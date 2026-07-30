import type { PDFPageAsset } from './pdfService';

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
  totals: { discharge: number; loading: number };
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

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
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
          maxOutputTokens: 4096,
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
  const totals = extractOperationTotals(allLines);

  addLog('cross-source', {
    shipName: header.shipName,
    voyage: header.voyage,
    totals,
  });

  const aiStart = Date.now();
  const aiFusion = await runGeminiFusionAI({
    header,
    totals,
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

  const operationDischarge = totals.discharge > 0 ? totals.discharge : stats.discharge;
  const operationLoading = totals.loading > 0 ? totals.loading : stats.loading;

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
    totalContainers: stats.totalContainers,
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

  const confidence = Math.max(
    0.35,
    Math.min(
      0.99,
      (bayRows.length > 0 ? 0.4 : 0) +
      Math.min(0.25, containers.length / 400) +
      Math.min(0.2, pageTypes.filter((p) => p.type !== 'desconhecida').length / Math.max(1, pageTypes.length)) +
      Math.min(0.14, aiFusion.confidence * 0.14)
    )
  );

  const smartSummary = [
    `Documento analisado automaticamente com OCR, Visão Computacional e IA.`,
    `Bays detectadas: ${stats.totalBays}, contêineres identificados: ${stats.totalContainers}.`,
    `Operação: Descarga ${operationDischarge} | Embarque ${operationLoading}.`,
    `Conves ${stats.deck} | Porão ${stats.hold} | Reefers ${stats.reefer} | DG ${stats.dg} | OOG ${stats.oog}.`,
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
    dischargeSource: operationDischarge > 0 ? 'extracted' : 'not_available_in_document',
    load: operationLoading,
    loadSource: operationLoading > 0 ? 'extracted' : 'not_available_in_document',
    dischargeRemaining: Math.max(0, operationDischarge - stats.discharge),
    loadRemaining: Math.max(0, operationLoading - stats.loading),

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

    operationalStats: stats,
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
    developerMode: {
      pages: pageDebug,
      aiRaw: aiFusion,
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
