// AI service: parser calibrado para o formato REAL dos relatórios "Split" do BTP.
//
// Este relatório NÃO é uma lista genérica de "BAY: nn — X movimentos". Ele é composto por:
//  1. Um título com o nome do navio + código da viagem + título do alerta principal
//     ex: "BREMERHAVEN EXPRESS NA626A > GRANDE QUANTIDADE DE REEFER POSITIVO"
//  2. Totais globais de Discharging/Loading (Total, Planned, QC Unassigned, Completed, Remained)
//  3. Um "QC Plan" com contagem de movimentos POR GUINDASTE (P01, P02, ... não por bay)
//  4. Mapas de bay em formato gráfico/visual (SEM texto extraível — não dá pra saber
//     quantos contêineres tem em cada bay a partir dessas páginas)
//  5. Tabelas de alerta com contêineres específicos que precisam de atenção:
//     "DESCARGA DE CARGA SENSÍVEL", "DESCARGA DE REEFERS TANQUES OPERACIONAIS",
//     "EMBARQUE DE FLAT VAZIO", "DESCARGA DE EXCESSOS", "DESCARGA DIRETA", etc.
//     Cada contêiner tem uma posição no formato Bay-Row-Tier (ex: 05-14-82)
//
// Por isso, os "movimentos por bay" mostrados no dashboard vêm EXCLUSIVAMENTE dos
// contêineres citados nessas tabelas de alerta (dados 100% reais), agrupados pelo
// número da bay extraído da posição. Não há estimativa nem invenção de números.

type SplitPageLike = string | { text?: string; lines?: string[]; content?: string };

export interface AlertContainer {
  stowage: string;
  bay: string;
  cntrNo?: string;
  iso?: string;
  weight?: string;
  operator?: string;
  pod?: string;
  imdgClasses?: string; // ex: "2.1 (1950), 3 (1170)"
  oog?: string;
  temperature?: string;
  rawLine: string;
}

export interface AlertSection {
  title: string;
  containers: AlertContainer[];
}

