import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSplitIntelligently, extractOperationalSummary, extractOperationalSummaryFromLayout, extractQcPlanSummary, validateSplitTotals } from './splitIntelligenceService';

const sampleText = `
BREMERHAVEN EXPRESS
NA626A

RESUMO OPERACIONAL

Discharging
Total 1517
Planned 1517
QC Unassigned 0
Completed 0
Remained 0

Loading
Total 141
Planned 141
QC Unassigned 0
Completed 0
Remained 0

QC Plan
DS-DECK 1200
LD-DECK 100
DS-HOLD 317
LD-HOLD 41
`;

test('extrai resumo operacional e QC plan a partir do texto do PDF', () => {
  const operationSummary = extractOperationalSummary(sampleText);
  const qcPlanSummary = extractQcPlanSummary(sampleText);
  const validation = validateSplitTotals(operationSummary, qcPlanSummary);

  assert.equal(operationSummary.totalMovements, 1658);
  assert.equal(operationSummary.discharge.total, 1517);
  assert.equal(operationSummary.loading.total, 141);
  assert.equal(operationSummary.validationStatus, 'VALID');

  assert.equal(qcPlanSummary.dischargeDeck, 1200);
  assert.equal(qcPlanSummary.loadingDeck, 100);
  assert.equal(qcPlanSummary.dischargeHold, 317);
  assert.equal(qcPlanSummary.loadingHold, 41);
  assert.equal(qcPlanSummary.dischargeTotal, 1517);
  assert.equal(qcPlanSummary.loadingTotal, 141);
  assert.equal(qcPlanSummary.grandTotal, 1658);

  assert.equal(validation.summaryValid, true);
  assert.equal(validation.dischargeValid, true);
  assert.equal(validation.loadingValid, true);
  assert.equal(validation.deckHoldValid, true);
});

test('extrai o resumo operacional a partir de itens de texto posicionais', () => {
  const layoutItems = [
    { text: 'Discharging', x: 80, y: 420, width: 90, height: 12 },
    { text: 'Total', x: 120, y: 440, width: 40, height: 12 },
    { text: '1517', x: 220, y: 440, width: 40, height: 12 },
    { text: 'Loading', x: 80, y: 480, width: 70, height: 12 },
    { text: 'Total', x: 120, y: 500, width: 40, height: 12 },
    { text: '141', x: 220, y: 500, width: 30, height: 12 },
  ];

  const operationSummary = extractOperationalSummaryFromLayout(layoutItems as any);

  assert.equal(operationSummary.discharge.total, 1517);
  assert.equal(operationSummary.loading.total, 141);
  assert.equal(operationSummary.totalMovements, 1658);
});

test('reconstrói as linhas operacionais mesmo quando as seções aparecem em ordem espacial invertida', () => {
  const layoutItems = [
    { text: 'Loading', x: 80, y: 180, width: 70, height: 12 },
    { text: 'Total', x: 120, y: 200, width: 40, height: 12 },
    { text: '141', x: 220, y: 200, width: 30, height: 12 },
    { text: 'Discharging', x: 80, y: 260, width: 90, height: 12 },
    { text: 'Total', x: 120, y: 280, width: 40, height: 12 },
    { text: '1517', x: 220, y: 280, width: 40, height: 12 },
  ];

  const operationSummary = extractOperationalSummaryFromLayout(layoutItems as any);

  assert.equal(operationSummary.discharge.total, 1517);
  assert.equal(operationSummary.loading.total, 141);
  assert.equal(operationSummary.totalMovements, 1658);
});

test('extrai o total geral do resumo de produtividade quando o PDF usa uma tabela de QC com a linha ALL', () => {
  const documentText = `
Público
BREMERHAVEN EXPRESS NA626A > GRANDE QUANTIDADE DE REEFER POSITIVO

### Tabela de QCs / Resumo de Produtividade
| QC | T | P | R | C |
|---|---|---|---|---|
| ALL | 1658 | 1658 | 1658 | 0 |
| P10 | 371 | 371 | 371 | 0 |
| P09 | 514 | 514 | 514 | 0 |
`;

  const operationSummary = extractOperationalSummary(documentText);
  const qcPlanSummary = extractQcPlanSummary(documentText);
  const validation = validateSplitTotals(operationSummary, qcPlanSummary);

  assert.equal(operationSummary.totalMovements, 1658);
  assert.equal(qcPlanSummary.grandTotal, 1658);
  assert.equal(validation.summaryValid, true);
});

test('extrai descarga e embarque a partir de uma tabela de categorias por bay', () => {
  const documentText = `
### TABELA DE RESUMO DE CARGA POR PERFIL DO NAVIO

| CATEGORIA | VALORES / MOVIMENTOS |
| :--- | :--- |
| **DS-DECK** | 2 | | 3 | | | 3 | | | C | | 4 | | | 9 | | C | | 9 |
| **LD-DECK** | 1 | 8 | 6 | 2 | 8 | 7 | 2 | 9 | 10 | C | 3 | 6 | 7 | 8 | 12 | 14 | 6 | 8 | 11 |
| **DS-HOLD** | | | 4 | | | 4 | 5 | | 4 | 6 | | | | 10 | | 5 | | 3 |
| **LD-HOLD** | | 7 | 5 | 1 | | 6 | C | 5 | C | | 5 | | 7 | 11 | 4 | 13 | 2 | 7 | 10 |
`;

  const operationSummary = extractOperationalSummary(documentText);
  const qcPlanSummary = extractQcPlanSummary(documentText);

  assert.equal(operationSummary.discharge.total, 71);
  assert.equal(operationSummary.loading.total, 211);
  assert.equal(qcPlanSummary.dischargeTotal, 71);
  assert.equal(qcPlanSummary.loadingTotal, 211);
});

