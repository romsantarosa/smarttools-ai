import * as XLSX from 'xlsx';
import { analyzeSplit } from './aiService';
import { processPdf, type PDFExtractionResult } from './pdfService';
import { extractTextFromImageWithGemini } from './geminiService';

export type ImportDocumentType = 'escala' | 'split' | 'lista-operadores' | 'relatorio' | 'documento-administrativo' | 'outro';
export type ImportStage = 'receiving' | 'validating' | 'reading-pdf' | 'running-ocr' | 'running-cv' | 'analyzing-ai' | 'importing' | 'completed' | 'error';

export interface ImportedDocumentEntities {
  dateCandidates: string[];
  turnoCandidates: string[];
  ships: string[];
  berths: string[];
  operators: string[];
  matriculas: string[];
  roles: string[];
  scheduleHints: string[];
  observations: string[];
}

export interface ImportLogEntry {
  timestamp: string;
  stage: ImportStage;
  message: string;
  data?: Record<string, any>;
}

export interface ImportedDocumentResult {
  text: string;
  pages: string[];
  lines: string[][];
  extractionMethod: 'native' | 'ocr' | 'text' | 'sheet';
  sourceKind: 'pdf' | 'image' | 'text' | 'sheet';
  analysis: any;
  errors: string[];
  documentType: ImportDocumentType;
  confidence: number;
  partialRecognition: boolean;
  autoImported: boolean;
  statusMessage: string;
  entities: ImportedDocumentEntities;
  logs: ImportLogEntry[];
  processingMs: number;
}

interface ImportCallbacks {
  onProgress?: (pct: number) => void;
  onStage?: (stage: ImportStage, message: string) => void;
  onOcrProgress?: (current: number, total: number) => void;
  onLog?: (entry: ImportLogEntry) => void;
}

interface ImportOptions {
  disablePdfOcr?: boolean;
}

function fileToTextLines(text: string): string[][] {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((pageLines) => pageLines.length > 0);
}

function setStage(callbacks: ImportCallbacks, stage: ImportStage, message: string) {
  callbacks.onStage?.(stage, message);
  const log: ImportLogEntry = {
    timestamp: new Date().toISOString(),
    stage,
    message,
  };
  callbacks.onLog?.(log);
}

function pushLog(logs: ImportLogEntry[], callbacks: ImportCallbacks, stage: ImportStage, message: string, data?: Record<string, any>) {
  const entry: ImportLogEntry = {
    timestamp: new Date().toISOString(),
    stage,
    message,
    data,
  };
  logs.push(entry);
  callbacks.onLog?.(entry);
}

function normalizeImportError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Erro desconhecido');
  const normalized = raw.toLowerCase();

  if (normalized.includes('password') || normalized.includes('senha')) {
    return 'PDF protegido por senha.';
  }

  if (normalized.includes('invalid pdf') || normalized.includes('corrupt') || normalized.includes('malformed')) {
    return 'PDF corrompido ou inválido.';
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Falha de rede durante o processamento do documento.';
  }

  if (normalized.includes('mime') || normalized.includes('tipo de arquivo')) {
    return 'Documento incompatível com o módulo de importação.';
  }

  return raw;
}

