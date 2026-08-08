/**
 * Leitor determinístico de SPLIT (BTP SmartTools).
 *
 * Ao contrário do pipeline legado (`splitIntelligenceService.ts`), este módulo:
 * - Analisa SOMENTE a página 1 do PDF (nunca as demais).
 * - Recorta SOMENTE a faixa horizontal do perfil longitudinal do navio
 *   (DS-DECK / LD-DECK / DS-HOLD / LD-HOLD + linha de bays), usando âncoras
 *   de texto nativo quando disponíveis (sem custo de IA) e, só na falta
 *   delas, um fallback de visão computacional para localizar a região.
 * - A IA (temperature 0) só é usada para LER os números de cada célula.
 *   Toda associação número->bay, soma, divisão e totalização é feita aqui,
 *   em código determinístico — nunca pela IA.
 * - Cada arquivo novo começa uma análise 100% limpa (nada de estado anterior).
 */

import { extractFirstPageForBayProfile, type Page1TextItem } from './pdfService';
import {
  detectDecoyGridBoundary,
  detectShipProfileBoundingBox,
  extractBaySplitReadings,
  extractBayTotalRow,
  type BayTotalReading,
  type BayTotalRowResult,
  type SplitBayArea,
  type SplitBayReading,
  type SplitBayReadingsResult,
} from './geminiService';

export interface SplitBayRow {
  bay: string;
  /** Total OFICIAL da bay, lido da linha de caixas brancas acima do DS-DECK. Nunca recalculado a partir de descarga+embarque. */
  total: number | null;
  totalConfidence: number;
  totalNeedsReview: boolean;
  dsDeck: number | null;
  ldDeck: number | null;
  dsHold: number | null;
  ldHold: number | null;
  /** Presente só quando a célula correspondente é "twin" (2 contêineres de 20' no mesmo slot) — os dois valores lado a lado, na ordem visual. Só para exibição (2 quadradinhos); a soma já está no campo principal (dsDeck/ldDeck/dsHold/ldHold). */
  dsDeckParts: number[] | null;
  ldDeckParts: number[] | null;
  dsHoldParts: number[] | null;
  ldHoldParts: number[] | null;
  /** Descarga/embarque calculados a partir das faixas coloridas — apenas composição, nunca sobrescrevem `total`. */
  discharge: number;
  load: number;
  /** true quando discharge+load não bate com `total` — a composição (não o total) precisa de confirmação manual. */
  compositionMismatch: boolean;
  confidence: number;
  needsReview: boolean;
}

export interface SplitBayAnalysisResult {
  vessel: string | null;
  voyage: string | null;
  bays: SplitBayRow[];
  totalDischarge: number;
  totalLoad: number;
  totalMoves: number;
  numberOfActiveBays: number;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  regionSource: 'text-anchors' | 'vision-fallback' | 'full-page-fallback';
  totalsSource: 'native-text' | 'vision-ai';
  croppedImageDataUrl: string | null;
  fullPageImageDataUrl: string;
}


const SPLIT_BAY_AREAS: SplitBayArea[] = ['DS-DECK', 'LD-DECK', 'DS-HOLD', 'LD-HOLD'];
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

interface TextRow {
  y: number;
  items: Page1TextItem[];
}

function groupRows(items: Page1TextItem[], toleranceY = 6): TextRow[] {
  const rows: TextRow[] = [];
  for (const item of items) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= toleranceY);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  rows.forEach((row) => row.items.sort((a, b) => a.x - b.x));
  rows.sort((a, b) => a.y - b.y);
  return rows;
}

function normalizeLabel(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '');
}

function rowText(row: TextRow): string {
  return normalizeLabel(row.items.map((item) => item.str).join(''));
}

function isBayNumberToken(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return n >= 0 && n <= 70;
}

function isTotalToken(value: string): boolean {
  return /^\d{1,4}$/.test(value.trim());
}

interface AnchorBay {
  label: string;
  xCenter: number;
}

interface AnchorDetectionResult {
  region: { x0: number; y0: number; x1: number; y1: number };
  bays: AnchorBay[];
  /** Totais lidos diretamente do texto nativo do PDF (linha de caixas brancas), por índice de coluna. null se não encontrados via texto. */
  totalsFromText: Map<number, number> | null;
}

