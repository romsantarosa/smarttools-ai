/**
 * PDF Service com suporte a OCR via Gemini Vision
 * Extrai texto de PDFs normais ou scaneados
 */

import * as pdfjsLib from 'pdfjs-dist';
import { extractTextFromPagesWithGemini } from './geminiService';

// Configure PDF.js worker for Vite
if (typeof window !== 'undefined') {
  // Use CDN fallback for worker
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;
}

export interface PDFTextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

export interface PDFPageTextItems {
  pageNumber: number;
  items: PDFTextItem[];
}

export interface PDFExtractionResult {
  text: string;
  pages: string[];
  lines?: string[][];
  hasTextContent: boolean;
  extractionMethod: 'native' | 'ocr';
  totalPages: number;
  processingTime: number;
  errors: string[];
  pageAssets?: PDFPageAsset[];
  pageTextItems?: PDFPageTextItems[];
}

export interface PDFProcessOptions {
  enableOcr?: boolean;
  renderScale?: number;
  ocrMinCharsPerPage?: number;
  maxPagesToRender?: number;
}

export interface PDFPageAsset {
  pageNumber: number;
  width: number;
  height: number;
  renderScale: number;
  imageDataUrl: string;
}

interface RenderedPage {
  pageNumber: number;
  width: number;
  height: number;
  renderScale: number;
  blob: Blob;
  imageDataUrl: string;
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/**
 * Carrega um PDF e retorna o documento PDF.js
 */
async function loadPdfDocument(file: File): Promise<any> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer } as any);
  return loadingTask.promise;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter blob para DataURL.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Extrai texto nativo de um PDF usando getTextContent()
 * Retorna nulo se PDF não tiver texto extraível
 */
export async function extractPdfText(
  doc: any,
  onProgress?: (pct: number) => void
): Promise<{ text: string; pages: string[]; lines: string[][]; hasText: boolean; pageTextItems: PDFPageTextItems[] } | null> {
  console.log('[pdfService] Iniciando extração de texto nativo do PDF...');

  try {
    console.log('[pdfService] PDF carregado. Páginas totais:', doc.numPages);

    const pages: string[] = [];
    const linesByPage: string[][] = [];
    const pageTextItems: PDFPageTextItems[] = [];
    let totalTextItems = 0;

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      totalTextItems += content.items.length;

      const buckets: Array<{ y: number; items: Array<{ str: string; transform: number[] }> }> = [];

      content.items.forEach((item: any) => {
        const text = item.str?.trim();
        if (!text) return;
        const transform = item.transform || [];
        const y = Number(transform[5] || 0);
        const bucket = buckets.find((entry) => Math.abs(entry.y - y) <= 2);
        if (bucket) {
          bucket.items.push({ str: text, transform });
        } else {
          buckets.push({ y, items: [{ str: text, transform }] });
        }
      });

      buckets.sort((a, b) => b.y - a.y);
      const pageLines = buckets.map((bucket) => {
        bucket.items.sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));
        return normalizeLine(bucket.items.map((entry) => entry.str).join(' '));
      }).filter(Boolean);

      const pageText = pageLines.join('\n');
      pages.push(pageText);
      linesByPage.push(pageLines);
      pageTextItems.push({
        pageNumber: i,
        items: content.items.map((item: any) => ({
          str: String(item.str || '').trim(),
          transform: Array.isArray(item.transform) ? item.transform : [],
          width: item.width,
          height: item.height,
        })).filter((item: PDFTextItem) => item.str),
      });

      const progressPct = Math.round((i / doc.numPages) * 40) + 10;
      onProgress?.(progressPct);
    }

    const hasText = totalTextItems > 0;
    console.log(`[pdfService] Extração nativa concluída. Total de itens de texto: ${totalTextItems}`);

    if (!hasText) {
      console.log('[pdfService] PDF não contém texto extraível - será necessário OCR');
      return null;
    }

    return {
      text: pages.join('\n\n'),
      pages,
      lines: linesByPage,
      hasText: true,
      pageTextItems,
    };
  } catch (error) {
    console.error('[pdfService] Erro ao extrair texto nativo:', error);
    throw error;
  }
}

/**
 * Renderiza uma página do PDF em um Canvas e retorna como imagem PNG
 */