function detectDocumentTypeHeuristic(text: string, fileName: string): ImportDocumentType {
  const upper = `${fileName}\n${text}`.toUpperCase();

  if (/SPLIT|BAY|REEFER|OOG|IMDG/.test(upper)) return 'split';
  if (/ESCALA|TERNO|BTP 01|BTP 02|BTP 03|OPERADOR/.test(upper)) return 'escala';
  if (/MATR[IÍ]CULA|NOME\s+DO\s+OPERADOR|LISTA\s+DE\s+OPERADORES/.test(upper)) return 'lista-operadores';
  if (/RELAT[ÓO]RIO|KPI|INDICADOR|AN[ÁA]LISE/.test(upper)) return 'relatorio';
  if (/OF[ÍI]CIO|MEMORANDO|PROTOCOLO|ADMINISTRATIVO/.test(upper)) return 'documento-administrativo';

  return 'outro';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractEntitiesFromText(text: string): ImportedDocumentEntities {
  const dateCandidates = unique(Array.from(text.matchAll(/\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/g)).map((m) => m[0]));
  const turnoCandidates = unique(Array.from(text.matchAll(/\b(?:Q[1-4]|(?:0?1|0?7|13|19)\s*(?:H|:00)\s*(?:A|À|AS|ÀS|-)\s*(?:0?1|0?7|13|19)\s*(?:H|:00))\b/gi)).map((m) => m[0]));
  const ships = unique(Array.from(text.matchAll(/\b(?:MAERSK|MSC|CMA|EVER|COSCO|HAPAG|ONE|PIL|ZIM)[\sA-Z0-9-]{2,40}\b/gi)).map((m) => m[0].trim()));
  const berths = unique(Array.from(text.matchAll(/\bBTP\s*0?[1-3]\b/gi)).map((m) => m[0].replace(/\s+/g, ' ').trim()));
  const operators = unique(Array.from(text.matchAll(/\b[A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,}){1,3}\b/g)).map((m) => m[0].trim()).slice(0, 60));
  const matriculas = unique(Array.from(text.matchAll(/\b\d{4,7}\b/g)).map((m) => m[0]));
  const roles = unique(Array.from(text.matchAll(/\b(?:OPERADOR|SUPERVISOR|L[ÍI]DER|APONTADOR|CONFERENTE|INSPETOR)\b/gi)).map((m) => m[0].toUpperCase()));
  const scheduleHints = unique(Array.from(text.matchAll(/\b(?:ATRACA[CÇ][AÃ]O|DESATRACA[CÇ][AÃ]O|CHEGADA|SA[ÍI]DA|ESCALA|TURNO)\b/gi)).map((m) => m[0].toUpperCase()));

  const observations = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /OBS|OBSERVA[CÇ][AÃ]O|NOTA|COMENT[ÁA]RIO/i.test(line))
    .slice(0, 10);

  return {
    dateCandidates,
    turnoCandidates,
    ships,
    berths,
    operators,
    matriculas,
    roles,
    scheduleHints,
    observations,
  };
}

async function analyzeByAI(text: string, fileName: string, callbacks: ImportCallbacks, logs: ImportLogEntry[]): Promise<{
  documentType?: ImportDocumentType;
  confidence?: number;
  entities?: Partial<ImportedDocumentEntities>;
}> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    pushLog(logs, callbacks, 'analyzing-ai', 'IA indisponível: VITE_GEMINI_API_KEY não configurada.');
    return {};
  }

  const prompt = `Analise o documento operacional portuário abaixo e retorne JSON válido.
Campos obrigatórios:
- documentType: "escala" | "split" | "lista-operadores" | "relatorio" | "documento-administrativo" | "outro"
- confidence: número entre 0 e 1
- entities: { dateCandidates[], turnoCandidates[], ships[], berths[], operators[], matriculas[], roles[], scheduleHints[], observations[] }

Documento: ${fileName}
Texto:\n${text.slice(0, 180000)}`;

  try {
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
          topP: 0.95,
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      pushLog(logs, callbacks, 'analyzing-ai', 'IA retornou erro HTTP.', { status: response.status });
      return {};
    }

    const payload = await response.json();
    const textResponse = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      pushLog(logs, callbacks, 'analyzing-ai', 'IA não retornou conteúdo para análise.');
      return {};
    }

    const parsed = JSON.parse(textResponse);
    pushLog(logs, callbacks, 'analyzing-ai', 'IA analisou o documento com sucesso.', {
      confidence: parsed?.confidence,
      documentType: parsed?.documentType,
    });

    return {
      documentType: parsed?.documentType,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : undefined,
      entities: parsed?.entities,
    };
  } catch (error) {
    pushLog(logs, callbacks, 'analyzing-ai', 'Falha ao interpretar resposta da IA.', {
      error: normalizeImportError(error),
    });
    return {};
  }
}

async function extractTextFromPlainFile(file: File, callbacks: ImportCallbacks, logs: ImportLogEntry): Promise<{ text: string; pages: string[]; lines: string[][]; extractionMethod: 'text' }> {
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

async function extractTextFromImage(file: File, callbacks: ImportCallbacks, logs: ImportLogEntry): Promise<{ text: string; pages: string[]; lines: string[][]; extractionMethod: 'ocr'; errors: string[] }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem para OCR.'));
    reader.readAsDataURL(file);
  });

  setStage(callbacks, 'running-ocr', 'Executando OCR automático...');
  const result = await extractTextFromImageWithGemini(base64, 1, file.type || 'image/png');
  const text = result.text || '';

  pushLog(logs, callbacks, 'running-ocr', 'OCR finalizado.', {
    chars: text.length,
    hasError: Boolean(result.error),
  });

  return {
    text,
    pages: text ? [text] : [],
    lines: text ? fileToTextLines(text) : [],
    extractionMethod: 'ocr',
    errors: result.error ? [result.error] : [],
  };
}