// Texto real extraído (OCR) do documento "SPLIT 0700 X 1300 MAERSK LETICIA.pdf".
// O rótulo (ex.: "DS-DECK:") fica sozinho em uma linha e os valores vêm na
// tabela de perfil do navio, do lado esquerdo da página. Mais abaixo, o
// documento repete os mesmos rótulos numa segunda tabela ("SUMÁRIO POR BAY")
// com números completamente diferentes (que na verdade mostram outra coisa,
// como a sequência de trabalho do guindaste) — essa segunda tabela deve ser
// ignorada.
const maerskDocumentText = `
Público

MAERSK LETICIA 630N | ATENÇÃO AOS HANDLES E AOS HEAVY ON LIGHT

================================================================================
ESQUEMA DE CARGA DO NAVIO (PERFIL)
================================================================================

QTD / BAIA SUPERIOR:
| 116 | 79 | 206 | | 19 | 290 | 22 | 108 | 107 | 2 | 103 | 2 | 55 | 97 | 86 | 227 | 92 | 109 |

DS-DECK:
| 10 | | 61 | | | 17 | | | | | 2 | | | 20 | | | | 3 | (1, 2)

LD-DECK:
| 106 | 77 | 83 | | 19 | 72 | 22 | 44 | | 2 | 49 | 2 | 31 | 33 | 57 | 80 | 49 | 64 | (4, 1, 6, 5)

DS-HOLD:
| | | 32 | | | 60 | | 32 | | | | | | 23 | 5 | 1 | | |

LD-HOLD:
| | 2 | 36 | | | 46 | | 32 | | | 4 | | 24 | 21 | 16 | 21 | 8 | |
| | | | | | 14 14 | | | | | 24 24 | | | | 8 8 | 7 7 | 15 15 | 14 14 |

--------------------------------------------------------------------------------
SUMÁRIO POR BAY / BAIA
--------------------------------------------------------------------------------

BAY:     | 70 | 66 | 62 | 58 | 54 | 50 | 46 | 42 | 38 | 34 | 30 | 26 | 22 | 18 | 14 | 10 | 06 | 02 |
DS-DECK: | 2  |    | 3  |    |    | 3  |    | C  |    | 4  |    |    | 9  |    | C  |    | 9  |
DS-HOLD: |    |    | 4  |    |    | 4 5|    | 4 6|    |    |    |    |    | 10 | 5  | 3  |    |    |
LD-DECK: | 1  | 8  | 6 2|    | 8  | 7 2| 9  | 10 | C  | 3  | 6  | 7  | 8  | 12 | 14 | 6  | 8  | 11 |
LD-HOLD: |    | 7  | 5 1|    |    | 6 C|    | 5  | C  |    | 5  |    | 7  | 11 | 4 13| 2 | 7  | 10 |


================================================================================
CRANE COVERAGE (COBERTURA DE GUINDASTE / CRONOGRAMA DE OPERAÇÃO)
================================================================================

BAYS:
70 | 66 | 62 | 58 | 54 | 50 | 46 | 42 | 38 | 34 | 30 | 26 | 22 | 18 | 14 | 10 | 06 | 02
67 65 | 63 61 | 55 53 | 51 49 | 47 45 | 43 41 | 39 37 | 35 33 | 31 29 | 27 25 | 23 21 | 19 17 | 15 13 | 11 09 | 07 05 | 03 01

PROGRAMAÇÃO HORÁRIA (03/Aug):
`;

test('extrai descarga/embarque do documento MAERSK LETICIA a partir da tabela de perfil (lado esquerdo), ignorando a segunda tabela SUMÁRIO POR BAY com números diferentes', () => {
  const operationSummary = extractOperationalSummary(maerskDocumentText);
  const qcPlanSummary = extractQcPlanSummary(maerskDocumentText);

  assert.equal(operationSummary.discharge.total, 269);
  assert.equal(operationSummary.loading.total, 1180);
  assert.equal(qcPlanSummary.dischargeDeck, 116);
  assert.equal(qcPlanSummary.loadingDeck, 806);
  assert.equal(qcPlanSummary.dischargeHold, 153);
  assert.equal(qcPlanSummary.loadingHold, 374);
  assert.equal(qcPlanSummary.deckTotal, 922);
  assert.equal(qcPlanSummary.holdTotal, 527);
  assert.equal(qcPlanSummary.grandTotal, 1449);
});

test('analyzeSplitIntelligently popula bays por coluna a partir da tabela de perfil do documento MAERSK LETICIA', async () => {
  const lines = maerskDocumentText.split(/\r?\n/);
  const result = await analyzeSplitIntelligently({
    text: maerskDocumentText,
    pages: [maerskDocumentText],
    lines: [lines],
  });

  assert.equal(result.operationalStats.discharge, 269);
  assert.equal(result.operationalStats.loading, 1180);
  assert.ok(result.bays.length > 0, 'esperava bays derivadas da tabela de perfil');

  const byId = (id: string) => result.bays.find((b: any) => b.id === id);

  const bay70 = byId('70');
  assert.ok(bay70, 'esperava encontrar a bay 70');
  assert.equal(bay70.discharge, 10);
  assert.equal(bay70.loading, 106);

  const bay62 = byId('62');
  assert.ok(bay62, 'esperava encontrar a bay 62');
  assert.equal(bay62.discharge, 61 + 32); // DS-DECK 61 + DS-HOLD 32

  // Bay 50: LD-DECK 72 + LD-HOLD 46 de 40' + 14 e 14 de 20' (twins), conforme o documento.
  const bay50 = byId('50');
  assert.ok(bay50, 'esperava encontrar a bay 50');
  assert.equal(bay50.loading, 72 + (46 + 14 + 14));
});
