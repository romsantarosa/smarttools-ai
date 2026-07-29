import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { getBtpData, getCacheTimeRemainingSeconds, setCustomBtpData, parseSppilotsRawText } from './src/services/btpService.js';
import { fetchBtpSchedule } from './src/services/btpScheduleService.js';

dotenv.config();

console.log("GEMINI_API_KEY existe?", !!process.env.GEMINI_API_KEY);
console.log("Primeiros 8 caracteres:", process.env.GEMINI_API_KEY?.substring(0, 8));

const app = express();

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Update endpoint to allow pushing real SPPilots data
app.post('/api/btp/update', (req, res) => {
  try {
    const updated = setCustomBtpData(req.body);
    return res.json({ success: true, message: 'Dados do BTP SPPilots atualizados com sucesso!', updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar dados BTP', message: err.message });
  }
});

// Parse endpoint to allow pasting raw text directly from SPPilots portal
app.post('/api/btp/parse-text', (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) return res.status(400).json({ error: 'Texto não fornecido' });
    const parsed = parseSppilotsRawText(rawText);
    const updated = setCustomBtpData(parsed);
    return res.json({ success: true, message: 'Tabela do SPPilots processada com sucesso!', updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao processar texto do SPPilots', message: err.message });
  }
});

// BTP SMARTTOOLS API Endpoints
const handleBtpRoute = async (req: express.Request, res: express.Response, type: 'movimentos' | 'atracados' | 'previstas' | 'fundeados' | 'resumo') => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await getBtpData(forceRefresh);
    const cacheRemaining = getCacheTimeRemainingSeconds();

    if (type === 'resumo') {
      return res.json({
        atracados: data.atracados,
        previstos: data.previstas,
        movimentos: data.movimentos,
        fundeados: data.fundeados,
        lastUpdate: new Date(data.lastUpdate).toISOString(),
        cacheRemainingSeconds: cacheRemaining,
        isMockData: data.isMockData,
      });
    }

    return res.json(data[type] || []);
  } catch (err: any) {
    console.error(`Error on /btp/${type}:`, err);
    return res.status(503).json({
      error: 'Portal temporariamente indisponível',
      code: 503,
      message: err?.message || 'Falha na extração dos dados BTP',
    });
  }
};

// Register routes for /btp/* and /api/btp/*
['movimentos', 'atracados', 'previstos', 'fundeados', 'resumo'].forEach(route => {
  const handler = (req: express.Request, res: express.Response) =>
    handleBtpRoute(req, res, route as 'movimentos' | 'atracados' | 'previstas' | 'fundeados' | 'resumo');

  app.get(`/btp/${route}`, handler);
  app.get(`/api/btp/${route}`, handler);
});

// BTP Schedule Endpoint - Programação BTP
app.get('/api/btp-schedule', async (req: express.Request, res: express.Response) => {
  try {
    console.log('[Server] Buscando dados de programação BTP...');
    const result = await fetchBtpSchedule();
    return res.json(result);
  } catch (err: any) {
    console.error('[Server] Erro ao buscar schedule BTP:', err);
    return res.status(500).json({
      success: false,
      data: [],
      totalRecords: 0,
      lastUpdate: new Date().toISOString(),
      error: err?.message || 'Erro ao buscar dados de programação BTP',
    });
  }
});