export async function renderPdfPageToImage(
  pdfDoc: any,
  pageNumber: number,
  scale: number = 2.0
): Promise<RenderedPage> {
  console.log(`[pdfService] Renderizando página ${pageNumber} em canvas...`);

  try {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Não foi possível obter contexto 2D do canvas');
    }

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    await page.render(renderContext).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            console.log(`[pdfService] Página ${pageNumber} renderizada com sucesso`);
            const imageDataUrl = await blobToDataUrl(blob);
            resolve({
              pageNumber,
              width: viewport.width,
              height: viewport.height,
              renderScale: scale,
              blob,
              imageDataUrl,
            });
          } else {
            reject(new Error('Falha ao converter canvas em blob'));
          }
        },
        'image/png',
        0.95
      );
    });
  } catch (error) {
    console.error(`[pdfService] Erro ao renderizar página ${pageNumber}:`, error);
    throw error;
  }
}

/**
 * Decide quais páginas precisam de OCR.
 *
 * IMPORTANTE: não basta olhar o número de caracteres do texto nativo.
 * Documentos como o Split da BTP têm um título/cabeçalho longo em texto
 * nativo (ex.: "BREMERHAVEN EXPRESS NA626A > GRANDE QUANTIDADE...") mesmo
 * quando TODO o conteúdo operacional da página (QC Plan, Discharging/
 * Loading, mapas de bay) é uma imagem JPEG embutida. Isso fazia a página
 * "passar" no antigo critério de tamanho (>= 50 chars) e o OCR nunca era
 * disparado, mesmo a página sendo 100% imagem.
 *
 * Critério novo: dispara OCR se o texto nativo for curto OU se tiver
 * poucos grupos numéricos (proxy para "não há tabela/valores reais aqui,
 * só um título").
 */
function shouldRunOcrOnPage(nativeText: string, ocrMinCharsPerPage: number): boolean {
  const strippedChars = nativeText.replace(/\s+/g, '').length;
  const numericGroups = (nativeText.match(/\d{2,7}/g) || []).length;
  return strippedChars < ocrMinCharsPerPage || numericGroups < 3;
}

/**
 * Processa um PDF completo:
 * 1. Tenta extrair texto nativo
 * 2. Se falhar, renderiza páginas e usa OCR com Gemini
 */
