/**
 * BTP Schedule Scraper Service
 * Extrai dados de programação do Portal do Cliente BTP
 * URL: https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex
 */

import { chromium, Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

export interface BtpScheduleRecord {
  navio: string;
  viagem: string;
  armador: string;
  berco: string;
  status: string;
  eta: string;
  etb: string;
  etd: string;
  datachegada: string;
  horachegada: string;
  dataatracacao: string;
  horaatracacao: string;
  datasaida: string;
  horasaida: string;
  operacao: string;
  terminal: string;
  [key: string]: string; // Flexibilidade para outros campos
}

export interface BtpScheduleResponse {
  success: boolean;
  data: BtpScheduleRecord[];
  totalRecords: number;
  lastUpdate: string;
  error?: string;
}

const BTP_PORTAL_URL = 'https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex';
const DEFAULT_TIMEOUT = 30000;

/**
 * Extrai dados de uma célula, removendo espaços e quebras de linha
 */
function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte string de data (DD/MM/YYYY) para objeto Date
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
}

/**
 * Converte string de hora (HH:MM) para número de minutos desde meia-noite
 */
function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Scraper principal para o portal BTP
 */
async function scrapeBtpPortal(): Promise<BtpScheduleRecord[]> {
  let browser = null;
  let page = null;

  try {
    console.log('[BtpScheduleService] Iniciando Playwright para acesso ao portal BTP...');

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    context.setDefaultTimeout(DEFAULT_TIMEOUT);
    context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

    page = await context.newPage();

    console.log(`[BtpScheduleService] Acessando portal: ${BTP_PORTAL_URL}`);
    await page.goto(BTP_PORTAL_URL, {
      waitUntil: 'networkidle',
      timeout: DEFAULT_TIMEOUT,
    });

    // Aguardar carregamento da tabela
    console.log('[BtpScheduleService] Aguardando carregamento da tabela...');
    
    // Tentar diferentes seletores de tabela (comum, tbody, datatable, etc)
    const tableSelectors = [
      'table',
      '.table',
      '[role="table"]',
      '.data-table',
      '.grid',
      '#gridview',
      '.schedule-table',
    ];

    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
        if ((await page.locator(selector).count()) > 0) {
          console.log(`[BtpScheduleService] Tabela encontrada com seletor: ${selector}`);
          tableFound = true;
          break;
        }
      } catch (e) {
        // Continuar tentando próximo seletor
      }
    }

    if (!tableFound) {
      console.warn('[BtpScheduleService] Nenhuma tabela encontrada. Aguardando conteúdo dinâmico...');
      await page.waitForTimeout(3000);
    }

    // Extrair dados da tabela
    console.log('[BtpScheduleService] Extraindo dados da tabela...');

    const records = await page.evaluate(() => {
      const results: BtpScheduleRecord[] = [];

      // Tentar múltiplas estratégias de extração
      const rows = document.querySelectorAll('table tbody tr, .data-table tbody tr, [role="table"] [role="row"]');

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td, [role="gridcell"]');
        if (cells.length === 0) return;

        // Extrair texto de cada célula
        const cellTexts = Array.from(cells).map((cell) =>
          cell.textContent?.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ') || ''
        );

        // Mapear para campos conhecidos (adaptável conforme estrutura real)
        // Assumindo ordem comum: navio, viagem, armador, berço, status, eta, etb, etd, ...
        if (cellTexts.length >= 5) {
          const record: BtpScheduleRecord = {
            navio: cellTexts[0] || '',
            viagem: cellTexts[1] || '',
            armador: cellTexts[2] || '',
            berco: cellTexts[3] || '',
            status: cellTexts[4] || '',
            eta: cellTexts[5] || '',
            etb: cellTexts[6] || '',
            etd: cellTexts[7] || '',
            datachegada: cellTexts[8] || '',
            horachegada: cellTexts[9] || '',
            dataatracacao: cellTexts[10] || '',
            horaatracacao: cellTexts[11] || '',
            datasaida: cellTexts[12] || '',
            horasaida: cellTexts[13] || '',
            operacao: cellTexts[14] || '',
            terminal: cellTexts[15] || '',
          };

          // Adicionar campos extras se existirem
          for (let i = 16; i < cellTexts.length; i++) {
            record[`extra_${i}`] = cellTexts[i];
          }

          results.push(record);
        }
      });

      return results;
    });

    console.log(`[BtpScheduleService] ${records.length} registros extraídos com sucesso`);

    // Filtrar registros vazios
    const filteredRecords = records.filter(
      (r) => r.navio && r.navio.trim().length > 0
    );

    return filteredRecords;
  } catch (error) {
    console.error('[BtpScheduleService] Erro ao fazer scraping:', error);
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.warn('[BtpScheduleService] Erro ao fechar página:', e);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.warn('[BtpScheduleService] Erro ao fechar browser:', e);
      }
    }
  }
}

/**
 * Serviço principal exportado para uso em rotas da API
 */
export async function fetchBtpSchedule(): Promise<BtpScheduleResponse> {
  const startTime = Date.now();

  try {
    console.log('[BtpScheduleService] Iniciando busca de dados de programação BTP...');

    const data = await scrapeBtpPortal();

    const duration = Date.now() - startTime;
    console.log(
      `[BtpScheduleService] Busca concluída em ${duration}ms. Total: ${data.length} registros`
    );

    return {
      success: true,
      data,
      totalRecords: data.length,
      lastUpdate: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[BtpScheduleService] Falha na busca:', errorMessage);

    return {
      success: false,
      data: [],
      totalRecords: 0,
      lastUpdate: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

export default fetchBtpSchedule;
