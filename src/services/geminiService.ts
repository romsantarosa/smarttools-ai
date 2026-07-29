/**
 * Gemini Vision OCR Service
 * Extrai texto de imagens de páginas de PDF usando Google Gemini Vision API
 */

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
export async function extractTextFromImageWithGemini(
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
        maxOutputTokens: 4096,
      },
    };

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
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

export default extractTextFromImageWithGemini;
