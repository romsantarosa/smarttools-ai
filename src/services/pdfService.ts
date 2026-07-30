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
}

export interface PDFProcessOptions {
  enableOcr?: boolean;
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

/**
 * Extrai texto nativo de um PDF usando getTextContent()
 * Retorna nulo se PDF não tiver texto extraível
 */
export async function extractPdfText(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ text: string; pages: string[]; lines: string[][]; hasText: boolean } | null> {
  console.log('[pdfService] Iniciando extração de texto nativo do PDF:', file.name);

  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('[pdfService] ArrayBuffer obtido. Tamanho:', arrayBuffer.byteLength, 'bytes');

    const doc = await loadPdfDocument(file);
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
): Promise<Blob> {
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
        (blob) => {
          if (blob) {
            console.log(`[pdfService] Página ${pageNumber} renderizada com sucesso`);
            resolve(blob);
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

  try {
    // Etapa 1: Tentar extração nativa
    setProgress(onProgress, 10);
    console.log('[pdfService] Etapa 1: Tentando extração nativa...');

    const nativeExtraction = await extractPdfText(file, (pct) => setProgress(onProgress, pct));

    if (nativeExtraction && nativeExtraction.hasText) {
      console.log('[pdfService] Sucesso! Texto nativo extraído.');
      setProgress(onProgress, 100);

      return {
        text: nativeExtraction.text,
        pages: nativeExtraction.pages,
        lines: nativeExtraction.lines,
        hasTextContent: true,
        extractionMethod: 'native',
        totalPages: nativeExtraction.pages.length,
        processingTime: Date.now() - startTime,
        errors,
      };
    }

    if (!enableOcr) {
      const processingTime = Date.now() - startTime;
      const noTextError = 'PDF sem texto nativo. OCR desativado para este fluxo.';
      errors.push(noTextError);

      return {
        text: '',
        pages: nativeExtraction?.pages || [],
        lines: nativeExtraction?.lines || [],
        hasTextContent: false,
        extractionMethod: 'native',
        totalPages: nativeExtraction?.pages?.length || 0,
        processingTime,
        errors,
      };
    }

    // Etapa 2: PDF é imagem - usar OCR com Gemini
    console.log('[pdfService] Etapa 2: PDF não tem texto - iniciando OCR com Gemini...');
    setProgress(onProgress, 50);

    const doc = await loadPdfDocument(file);
    const imageBlobs: Blob[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const blob = await renderPdfPageToImage(doc, i, 2.0);
      imageBlobs.push(blob);
      const renderProgress = Math.round((i / doc.numPages) * 35) + 50;
      setProgress(onProgress, renderProgress);
    }

    console.log(`[pdfService] ${imageBlobs.length} páginas renderizadas. Enviando para OCR...`);
    setProgress(onProgress, 85);

    const ocrResult = await extractTextFromPagesWithGemini(imageBlobs, (current, total) => {
      const ocrProgressPct = Math.round((current / total) * 10) + 85;
      setProgress(onProgress, ocrProgressPct);
      onOcrProgress?.(current, total);
    });

    if (ocrResult.errors.length > 0) {
      errors.push(...ocrResult.errors);
      console.warn('[pdfService] Erros durante OCR:', ocrResult.errors);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[pdfService] Processamento completo concluído em ${processingTime}ms`);
    setProgress(onProgress, 100);

    return {
      text: ocrResult.combinedText,
      pages: ocrResult.pages.map((p) => p.text),
      hasTextContent: false,
      extractionMethod: 'ocr',
      totalPages: ocrResult.totalPages,
      processingTime,
      errors,
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
  };
}

export default processPdf;