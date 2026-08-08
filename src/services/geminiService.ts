/**
 * Gemini Vision OCR Service
 * Extrai texto de imagens de páginas de PDF usando Google Gemini Vision API
 */

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiExtractedPage {
  pageNumber: number;
  text: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

interface GeminiExtractionResult {
  success: boolean;
  pages: GeminiExtractedPage[];
  totalPages: number;
  combinedText: string;
  processingTime: number;
  errors: string[];
}

export interface GeminiSplitSection {
  total: number | null;
  planned: number | null;
  qcUnassigned: number | null;
  completed: number | null;
  remained: number | null;
}

export interface GeminiSplitDeckHold {
  dischargeDeck: number | null;
  loadingDeck: number | null;
  dischargeHold: number | null;
  loadingHold: number | null;
}

export interface GeminiSplitSummaryResult {
  totalMovements: number | null;
  discharge: GeminiSplitSection;
  loading: GeminiSplitSection;
  deckHold: GeminiSplitDeckHold;
  confidence: number;
  error?: string;
}

/**
 * Valida se a API key do Gemini está configurada
 */
function validateGeminiApiKey(): string {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Google Gemini API Key não configurada. ' +
      'Por favor, adicione VITE_GEMINI_API_KEY ao arquivo .env.local'
    );
  }

  return apiKey;
}

/**
 * Converte uma imagem em base64
 */
async function imageToBase64(imageBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
}

/**
 * Extrai texto de uma única imagem usando Google Gemini Vision API
 */
async function extractTextFromImageWithGeminiOnce(
  imageBase64: string,
  pageNumber: number,
  mimeType: string = 'image/png'
): Promise<GeminiExtractedPage> {
  console.log(`[geminiService] Enviando página ${pageNumber} para Gemini Vision...`);

  try {
    const apiKey = validateGeminiApiKey();

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Por favor, extraia TODO o texto visível desta página de documento.
              
Requisitos:
- Extraia EXATAMENTE tudo que vê no documento
- Preserve estruturas de tabelas usando formatação clara
- Identifique e liste:
  * Números de container
  * BAYs ou BAIA (ex: BAY 01, BAIA 02)
  * Códigos e referências
  * Datas e horários
  * Nomes de navios
  * Operações (Descarga, Embarque, Reefer, IMO, OOG, etc)
  * Quantidades e movimentos
- Mantenha a ordem e agrupamento do documento original
- Se houver tabelas, mantenha a estrutura com barras | ou tabulações
- Retorne apenas o texto extraído, sem explicações adicionais

Comece a extração:`,
            },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Baixa temperatura para máxima consistência
        topP: 0.95,
        maxOutputTokens: 16384, // páginas com tabelas densas (ex.: perfil de carga) truncavam em 4096
      },
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!extractedText.trim()) {
      throw new Error('Nenhum texto foi extraído do Gemini');
    }

    console.log(`[geminiService] Página ${pageNumber} processada com sucesso. Caracteres: ${extractedText.length}`);

    return {
      pageNumber,
      text: extractedText,
      confidence: 'high',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no Gemini Vision';
    console.error(`[geminiService] Erro ao processar página ${pageNumber}:`, error);

    return {
      pageNumber,
      text: '',
      confidence: 'low',
      error: errorMessage,
    };
  }
}

/**
 * Tenta até 3 vezes: a API do Gemini falha de forma intermitente (503 de
 * sobrecarga momentânea, timeout, resposta vazia) e a MESMA página/imagem
 * costuma funcionar numa tentativa seguinte sem nenhuma mudança de código.
 * Sem esse retry, o MESMO PDF pode extrair texto certinho numa análise e
 * voltar vazio/sem dados na próxima, de forma totalmente aleatória.
 */
export async function extractTextFromImageWithGemini(
  imageBase64: string,
  pageNumber: number,
  mimeType: string = 'image/png'
): Promise<GeminiExtractedPage> {
  const maxAttempts = 3;
  let lastResult: GeminiExtractedPage | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractTextFromImageWithGeminiOnce(imageBase64, pageNumber, mimeType);
    lastResult = result;

    if (!result.error && result.text.trim()) {
      return result;
    }

    console.warn(`[geminiService] extractTextFromImageWithGemini: página ${pageNumber}, tentativa ${attempt}/${maxAttempts} sem texto útil.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as GeminiExtractedPage;
}

/**
 * Processa múltiplas páginas com o Gemini Vision, com throttling para respeitar rate limits
 */
export async function extractTextFromPagesWithGemini(
  imageBlobs: Blob[],
  onProgress?: (current: number, total: number) => void
): Promise<GeminiExtractionResult> {
  console.log(`[geminiService] Iniciando extração de ${imageBlobs.length} páginas com Gemini Vision...`);

  const startTime = Date.now();
  const pages: GeminiExtractedPage[] = [];
  const errors: string[] = [];

  // Processa sequencialmente com delay para evitar rate limits
  for (let i = 0; i < imageBlobs.length; i++) {
    try {
      const imageBlob = imageBlobs[i];
      const base64 = await imageToBase64(imageBlob);

      const result = await extractTextFromImageWithGemini(base64, i + 1, imageBlob.type);
      pages.push(result);

      if (result.error) {
        errors.push(`Página ${i + 1}: ${result.error}`);
      }

      onProgress?.(i + 1, imageBlobs.length);

      // Delay entre requisições para evitar rate limiting (1 segundo)
      if (i < imageBlobs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      errors.push(`Página ${i + 1}: ${errorMsg}`);
      console.error(`[geminiService] Falha ao processar página ${i + 1}:`, error);
    }
  }

  const combinedText = pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => {
      const header = `\n\n--- PÁGINA ${page.pageNumber} ---\n`;
      return header + (page.text || '');
    })
    .join('\n');

  const processingTime = Date.now() - startTime;

  const result: GeminiExtractionResult = {
    success: pages.length > 0 && errors.length === 0,
    pages,
    totalPages: imageBlobs.length,
    combinedText,
    processingTime,
    errors,
  };

  console.log(`[geminiService] Extração concluída em ${processingTime}ms. Páginas processadas: ${pages.length}/${imageBlobs.length}`);

  return result;
}

function emptySplitSection(): GeminiSplitSection {
  return { total: null, planned: null, qcUnassigned: null, completed: null, remained: null };
}

function emptyDeckHold(): GeminiSplitDeckHold {
  return { dischargeDeck: null, loadingDeck: null, dischargeHold: null, loadingHold: null };
}

function normalizeSplitSection(raw: any): GeminiSplitSection {
  const num = (v: any) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
    // Trava de sanidade: um Split real não tem 6+ dígitos de movimentos.
    // Protege contra loops de repetição de token da IA (ex.: "1517151715...").
    if (n !== null && Math.abs(n) >= 1000000) return null;
    return n;
  };
  return {
    total: num(raw?.total),
    planned: num(raw?.planned),
    qcUnassigned: num(raw?.qcUnassigned),
    completed: num(raw?.completed),
    remained: num(raw?.remained),
  };
}