/**
 * Localiza, via texto nativo (zero IA), a linha de CAIXAS BRANCAS com o total
 * oficial de cada bay — sempre a linha numérica mais próxima IMEDIATAMENTE
 * ACIMA da faixa DS-DECK. Associa cada número à bay mais próxima pela posição
 * horizontal (x). Retorna null se não houver uma linha candidata suficiente
 * (ex.: totais só existem como imagem rasterizada, sem texto selecionável).
 */
function detectBayTotalsFromTextAnchors(rows: TextRow[], dsDeckRow: TextRow, bays: AnchorBay[]): Map<number, number> | null {
  const above = rows.filter((row) => row.y < dsDeckRow.y);
  const minTokens = Math.max(4, Math.floor(bays.length * 0.5));

  const candidates = above
    .map((row) => ({ row, numericItems: row.items.filter((item) => isTotalToken(item.str)) }))
    .filter((candidate) => candidate.numericItems.length >= minTokens);

  if (candidates.length === 0) return null;

  // A linha do total fica logo acima do DS-DECK: escolhe a candidata com maior y (mais próxima).
  candidates.sort((a, b) => b.row.y - a.row.y);
  const chosen = candidates[0];

  const totals = new Map<number, number>();
  for (const item of chosen.numericItems) {
    const xCenter = item.x + item.width / 2;
    let bestIndex = -1;
    let bestDistance = Infinity;
    bays.forEach((bay, index) => {
      const distance = Math.abs(bay.xCenter - xCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      totals.set(bestIndex, Number(item.str.trim()));
    }
  }

  return totals.size > 0 ? totals : null;
}


/**
 * Localiza a região do perfil do navio usando SOMENTE texto nativo do PDF
 * (zero chamadas de IA). Retorna null quando os rótulos DS-DECK/LD-DECK/
 * DS-HOLD/LD-HOLD e/ou a linha de bays não puderem ser localizados com
 * segurança (ex.: página inteiramente rasterizada) — nesse caso o chamador
 * deve usar o fallback de visão computacional.
 */
function detectRegionFromTextAnchors(items: Page1TextItem[], width: number, height: number): AnchorDetectionResult | null {
  const rows = groupRows(items);

  const dsDeckRow = rows.find((row) => rowText(row).includes('DSDECK'));
  const ldDeckRow = rows.find((row) => rowText(row).includes('LDDECK'));
  const dsHoldRow = rows.find((row) => rowText(row).includes('DSHOLD'));
  const ldHoldRow = rows.find((row) => rowText(row).includes('LDHOLD'));

  const anchorRows = [dsDeckRow, ldDeckRow, dsHoldRow, ldHoldRow];
  if (anchorRows.some((row) => !row)) {
    return null;
  }

  const candidateBayRows = rows
    .map((row) => ({ row, numericItems: row.items.filter((item) => isBayNumberToken(item.str)) }))
    .filter((candidate) => candidate.numericItems.length >= 6);

  if (candidateBayRows.length === 0) {
    return null;
  }

  const belowLdHold = ldHoldRow
    ? candidateBayRows.filter((candidate) => candidate.row.y > (ldHoldRow as TextRow).y)
    : candidateBayRows;
  const pool = belowLdHold.length > 0 ? belowLdHold : candidateBayRows;

  const bayRowCandidate = pool.reduce<typeof pool[0] | null>(
    (best, candidate) => (!best || candidate.numericItems.length > best.numericItems.length ? candidate : best),
    null
  );

  if (!bayRowCandidate) return null;

  const bays: AnchorBay[] = bayRowCandidate.numericItems
    .map((item) => ({ label: item.str.trim(), xCenter: item.x + item.width / 2 }))
    .sort((a, b) => a.xCenter - b.xCenter);

  if (bays.length === 0) return null;

  const allAnchorItems = anchorRows.flatMap((row) => (row ? row.items : []));
  const minY = Math.min(...allAnchorItems.map((item) => item.y));
  const bayRowBottom = bayRowCandidate.row.y + Math.max(...bayRowCandidate.numericItems.map((item) => item.height));

  const marginX = width * 0.03;
  const marginY = height * 0.02;
  // Headroom extra para incluir a linha de caixas brancas com o total oficial de cada bay,
  // que fica imediatamente ACIMA de DS-DECK (fora da faixa das 4 áreas coloridas).
  const rowHeightEstimate = Math.max(...allAnchorItems.map((item) => item.height), 10);

  const x0 = Math.max(0, Math.min(...bays.map((b) => b.xCenter)) - marginX * 2);
  const x1 = Math.min(width, Math.max(...bays.map((b) => b.xCenter)) + marginX * 2);
  const y0 = Math.max(0, minY - marginY * 3 - rowHeightEstimate * 2);
  const y1 = Math.min(height, bayRowBottom + marginY * 2);

  const totalsFromText = dsDeckRow ? detectBayTotalsFromTextAnchors(rows, dsDeckRow, bays) : null;

  return { region: { x0, y0, x1, y1 }, bays, totalsFromText };
}

function cropImageDataUrl(
  imageDataUrl: string,
  region: { x0: number; y0: number; x1: number; y1: number },
  sourceWidth: number,
  sourceHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const x = Math.max(0, Math.round(region.x0));
      const y = Math.max(0, Math.round(region.y0));
      const w = Math.max(1, Math.min(sourceWidth - x, Math.round(region.x1 - region.x0)));
      const h = Math.max(1, Math.min(sourceHeight - y, Math.round(region.y1 - region.y0)));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao criar contexto 2D para recorte da imagem.'));
        return;
      }
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png', 0.95));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem renderizada para recorte.'));
    img.src = imageDataUrl;
  });
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] || '';
}