export interface BaySummary {
  id: string;
  containers: AlertContainer[];
  sections: string[]; // quais tabelas de alerta tocam essa bay
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getPageLines(parsed: any): string[] {
  const pages: SplitPageLike[] = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const explicitLines = Array.isArray(parsed?.lines) ? parsed.lines : [];

  if (explicitLines.length > 0) {
    return explicitLines.flatMap((pageLines: any) => (Array.isArray(pageLines) ? pageLines : []));
  }

  return pages.flatMap((page: SplitPageLike) => {
    if (typeof page === 'string') {
      return normalizeWhitespace(page).split(/\n/).map((line) => line.trim()).filter(Boolean);
    }
    if (typeof page?.text === 'string') {
      return normalizeWhitespace(page.text).split(/\n/).map((line) => line.trim()).filter(Boolean);
    }
    if (typeof page?.content === 'string') {
      return normalizeWhitespace(page.content).split(/\n/).map((line) => line.trim()).filter(Boolean);
    }
    if (Array.isArray(page?.lines)) {
      return page.lines.map((line: string) => normalizeWhitespace(line)).filter(Boolean);
    }
    return [];
  });
}

// --- 1. Cabeçalho: "NOME DO NAVIO CODIGOVIAGEM > TITULO DO ALERTA" ---
function extractVesselHeader(lines: string[]): { shipName?: string; voyage?: string; alertTitle?: string } {
  const headerLine = lines.find((line) => /\s>\s/.test(line) && /^[A-Z\s]+[A-Z0-9]+\s*>/.test(line));
  if (!headerLine) return {};

  const [left, right] = headerLine.split(/\s>\s/);
  if (!left) return { alertTitle: right };

  // O código da viagem é o último "token" do lado esquerdo, geralmente formato tipo NA626A
  const tokens = left.trim().split(/\s+/);
  const voyageToken = tokens[tokens.length - 1];
  const looksLikeVoyage = /^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(voyageToken);

  if (looksLikeVoyage) {
    return {
      shipName: tokens.slice(0, -1).join(' '),
      voyage: voyageToken,
      alertTitle: right?.trim(),
    };
  }

  return { shipName: left.trim(), alertTitle: right?.trim() };
}

// --- 2. Totais globais de Discharging / Loading ---
// Retorna null quando o bloco não é encontrado como texto (ex: quando a página é uma
// imagem/screenshot, como acontece na página 1 destes relatórios) — em vez de 0, que
// passaria a falsa impressão de que a operação realmente tem zero movimentos.
function extractOperationTotals(lines: string[]) {
  function extractBlock(blockLabel: string) {
    const startIdx = lines.findIndex((line) => new RegExp(`^${blockLabel}\\b`, 'i').test(line.trim()));
    if (startIdx === -1) {
      return { total: null, planned: null, completed: null, remaining: null, found: false };
    }

    const windowLines = lines.slice(startIdx, startIdx + 12).join(' ');
    const pick = (label: string) => {
      const match = windowLines.match(new RegExp(`${label}\\s*:?\\s*(\\d+)`, 'i'));
      return match ? Number(match[1]) : null;
    };

    const total = pick('Total');
    return {
      total,
      planned: pick('Planned'),
      completed: pick('Completed'),
      remaining: pick('Remained|Remaining'),
      found: total !== null,
    };
  }

  return {
    discharging: extractBlock('Discharging'),
    loading: extractBlock('Loading'),
  };
}

// --- 3. Plano de guindastes (QC Plan): linhas tipo "P10 371 371 371 0" ---
function extractCranePlan(lines: string[]): Array<{ crane: string; total: number; planned: number; remaining: number; completed: number }> {
  const craneLineRegex = /^(P\d{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;
  const cranes: Array<{ crane: string; total: number; planned: number; remaining: number; completed: number }> = [];

  for (const line of lines) {
    const match = line.match(craneLineRegex);
    if (match) {
      const [, crane, t, p, r, c] = match;
      const total = Number(t);
      if (total > 0) {
        cranes.push({ crane, total, planned: Number(p), remaining: Number(r), completed: Number(c) });
      }
    }
  }

  return cranes;
}

// --- 4. Seções de alerta (tabelas de contêineres) ---
// Detecção por PALAVRA-CHAVE (não por regex ancorada no fim da linha), porque alguns
// títulos vêm com texto extra colado na mesma linha, ex:
// "DESCARGA DE CARGA SENSÍVEL (Desligar no máximo 1 hora antes da descarga)"
// Isso garante que o título seja reconhecido mesmo com sufixo variável.
const KNOWN_SECTION_KEYWORDS: Array<{ key: RegExp; title: string }> = [
  { key: /CARGA SENS[ÍI]VEL/i, title: 'DESCARGA DE CARGA SENSÍVEL' },
  { key: /REEFERS?\s+TANQUES\s+OPERACIONAIS/i, title: 'DESCARGA DE REEFERS TANQUES OPERACIONAIS' },
  { key: /FLAT\s+VAZIO/i, title: 'EMBARQUE DE FLAT VAZIO' },
  { key: /DE\s+EXCESSOS/i, title: 'DESCARGA DE EXCESSOS' },
  { key: /DESCARGA\s+DIRETA/i, title: 'DESCARGA DIRETA' },
  { key: /DESCARGA\s+INDIRETA/i, title: 'DESCARGA INDIRETA' },
  { key: /EMBARQUE\s+DIRETO/i, title: 'EMBARQUE DIRETO' },
];

function matchSectionKeyword(line: string): string | null {
  if (line.length > 150) return null; // evita falso positivo em parágrafos longos
  const found = KNOWN_SECTION_KEYWORDS.find((entry) => entry.key.test(line));
  return found ? found.title : null;
}

const STOWAGE_REGEX = /^(\d{2})-(\d{2})-(\d{2,3})\b/;
// Fallback: algumas tabelas trazem a posição entre parênteses no meio da linha,
// ex: "1 MSDU9947037 XX AH-46-B-3 (10-09-86) 45P3 M 5.2 MSC ARBUE"
const STOWAGE_IN_PARENS_REGEX = /\((\d{2})-(\d{2})-(\d{2,3})\)/;
const CONTAINER_ID_REGEX = /\b([A-Z]{3}[UJZ]\d{7})\b/;
const ISO_CODE_REGEX = /\b(\d{2}[A-Z]\d)\b/;
const IMDG_CLASSES_REGEX = /(\d(?:\.\d)?\s*\(\d{3,4}\)(?:,\s*\d(?:\.\d)?\s*\(\d{3,4}\))*)/;
const OOG_REGEX = /(\/\/[\d/]*\/)/;
// Peso em toneladas: número decimal isolado que aparece logo após o código ISO (ex: "7.0", "31.3")
const WEIGHT_REGEX = /\b(\d{1,3}[.,]\d)\b/;
// Temperatura de reefer: número inteiro isolado antes do nome do recinto/operador.
// Best-effort — só confiável em linhas de tabelas de reefer.
const TEMP_REGEX = /\s(-?\d{1,2})\s(?:NOVA|MARIMEX|ECOPORTO|BAND|TRANSPORTES|[A-Z]{3,})/;

function parseContainerLine(line: string): AlertContainer | null {
  const stowageMatch = line.match(STOWAGE_REGEX) || line.match(STOWAGE_IN_PARENS_REGEX);
  if (!stowageMatch) return null;

  const stowage = `${stowageMatch[1]}-${stowageMatch[2]}-${stowageMatch[3]}`;
  const bay = stowageMatch[1];

  const cntrMatch = line.match(CONTAINER_ID_REGEX);
  const isoMatch = line.match(ISO_CODE_REGEX);
  const imdgMatch = line.match(IMDG_CLASSES_REGEX);
  const oogMatch = line.match(OOG_REGEX);
  const weightMatch = line.match(WEIGHT_REGEX);
  const tempMatch = line.match(TEMP_REGEX);

  // Operador (OPR) e POD costumam ser códigos de 3 letras maiúsculas isolados
  const knownOperators = ['HLC', 'MSC', 'MSK', 'CMA', 'ONE', 'EVE', 'COS', 'HMM', 'ZIM', 'PIL'];
  const operatorMatch = knownOperators.find((op) => new RegExp(`\\b${op}\\b`).test(line));
  const podMatch = line.match(/\b(BR[A-Z]{3}|AR[A-Z]{3}|[A-Z]{5})\b/g)?.find((token) => token !== operatorMatch && !/^[A-Z]{3}[UJZ]/.test(token));

  return {
    stowage,
    bay,
    cntrNo: cntrMatch?.[1],
    iso: isoMatch?.[1],
    imdgClasses: imdgMatch?.[1],
    oog: oogMatch?.[1],
    weight: weightMatch?.[1],
    temperature: tempMatch?.[1],
    operator: operatorMatch,
    pod: podMatch,
    rawLine: normalizeWhitespace(line),
  };
}

function extractAlertSections(lines: string[]): AlertSection[] {
  const rawSections: AlertSection[] = [];
  let current: AlertSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const sectionTitle = matchSectionKeyword(trimmed);
    if (sectionTitle) {
      if (current) {
        rawSections.push(current);
      }
      current = { title: sectionTitle, containers: [] };
      continue;
    }

    if (current) {
      const container = parseContainerLine(trimmed);
      if (container) {
        current.containers.push(container);
      }
    }
  }

  if (current) {
    rawSections.push(current);
  }

  // Mescla seções com o mesmo título (o cabeçalho se repete a cada página do PDF,
  // então a mesma categoria pode aparecer "fatiada" em vários blocos)
  const merged = new Map<string, AlertSection>();
  for (const section of rawSections) {
    if (section.containers.length === 0) continue; // ignora blocos vazios (ex: título repetido sem linhas novas)
    const existing = merged.get(section.title);
    if (existing) {
      const existingKeys = new Set(existing.containers.map((c) => c.stowage + c.cntrNo));
      for (const container of section.containers) {
        if (!existingKeys.has(container.stowage + container.cntrNo)) {
          existing.containers.push(container);
        }
      }
    } else {
      merged.set(section.title, { title: section.title, containers: [...section.containers] });
    }
  }

  return Array.from(merged.values());
}

// --- 5. Agrupar contêineres por bay (dado real, sem estimativa) ---
function buildBaysFromSections(sections: AlertSection[]): BaySummary[] {
  const bayMap = new Map<string, BaySummary>();

  for (const section of sections) {
    for (const container of section.containers) {
      const existing = bayMap.get(container.bay);
      if (existing) {
        existing.containers.push(container);
        if (!existing.sections.includes(section.title)) {
          existing.sections.push(section.title);
        }
      } else {
        bayMap.set(container.bay, {
          id: container.bay,
          containers: [container],
          sections: [section.title],
        });
      }
    }
  }

  return Array.from(bayMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export async function analyzeSplit(parsed: any): Promise<any> {
  console.log('[aiService] Iniciando análise do Split (formato BTP real)...');

  try {
    const lines = getPageLines(parsed);
    console.log('[aiService] Linhas extraídas:', lines.length);

    const header = extractVesselHeader(lines);
    const totals = extractOperationTotals(lines);
    const cranePlan = extractCranePlan(lines);
    const alertSections = extractAlertSections(lines);
    const bays = buildBaysFromSections(alertSections);

    console.log('[aiService] Cabeçalho detectado:', header);
    console.log('[aiService] Totais:', totals);
    console.log('[aiService] Guindastes com plano:', cranePlan.length);
    console.log('[aiService] Seções de alerta encontradas:', alertSections.map((s) => `${s.title} (${s.containers.length})`));
    console.log('[aiService] Bays com contêineres de alerta:', bays.length);

    const allAlertContainers = alertSections.flatMap((s) => s.containers);

    const reefersPositive = allAlertContainers.filter((c) => c.temperature && Number(c.temperature) >= 0).length
      || alertSections.filter((s) => /reefer/i.test(s.title) && !/negativ/i.test(s.title)).reduce((sum, s) => sum + s.containers.length, 0);

    const imoCount = allAlertContainers.filter((c) => !!c.imdgClasses).length;
    const oogCount = allAlertContainers.filter((c) => !!c.oog).length
      || alertSections.filter((s) => /excesso/i.test(s.title)).reduce((sum, s) => sum + s.containers.length, 0);
    const directDeliveryCount = alertSections.filter((s) => /direta/i.test(s.title)).reduce((sum, s) => sum + s.containers.length, 0);

    const alerts = alertSections.map((s) => s.title);
    if (header.alertTitle && !alerts.includes(header.alertTitle)) {
      alerts.unshift(header.alertTitle);
    }

    const smartSummary = [
      `Navio ${header.shipName ?? 'não identificado'}${header.voyage ? ` (viagem ${header.voyage})` : ''}.`,
      `Descarga total planejada: ${totals.discharging.total} contêineres, Embarque: ${totals.loading.total}.`,
      cranePlan.length > 0 ? `${cranePlan.length} guindastes escalados, totalizando ${cranePlan.reduce((s, c) => s + c.total, 0)} movimentos.` : '',
      alertSections.length > 0
        ? `${alertSections.length} categorias de alerta identificadas, envolvendo ${allAlertContainers.length} contêineres específicos em ${bays.length} bays.`
        : 'Nenhuma tabela de alerta com contêineres específicos foi encontrada no texto extraído.',
    ].filter(Boolean).join(' ');

    const result = {
      // Cabeçalho — dados reais extraídos do texto (sem "estimated" fake, ou null se não encontrado)
      shipName: header.shipName ?? null,
      shipNameSource: header.shipName ? 'extracted' : 'not_found',
      voyage: header.voyage ?? null,
      voyageSource: header.voyage ? 'extracted' : 'not_found',
      // Este relatório não contém ETA/ETB/Berço/Operador como texto — não inventamos esses campos
      operator: null,
      operatorSource: 'not_available_in_document',
      eta: null,
      etaSource: 'not_available_in_document',
      etb: null,
      etbSource: 'not_available_in_document',
      berth: null,
      berthSource: 'not_available_in_document',

      // Totais reais (null + source quando o dado está apenas na imagem da página 1, não em texto)
      discharge: totals.discharging.total,
      dischargeSource: totals.discharging.found ? 'extracted' : 'not_available_in_document',
      dischargeRemaining: totals.discharging.remaining,
      load: totals.loading.total,
      loadSource: totals.loading.found ? 'extracted' : 'not_available_in_document',
      loadRemaining: totals.loading.remaining,
      reefersPositive,
      reefersNegative: 0, // não há dado explícito de reefers negativos neste relatório
      imo: imoCount,
      oog: oogCount,
      directDelivery: directDeliveryCount,
      total: (totals.discharging.total ?? 0) + (totals.loading.total ?? 0),

      // Plano de guindastes — fica vazio (array []) quando a página 1 é imagem, sem texto extraível
      cranePlan,
      cranePlanSource: cranePlan.length > 0 ? 'extracted' : 'not_available_in_document',

      // Bays com dados 100% reais (apenas as que aparecem nas tabelas de alerta)
      bays: bays.map((bay) => ({
        id: bay.id,
        containerCount: bay.containers.length,
        sections: bay.sections,
        containers: bay.containers,
      })),

      // Seções de alerta completas, para exibir as tabelas originais se quiser
      alertSections,
      alerts,
      smartSummary,
    };

    console.log('[aiService] Análise concluída:', {
      shipName: result.shipName,
      discharge: result.discharge,
      load: result.load,
      bays: result.bays.length,
    });

    return result;
  } catch (error) {
    console.error('[aiService] Erro ao analisar o Split:', error);
    throw error;
  }
}

export default analyzeSplit;