function normalizeDeckHold(raw: any): GeminiSplitDeckHold {
  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    dischargeDeck: num(raw?.dischargeDeck),
    loadingDeck: num(raw?.loadingDeck),
    dischargeHold: num(raw?.dischargeHold),
    loadingHold: num(raw?.loadingHold),
  };
}

async function extractSplitSummaryFromImageOnce(
  imageBase64: string,
  mimeType: string
): Promise<GeminiSplitSummaryResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const prompt = `Esta é uma página de um documento operacional portuário (Split de plano de estiva).

Localize duas informações distintas nesta imagem:

1) As caixas rotuladas "Discharging" e "Loading", cada uma com os campos:
Total, Planned, QC Unassigned, Completed, Remained.

2) A tabela "QC Plan", que tem linhas rotuladas DS-DECK, LD-DECK, DS-HOLD, LD-HOLD
(geralmente perto de um desenho do navio, com números de bay no topo).
Some os valores de cada linha ao longo de todas as colunas de bay para obter o total
de cada uma (DS-DECK, LD-DECK, DS-HOLD, LD-HOLD).

Retorne SOMENTE JSON válido, sem nenhum texto adicional, neste formato:
{
  "discharge": { "total": number|null, "planned": number|null, "qcUnassigned": number|null, "completed": number|null, "remained": number|null },
  "loading": { "total": number|null, "planned": number|null, "qcUnassigned": number|null, "completed": number|null, "remained": number|null },
  "deckHold": {
    "dischargeDeck": number|null,
    "loadingDeck": number|null,
    "dischargeHold": number|null,
    "loadingHold": number|null
  },
  "confidence": number de 0 a 1
}

Regras:
- Se não encontrar alguma dessas seções nesta imagem, retorne null nos campos correspondentes.
- NÃO invente valores. Extraia apenas o que está literalmente visível.
- Os números aparecem no formato "Total : 1517" ou similar.
- Para o QC Plan, DS-DECK/LD-DECK/DS-HOLD/LD-HOLD são rótulos de linha à esquerda da grade de bays; some os números da linha inteira.`;

    const splitSectionSchema = {
      type: 'OBJECT',
      properties: {
        total: { type: 'NUMBER', nullable: true },
        planned: { type: 'NUMBER', nullable: true },
        qcUnassigned: { type: 'NUMBER', nullable: true },
        completed: { type: 'NUMBER', nullable: true },
        remained: { type: 'NUMBER', nullable: true },
      },
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              discharge: splitSectionSchema,
              loading: splitSectionSchema,
              deckHold: {
                type: 'OBJECT',
                properties: {
                  dischargeDeck: { type: 'NUMBER', nullable: true },
                  loadingDeck: { type: 'NUMBER', nullable: true },
                  dischargeHold: { type: 'NUMBER', nullable: true },
                  loadingHold: { type: 'NUMBER', nullable: true },
                },
              },
              confidence: { type: 'NUMBER' },
            },
            required: ['discharge', 'loading', 'deckHold', 'confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = `HTTP ${response.status} - ${JSON.stringify(errorData)}`;
      } catch {
        // resposta sem corpo JSON, mantém o errorDetail simples
      }
      return {
        totalMovements: null,
        discharge: emptySplitSection(),
        loading: emptySplitSection(),
        deckHold: emptyDeckHold(),
        confidence: 0,
        error: `Gemini API error: ${errorDetail}`,
      };
    }

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const parts = data?.candidates?.[0]?.content?.parts;
    // Concatena TODOS os parts de texto, não só o primeiro — a resposta pode
    // vir dividida em mais de um part, e ler só parts[0] cortaria o JSON.
    const text = Array.isArray(parts)
      ? parts.map((part: any) => part?.text || '').join('')
      : '';

    if (!text) {
      return {
        totalMovements: null,
        discharge: emptySplitSection(),
        loading: emptySplitSection(),
        deckHold: emptyDeckHold(),
        confidence: 0,
        error: `Resposta vazia da IA ao extrair resumo operacional. finishReason: ${finishReason || 'desconhecido'}`,
      };
    }

    if (finishReason && finishReason !== 'STOP') {
      return {
        totalMovements: null,
        discharge: emptySplitSection(),
        loading: emptySplitSection(),
        deckHold: emptyDeckHold(),
        confidence: 0,
        error: `Geração interrompida antes de terminar (finishReason: ${finishReason}). Resposta parcial (600 chars): ${text.slice(0, 600)}`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (firstError) {
      // Tentativa de reparo: às vezes a IA envolve o JSON em cercas de
      // markdown (```json ... ```) mesmo com responseMimeType forçado, ou
      // deixa uma vírgula sobrando antes de '}'/']'. Tenta extrair só o
      // maior bloco {...} e limpar vírgulas penduradas antes de desistir.
      try {
        const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
        const candidate = (jsonBlockMatch ? jsonBlockMatch[0] : text)
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(candidate);
      } catch (secondError) {
        const rawPreview = text.slice(0, 600);
        return {
          totalMovements: null,
          discharge: emptySplitSection(),
          loading: emptySplitSection(),
          deckHold: emptyDeckHold(),
          confidence: 0,
          error: `Falha ao interpretar JSON da IA: ${firstError instanceof Error ? firstError.message : 'erro desconhecido'}. finishReason: ${finishReason || 'desconhecido'}. Resposta bruta (600 chars): ${rawPreview}`,
        };
      }
    }

    const discharge = normalizeSplitSection(parsed?.discharge);
    const loading = normalizeSplitSection(parsed?.loading);
    const deckHold = normalizeDeckHold(parsed?.deckHold);
    const totalMovements = discharge.total !== null && loading.total !== null
      ? discharge.total + loading.total
      : null;

    return {
      totalMovements,
      discharge,
      loading,
      deckHold,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.6,
    };
  } catch (error) {
    return {
      totalMovements: null,
      discharge: emptySplitSection(),
      loading: emptySplitSection(),
      deckHold: emptyDeckHold(),
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao extrair resumo via visão.',
    };
  }
}