/**
 * Reduz uma imagem para no máximo `maxDimension` pixels no maior lado,
 * preservando a proporção. Usado para a tarefa de localização aproximada
 * da região do perfil do navio — essa tarefa não precisa de detalhe fino
 * (não lê números, só identifica o layout geral da página), e mandar a
 * imagem inteira em altíssima resolução (necessária para a leitura de
 * números depois) só deixa essa chamada mais lenta, sem ganho de precisão.
 */
function downscaleImageDataUrl(imageDataUrl: string, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao criar contexto 2D para reduzir a imagem.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png', 0.92));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para redução de resolução.'));
    img.src = imageDataUrl;
  });
}

/** Tenta identificar navio/viagem a partir do cabeçalho textual da página 1 (best-effort, nunca bloqueia a análise). */
function guessVesselAndVoyage(items: Page1TextItem[]): { vessel: string | null; voyage: string | null } {
  const rows = groupRows(items, 4).sort((a, b) => a.y - b.y);

  for (const row of rows.slice(0, 12)) {
    const text = row.items.map((item) => item.str).join(' ').trim();
    if (!text || !/>/.test(text)) continue;

    const left = text.split('>')[0]?.trim() || '';
    const tokens = left.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;

    const maybeVoyage = tokens[tokens.length - 1];
    if (/^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(maybeVoyage)) {
      return { vessel: tokens.slice(0, -1).join(' ') || null, voyage: maybeVoyage };
    }
    return { vessel: left || null, voyage: null };
  }

  return { vessel: null, voyage: null };
}

