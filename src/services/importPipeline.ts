import * as XLSX from 'xlsx';
import { analyzeSplit } from './aiService';
import { processPdf, type PDFExtractionResult } from './pdfService';
import { extractTextFromImageWithGemini } from './geminiService';

export interface ImportedDocumentResult {
  text: string;
  pages: string[];
  lines: string[][];
  extractionMethod: 'native' | 'ocr' | 'text' | 'sheet';
  sourceKind: 'pdf' | 'image' | 'text' | 'sheet';
  analysis: any;
  errors: string[];
}

function fileToTextLines(text: string): string[][] {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((pageLines) => pageLines.length > 0);
}

async function extractTextFromPlainFile(file: File): Promise<{ text: string; pages: string[]; lines: string[][]; extractionMethod: 'text' }> {
  const text = await file.text();
  return {
    text,
    pages: text ? [text] : [],
    lines: text ? fileToTextLines(text) : [],
    extractionMethod: 'text',
  };
}

async function extractTextFromSpreadsheet(file: File): Promise<{ text: string; pages: string[]; lines: string[][]; extractionMethod: 'sheet' }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
  }).filter(Boolean);

  const text = sheets.join('\n\n');
  return {
    text,
    pages: sheets,
    lines: sheets.map((sheetText) => sheetText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)),
    extractionMethod: 'sheet',
  };
}

async function extractTextFromImage(file: File): Promise<{ text: string; pages: string[]; lines: string[][]; extractionMethod: 'ocr'; errors: string[] }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem para OCR.'));
    reader.readAsDataURL(file);
  });

  const result = await extractTextFromImageWithGemini(base64, 1, file.type || 'image/png');
  const text = result.text || '';

  return {
    text,
    pages: text ? [text] : [],
    lines: text ? fileToTextLines(text) : [],
    extractionMethod: 'ocr',
    errors: result.error ? [result.error] : [],
  };
}

export async function extractDocumentForAnalysis(
  file: File,
  onProgress?: (pct: number) => void,
  onOcrProgress?: (current: number, total: number) => void
): Promise<{ extraction: ImportedDocumentResult; pdf?: PDFExtractionResult }> {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    const pdf = await processPdf(file, onProgress, onOcrProgress);
    return {
      pdf,
      extraction: {
        text: pdf.text,
        pages: pdf.pages,
        lines: pdf.lines ?? pdf.pages.map((pageText) => pageText.split('\n')),
        extractionMethod: pdf.extractionMethod,
        sourceKind: 'pdf',
        analysis: null,
        errors: pdf.errors,
      },
    };
  }

  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name)) {
    const imageExtraction = await extractTextFromImage(file);
    return {
      extraction: {
        text: imageExtraction.text,
        pages: imageExtraction.pages,
        lines: imageExtraction.lines,
        extractionMethod: imageExtraction.extractionMethod,
        sourceKind: 'image',
        analysis: null,
        errors: imageExtraction.errors,
      },
    };
  }

  if (mime.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const sheetExtraction = await extractTextFromSpreadsheet(file);
    return {
      extraction: {
        text: sheetExtraction.text,
        pages: sheetExtraction.pages,
        lines: sheetExtraction.lines,
        extractionMethod: sheetExtraction.extractionMethod,
        sourceKind: 'sheet',
        analysis: null,
        errors: [],
      },
    };
  }

  const plainExtraction = await extractTextFromPlainFile(file);
  return {
    extraction: {
      text: plainExtraction.text,
      pages: plainExtraction.pages,
      lines: plainExtraction.lines,
      extractionMethod: plainExtraction.extractionMethod,
      sourceKind: 'text',
      analysis: null,
      errors: [],
    },
  };
}

export async function importDocumentAndAnalyze(
  file: File,
  onProgress?: (pct: number) => void,
  onOcrProgress?: (current: number, total: number) => void
): Promise<ImportedDocumentResult> {
  const { extraction } = await extractDocumentForAnalysis(file, onProgress, onOcrProgress);

  if (!extraction.text.trim()) {
    return {
      ...extraction,
      analysis: null,
      errors: extraction.errors.length > 0 ? extraction.errors : ['Nenhum texto foi encontrado no arquivo.'],
    };
  }

  const analysis = await analyzeSplit({
    pages: extraction.pages,
    lines: extraction.lines,
    text: extraction.text,
  });

  return {
    ...extraction,
    analysis,
  };
}