function isUsableSplitSummary(result: GeminiSplitSummaryResult): boolean {
  const hasSummary = result.discharge.total !== null || result.loading.total !== null;
  const hasDeckHold =
    result.deckHold.dischargeDeck !== null ||
    result.deckHold.loadingDeck !== null ||
    result.deckHold.dischargeHold !== null ||
    result.deckHold.loadingHold !== null;
  return hasSummary || hasDeckHold;
}

/**
 * Extrai o resumo operacional (Discharging/Loading) E o resumo de Deck/Hold
 * do QC Plan de uma imagem de página, numa ÚNICA chamada à API (mesmo prompt,
 * mesma imagem, JSON com os dois blocos). Usado como rede de segurança quando
 * o texto nativo do PDF não contém esses valores (porque a página é uma
 * imagem embutida).
 *
 * Tenta até 3 vezes: chamadas de IA generativa falham de forma intermitente
 * por motivos variados (sobrecarga momentânea 503, JSON cortado, etc.) e a
 * MESMA imagem costuma funcionar numa tentativa seguinte sem nenhuma mudança
 * de código. Retry automático resolve a maioria desses casos de uma vez.
 */
export async function extractSplitSummaryFromImage(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<GeminiSplitSummaryResult> {
  const maxAttempts = 3;
  let lastResult: GeminiSplitSummaryResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractSplitSummaryFromImageOnce(imageBase64, mimeType);
    lastResult = result;

    if (isUsableSplitSummary(result)) {
      return result;
    }

    console.warn(`[geminiService] extractSplitSummaryFromImage: tentativa ${attempt}/${maxAttempts} sem dados úteis.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as GeminiSplitSummaryResult;
}

export interface GeminiBayColumnCell {
  fortyFoot: number | null;
  twentyFootPair: [number | null, number | null];
}

export interface GeminiBayColumnEntry {
  bayLabel: string;
  dsDeck: GeminiBayColumnCell | null;
  ldDeck: GeminiBayColumnCell | null;
  dsHold: GeminiBayColumnCell | null;
  ldHold: GeminiBayColumnCell | null;
}

export interface GeminiBayColumnSummaryResult {
  bays: GeminiBayColumnEntry[];
  confidence: number;
  error?: string;
}

function emptyBayColumnCell(): GeminiBayColumnCell {
  return { fortyFoot: null, twentyFootPair: [null, null] };
}

function normalizeBayColumnCell(raw: any): GeminiBayColumnCell | null {
  if (!raw) return null;
  const num = (v: any) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
    // Trava de sanidade: uma célula de bay não tem centenas de contêineres.
    if (n !== null && Math.abs(n) >= 500) return null;
    return n;
  };
  const pair = Array.isArray(raw?.twentyFootPair) ? raw.twentyFootPair : [null, null];
  return {
    fortyFoot: num(raw?.fortyFoot),
    twentyFootPair: [num(pair[0]), num(pair[1])],
  };
}

async function extractBayColumnSummaryFromImageOnce(
  imageBase64: string,
  mimeType: string
): Promise<GeminiBayColumnSummaryResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const prompt = `Esta é a imagem do "QC Plan" de um documento operacional portuário (Split de plano de estiva),
mostrando o desenho do navio com uma coluna de números para cada BAY.

Cada coluna de bay tem 4 blocos empilhados, nesta ordem de cima para baixo:
1) DS-DECK (descarga do convés)
2) LD-DECK (embarque no convés)
--- (linha do navio no meio) ---
3) DS-HOLD (descarga do porão)
4) LD-HOLD (embarque no porão)

Dentro de CADA um desses 4 blocos, pode haver até dois números:
- Um número maior/sozinho = quantidade de contêineres de 40 pés naquela bay/bloco.
- Um PAR de dois números lado a lado (ex.: "6  6" ou "18  14") = contêineres de 20 pés (twins),
  que ocupam a mesma posição em duas metades da bay. Se só houver um bloco de 40', o par de 20' pode
  estar ausente (retorne null nesse caso).

Se um bloco inteiro (ex.: LD-DECK) estiver vazio/sem número nessa bay, retorne null para ele.

Retorne SOMENTE JSON válido, sem nenhum texto adicional, com um item por bay visível na imagem:
{
  "bays": [
    {
      "bayLabel": "string (o rótulo da bay exatamente como aparece no topo da coluna, ex: '10' ou '19/18')",
      "dsDeck": { "fortyFoot": number|null, "twentyFootPair": [number|null, number|null] } | null,
      "ldDeck": { "fortyFoot": number|null, "twentyFootPair": [number|null, number|null] } | null,
      "dsHold": { "fortyFoot": number|null, "twentyFootPair": [number|null, number|null] } | null,
      "ldHold": { "fortyFoot": number|null, "twentyFootPair": [number|null, number|null] } | null
    }
  ],
  "confidence": number de 0 a 1
}