function buildBayRows(
  bayLabels: string[],
  readings: SplitBayReading[],
  totalReadings: BayTotalReading[],
  warnings: string[]
): SplitBayRow[] {
  const maxColumnIndex = readings.reduce((max, reading) => Math.max(max, reading.columnIndex), -1);
  const columnCount = Math.max(bayLabels.length, maxColumnIndex + 1);

  const readingKey = (columnIndex: number, area: SplitBayArea) => `${columnIndex}|${area}`;
  const seenKeys = new Map<string, SplitBayReading>();
  for (const reading of readings) {
    const key = readingKey(reading.columnIndex, reading.area);
    const existing = seenKeys.get(key);
    if (existing && existing.quantidade !== reading.quantidade) {
      warnings.push(
        `Leitura duplicada/inconsistente na coluna ${reading.columnIndex + 1} (${reading.area}): valores ${existing.quantidade} e ${reading.quantidade}. Mantido o primeiro valor lido.`
      );
      continue;
    }
    if (!existing) seenKeys.set(key, reading);
  }

  const totalsByColumn = new Map<number, BayTotalReading>();
  for (const totalReading of totalReadings) {
    const existing = totalsByColumn.get(totalReading.columnIndex);
    if (existing && existing.quantidade !== totalReading.quantidade) {
      warnings.push(
        `Leitura duplicada/inconsistente do TOTAL oficial na coluna ${totalReading.columnIndex + 1}: valores ${existing.quantidade} e ${totalReading.quantidade}. Mantido o primeiro valor lido.`
      );
      continue;
    }
    if (!existing) totalsByColumn.set(totalReading.columnIndex, totalReading);
  }

  const rows: SplitBayRow[] = [];
  for (let i = 0; i < columnCount; i++) {
    const label = bayLabels[i] || `Coluna ${i + 1}`;
    const cellFor = (area: SplitBayArea) => seenKeys.get(readingKey(i, area)) || null;

    const dsDeckReading = cellFor('DS-DECK');
    const ldDeckReading = cellFor('LD-DECK');
    const dsHoldReading = cellFor('DS-HOLD');
    const ldHoldReading = cellFor('LD-HOLD');

    const dsDeck = dsDeckReading?.quantidade ?? null;
    const ldDeck = ldDeckReading?.quantidade ?? null;
    const dsHold = dsHoldReading?.quantidade ?? null;
    const ldHold = ldHoldReading?.quantidade ?? null;

    const dsDeckParts = dsDeckReading?.parts ?? null;
    const ldDeckParts = ldDeckReading?.parts ?? null;
    const dsHoldParts = dsHoldReading?.parts ?? null;
    const ldHoldParts = ldHoldReading?.parts ?? null;

    const cellReadings = [dsDeckReading, ldDeckReading, dsHoldReading, ldHoldReading];
    const confidences = cellReadings.map((r) => r?.confidence ?? 0);
    const rowConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
    const colorNeedsReview = cellReadings.some((r) => !r || r.quantidade === null || r.confidence < LOW_CONFIDENCE_THRESHOLD);

    const discharge = (dsDeck ?? 0) + (dsHold ?? 0);
    const load = (ldDeck ?? 0) + (ldHold ?? 0);

    const totalReading = totalsByColumn.get(i) || null;
    const total = totalReading?.quantidade ?? null;
    const totalConfidence = totalReading?.confidence ?? 0;
    const totalNeedsReview = !totalReading || totalReading.quantidade === null || totalReading.confidence < LOW_CONFIDENCE_THRESHOLD;

    const compositionMismatch = total !== null && discharge + load !== total;
    if (compositionMismatch) {
      warnings.push(
        `Bay ${label}: descarga (${discharge}) + embarque (${load}) = ${discharge + load}, mas o TOTAL OFICIAL (caixa branca) é ${total}. A composição foi marcada como "PRECISA DE CONFIRMAÇÃO" — o total oficial foi mantido.`
      );
    }

    rows.push({
      bay: label,
      total,
      totalConfidence,
      totalNeedsReview,
      dsDeck,
      ldDeck,
      dsHold,
      ldHold,
      dsDeckParts,
      ldDeckParts,
      dsHoldParts,
      ldHoldParts,
      discharge,
      load,
      compositionMismatch,
      confidence: rowConfidence,
      needsReview: totalNeedsReview || compositionMismatch || colorNeedsReview,
    });
  }

  return rows;
}

