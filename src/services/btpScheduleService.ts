/**
 * BTP Schedule Scraper Service
 * Extrai dados de programação do Portal do Cliente BTP
 * URL: https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex
 */

import { chromium, Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

interface JtableResponse {
  Result: string;
  Records?: Array<Record<string, any>>;
  TotalRecordCount?: number;
  Error?: string;
  Message?: string;
}

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
const BTP_LIST_ACTION_URL = 'https://novo-tas.btp.com.br/ConsultasLivres/ListaAtracacao';
const DEFAULT_TIMEOUT = 45000;

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

function splitDateTime(value: string): { data: string; hora: string } {
  const cleaned = cleanText(value);
  if (!cleaned) return { data: '', hora: '' };

  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { data: cleaned, hora: '' };

  return {
    data: `${match[1]}/${match[2]}/${match[3]}`,
    hora: `${match[4]}:${match[5]}`,
  };
}

export function parseBtpScheduleRows(rows: string[][]): BtpScheduleRecord[] {
  const records: BtpScheduleRecord[] = [];

  rows.forEach((cells) => {
    const normalizedCells = cells.map((cell) => cleanText(cell));
    const hasData = normalizedCells.some((cell) => cell.length > 0);
    if (!hasData) return;

    const isHeader = normalizedCells.some((cell) => /navio|viagem|agência|serviço|rap/i.test(cell));
    if (isHeader) return;

    const [rap, navio, viagem, armador, eta, chegada, etb, atracacao, etd, saida, gateDry, gateReefer, deadline, servico] = normalizedCells;
    if (!navio || navio.toLowerCase().includes('navio')) return;

    const chegadaParts = splitDateTime(chegada);
    const atracacaoParts = splitDateTime(atracacao);
    const saidaParts = splitDateTime(saida);

    records.push({
      navio,
      viagem,
      armador,
      berco: '',
      status: 'Previsto',
      eta: eta || '',
      etb: etb || '',
      etd: etd || '',
      datachegada: chegadaParts.data,
      horachegada: chegadaParts.hora,
      dataatracacao: atracacaoParts.data,
      horaatracacao: atracacaoParts.hora,
      datasaida: saidaParts.data,
      horasaida: saidaParts.hora,
      operacao: servico || '',
      terminal: '',
      rap: rap || '',
      gateDry: gateDry || '',
      gateReefer: gateReefer || '',
      deadline: deadline || '',
    });
  });

  return records;
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

    const candidateUrls = [
      'https://novo-tas.btp.com.br/ConsultasLivres/listaatracacaoindex?accessToken=undefined&authenticationType=undefined',
      'https://novo-tas.btp.com.br/ConsultasLivres/listaatracacaoindex',
      'https://portaldocliente.btp.com.br/sistemas/processos-logisticos/ConsultasLivres/listaatracacaoindex',
    ];

    let rows: string[][] = [];

    for (const candidateUrl of candidateUrls) {
      try {
        console.log(`[BtpScheduleService] Tentando acessar: ${candidateUrl}`);
        await page.goto(candidateUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        await page.waitForTimeout(4000);

        const bodyText = await page.locator('body').innerText().catch(() => '');
        const hasKnownContent = ['programação de atracação', 'navio', 'viagem', 'agência', 'serviço'].some((token) =>
          bodyText.toLowerCase().includes(token)
        );

        if (!hasKnownContent) {
          const iframeSrc = await page.locator('iframe').getAttribute('src').catch(() => null);
          if (iframeSrc) {
            const resolvedIframeUrl = iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, candidateUrl).toString();
            console.log(`[BtpScheduleService] Encontrado iframe, tentando: ${resolvedIframeUrl}`);
            await page.goto(resolvedIframeUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 20000,
            });
            await page.waitForTimeout(4000);
          }
        }

        const tableCount = await page.locator('table tr').count().catch(() => 0);
        if (tableCount >= 3) {
          rows = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            for (const table of tables) {
              const normalizedRows = Array.from(table.querySelectorAll('tr')).map((row) =>
                Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
              );
              const hasHeader = normalizedRows.some((row) => row.some((cell) => /navio|viagem|agência|serviço|rap/i.test(cell)));
              if (normalizedRows.length > 2 && hasHeader) {
                return normalizedRows;
              }
            }
            return [] as string[][];
          });

          if (rows.length > 2) {
            break;
          }
        }
      } catch (error) {
        console.warn(`[BtpScheduleService] Falha ao acessar ${candidateUrl}:`, error);
      }
    }

    const parsedRecords = parseBtpScheduleRows(rows);
    const filteredRecords = parsedRecords.filter((record) => record.navio && record.navio.trim().length > 0);
    console.log(`[BtpScheduleService] ${filteredRecords.length} registros extraídos do iframe BTP`);
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
