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
): Promise<{ text: string; pages: string[]; lines: string[][]; hasText: boolean } | null> {
  console.log('[pdfService] Iniciando extração de texto nativo do PDF...');

  try {
    console.log('[pdfService] PDF carregado. Páginas totais:', doc.numPages);

    const pages: string[] = [];
    const linesByPage: string[][] = [];
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
      .map((page, idx) => ({ idx, nativeChars: (nativePages[idx] || '').replace(/\s+/g, '').length }))
      .filter((item) => item.nativeChars < ocrMinCharsPerPage)
      .map((item) => item.idx);

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
        const chosenText = nativeText.replace(/\s+/g, '').length >= ocrMinCharsPerPage
          ? nativeText
          : (ocrText || nativeText);

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
  };
}

export default processPdf;