export async function analyzeSplitFromFile(file: File): Promise<SplitBayAnalysisResult> {
  const warnings: string[] = [];

  const page1 = await extractFirstPageForBayProfile(file, 4.5);
  const { vessel, voyage } = guessVesselAndVoyage(page1.textItems);

  const anchorDetection = detectRegionFromTextAnchors(page1.textItems, page1.width, page1.height);

  let regionSource: SplitBayAnalysisResult['regionSource'];
  let region: { x0: number; y0: number; x1: number; y1: number };
  let bayOrderHint: string[] = [];

  if (anchorDetection) {
    regionSource = 'text-anchors';
    region = anchorDetection.region;
    bayOrderHint = anchorDetection.bays.map((b) => b.label);
  } else {
    warnings.push('Não foi possível localizar DS-DECK/LD-DECK/DS-HOLD/LD-HOLD via texto nativo do PDF. Usando visão computacional apenas para localizar a região (não para ler números).');

    const localizationImageDataUrl = await downscaleImageDataUrl(page1.imageDataUrl, 1400);
    const bboxResult = await detectShipProfileBoundingBox(dataUrlToBase64(localizationImageDataUrl), 'image/png');

    // Usa QUALQUER box retornado, mesmo com confiança baixa: a confiança que
    // a própria IA reporta costuma ser mal calibrada (subestima com
    // frequência), e um recorte imperfeito ainda é muito melhor para a
    // leitura seguinte do que mandar a página inteira (com Crane Coverage,
    // Discharging/Loading, a segunda tabela de guindaste/turno que imita os
    // mesmos rótulos DS-DECK/LD-DECK/DS-HOLD/LD-HOLD, etc. competindo por
    // atenção). Só cai pra página inteira se a IA realmente não conseguiu
    // identificar NENHUMA região (box null).
    if (bboxResult.box) {
      regionSource = 'vision-fallback';
      if (bboxResult.confidence < 0.15) {
        warnings.push(`Região do perfil do navio localizada por visão computacional com confiança baixa (${Math.round(bboxResult.confidence * 100)}%) — confira visualmente o recorte antes de salvar.`);
      }
      // Padding de 4% em cada direção: protege contra o box vir um pouco
      // apertado demais e cortar uma borda do perfil do navio.
      const padX = page1.width * 0.04;
      const padY = page1.height * 0.04;
      region = {
        x0: Math.max(0, bboxResult.box.x0 * page1.width - padX),
        y0: Math.max(0, bboxResult.box.y0 * page1.height - padY),
        x1: Math.min(page1.width, bboxResult.box.x1 * page1.width + padX),
        y1: Math.min(page1.height, bboxResult.box.y1 * page1.height + padY),
      };
    } else {
      regionSource = 'full-page-fallback';
      region = { x0: 0, y0: 0, x1: page1.width, y1: page1.height };
      warnings.push('Não foi possível localizar a região do perfil do navio com confiança. Enviando a página inteira como último recurso — revise o resultado com atenção.');
    }
  }

  let croppedImageDataUrl = await cropImageDataUrl(page1.imageDataUrl, region, page1.width, page1.height);
  let croppedBase64 = dataUrlToBase64(croppedImageDataUrl);

  if (regionSource !== 'text-anchors') {
    // O caminho de âncoras de texto já para exatamente na linha de números de
    // bay (determinístico). Nos caminhos de visão, pedir pra IA "não incluir"
    // a tabela de guindaste/turno como parte do prompt de localização maior
    // não é suficiente na prática — o recorte devolvido às vezes continua
    // incluindo essa segunda tabela inteira (já observado em mais de um
    // documento real). Por isso, aqui SEMPRE fazemos uma segunda verificação
    // dedicada e recortamos programaticamente se ela for detectada.
    const decoyCheckImage = await downscaleImageDataUrl(croppedImageDataUrl, 1200);
    const decoyResult = await detectDecoyGridBoundary(dataUrlToBase64(decoyCheckImage), 'image/png');

    if (decoyResult.hasDecoyGrid && decoyResult.boundaryY) {
      const trimmedRegion = {
        ...region,
        y1: region.y0 + (region.y1 - region.y0) * decoyResult.boundaryY,
      };
      croppedImageDataUrl = await cropImageDataUrl(page1.imageDataUrl, trimmedRegion, page1.width, page1.height);
      croppedBase64 = dataUrlToBase64(croppedImageDataUrl);
      warnings.push('Detectada e removida automaticamente uma segunda tabela (atribuição de guindaste/turno) que apareceu colada abaixo do perfil do navio no recorte inicial.');
    } else if (decoyResult.error) {
      warnings.push(`Não foi possível verificar se havia uma segunda tabela (guindaste/turno) coladas ao recorte: ${decoyResult.error}`);
    }
  }

  // Total oficial de cada bay vem da linha de caixas brancas acima do DS-DECK.
  // Preferimos SEMPRE o texto nativo do PDF (100% determinístico); a IA só é
  // usada como fallback quando essa linha não existe como texto selecionável.
  const totalsFromText = regionSource === 'text-anchors' ? anchorDetection?.totalsFromText ?? null : null;

  let totalReadings: BayTotalReading[];
  let totalsSource: SplitBayAnalysisResult['totalsSource'];
  let readingResult: SplitBayReadingsResult;
  let totalRowResult: BayTotalRowResult | null;

  if (bayOrderHint.length > 0) {
    // A lista de bays já é confiável (âncoras de texto) — as duas leituras
    // podem rodar em paralelo com segurança, pois ambas recebem o MESMO hint.
    const [readingRes, totalRes] = await Promise.all([
      extractBaySplitReadings(croppedBase64, 'image/png', bayOrderHint),
      totalsFromText ? Promise.resolve(null) : extractBayTotalRow(croppedBase64, 'image/png', bayOrderHint),
    ]);
    readingResult = readingRes;
    totalRowResult = totalRes;
  } else {
    // Sem âncoras de texto, NENHUMA das duas chamadas tem de antemão uma
    // lista confiável de colunas/bays — cada uma teria que adivinhar sozinha
    // quantas colunas existem e em que ordem. Bays sem carga (total 0) podem
    // ser puladas por uma chamada e não pela outra, e as duas leituras saem
    // de sincronia: o código junta os resultados só por columnIndex
    // (posição), então um desalinhamento de 1 coluna já cola o total oficial
    // na bay ERRADA — bug real já observado (ex.: total de uma bay aparecendo
    // em outra, soma geral batendo errado). Por isso, aqui SEMPRE lemos
    // primeiro DS-DECK/LD-DECK/DS-HOLD/LD-HOLD e usamos a lista de bays que
    // essa leitura detectou como hint da segunda chamada — garantindo que as
    // duas leituras usem a MESMA indexação de colunas.
    readingResult = await extractBaySplitReadings(croppedBase64, 'image/png', bayOrderHint);
    const sharedBayOrder = readingResult.bayLabelsDetected.length > 0 ? readingResult.bayLabelsDetected : bayOrderHint;
    totalRowResult = totalsFromText ? null : await extractBayTotalRow(croppedBase64, 'image/png', sharedBayOrder);
  }

  if (totalsFromText) {
    totalsSource = 'native-text';
    totalReadings = bayOrderHint.map((_, index) => ({
      columnIndex: index,
      quantidade: totalsFromText.has(index) ? (totalsFromText.get(index) as number) : 0,
      confidence: totalsFromText.has(index) ? 1 : 0.9,
    }));
  } else {
    totalsSource = 'vision-ai';
    warnings.push('A linha de totais oficiais (caixas brancas) não pôde ser lida via texto nativo do PDF — usando leitura por IA (temperature 0). Confirme visualmente antes de salvar.');
    if (totalRowResult?.error) {
      warnings.push(`Falha ao ler a linha de totais oficiais: ${totalRowResult.error}`);
    }
    totalReadings = totalRowResult?.totals ?? [];
  }

  if (readingResult.error) {
    warnings.push(`Falha ao ler os números do perfil do navio: ${readingResult.error}`);
  }

  const bayLabels = bayOrderHint.length > 0 ? bayOrderHint : (readingResult.bayLabelsDetected.length > 0 ? readingResult.bayLabelsDetected : totalRowResult?.bayLabelsDetected ?? []);
  if (bayLabels.length === 0 && readingResult.readings.length === 0 && totalReadings.length === 0) {
    warnings.push('Não foi possível confirmar nenhuma bay ou número neste documento.');
  }

  const bays = buildBayRows(bayLabels, readingResult.readings, totalReadings, warnings);

  const totalMoves = bays.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const totalDischarge = bays.reduce((sum, row) => sum + row.discharge, 0);
  const totalLoad = bays.reduce((sum, row) => sum + row.load, 0);

  if (totalDischarge + totalLoad !== totalMoves) {
    warnings.push('A soma de descarga+embarque não bate com a soma dos totais oficiais das bays. Os totais oficiais (caixas brancas) foram mantidos como referência.');
  }

  const numberOfActiveBays = bays.filter((row) => (row.total ?? 0) > 0).length;

  const anchorsConfirmed = regionSource === 'text-anchors';
  const averageRowConfidence = bays.length > 0 ? bays.reduce((sum, row) => sum + row.confidence, 0) / bays.length : 0;
  const regionPenalty = anchorsConfirmed ? 1 : regionSource === 'vision-fallback' ? 0.9 : 0.65;
  const confidence = Math.max(0, Math.min(1, averageRowConfidence * regionPenalty));

  const needsReview =
    bays.length === 0 ||
    bays.some((row) => row.needsReview) ||
    confidence < REVIEW_CONFIDENCE_THRESHOLD ||
    regionSource === 'full-page-fallback' ||
    totalsSource === 'vision-ai' ||
    warnings.length > 0;

  if (!anchorsConfirmed) {
    warnings.push('DS-DECK/LD-DECK/DS-HOLD/LD-HOLD não foram confirmados via texto nativo — confirme visualmente antes de salvar.');
  }

  return {
    vessel,
    voyage,
    bays,
    totalDischarge,
    totalLoad,
    totalMoves,
    numberOfActiveBays,
    confidence,
    needsReview,
    warnings,
    regionSource,
    totalsSource,
    croppedImageDataUrl,
    fullPageImageDataUrl: page1.imageDataUrl,
  };
}

export { SPLIT_BAY_AREAS };