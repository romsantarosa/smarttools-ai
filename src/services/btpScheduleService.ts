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

interface RapDetailResponse {
  Result: string;
  Records?: Record<string, any>;
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

function normalizeRap(rap: string): string {
  return cleanText(rap).replace(/\s+/g, ' ').trim();
}

function toRapRequestValue(rap: string): string {
  const normalized = normalizeRap(rap);
  if (!normalized) return '';

  const match = normalized.match(/^(\d+)\s+(\d{4})$/);
  if (match) {
    // O endpoint DetalhesViagem espera o mesmo formato visual do portal: "NNNNN  AAAA".
    return `${match[1]}  ${match[2]}`;
  }

  return normalized;
}

function toRapKey(rap: string): string {
  return toRapRequestValue(rap).replace(/\s+/g, '');
}

function mapRapDetailsToRecord(record: BtpScheduleRecord, details: Record<string, any>): BtpScheduleRecord {
  const get = (key: string) => cleanText(String(details[key] ?? ''));

  const previsaoChegada = get('PrevisaoChegada');
  const atracacao = get('Atracacao');
  const previsaoSaida = get('PrevisaoSaida');
  const inicioOperacao = get('InicioOperacao');
  const fimOperacao = get('FimOperacao');
  const saida = get('Saida');
  const deadline = get('Deadline');

  const previsaoChegadaParts = splitDateTime(previsaoChegada);
  const atracacaoParts = splitDateTime(atracacao);
  const previsaoSaidaParts = splitDateTime(previsaoSaida);
  const saidaParts = splitDateTime(saida);

  return {
    ...record,
    navio: get('Navio') || record.navio,
    viagem: get('Viagem') || record.viagem,
    operacao: get('Servico') || record.operacao,
    berco: get('Berco') || record.berco,
    eta: previsaoChegada || record.eta,
    etb: atracacao || record.etb,
    etd: previsaoSaida || record.etd,
    datachegada: previsaoChegadaParts.data || record.datachegada,
    horachegada: previsaoChegadaParts.hora || record.horachegada,
    dataatracacao: atracacaoParts.data || record.dataatracacao,
    horaatracacao: atracacaoParts.hora || record.horaatracacao,
    datasaida: saidaParts.data || record.datasaida,
    horasaida: saidaParts.hora || record.horasaida,
    chegadaPrevista: previsaoChegada,
    atracacao,
    saidaPrevista: previsaoSaida,
    comprimentoNavio: get('Comprimento'),
    codigoCodesp: get('CodigoCodesp'),
    pontoAtracacao: get('Berco'),
    numeroViagemDescarga: get('ViagemDescarga'),
    inicioOperacao,
    fimOperacao,
    saida,
    tipoOperacao: get('TipoOperacao'),
    deadLine: deadline || record.deadline || '',
    direcaoAtracacao: get('DirecaoAtracacao'),
    numeroViagemEmbarque: get('ViagemEmbarque'),
  };
}

async function fetchRapDetailsMap(page: Page, records: BtpScheduleRecord[]): Promise<Map<string, Record<string, any>>> {
  const detailMap = new Map<string, Record<string, any>>();

  const verificationToken = await page.evaluate(() => {
    const input = document.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement | null;
    return input?.value || '';
  });

  if (!verificationToken) {
    console.warn('[BtpScheduleService] Token de verificação não encontrado; seguindo sem detalhes de RAP.');
    return detailMap;
  }

  const uniqueRaps = Array.from(
    new Set(
      records
        .map((record) => toRapRequestValue(record.rap || ''))
        .filter((rap) => rap.length > 0)
    )
  );

  if (uniqueRaps.length === 0) return detailMap;

  const concurrency = 5;
  let index = 0;

  const worker = async () => {
    while (index < uniqueRaps.length) {
      const currentIndex = index;
      index += 1;
      const rap = uniqueRaps[currentIndex];
      const rapKey = toRapKey(rap);

      try {
        const response = await page.request.post('https://novo-tas.btp.com.br/ConsultasLivres/DetalhesViagem', {
          form: { rap },
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            '__RequestVerificationToken': verificationToken,
          },
          timeout: 15000,
        });

        if (!response.ok()) continue;

        const json = (await response.json()) as RapDetailResponse;
        if (json.Result !== 'OK' || !json.Records) continue;

        detailMap.set(rapKey, json.Records);
      } catch (error) {
        console.warn(`[BtpScheduleService] Falha ao buscar detalhes do RAP ${rap}:`, error);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return detailMap;
}

// Rótulos das colunas de cabeçalho, para comparação EXATA (célula inteira),
// não por substring: um teste de substring (ex.: /rap/i.test(cell)) também
// casa com nomes de navio reais como "SAN RAPHAEL MAERSK" (contém "RAP"
// dentro de "RAPHAEL"), fazendo a linha inteira ser descartada como se fosse
// o cabeçalho da tabela — bug real já confirmado com esse navio específico.
const HEADER_CELL_LABELS = new Set(['rap', 'navio', 'viagem', 'agência', 'agencia', 'serviço', 'servico']);

export function parseBtpScheduleRows(rows: string[][]): BtpScheduleRecord[] {
  const records: BtpScheduleRecord[] = [];

  rows.forEach((cells) => {
    const normalizedCells = cells.map((cell) => cleanText(cell));
    const hasData = normalizedCells.some((cell) => cell.length > 0);
    if (!hasData) return;

    const isHeader = normalizedCells.some((cell) => HEADER_CELL_LABELS.has(cell.toLowerCase()));
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
    const rapDetailsMap = await fetchRapDetailsMap(page, filteredRecords);

    const enrichedRecords = filteredRecords.map((record) => {
      const rapKey = toRapKey(record.rap || '');
      const details = rapDetailsMap.get(rapKey);
      if (!details) return record;
      return mapRapDetailsToRecord(record, details);
    });

    console.log(`[BtpScheduleService] ${filteredRecords.length} registros extraídos do iframe BTP`);
    return enrichedRecords;
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