Regras:
- Percorra a imagem da esquerda para a direita e inclua TODAS as colunas de bay visíveis.
- NÃO invente valores. Extraia apenas o que está literalmente visível.
- NÃO pule bays vazias — inclua-as com todos os blocos null.`;

    const bayCellSchema = {
      type: 'OBJECT',
      nullable: true,
      properties: {
        fortyFoot: { type: 'NUMBER', nullable: true },
        twentyFootPair: {
          type: 'ARRAY',
          items: { type: 'NUMBER', nullable: true },
        },
      },
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: 24576,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              bays: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    bayLabel: { type: 'STRING' },
                    dsDeck: bayCellSchema,
                    ldDeck: bayCellSchema,
                    dsHold: bayCellSchema,
                    ldHold: bayCellSchema,
                  },
                  required: ['bayLabel'],
                },
              },
              confidence: { type: 'NUMBER' },
            },
            required: ['bays', 'confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = `HTTP ${response.status} - ${JSON.stringify(errorData)}`;
      } catch {
        // resposta sem corpo JSON
      }
      return { bays: [], confidence: 0, error: `Gemini API error: ${errorDetail}` };
    }

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';

    if (!text) {
      return {
        bays: [],
        confidence: 0,
        error: `Resposta vazia da IA ao extrair colunas de bay. finishReason: ${finishReason || 'desconhecido'}`,
      };
    }

    if (finishReason && finishReason !== 'STOP') {
      return {
        bays: [],
        confidence: 0,
        error: `Geração interrompida antes de terminar (finishReason: ${finishReason}). Resposta parcial (600 chars): ${text.slice(0, 600)}`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (firstError) {
      try {
        const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
        const candidate = (jsonBlockMatch ? jsonBlockMatch[0] : text)
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(candidate);
      } catch (secondError) {
        const rawPreview = text.slice(0, 600);
        return {
          bays: [],
          confidence: 0,
          error: `Falha ao interpretar JSON da IA: ${firstError instanceof Error ? firstError.message : 'erro desconhecido'}. finishReason: ${finishReason || 'desconhecido'}. Resposta bruta (600 chars): ${rawPreview}`,
        };
      }
    }

    const bays: GeminiBayColumnEntry[] = Array.isArray(parsed?.bays)
      ? parsed.bays.map((raw: any) => ({
          bayLabel: typeof raw?.bayLabel === 'string' ? raw.bayLabel : '',
          dsDeck: normalizeBayColumnCell(raw?.dsDeck),
          ldDeck: normalizeBayColumnCell(raw?.ldDeck),
          dsHold: normalizeBayColumnCell(raw?.dsHold),
          ldHold: normalizeBayColumnCell(raw?.ldHold),
        }))
      : [];

    return {
      bays,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.6,
    };
  } catch (error) {
    return {
      bays: [],
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao extrair colunas de bay via visão.',
    };
  }
}

function isUsableBayColumnSummary(result: GeminiBayColumnSummaryResult): boolean {
  return result.bays.length > 0 && result.bays.some((bay) => bay.dsDeck || bay.ldDeck || bay.dsHold || bay.ldHold);
}

/**
 * Extrai a leitura numérica por bay da faixa do QC Plan (desenho do navio no
 * topo da página 1): para cada bay, os totais de DS-DECK/LD-DECK/DS-HOLD/
 * LD-HOLD, cada um separado entre contêineres de 40 pés (número único) e
 * pares de 20 pés/twins (dois números lado a lado). Essa é uma alternativa
 * mais confiável do que classificar a cor de cada quadradinho do mapa de
 * bays (páginas 2-3): aqui a IA só precisa ler dígitos, não distinguir tons
 * de cor entre células JPEG-comprimidas coladas umas nas outras.
 *
 * Mesma resiliência das outras chamadas de visão desta pipeline: schema
 * estrito, concatenação de todos os parts, checagem de finishReason, reparo
 * de JSON malformado, e retry automático (falhas de IA generativa são
 * intermitentes — a mesma imagem costuma funcionar numa tentativa seguinte).
 */
export async function extractBayColumnSummaryFromImage(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<GeminiBayColumnSummaryResult> {
  const maxAttempts = 3;
  let lastResult: GeminiBayColumnSummaryResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractBayColumnSummaryFromImageOnce(imageBase64, mimeType);
    lastResult = result;

    if (isUsableBayColumnSummary(result)) {
      return result;
    }

    console.warn(`[geminiService] extractBayColumnSummaryFromImage: tentativa ${attempt}/${maxAttempts} sem dados úteis.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as GeminiBayColumnSummaryResult;
}

export interface ShipProfileBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ShipProfileBoundingBoxResult {
  box: ShipProfileBoundingBox | null;
  confidence: number;
  error?: string;
}

/**
 * Usado SOMENTE como fallback quando o PDF não tem texto nativo suficiente
 * para localizar as âncoras (DS-DECK/LD-DECK/DS-HOLD/LD-HOLD + linha de bays)
 * por posição. A IA aqui NUNCA lê números de contêiner — só devolve as
 * coordenadas (normalizadas 0-1) do retângulo do perfil longitudinal do
 * navio, para o código recortar a imagem. Temperature 0 para reprodutibilidade.
 */
