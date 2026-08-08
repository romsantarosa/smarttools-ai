/**
 * Bus Schedule Scraper Service
 * Extrai o horário da próxima saída de ônibus da BTP a partir do portal do
 * colaborador (BTP Conecta), que exige login.
 * URL: https://www.btpconecta.com.br/
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

dotenv.config();

export interface BusStop {
  ponto: string;
  horario: string;
}

export interface BusScheduleResponse {
  success: boolean;
  data: BusStop[];
  lastUpdate: string;
  error?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT = 30000;

let cache: { data: BusStop[]; lastUpdate: number } | null = null;

async function scrapeBusScheduleOnce(): Promise<BusStop[]> {
  const user = process.env.BTPCONECTA_USER || '';
  const pass = process.env.BTPCONECTA_PASSWORD || '';

  if (!user || !pass) {
    throw new Error('Credenciais do BTP Conecta não configuradas (BTPCONECTA_USER / BTPCONECTA_PASSWORD no .env).');
  }

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    context.setDefaultTimeout(DEFAULT_TIMEOUT);
    context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

    const page = await context.newPage();

    await page.goto('https://www.btpconecta.com.br/', { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
    await page.fill('#cp-login-username', user);
    await page.fill('#cp-login-pass', pass);
    await page.click('button:has-text("Entrar")');

    try {
      // O widget de horários de ônibus (id="btp-onibus-content") só existe na
      // página inicial depois do login ter sido aceito de verdade — esperar
      // por ele em vez de um timeout fixo também detecta login incorreto (o
      // seletor nunca aparece e o waitForSelector estoura por timeout).
      await page.waitForSelector('#btp-onibus-content .btp-onibus-ponto', { timeout: 25000 });
    } catch (waitError) {
      // Diagnóstico: se o formulário de login ainda está na tela, o login
      // falhou de verdade (credenciais erradas ou bloqueio). Se não está,
      // a página carregou em outro estado inesperado (aviso de sessão ativa
      // em outro lugar, termo de uso, etc.) — salva print pra investigar.
      const stillOnLoginForm = (await page.locator('#cp-login-username').count()) > 0;
      const debugPath = path.join(os.tmpdir(), `btpconecta-debug-${Date.now()}.png`);
      await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {});

      if (stillOnLoginForm) {
        throw new Error(
          `Login no BTP Conecta falhou (credenciais inválidas ou bloqueio do portal). Print salvo em: ${debugPath}`
        );
      }
      throw new Error(
        `Login no BTP Conecta ocorreu mas a página inicial não carregou o widget de ônibus esperado. Print salvo em: ${debugPath}`
      );
    }

    const stops = await page.$$eval('#btp-onibus-content .btp-onibus-ponto', (elements) =>
      elements.map((el) => {
        const ponto = el.querySelector('b')?.textContent?.trim() || '';
        const horario = (el.textContent || '').replace(ponto, '').trim();
        return { ponto, horario };
      })
    );

    return stops.filter((stop) => stop.ponto.length > 0);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.warn('[BusScheduleService] Erro ao fechar browser:', e);
      }
    }
  }
}

/**
 * Retry automático (3 tentativas, backoff 1.5s × tentativa): login/navegação
 * num portal externo falha de forma intermitente (rede, portal lento) e a
 * MESMA sequência costuma funcionar na tentativa seguinte sem nenhuma
 * mudança — mesmo padrão já usado nas chamadas do Gemini em geminiService.ts.
 */
async function scrapeBusSchedule(): Promise<BusStop[]> {
  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await scrapeBusScheduleOnce();
    } catch (error) {
      lastError = error;
      console.warn(`[BusScheduleService] Tentativa ${attempt}/${maxAttempts} falhou:`, error instanceof Error ? error.message : error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Cache em memória de 5 minutos: cada busca faz login completo via Playwright
 * no BTP Conecta, então evitamos repetir esse custo (e o risco de acionar
 * algum bloqueio de login repetido) a cada refresh do painel operacional.
 */
export async function fetchBusSchedule(forceRefresh = false): Promise<BusScheduleResponse> {
  const now = Date.now();

  if (!forceRefresh && cache && now - cache.lastUpdate < CACHE_TTL_MS) {
    return { success: true, data: cache.data, lastUpdate: new Date(cache.lastUpdate).toISOString() };
  }

  try {
    const data = await scrapeBusSchedule();
    cache = { data, lastUpdate: Date.now() };
    return { success: true, data, lastUpdate: new Date(cache.lastUpdate).toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao buscar horários de ônibus.';
    console.error('[BusScheduleService] Falha ao buscar horários:', message);

    // Prefere devolver o último dado bom conhecido (mesmo desatualizado) a
    // deixar o card vazio por causa de uma falha pontual no login/portal.
    if (cache) {
      return { success: true, data: cache.data, lastUpdate: new Date(cache.lastUpdate).toISOString(), error: message };
    }

    return { success: false, data: [], lastUpdate: new Date().toISOString(), error: message };
  }
}

export default fetchBusSchedule;
