// AI service: heuristics to extract structured data from parsed PDF text.
// This implementation uses regex heuristics to locate bays, counts and special cargo.
// It returns both values and a `source` flag indicating if a value was directly extracted
// from the PDF or estimated by heuristics.
export async function analyzeSplit(parsed: any): Promise<any> {
  const pages: string[] = parsed.pages || [];
  const text = pages.join('\n');

  const markExtracted = (val: any, found: boolean) => ({ value: val, source: found ? 'extracted' : 'estimated' });

  const extractSingle = (re: RegExp) => {
    const m = text.match(re);
    return m && m[1] ? { value: m[1].trim(), found: true } : { value: undefined, found: false };
  };

  // Basic fields
  const shipNameRes = extractSingle(/(?:Ship|Vessel|Nome|Navio)[:\s\-]*([A-Za-z0-9\s\-\/\.]+)/i);
  const voyageRes = extractSingle(/(?:Voyage|Viagem)[:\s\-]*([A-Za-z0-9\s\-\/]+)/i);
  const operatorRes = extractSingle(/(?:Operator|Operador)[:\s\-]*([A-Za-z0-9\s\-]+)/i);
  const etaRes = extractSingle(/\bETA[:\s\-]*([0-9T:\/\s\-apmAPM]+)/i);
  const etbRes = extractSingle(/\bETB[:\s\-]*([0-9T:\/\s\-apmAPM]+)/i);
  const berthRes = extractSingle(/(?:Berth|Berço|Berco)[:\s\-]*([A-Za-z0-9\s\-]+)/i);

  // Global counts (try to extract explicit counts first)
  const countFromRegex = (name: string, re: RegExp) => {
    const m = text.match(re);
    return m && m[1] ? Number(m[1]) : undefined;
  };

  const discharge = countFromRegex('discharge', /(?:Descarga|Discharge)[:\s\-]*(\d+)/i) ?? 0;
  const load = countFromRegex('load', /(?:Embarque|Load|Loading)[:\s\-]*(\d+)/i) ?? 0;
  const reefersPositive = countFromRegex('reefersPositive', /(?:Reefers Positivos|Reefers Positivas|Reefers Positive)[:\s\-]*(\d+)/i) ?? undefined;
  const reefersNegative = countFromRegex('reefersNegative', /(?:Reefers Negativos|Reefers Negative)[:\s\-]*(\d+)/i) ?? undefined;
  const imoCount = countFromRegex('imo', /(?:IMO)[:\s\-]*(\d+)/i) ?? 0;
  const oogCount = countFromRegex('oog', /(?:OOG)[:\s\-]*(\d+)/i) ?? undefined;
  const directDelivery = countFromRegex('directDelivery', /(?:Direct Delivery|Delivery Direct)[:\s\-]*(\d+)/i) ?? undefined;

  // Find bay headers and build segments
  const bayHeaderRe = /(?:BAY|Bay|BAIA|Baia|BAÍA|Baía)\s*[:#\-\s]*0*([0-9]{1,3})/g;
  const matches = Array.from(text.matchAll(bayHeaderRe));

  const bays: any[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const id = matches[i][1];
      const start = (matches[i].index ?? 0);
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const segment = text.slice(start, end);

      // Operations detection
      const hasOpen = /abrir tamp|abrir tampa|open hatch|open cover|open hatch cover/i.test(segment);
      const hasClose = /fechar tamp|fechar tampa|close hatch/i.test(segment);
      const deckDesc = /descarga conv[eé]x|descarga conv[eé]x|deck.*discharg|deck discharge|descarga convexo/i.test(segment);
      const holdDesc = /descarga por[aã]o|hold.*discharg|por[aã]o.*descarga|porao.*descarga/i.test(segment);

      // Reefers inside bay
      const reefersBay = (() => {
        const m = segment.match(/Reefer[s]?[\s:\-]*(\d+)/i);
        if (m && m[1]) return Number(m[1]);
        const countWords = (segment.match(/reefer/ig) || []).length;
        return countWords > 0 ? countWords : 0;
      })();

      // IMO / OOG detection in bay
      const imoBay = (segment.match(/IMO/gi) || []).length;
      const oogBay = (segment.match(/OOG/gi) || []).length;

      // Movement estimate: sum of small integers in segment (heuristic)
      const numbers = Array.from(segment.matchAll(/\b(\d{1,3})\b/g)).map(m => Number(m[1]));
      const movementEstimate = numbers.filter(n => n > 0 && n < 1000).reduce((a, b) => a + b, 0) || undefined;

      // Build operation sequence based on detected flags
      const ops: string[] = [];
      if (hasOpen) ops.push('Abrir tampa');
      if (deckDesc) ops.push('Descarga Convés');
      if (holdDesc) {
        if (!hasOpen) ops.push('Abrir Porão');
        ops.push('Descarga Porão');
      }
      if (reefersBay > 0) ops.push('Reefers');
      if (hasClose) ops.push('Fechar tampa');

      bays.push({
        id: id.padStart(2, '0'),
        segmentSnippet: segment.slice(0, 400),
        operations: ops.length ? ops : ['Descarga Convés'],
        reefers: reefersBay,
        imo: imoBay,
        oog: oogBay,
        movements: movementEstimate ?? 0,
      });
    }
  }

  // Fallback: try to detect bay-like lines if header regex failed
  if (bays.length === 0) {
    const simpleBayRe = /\b(\d{1,2})\b\s+Bay\b/gi;
    const simpleMatches = Array.from(text.matchAll(simpleBayRe));
    for (const m of simpleMatches) {
      const id = m[1];
      bays.push({ id: id.padStart(2, '0'), operations: ['Descarga Convés'], reefers: 0, imo: 0, oog: 0, movements: 0 });
    }
  }

  // Total movements calculation
  const totalMovements = bays.reduce((s, b) => s + (b.movements || 0), 0) || (discharge + load) || 0;

  // Decide number of shifts heuristically
  const shiftsCount = Math.max(1, Math.ceil(totalMovements / 200));
  const targetPerShift = Math.ceil(totalMovements / shiftsCount) || 1;

  // Allocate bays sequentially into shifts until target reached
  const shifts: any[] = [];
  let currentShift: any = { range: '01:00 às 07:00', team: '1º', bays: [], movements: 0 };
  for (const bay of bays) {
    if (currentShift.movements + bay.movements > targetPerShift && shifts.length + 1 < shiftsCount) {
      shifts.push(currentShift);
      currentShift = { range: '—', team: `${shifts.length + 2}º`, bays: [], movements: 0 };
    }
    currentShift.bays.push(bay.id);
    currentShift.movements += bay.movements;
  }
  shifts.push(currentShift);

  // Classification per bay
  const classify = (moves: number) => {
    if (moves <= 40) return 'Baixa';
    if (moves <= 80) return 'Média';
    return 'Alta';
  };

  const baySummaries = bays.map(b => ({
    id: b.id,
    operations: b.operations,
    reefers: b.reefers,
    imo: b.imo,
    oog: b.oog,
    movements: b.movements,
    classification: classify(b.movements),
    progressPct: 0,
  }));

  // Alerts
  const alerts = new Set<string>();
  if ((reefersPositive ?? (bays.reduce((s, b) => s + b.reefers, 0))) > 20) alerts.add('Grande quantidade de Reefers Positivos');
  if (imoCount > 0 || bays.some(b => b.imo > 0)) alerts.add('IMO');
  if ((oogCount ?? bays.some(b => b.oog > 0)) ) alerts.add('OOG');
  if ((directDelivery ?? 0) > 0) alerts.add('Direct Delivery');

  const smartSummary = `Resumo gerado automaticamente: total ≈ ${totalMovements} movimentos; bays detectadas: ${bays.length}.`; 

  return {
    shipName: shipNameRes.value ?? 'Desconhecido', shipNameSource: shipNameRes.found ? 'extracted' : 'estimated',
    voyage: voyageRes.value, voyageSource: voyageRes.found ? 'extracted' : 'estimated',
    operator: operatorRes.value, operatorSource: operatorRes.found ? 'extracted' : 'estimated',
    eta: etaRes.value, etaSource: etaRes.found ? 'extracted' : 'estimated',
    etb: etbRes.value, etbSource: etbRes.found ? 'extracted' : 'estimated',
    berth: berthRes.value, berthSource: berthRes.found ? 'extracted' : 'estimated',
    discharge,
    load,
    reefersPositive: reefersPositive ?? bays.reduce((s, b) => s + b.reefers, 0),
    reefersNegative: reefersNegative ?? 0,
    imo: imoCount + bays.reduce((s, b) => s + b.imo, 0),
    oog: oogCount ?? bays.reduce((s, b) => s + b.oog, 0),
    directDelivery: directDelivery ?? 0,
    total: totalMovements,
    shifts,
    bays: baySummaries,
    alerts: Array.from(alerts),
    smartSummary,
  };
}

export default analyzeSplit;