async function detectShipProfileBoundingBoxOnce(
  imageBase64: string,
  mimeType: string
): Promise<ShipProfileBoundingBoxResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const prompt = `Esta é a página 1 de um documento operacional portuário (Split de plano de estiva).

Localize APENAS a região que contém o PERFIL LONGITUDINAL DO NAVIO (o desenho do casco do navio
visto de lado, dividido em colunas verticais por BAY). Essa região (parte do "QC Plan") contém,
de cima para baixo: uma linha de CAIXAS BRANCAS com o total de movimentos de cada bay, DS-DECK,
LD-DECK, (linha do navio — um DESENHO/SILHUETA colorida do casco do navio aparece à direita dessas
duas linhas), DS-HOLD, LD-HOLD, e uma linha de números de BAY (ex: 70, 66, 62, 58, ... 02).
INCLUA a linha de caixas brancas do total no topo da região.

ATENÇÃO — ARMADILHA COMUM: logo ABAIXO dessa linha de números de bay, quase colada, existe uma
SEGUNDA tabela com os MESMOS rótulos (DS-DECK/DS-HOLD/LD-DECK/LD-HOLD, possivelmente em outra
ordem) — mas essa segunda tabela é de atribuição de guindaste/turno, tem células cinza com
padrão de hachura em X e números pequenos, e NÃO tem a silhueta do navio ao lado. NÃO inclua essa
segunda tabela na região retornada — pare exatamente na linha de números de bay que vem logo
depois de DS-HOLD/LD-HOLD da região correta (a que tem a silhueta do navio).

NÃO inclua nesta região: a segunda tabela de guindaste/turno descrita acima, Crane Coverage,
gráfico de horários, tabelas de Discharging/Loading, tabelas laterais, BBK, Embarque Direto, ou
qualquer texto fora do perfil do navio.

Retorne SOMENTE JSON válido, sem texto adicional, neste formato:
{
  "box": { "x0": number, "y0": number, "x1": number, "y1": number },
  "confidence": number de 0 a 1
}

As coordenadas x0,y0 (canto superior-esquerdo) e x1,y1 (canto inferior-direito) devem ser
NORMALIZADAS entre 0 e 1 em relação à largura/altura da imagem inteira.

IMPORTANTE: SEMPRE retorne sua MELHOR ESTIMATIVA da região, mesmo que não tenha certeza absoluta
das bordas exatas — é preferível uma estimativa aproximada (com confidence baixo refletindo a
incerteza) a retornar "box": null. Só retorne "box": null se o perfil do navio genuinamente NÃO
estiver visível em nenhuma parte desta imagem.`;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 1024,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              box: {
                type: 'OBJECT',
                nullable: true,
                properties: {
                  x0: { type: 'NUMBER' },
                  y0: { type: 'NUMBER' },
                  x1: { type: 'NUMBER' },
                  y1: { type: 'NUMBER' },
                },
              },
              confidence: { type: 'NUMBER' },
            },
            required: ['confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      return { box: null, confidence: 0, error: `Gemini API error: HTTP ${response.status}` };
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';
    if (!text) {
      return { box: null, confidence: 0, error: 'Resposta vazia da IA ao localizar o perfil do navio.' };
    }

    const parsed = JSON.parse(text);
    const rawBox = parsed?.box;
    const isValidBox =
      rawBox &&
      [rawBox.x0, rawBox.y0, rawBox.x1, rawBox.y1].every((v) => typeof v === 'number' && v >= 0 && v <= 1) &&
      rawBox.x1 > rawBox.x0 &&
      rawBox.y1 > rawBox.y0;

    return {
      box: isValidBox ? { x0: rawBox.x0, y0: rawBox.y0, x1: rawBox.x1, y1: rawBox.y1 } : null,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch (error) {
    return {
      box: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao localizar o perfil do navio.',
    };
  }
}

/**
 * Tenta até 3 vezes: assim como as demais leituras de visão desta pipeline,
 * essa chamada falha de forma intermitente (às vezes devolve box null, às
 * vezes acerta, na MESMA imagem, sem nenhuma mudança). Sem retry, um PDF
 * podia cair no fallback de "página inteira" só por azar da rodada.
 */
export async function detectShipProfileBoundingBox(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<ShipProfileBoundingBoxResult> {
  const maxAttempts = 3;
  let lastResult: ShipProfileBoundingBoxResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await detectShipProfileBoundingBoxOnce(imageBase64, mimeType);
    lastResult = result;

    if (result.box) {
      return result;
    }

    console.warn(`[geminiService] detectShipProfileBoundingBox: tentativa ${attempt}/${maxAttempts} sem região identificada.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as ShipProfileBoundingBoxResult;
}

export interface DecoyGridBoundaryResult {
  hasDecoyGrid: boolean;
  /** Fração (0-1) da altura da imagem recebida onde a tabela de guindaste/turno COMEÇA. Só presente se hasDecoyGrid=true. */
  boundaryY: number | null;
  confidence: number;
  error?: string;
}

/**
 * Verificação dedicada e estreita (uma única pergunta de sim/não + posição),
 * rodada DEPOIS do recorte inicial de `detectShipProfileBoundingBox`. Pedir
 * pra IA "não incluir" a tabela de guindaste/turno como parte de uma tarefa
 * de localização maior (ver prompt de `detectShipProfileBoundingBoxOnce`) não
 * é suficiente na prática — o recorte devolvido continua incluindo essa
 * segunda tabela em alguns documentos, mesmo com a instrução explícita.
 * Perguntar isoladamente "essa tabela específica está presente, e onde ela
 * começa" é uma tarefa de identificação positiva, bem mais confiável do que
 * uma instrução negativa dentro de um prompt maior. Se detectada, o chamador
 * deve recortar a imagem em `boundaryY` antes de mandar pra leitura.
 */
async function detectDecoyGridBoundaryOnce(
  imageBase64: string,
  mimeType: string
): Promise<DecoyGridBoundaryResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const prompt = `Esta imagem é um recorte de um documento operacional portuário (Split de plano de estiva),
contendo o perfil longitudinal do navio: uma linha de caixas brancas com totais, DS-DECK, LD-DECK,
a silhueta colorida do casco do navio, DS-HOLD, LD-HOLD, e uma linha de números de bay (ex: 70, 66,
62... 02).

Às vezes, colada logo ABAIXO da linha de números de bay, existe uma SEGUNDA tabela — de atribuição
de guindaste/turno. Ela reusa os MESMOS rótulos (DS-DECK/DS-HOLD/LD-DECK/LD-HOLD, possivelmente em
outra ordem), mas tem células CINZA com padrão de hachura em X, números pequenos de sequência
(1, 2, 3...), e NÃO tem a silhueta do navio ao lado.

Sua ÚNICA tarefa: dizer se essa segunda tabela (guindaste/turno) aparece nesta imagem e, se aparecer,
em que altura ela começa.

Retorne SOMENTE JSON válido, sem texto adicional:
{
  "hasDecoyGrid": boolean,
  "boundaryY": number entre 0 e 1 (fração da ALTURA TOTAL desta imagem onde a segunda tabela
    começa — o topo dela, logo abaixo da linha de números de bay da tabela correta) ou null se
    hasDecoyGrid for false,
  "confidence": number de 0 a 1
}

Se não tiver certeza se a segunda tabela está presente, retorne hasDecoyGrid: false.`;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 1024,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              hasDecoyGrid: { type: 'BOOLEAN' },
              boundaryY: { type: 'NUMBER', nullable: true },
              confidence: { type: 'NUMBER' },
            },
            required: ['hasDecoyGrid', 'confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      return { hasDecoyGrid: false, boundaryY: null, confidence: 0, error: `Gemini API error: HTTP ${response.status}` };
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';
    if (!text) {
      return { hasDecoyGrid: false, boundaryY: null, confidence: 0, error: 'Resposta vazia da IA ao verificar tabela de guindaste.' };
    }

    const parsed = JSON.parse(text);
    const hasDecoyGrid = Boolean(parsed?.hasDecoyGrid);
    const rawBoundary = parsed?.boundaryY;
    const isValidBoundary = typeof rawBoundary === 'number' && rawBoundary > 0 && rawBoundary < 1;

    return {
      hasDecoyGrid: hasDecoyGrid && isValidBoundary,
      boundaryY: hasDecoyGrid && isValidBoundary ? rawBoundary : null,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch (error) {
    return {
      hasDecoyGrid: false,
      boundaryY: null,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao verificar tabela de guindaste.',
    };
  }
}

/** Mesma política de retry das demais leituras de visão desta pipeline (falha intermitente é comum). */
export async function detectDecoyGridBoundary(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<DecoyGridBoundaryResult> {
  const maxAttempts = 2;
  let lastResult: DecoyGridBoundaryResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await detectDecoyGridBoundaryOnce(imageBase64, mimeType);
    lastResult = result;

    if (!result.error) {
      return result;
    }

    console.warn(`[geminiService] detectDecoyGridBoundary: tentativa ${attempt}/${maxAttempts} falhou.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as DecoyGridBoundaryResult;
}

export type SplitBayArea = 'DS-DECK' | 'LD-DECK' | 'DS-HOLD' | 'LD-HOLD';

export interface SplitBayReading {
  columnIndex: number;
  area: SplitBayArea;
  quantidade: number | null;
  /** Presente só quando a célula é "twin" (dois contêineres de 20' no mesmo slot) — os dois valores lado a lado, na ordem visual. `quantidade` já é a soma deles. */
  parts?: number[] | null;
  confidence: number;
}

export interface SplitBayReadingsResult {
  readings: SplitBayReading[];
  bayLabelsDetected: string[];
  confidence: number;
  error?: string;
}

const SPLIT_BAY_AREAS: SplitBayArea[] = ['DS-DECK', 'LD-DECK', 'DS-HOLD', 'LD-HOLD'];

/**
 * Lê os números de contêiner das 4 faixas (DS-DECK/LD-DECK/DS-HOLD/LD-HOLD) de
 * uma imagem JÁ RECORTADA contendo somente o perfil longitudinal do navio.
 *
 * IMPORTANTE (determinismo/segurança):
 * - temperature 0 (sem variação criativa).
 * - A IA NUNCA soma, divide ou associa número->bay: ela só devolve o número
 *   que enxerga em cada coluna/área, na ORDEM posicional esquerda->direita
 *   (columnIndex). A associação columnIndex -> rótulo de bay é feita pelo
 *   código (buildBaySplitAnalysis), usando a lista de bays já detectada por
 *   âncoras de texto (ou, na falta delas, pela própria ordem que a IA lista
 *   as colunas, mas o código quem decide o rótulo final).
 * - Se não conseguir confirmar um número, deve retornar quantidade: null e
 *   confidence baixa — nunca estimar ou inventar.
 */
async function extractBaySplitReadingsOnce(
  imageBase64: string,
  mimeType: string,
  bayOrderHint: string[]
): Promise<SplitBayReadingsResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const hintText = bayOrderHint.length > 0
      ? `A lista de bays desta imagem, da ESQUERDA para a DIREITA, já foi confirmada como: ${bayOrderHint.join(', ')}. Use EXATAMENTE essas colunas, nessa ordem e quantidade — não pule, não adicione e não reordene colunas, mesmo que alguma pareça vazia. Leia os números que realmente aparecem em cada coluna.`
      : 'Identifique você mesmo os rótulos de bay na linha inferior, da esquerda para a direita.';

    const prompt = `Esta imagem é um recorte contendo o perfil longitudinal de um navio em um documento
operacional portuário (Split de plano de estiva). Pode existir, no topo do recorte, uma linha de
CAIXAS BRANCAS com o TOTAL de cada bay — IGNORE essa linha nesta tarefa (ela é lida separadamente).
Abaixo dela ficam as 4 faixas horizontais empilhadas que você deve ler aqui:
1) DS-DECK (primeira faixa colorida)
2) LD-DECK
--- linha do casco do navio ---
3) DS-HOLD
4) LD-HOLD (base, acima da numeração de bays)

${hintText}

Para CADA coluna de bay (da esquerda para a direita, começando em columnIndex=0) e para CADA uma das
4 áreas (DS-DECK, LD-DECK, DS-HOLD, LD-HOLD), leia o número visível naquela célula.

IMPORTANTE sobre a letra "C" dentro de uma célula: "C" significa "Completo" — ou seja, aquela
sequência de trabalho já foi CONCLUÍDA. "C" NÃO significa célula vazia e NÃO significa quantidade
zero. Uma célula marcada com "C" ainda representa uma quantidade real de contêineres que foi
movimentada; o número da quantidade pode aparecer junto com o "C" (leia esse número normalmente,
ignorando apenas a letra "C" ao lado dele) ou pode ter sido substituído visualmente pelo "C". Se você
conseguir ler algum dígito numérico na célula (mesmo ao lado de "C"), retorne esse número. Se a célula
mostrar SOMENTE a letra "C" sem nenhum dígito visível, NÃO retorne 0 — retorne quantidade: null e
confidence abaixo de 0.5, sinalizando que o valor real precisa ser confirmado manualmente (célula
concluída, mas quantidade não visível para leitura).

Também podem aparecer pequenos números de sequência de trabalho (1, 2, 3, 4, 5...) na parte inferior
de cada bay — esses são a ORDEM das etapas de operação daquela bay, não a quantidade de contêineres.
IGNORE esses números de sequência nesta tarefa; leia apenas a quantidade de contêineres de cada célula
DS-DECK/LD-DECK/DS-HOLD/LD-HOLD.

IMPORTANTE sobre células "TWIN" (dois números lado a lado DENTRO da mesma célula, ex.: "14 | 14",
"24 | 24", "8 | 8"): isso representa dois contêineres de 20' dividindo o mesmo slot da bay
(twin-lock) — cada metade é uma quantidade real e SEPARADA, não o mesmo valor duplicado por engano
visual. Quando isso acontecer, retorne os dois números SEPARADAMENTE no campo "parts" (ex.: "parts":
[14, 14]), na mesma ordem visual (esquerda para direita) — NÃO some os dois você mesmo; a soma é
calculada depois, no código. Se a célula NÃO for twin (um valor só, ou vazia), não inclua "parts"
(ou retorne null). Não confunda twin com os números de sequência de trabalho (ficam fora/abaixo da
célula, isolados) nem com o número principal ao lado da letra "C" (um único valor, não duas partes).

Regras OBRIGATÓRIAS:
- NUNCA invente ou estime um número que não esteja visualmente presente.
- Se a célula estiver GENUINAMENTE vazia (sem número, sem "C", sem nenhuma marca), retorne
  quantidade: 0 com confidence 0.95+.
- Se houver um número mas ele estiver ilegível/ambíguo, retorne quantidade: null e confidence abaixo de 0.5.
- Se a célula for "twin" (dois números lado a lado): preencha "parts" com os dois valores e deixe
  "quantidade": null — NÃO some os dois valores você mesmo, isso é feito depois no código.
- Se a célula NÃO for twin: preencha "quantidade" normalmente e NÃO inclua "parts" (ou retorne null).
- NÃO calcule somas, totais ou médias ENTRE células ou áreas diferentes. Apenas leia célula por célula.
- NÃO pule colunas: inclua todas as colunas visíveis na imagem, mesmo vazias.
- NÃO leia a linha de caixas brancas do total — apenas as 4 faixas DS-DECK/LD-DECK/DS-HOLD/LD-HOLD.

Retorne SOMENTE JSON válido, sem texto adicional:
{
  "bayLabelsDetected": ["70", "66", "62", ...],
  "readings": [
    { "columnIndex": 0, "area": "DS-DECK", "quantidade": number|null, "parts": [number, number]|null, "confidence": number },
    { "columnIndex": 0, "area": "LD-DECK", "quantidade": number|null, "parts": [number, number]|null, "confidence": number },
    { "columnIndex": 0, "area": "DS-HOLD", "quantidade": number|null, "parts": [number, number]|null, "confidence": number },
    { "columnIndex": 0, "area": "LD-HOLD", "quantidade": number|null, "parts": [number, number]|null, "confidence": number }
  ],
  "confidence": number de 0 a 1 (confiança geral da leitura)
}`;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 32768,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              bayLabelsDetected: { type: 'ARRAY', items: { type: 'STRING' } },
              readings: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    columnIndex: { type: 'NUMBER' },
                    area: { type: 'STRING' },
                    quantidade: { type: 'NUMBER', nullable: true },
                    parts: { type: 'ARRAY', items: { type: 'NUMBER' }, nullable: true },
                    confidence: { type: 'NUMBER' },
                  },
                  required: ['columnIndex', 'area', 'confidence'],
                },
              },
              confidence: { type: 'NUMBER' },
            },
            required: ['readings', 'bayLabelsDetected', 'confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = `HTTP ${response.status} - ${JSON.stringify(errorData)}`;
      } catch {
        // resposta sem corpo JSON
      }
      return { readings: [], bayLabelsDetected: [], confidence: 0, error: `Gemini API error: ${errorDetail}` };
    }

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';

    if (!text) {
      return {
        readings: [],
        bayLabelsDetected: [],
        confidence: 0,
        error: `Resposta vazia da IA ao ler o perfil de bays. finishReason: ${finishReason || 'desconhecido'}`,
      };
    }

    if (finishReason && finishReason !== 'STOP') {
      return {
        readings: [],
        bayLabelsDetected: [],
        confidence: 0,
        error: `Geração interrompida antes de terminar (finishReason: ${finishReason}).`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (firstError) {
      try {
        const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
        const candidate = (jsonBlockMatch ? jsonBlockMatch[0] : text)
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(candidate);
      } catch (secondError) {
        return {
          readings: [],
          bayLabelsDetected: [],
          confidence: 0,
          error: `Falha ao interpretar JSON da IA: ${firstError instanceof Error ? firstError.message : 'erro desconhecido'}.`,
        };
      }
    }

    const validAreas = new Set(SPLIT_BAY_AREAS);
    const readings: SplitBayReading[] = Array.isArray(parsed?.readings)
      ? parsed.readings
          .filter((raw: any) => validAreas.has(raw?.area))
          .map((raw: any) => {
            const rawParts = Array.isArray(raw?.parts)
              ? raw.parts.filter((p: any) => typeof p === 'number' && Number.isFinite(p) && p >= 0).map((p: number) => Math.round(p))
              : [];
            // A soma de um par "twin" é sempre calculada aqui no código, nunca confiada à IA.
            const parts = rawParts.length >= 2 ? rawParts : null;
            const quantidade = parts
              ? parts.reduce((sum: number, p: number) => sum + p, 0)
              : typeof raw?.quantidade === 'number' && Number.isFinite(raw.quantidade) && raw.quantidade >= 0
              ? Math.round(raw.quantidade)
              : null;
            return {
              columnIndex: typeof raw?.columnIndex === 'number' ? raw.columnIndex : -1,
              area: raw.area as SplitBayArea,
              quantidade,
              parts,
              confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
            };
          })
          .filter((reading: SplitBayReading) => reading.columnIndex >= 0)
      : [];

    const bayLabelsDetected: string[] = Array.isArray(parsed?.bayLabelsDetected)
      ? parsed.bayLabelsDetected.map((label: any) => String(label))
      : [];

    return {
      readings,
      bayLabelsDetected,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch (error) {
    return {
      readings: [],
      bayLabelsDetected: [],
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao ler o perfil de bays.',
    };
  }
}

/**
 * Uma única tentativa "limpa" por padrão (temperature 0 já é reprodutível).
 * Só repete em caso de FALHA DE TRANSPORTE/PARSE (erro/resposta vazia) — nunca
 * por "baixa confiança", para não aceitar silenciosamente um resultado
 * diferente do primeiro em cima do mesmo arquivo.
 */
export async function extractBaySplitReadings(
  imageBase64: string,
  mimeType: string = 'image/png',
  bayOrderHint: string[] = []
): Promise<SplitBayReadingsResult> {
  const maxAttempts = 2;
  let lastResult: SplitBayReadingsResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractBaySplitReadingsOnce(imageBase64, mimeType, bayOrderHint);
    lastResult = result;

    if (!result.error) {
      return result;
    }

    console.warn(`[geminiService] extractBaySplitReadings: tentativa ${attempt}/${maxAttempts} falhou.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as SplitBayReadingsResult;
}

export interface BayTotalReading {
  columnIndex: number;
  quantidade: number | null;
  confidence: number;
}

export interface BayTotalRowResult {
  totals: BayTotalReading[];
  bayLabelsDetected: string[];
  confidence: number;
  error?: string;
}

/**
 * Lê a LINHA DE CAIXAS BRANCAS com o TOTAL OFICIAL de cada bay, localizada
 * imediatamente ACIMA da faixa DS-DECK no perfil longitudinal do navio.
 *
 * Esse total é a referência OFICIAL da bay (não é DS-DECK+LD-DECK+DS-HOLD+LD-HOLD
 * somados pela IA) — ele já vem impresso na própria caixa branca do documento.
 * Usado apenas quando o texto nativo do PDF não permite ler essa linha
 * diretamente (ver `detectRegionFromTextAnchors` em splitBayReaderService.ts,
 * que é sempre preferido por ser 100% determinístico). temperature 0.
 */
async function extractBayTotalRowOnce(
  imageBase64: string,
  mimeType: string,
  bayOrderHint: string[]
): Promise<BayTotalRowResult> {
  try {
    const apiKey = validateGeminiApiKey();

    const hintText = bayOrderHint.length > 0
      ? `A lista de bays desta imagem, da ESQUERDA para a DIREITA, já foi confirmada como: ${bayOrderHint.join(', ')}. Use EXATAMENTE essas colunas, nessa ordem e quantidade — não pule, não adicione e não reordene colunas, mesmo que alguma caixa pareça vazia. Cada coluna dessa lista corresponde a exatamente uma caixa branca, na mesma posição.`
      : 'Identifique você mesmo quantas colunas de bay existem, da esquerda para a direita.';

    const prompt = `Esta imagem é um recorte da página 1 de um documento operacional portuário (Split de plano de estiva).

Existe uma LINHA DE CAIXAS BRANCAS com borda preta, uma caixa por coluna de bay, localizada
IMEDIATAMENTE ACIMA da primeira faixa colorida (DS-DECK) do perfil longitudinal do navio.
Cada caixa branca contém o NÚMERO TOTAL DE MOVIMENTOS daquela bay (descarga + embarque já somados).

Leia SOMENTE essa linha de caixas brancas. NÃO leia DS-DECK/LD-DECK/DS-HOLD/LD-HOLD nesta tarefa.

${hintText}

Regras OBRIGATÓRIAS:
- Para cada coluna, da esquerda para a direita (columnIndex começando em 0), leia o número dentro
  da caixa branca correspondente.
- Caixa vazia = quantidade 0, confidence 0.95+ (célula vazia = zero, não é dúvida).
- Número ilegível/ambíguo = quantidade null, confidence abaixo de 0.5.
- NUNCA calcule, some ou infira esse total a partir de outras faixas — leia SOMENTE o número já
  impresso na própria caixa branca.
- NÃO pule colunas: inclua todas as colunas visíveis, mesmo vazias.

Retorne SOMENTE JSON válido, sem texto adicional:
{
  "bayLabelsDetected": ["70", "66", "62", ...],
  "totals": [ { "columnIndex": 0, "quantidade": number|null, "confidence": number } ],
  "confidence": number de 0 a 1 (confiança geral da leitura)
}`;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
          responseSchema: {
            type: 'OBJECT',
            properties: {
              bayLabelsDetected: { type: 'ARRAY', items: { type: 'STRING' } },
              totals: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    columnIndex: { type: 'NUMBER' },
                    quantidade: { type: 'NUMBER', nullable: true },
                    confidence: { type: 'NUMBER' },
                  },
                  required: ['columnIndex', 'confidence'],
                },
              },
              confidence: { type: 'NUMBER' },
            },
            required: ['totals', 'bayLabelsDetected', 'confidence'],
          },
        },
      }),
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetail = `HTTP ${response.status} - ${JSON.stringify(errorData)}`;
      } catch {
        // resposta sem corpo JSON
      }
      return { totals: [], bayLabelsDetected: [], confidence: 0, error: `Gemini API error: ${errorDetail}` };
    }

    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('') : '';

    if (!text) {
      return {
        totals: [],
        bayLabelsDetected: [],
        confidence: 0,
        error: `Resposta vazia da IA ao ler a linha de totais das bays. finishReason: ${finishReason || 'desconhecido'}`,
      };
    }

    if (finishReason && finishReason !== 'STOP') {
      return {
        totals: [],
        bayLabelsDetected: [],
        confidence: 0,
        error: `Geração interrompida antes de terminar (finishReason: ${finishReason}).`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (firstError) {
      try {
        const jsonBlockMatch = text.match(/\{[\s\S]*\}/);
        const candidate = (jsonBlockMatch ? jsonBlockMatch[0] : text)
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/,(\s*[}\]])/g, '$1');
        parsed = JSON.parse(candidate);
      } catch (secondError) {
        return {
          totals: [],
          bayLabelsDetected: [],
          confidence: 0,
          error: `Falha ao interpretar JSON da IA: ${firstError instanceof Error ? firstError.message : 'erro desconhecido'}.`,
        };
      }
    }

    const totals: BayTotalReading[] = Array.isArray(parsed?.totals)
      ? parsed.totals
          .map((raw: any) => {
            const quantidade = typeof raw?.quantidade === 'number' && Number.isFinite(raw.quantidade) && raw.quantidade >= 0
              ? Math.round(raw.quantidade)
              : null;
            return {
              columnIndex: typeof raw?.columnIndex === 'number' ? raw.columnIndex : -1,
              quantidade,
              confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
            };
          })
          .filter((reading: BayTotalReading) => reading.columnIndex >= 0)
      : [];

    const bayLabelsDetected: string[] = Array.isArray(parsed?.bayLabelsDetected)
      ? parsed.bayLabelsDetected.map((label: any) => String(label))
      : [];

    return {
      totals,
      bayLabelsDetected,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch (error) {
    return {
      totals: [],
      bayLabelsDetected: [],
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao ler a linha de totais das bays.',
    };
  }
}

/** Mesma política de retry das demais leituras determinísticas: só repete em falha de transporte/parse. */
export async function extractBayTotalRow(
  imageBase64: string,
  mimeType: string = 'image/png',
  bayOrderHint: string[] = []
): Promise<BayTotalRowResult> {
  const maxAttempts = 2;
  let lastResult: BayTotalRowResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractBayTotalRowOnce(imageBase64, mimeType, bayOrderHint);
    lastResult = result;

    if (!result.error) {
      return result;
    }

    console.warn(`[geminiService] extractBayTotalRow: tentativa ${attempt}/${maxAttempts} falhou.`, result.error);

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return lastResult as BayTotalRowResult;
}

export default extractTextFromImageWithGemini;