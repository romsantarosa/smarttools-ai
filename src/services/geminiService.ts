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
        maxOutputTokens: 8192, // páginas com tabelas densas (ex.: perfil de carga) truncavam em 4096
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
          maxOutputTokens: 2048,
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
          maxOutputTokens: 8192,
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

export default extractTextFromImageWithGemini;