export async function processPdf(
  file: File,
  onProgress?: (pct: number) => void,
  onOcrProgress?: (current: number, total: number) => void,
  options: PDFProcessOptions = {}
): Promise<PDFExtractionResult> {
  console.log('[pdfService] Iniciando processamento completo do PDF:', file.name);
  const startTime = Date.now();
  const errors: string[] = [];
  const enableOcr = options.enableOcr !== false;
  const renderScale = options.renderScale ?? 2.4;
  const ocrMinCharsPerPage = options.ocrMinCharsPerPage ?? 50;
  const maxPagesToRender = options.maxPagesToRender ?? 80;

  try {
    const doc = await loadPdfDocument(file);
    const totalPages = Math.min(doc.numPages, maxPagesToRender);

    // Etapa 1: Tentar extração nativa
    setProgress(onProgress, 10);
    console.log('[pdfService] Etapa 1: Tentando extração nativa...');

    const nativeExtraction = await extractPdfText(doc, (pct) => setProgress(onProgress, pct));
    const nativePages = nativeExtraction?.pages || [];
    const nativeLines = nativeExtraction?.lines || [];
    const hasNativeText = Boolean(nativeExtraction?.hasText);
    const pageTextItems = nativeExtraction?.pageTextItems || [];

    console.log('[pdfService] Etapa 2: Renderizando páginas em alta resolução...');
    setProgress(onProgress, 48);

    const renderedPages: RenderedPage[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const rendered = await renderPdfPageToImage(doc, i, renderScale);
      renderedPages.push(rendered);
      const renderProgress = Math.round((i / totalPages) * 26) + 48;
      setProgress(onProgress, renderProgress);
    }

    let usedOcr = false;
    const finalPages: string[] = [];
    const finalLines: string[][] = [];

    const ocrTargetIndices = renderedPages
      .map((_page, idx) => idx)
      .filter((idx) => shouldRunOcrOnPage(nativePages[idx] || '', ocrMinCharsPerPage));

    console.log(
      '[pdfService] Páginas selecionadas para OCR (visão):',
      ocrTargetIndices.map((idx) => idx + 1)
    );

    const shouldRunOcr = enableOcr && ocrTargetIndices.length > 0;

    if (shouldRunOcr) {
      console.log(`[pdfService] Etapa 3: OCR seletivo em ${ocrTargetIndices.length} página(s)...`);
      setProgress(onProgress, 78);

      const selectedBlobs = ocrTargetIndices.map((idx) => renderedPages[idx].blob);
      const ocrResult = await extractTextFromPagesWithGemini(selectedBlobs, (current, total) => {
        const ocrProgressPct = Math.round((current / total) * 16) + 78;
        setProgress(onProgress, ocrProgressPct);
        onOcrProgress?.(current, total);
      });

      if (ocrResult.errors.length > 0) {
        errors.push(...ocrResult.errors);
      }

      const ocrTextsByOriginalPage = new Map<number, string>();
      ocrTargetIndices.forEach((originalIndex, localIdx) => {
        const ocrPage = ocrResult.pages[localIdx];
        ocrTextsByOriginalPage.set(originalIndex, ocrPage?.text || '');
      });

      for (let i = 0; i < totalPages; i++) {
        const nativeText = nativePages[i] || '';
        const ocrText = ocrTextsByOriginalPage.get(i) || '';
        const needsOcr = shouldRunOcrOnPage(nativeText, ocrMinCharsPerPage);
        const chosenText = needsOcr && ocrText.trim() ? ocrText : nativeText;

        if (chosenText === ocrText && ocrText.trim()) {
          usedOcr = true;
        }

        finalPages.push(chosenText);
        finalLines.push(chosenText.split(/\r?\n/).map((line) => normalizeLine(line)).filter(Boolean));
      }
    } else {
      for (let i = 0; i < totalPages; i++) {
        const nativeText = nativePages[i] || '';
        finalPages.push(nativeText);
        finalLines.push((nativeLines[i] || nativeText.split(/\r?\n/)).map((line) => normalizeLine(line)).filter(Boolean));
      }
    }

    const mergedText = finalPages.join('\n\n');

    if (!mergedText.trim() && !enableOcr) {
      errors.push('PDF sem texto nativo. OCR desativado para este fluxo.');
    }

    const pageAssets: PDFPageAsset[] = renderedPages.map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      renderScale: page.renderScale,
      imageDataUrl: page.imageDataUrl,
    }));

    const processingTime = Date.now() - startTime;
    console.log(`[pdfService] Processamento completo concluído em ${processingTime}ms`);
    setProgress(onProgress, 100);

    return {
      text: mergedText,
      pages: finalPages,
      lines: finalLines,
      hasTextContent: hasNativeText,
      extractionMethod: usedOcr ? 'ocr' : 'native',
      totalPages,
      processingTime,
      errors,
      pageAssets,
      pageTextItems,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[pdfService] Erro durante processamento do PDF:', error);
    errors.push(errorMessage);

    throw {
      message: errorMessage,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Função auxiliar para atualizar progresso com validação
 */
function setProgress(onProgress: ((pct: number) => void) | undefined, pct: number): void {
  if (onProgress && pct >= 0 && pct <= 100) {
    onProgress(Math.round(pct));
  }
}

export interface Page1TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Page1RenderResult {
  imageDataUrl: string;
  width: number;
  height: number;
  scale: number;
  textItems: Page1TextItem[];
}

/**
 * Renderiza SOMENTE a página 1 do PDF (nunca as demais) e retorna os itens de
 * texto nativo já convertidos para o mesmo espaço de coordenadas em pixels da
 * imagem renderizada (origem no canto superior-esquerdo). Usado pelo leitor
 * determinístico de SPLIT, que não deve analisar o documento inteiro.
 */
export async function extractFirstPageForBayProfile(file: File, scale: number = 3.0): Promise<Page1RenderResult> {
  const doc = await loadPdfDocument(file);
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível obter contexto 2D do canvas.');
  }

  await page.render({ canvasContext: context, viewport }).promise;
  const imageDataUrl = canvas.toDataURL('image/png', 0.95);

  const content = await page.getTextContent();
  const textItems: Page1TextItem[] = content.items
    .map((item: any) => {
      const text = String(item.str || '').trim();
      if (!text) return null;
      const transform = Array.isArray(item.transform) ? item.transform : [0, 0, 0, 0, 0, 0];
      const [vx, vy] = viewport.convertToViewportPoint(transform[4] || 0, transform[5] || 0);
      const itemHeight = Math.hypot(transform[2] || 0, transform[3] || 0) * scale || 10 * scale;
      const itemWidth = (item.width || text.length * 4) * scale;
      return {
        str: text,
        x: vx,
        y: vy - itemHeight,
        width: itemWidth,
        height: itemHeight,
      };
    })
    .filter((item): item is Page1TextItem => item !== null);

  return {
    imageDataUrl,
    width: viewport.width,
    height: viewport.height,
    scale,
    textItems,
  };
}

/**
 * Função legada para compatibilidade com código existente
 */
export async function parsePDF(file: File, onProgress?: (pct: number) => void): Promise<any> {
  console.log('[pdfService] parsePDF (legado) - redirecionando para processPdf()');

  const result = await processPdf(file, onProgress);

  return {
    pages: result.pages,
    lines: result.pages.map((pageText) => pageText.split('\n')),
    text: result.text,
    pageAssets: result.pageAssets || [],
    pageTextItems: result.pageTextItems || [],
  };
}

export default processPdf;