function validateIncomingFile(file: File): string[] {
  const errors: string[] = [];
  if (!file || !(file instanceof File)) {
    errors.push('Nenhum arquivo válido foi recebido.');
    return errors;
  }

  if (file.size <= 0) {
    errors.push('Arquivo vazio ou inválido.');
  }

  const fileName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  const allowed =
    mime.includes('pdf') ||
    mime.startsWith('image/') ||
    mime.includes('text') ||
    mime.includes('csv') ||
    mime.includes('spreadsheet') ||
    /\.(pdf|png|jpg|jpeg|txt|csv|xlsx|xls)$/i.test(fileName);

  if (!allowed) {
    errors.push('Documento incompatível. Formatos aceitos: PDF, PNG, JPG, JPEG, TXT, CSV, XLSX, XLS.');
  }

  return errors;
}

export async function importDocumentAndAnalyze(
  file: File,
  callbacks: ImportCallbacks = {},
  options: ImportOptions = {}
): Promise<ImportedDocumentResult> {
  const startedAt = Date.now();
  const logs: ImportLogEntry[] = [];

  setStage(callbacks, 'receiving', 'Recebendo arquivo...');
  pushLog(logs, callbacks, 'receiving', 'Arquivo recebido.', {
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
  });

  setStage(callbacks, 'validating', 'Validando arquivo...');
  const validationErrors = validateIncomingFile(file);
  if (validationErrors.length > 0) {
    setStage(callbacks, 'error', 'Falha na validação do arquivo.');
    return {
      text: '',
      pages: [],
      lines: [],
      extractionMethod: 'text',
      sourceKind: 'text',
      analysis: null,
      errors: validationErrors,
      documentType: 'outro',
      confidence: 0,
      partialRecognition: true,
      autoImported: false,
      statusMessage: validationErrors[0],
      entities: {
        dateCandidates: [],
        turnoCandidates: [],
        ships: [],
        berths: [],
        operators: [],
        matriculas: [],
        roles: [],
        scheduleHints: [],
        observations: [],
      },
      logs,
      processingMs: Date.now() - startedAt,
    };
  }

  let extractionMethod: ImportedDocumentResult['extractionMethod'] = 'text';
  let sourceKind: ImportedDocumentResult['sourceKind'] = 'text';
  let pages: string[] = [];
  let lines: string[][] = [];
  let pageAssets: PDFExtractionResult['pageAssets'] = [];
  let text = '';
  let extractionErrors: string[] = [];
  let pdfResult: PDFExtractionResult | null = null;

  try {
    const mime = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();

    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      sourceKind = 'pdf';
      setStage(callbacks, 'reading-pdf', 'Lendo PDF...');
      callbacks.onProgress?.(12);

      try {
        pdfResult = await processPdf(
          file,
          (pct) => {
            callbacks.onProgress?.(Math.min(72, pct));
            if (!options.disablePdfOcr && pct >= 50) {
              callbacks.onStage?.('running-ocr', 'Executando OCR automático...');
            }
          },
          (current, total) => callbacks.onOcrProgress?.(current, total),
          { enableOcr: !options.disablePdfOcr }
        );
      } catch (error) {
        const normalized = normalizeImportError(error);
        throw new Error(normalized);
      }

      extractionMethod = pdfResult.extractionMethod;
      text = pdfResult.text;
      pages = pdfResult.pages;
      lines = pdfResult.lines ?? pdfResult.pages.map((pageText) => pageText.split('\n'));
      pageAssets = pdfResult.pageAssets || [];
      extractionErrors = pdfResult.errors;

      pushLog(logs, callbacks, extractionMethod === 'ocr' ? 'running-ocr' : 'reading-pdf', 'Extração do PDF concluída.', {
        extractionMethod,
        totalPages: pdfResult.totalPages,
        processingTimeMs: pdfResult.processingTime,
        renderedPages: pageAssets.length,
        textChars: text.length,
      });

      if (pageAssets.length > 0) {
        pushLog(logs, callbacks, 'running-cv', 'Páginas convertidas para visão computacional.', {
          totalPageAssets: pageAssets.length,
          avgResolution: Math.round(
            pageAssets.reduce((acc, item) => acc + item.width * item.height, 0) / Math.max(1, pageAssets.length)
          ),
        });
      }
    } else if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name)) {
      sourceKind = 'image';
      setStage(callbacks, 'running-ocr', 'Executando OCR automático...');
      callbacks.onProgress?.(35);

      const imageExtraction = await extractTextFromImage(file, callbacks, logs);
      extractionMethod = imageExtraction.extractionMethod;
      text = imageExtraction.text;
      pages = imageExtraction.pages;
      lines = imageExtraction.lines;
      extractionErrors = imageExtraction.errors;
      callbacks.onProgress?.(70);
    } else if (mime.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      sourceKind = 'sheet';
      extractionMethod = 'sheet';
      setStage(callbacks, 'reading-pdf', 'Lendo planilha...');
      callbacks.onProgress?.(40);

      const sheetExtraction = await extractTextFromSpreadsheet(file);
      text = sheetExtraction.text;
      pages = sheetExtraction.pages;
      lines = sheetExtraction.lines;
      callbacks.onProgress?.(70);

      pushLog(logs, callbacks, 'reading-pdf', 'Planilha convertida para texto.', {
        sheets: pages.length,
        textChars: text.length,
      });
    } else {
      sourceKind = 'text';
      extractionMethod = 'text';
      setStage(callbacks, 'reading-pdf', 'Lendo arquivo textual...');
      callbacks.onProgress?.(40);

      const plain = await extractTextFromPlainFile(file, callbacks, logs as any);
      text = plain.text;
      pages = plain.pages;
      lines = plain.lines;
      callbacks.onProgress?.(70);
    }
  } catch (error) {
    const message = normalizeImportError(error);
    setStage(callbacks, 'error', message);
    pushLog(logs, callbacks, 'error', 'Falha durante extração.', { reason: message });

    return {
      text: '',
      pages: [],
      lines: [],
      extractionMethod,
      sourceKind,
      analysis: null,
      errors: [message],
      documentType: 'outro',
      confidence: 0,
      partialRecognition: true,
      autoImported: false,
      statusMessage: message,
      entities: {
        dateCandidates: [],
        turnoCandidates: [],
        ships: [],
        berths: [],
        operators: [],
        matriculas: [],
        roles: [],
        scheduleHints: [],
        observations: [],
      },
      logs,
      processingMs: Date.now() - startedAt,
    };
  }

  if (!text.trim()) {
    const reason = extractionErrors.length > 0
      ? `OCR não conseguiu reconhecer texto. ${extractionErrors.join(' ')}`
      : 'Documento incompatível: não foi possível extrair texto do arquivo.';

    setStage(callbacks, 'error', reason);
    pushLog(logs, callbacks, 'error', 'Arquivo sem texto útil após todas as tentativas.', {
      extractionMethod,
      extractionErrors,
    });

    return {
      text,
      pages,
      lines,
      extractionMethod,
      sourceKind,
      analysis: null,
      errors: [reason, ...extractionErrors],
      documentType: 'outro',
      confidence: 0,
      partialRecognition: true,
      autoImported: false,
      statusMessage: reason,
      entities: {
        dateCandidates: [],
        turnoCandidates: [],
        ships: [],
        berths: [],
        operators: [],
        matriculas: [],
        roles: [],
        scheduleHints: [],
        observations: [],
      },
      logs,
      processingMs: Date.now() - startedAt,
    };
  }

  const heuristicsEntities = extractEntitiesFromText(text);
  const heuristicType = detectDocumentTypeHeuristic(text, file.name);

  setStage(callbacks, 'analyzing-ai', 'Analisando IA...');
  callbacks.onProgress?.(80);

  const aiResult = await analyzeByAI(text, file.name, callbacks, logs);
  const mergedEntities: ImportedDocumentEntities = {
    dateCandidates: unique([...(aiResult.entities?.dateCandidates || []), ...heuristicsEntities.dateCandidates]),
    turnoCandidates: unique([...(aiResult.entities?.turnoCandidates || []), ...heuristicsEntities.turnoCandidates]),
    ships: unique([...(aiResult.entities?.ships || []), ...heuristicsEntities.ships]),
    berths: unique([...(aiResult.entities?.berths || []), ...heuristicsEntities.berths]),
    operators: unique([...(aiResult.entities?.operators || []), ...heuristicsEntities.operators]),
    matriculas: unique([...(aiResult.entities?.matriculas || []), ...heuristicsEntities.matriculas]),
    roles: unique([...(aiResult.entities?.roles || []), ...heuristicsEntities.roles]),
    scheduleHints: unique([...(aiResult.entities?.scheduleHints || []), ...heuristicsEntities.scheduleHints]),
    observations: unique([...(aiResult.entities?.observations || []), ...heuristicsEntities.observations]),
  };

  const confidenceFromCoverage = Math.min(
    1,
    (
      (mergedEntities.dateCandidates.length > 0 ? 0.12 : 0) +
      (mergedEntities.turnoCandidates.length > 0 ? 0.12 : 0) +
      (mergedEntities.ships.length > 0 ? 0.16 : 0) +
      (mergedEntities.berths.length > 0 ? 0.12 : 0) +
      (mergedEntities.operators.length > 0 ? 0.16 : 0) +
      (mergedEntities.matriculas.length > 0 ? 0.12 : 0) +
      (mergedEntities.roles.length > 0 ? 0.1 : 0) +
      (mergedEntities.scheduleHints.length > 0 ? 0.1 : 0)
    )
  );

  const confidence = Math.max(0, Math.min(1, typeof aiResult.confidence === 'number' ? aiResult.confidence : confidenceFromCoverage));
  const documentType: ImportDocumentType = aiResult.documentType || heuristicType;

  let analysis: any = null;
  if (documentType === 'split') {
    try {
      setStage(callbacks, 'running-cv', 'Executando visão computacional...');
      analysis = await analyzeSplit({ pages, lines, text, pageAssets, pageTextItems: pdfResult?.pageTextItems ?? [] });

      const extractionLog = [...logs]
        .reverse()
        .find((entry) => (entry.stage === 'running-ocr' || entry.stage === 'reading-pdf') && typeof entry.data?.processingTimeMs === 'number');

      const ocrTimeMs = Number(extractionLog?.data?.processingTimeMs || 0);
      if (analysis?.pipelineMetrics) {
        analysis.pipelineMetrics.ocrTimeMs = ocrTimeMs;
      }
      if (analysis?.developerMode?.timing) {
        analysis.developerMode.timing.ocrMs = ocrTimeMs;
      }

      if (analysis?.pipelineMetrics) {
        pushLog(logs, callbacks, 'analyzing-ai', 'Métricas da análise de Split consolidadas.', {
          ocrTimeMs: analysis.pipelineMetrics.ocrTimeMs,
          aiTimeMs: analysis.pipelineMetrics.aiTimeMs,
          visionTimeMs: analysis.pipelineMetrics.visionTimeMs,
          baysCount: analysis.pipelineMetrics.baysCount,
          containersCount: analysis.pipelineMetrics.containersCount,
          deckCount: analysis.pipelineMetrics.deckCount,
          holdCount: analysis.pipelineMetrics.holdCount,
          confidence: analysis.pipelineMetrics.confidence,
        });
      }
    } catch (error) {
      extractionErrors.push(`Falha ao analisar Split: ${normalizeImportError(error)}`);
    }
  }

  setStage(callbacks, 'importing', 'Importando dados...');
  callbacks.onProgress?.(92);

  const autoImported = confidence >= 0.9;
  const partialRecognition = !autoImported;
  const statusMessage = autoImported
    ? 'Importação concluída com sucesso.'
    : 'Documento parcialmente reconhecido.';

  pushLog(logs, callbacks, 'importing', 'Resumo da importação inteligente.', {
    documentType,
    confidence,
    operatorsFound: mergedEntities.operators.length,
    shipsFound: mergedEntities.ships.length,
    matriculasFound: mergedEntities.matriculas.length,
  });

  setStage(callbacks, 'completed', 'Concluído.');
  callbacks.onProgress?.(100);

  const processingMs = Date.now() - startedAt;
  pushLog(logs, callbacks, 'completed', 'Processamento finalizado.', {
    processingMs,
    textChars: text.length,
    extractionMethod,
  });

  return {
    text,
    pages,
    lines,
    extractionMethod,
    sourceKind,
    analysis,
    errors: extractionErrors,
    documentType,
    confidence,
    partialRecognition,
    autoImported,
    statusMessage,
    entities: mergedEntities,
    logs,
    processingMs,
  };
}