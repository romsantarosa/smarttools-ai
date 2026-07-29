import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker for Vite: import estático resolvido em build-time
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export async function parsePDF(file: File, onProgress?: (pct: number) => void): Promise<any> {
  console.log('[pdfService] Iniciando leitura do PDF:', file.name);

  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('[pdfService] ArrayBuffer obtido. Tamanho:', arrayBuffer.byteLength, 'bytes');

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer } as any);
    const doc = await loadingTask.promise;
    console.log('[pdfService] PDF carregado. Páginas totais:', doc.numPages);

    const pages: string[] = [];
    const linesByPage: string[][] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      console.log(`[pdfService] Processando página ${i}/${doc.numPages}...`);

      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      console.log(`[pdfService] Página ${i} - ${content.items.length} itens extraídos`);

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

    console.log('[pdfService] Extração de texto concluída. Páginas:', pages.length);

    return {
      pages,
      lines: linesByPage,
      text: pages.join('\n\n'),
    };
  } catch (error) {
    console.error('[pdfService] Erro ao ler o PDF:', error);
    throw error;
  }
}

export default parsePDF;