// Initialize Gemini SDK with User-Agent header as specified in skill guidelines

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'BTP SmartTools AI',
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Gemini AI Supervisor Analysis Endpoint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { inventory, maintenance, purchases, history, customPrompt } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback response if key is missing
      const mockAnalysis = generateMockAnalysis(inventory, maintenance, purchases);
      return res.json({
        success: true,
        opinion: mockAnalysis.opinion,
        recommendations: mockAnalysis.recommendations,
        riskLevel: mockAnalysis.riskLevel,
        isFallback: true,
      });
    }

    const systemInstruction = `Você é o Supervisor de Operações Portuárias Sênior da BTP (Brasil Terminal Portuário), especializado no controle de ferramentas operacionais de destravamento e travamento de containers (varas de 2m, 3m, 6m, 9m e spanners/mãos de força).
Sua função é analisar o estado do estoque de ferramentas, ordens de manutenção, solicitações de compras e movimentações de turnos/navios para emitir um parecer técnico profissional, claro e objetivo para a equipe de operação e gerência.

Seu retorno deve ser um JSON válido contendo:
- "opinion": texto resumido e profissional do parecer técnico da operação.
- "recommendations": array de 2 a 4 recomendações acionáveis específicas.
- "riskLevel": "BAIXO" | "MÉDIO" | "ALTO".`;

    const promptText = customPrompt
      ? `Solicitação do Operador: "${customPrompt}"\n\nDados da Operação Atual:\nEstoque: ${JSON.stringify(inventory)}\nManutenção: ${JSON.stringify(maintenance)}\nCompras: ${JSON.stringify(purchases)}`
      : `Análise Geral da Operação:\n\nEstoque Atual de Ferramentas: ${JSON.stringify(inventory)}\nItens em Manutenção: ${JSON.stringify(maintenance)}\nSolicitações de Compras Pendentes: ${JSON.stringify(purchases)}\nHistórico Recente de Movimentações: ${JSON.stringify(history)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedJson;
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      parsedJson = {
        opinion: responseText,
        recommendations: [
          'Verifique a quantidade de varas disponíveis antes da atracação do próximo navio.',
          'Priorize a liberação de ferramentas retidas em manutenção.',
        ],
        riskLevel: 'MÉDIO',
      };
    }

    return res.json({
      success: true,
      ...parsedJson,
      isFallback: false,
    });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    // Return structured graceful fallback
    const { inventory, maintenance, purchases } = req.body;
    const fallback = generateMockAnalysis(inventory, maintenance, purchases);
    return res.json({
      success: true,
      ...fallback,
      isFallback: true,
      errorDetail: error?.message || 'Serviço temporariamente operando em contingência local.',
    });
  }
});

function generateMockAnalysis(inventory: any[] = [], maintenance: any[] = [], purchases: any[] = []) {
  const lowStockItems = (inventory || []).filter((item: any) => item.available <= item.minStock);
  const totalMaint = (maintenance || []).filter((m: any) => m.status !== 'Concluído').length;
  const pendingPurchases = (purchases || []).filter((p: any) => p.status === 'Solicitado' || p.status === 'Aprovado').length;

  let riskLevel = 'BAIXO';
  let opinion = 'O estoque atual atende adequadamente as operações nos berços atracados.';
  const recommendations: string[] = [];

  if (lowStockItems.length > 0) {
    riskLevel = 'ALTO';
    const names = lowStockItems.map((i: any) => i.name).join(', ');
    opinion = `Atenção Crítica: Identificado estoque baixo ou crítico em: ${names}. Risco de paralisação no desengate de containers no próximo turno.`;
    recommendations.push(`Acelerar a requisição de compras para ${names}.`);
    recommendations.push(`Cobrar prioridade na oficina para a manutenção das ferramentas retidas.`);
  } else if (totalMaint > 2) {
    riskLevel = 'MÉDIO';
    opinion = `Estoque operacional estabilizado, porém há ${totalMaint} ferramentas na manutenção. Acompanhar disponibilidade antes da virada do turno.`;
    recommendations.push('Verificar com o supervisor de manutenção a previsão de retorno das varas em reparo.');
  }

  if (pendingPurchases > 0) {
    recommendations.push(`Acompanhar aprovação dos ${pendingPurchases} pedidos de compras pendentes.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Manter rotina padrão de conferência de ferramentas ao final do turno.');
    recommendations.push('Realizar inspeção visual preventiva nas travas de elevação e spanners.');
  }

  return { opinion, recommendations, riskLevel };
}

// Start Express Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

  } else {

    // Em produção o server.cjs já roda dentro de dist/, então os arquivos
    // gerados pelo `vite build` (index.html, assets/) são irmãos deste arquivo.
    // __dirname funciona aqui porque o esbuild empacota este arquivo em CommonJS.
    const distPath = __dirname;

    app.use(express.static(distPath));

    // Fallback de SPA: qualquer rota GET que não bateu em /api ou /btp
    // recebe o index.html para o React Router assumir no client.
    app.get(/^(?!\/api|\/btp).*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

  }

  app.use((err: any, req: any, res: any, next: any) => {
  console.error("ERRO EXPRESS:", err);
  res.status(500).send(err?.stack || err?.message || String(err));
});
  // ESTE app.listen FICA FORA DO if/else
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BTP SmartTools AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();