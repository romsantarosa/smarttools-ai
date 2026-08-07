# Bercos Fixos + Proximo Navio (Atracacao/Saida) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the "Atracacao / Saida de Navios" page, always show exactly 3 berth cards (BTP 1/2/3, "Livre" when empty) plus a new "Proximo Navio" row showing the next scheduled ship per berth.

**Architecture:** A new `getBerthSlots(records)` helper in `src/services/btpPortalData.ts` reshapes the flat list of Portal BTP records into exactly 3 fixed berth slots (`{ berco, atracado, proximo }`), reusing the existing `getDisplayBerco` / `getPortalStatusLabel` / `parsePortalDateTime` helpers already in that file. `src/pages/AtracacaoSaida.tsx` then renders two fixed 3-column grids off that single array instead of its current dynamic ship-list grid.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, Vite + Express dev server (`tsx server.ts`), no test framework in this repo (verification is `tsc --noEmit` + manual browser checks, per project convention).

## Global Constraints

- The terminal has exactly 3 berths, always shown in this order: `BTP 1`, `BTP 2`, `BTP 3`.
- No changes to scraping (`src/services/btpScheduleService.ts`) or to any Portal BTP field names.
- No changes to `src/pages/ProgramacaoBtp.tsx` or the Dashboard page — this plan touches only `src/services/btpPortalData.ts` and `src/pages/AtracacaoSaida.tsx`.
- A ship counts as "next" for a berth only if its status (via `getPortalStatusLabel`) is `'Previsto'` or `'Na Barra'` **and** it has a non-empty, parseable `etb`. No fallback to `eta` when `etb` is missing (explicit product decision — see spec's "Decisoes e trade-offs").
- This repo has no automated test runner (`package.json` has no jest/vitest/etc. — only `"lint": "tsc --noEmit"`). Do not add one as part of this work; it's out of scope. Verification steps below use `npm run lint` for type-checking and temporary ad-hoc `tsx` scripts / manual browser checks in place of unit tests.

---

## Task 1: `getBerthSlots()` helper in `btpPortalData.ts`

**Files:**
- Modify: `src/services/btpPortalData.ts` (add after the `getStatusRank` function, i.e. after line 277, before `toOperationalShipSnapshot`)
- Verify: temporary `verify-berth-slots.ts` at repo root (written, run, then deleted — not committed)

**Interfaces:**
- Produces: `export const BTP_BERTHS: readonly ['BTP 1', 'BTP 2', 'BTP 3']`, `export interface BerthSlot { berco: string; atracado: BtpScheduleRecord | null; proximo: BtpScheduleRecord | null }`, `export function getBerthSlots(records: BtpScheduleRecord[]): BerthSlot[]`. Task 2 and Task 3 both consume `getBerthSlots` and the `BerthSlot` type.

- [ ] **Step 1: Add the `BTP_BERTHS` constant, `BerthSlot` interface, and `getBerthSlots()` function**

Open `src/services/btpPortalData.ts` and insert this block immediately after the closing brace of `getStatusRank` (currently ends at line 277), before `export function toOperationalShipSnapshot`:

```ts
export const BTP_BERTHS = ['BTP 1', 'BTP 2', 'BTP 3'] as const;

export interface BerthSlot {
  berco: string;
  atracado: BtpScheduleRecord | null;
  proximo: BtpScheduleRecord | null;
}

export function getBerthSlots(records: BtpScheduleRecord[]): BerthSlot[] {
  return BTP_BERTHS.map((berco) => {
    const forThisBerth = records.filter((record) => getDisplayBerco(record) === berco);

    const atracado = forThisBerth.find((record) => getPortalStatusLabel(record) === 'Atracado') || null;

    const proximo =
      forThisBerth
        .filter((record) => {
          const status = getPortalStatusLabel(record);
          return (status === 'Previsto' || status === 'Na Barra') && Boolean(parsePortalDateTime(record.etb));
        })
        .sort((a, b) => parsePortalDateTime(a.etb)!.getTime() - parsePortalDateTime(b.etb)!.getTime())[0] || null;

    return { berco, atracado, proximo };
  });
}
```

- [ ] **Step 2: Write a temporary verification script**

Create `verify-berth-slots.ts` at the repo root (same level as `server.ts`):

```ts
import assert from 'node:assert/strict';
import { getBerthSlots } from './src/services/btpPortalData';
import type { BtpScheduleRecord } from './src/services/btpScheduleService';

function makeRecord(overrides: Partial<BtpScheduleRecord> & { pontoAtracacao: string }): BtpScheduleRecord {
  return {
    navio: '',
    viagem: '',
    armador: '',
    berco: '',
    status: '',
    eta: '',
    etb: '',
    etd: '',
    datachegada: '',
    horachegada: '',
    dataatracacao: '',
    horaatracacao: '',
    datasaida: '',
    horasaida: '',
    operacao: '',
    terminal: '',
    ...overrides,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatBr(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatBrDateOnly(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function addDays(base: Date, days: number, hours = 8, minutes = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const now = new Date();

const records: BtpScheduleRecord[] = [
  makeRecord({
    navio: 'Navio A',
    armador: 'Armador A',
    viagem: '001',
    pontoAtracacao: 'BTP-1',
    status: 'Atracado',
    dataatracacao: formatBrDateOnly(now),
    horaatracacao: '08:00',
    etd: formatBr(addDays(now, 3)),
  }),
  makeRecord({
    navio: 'Navio B2',
    armador: 'Armador B2',
    viagem: '002',
    pontoAtracacao: 'BTP-1',
    status: 'Previsto',
    etb: formatBr(addDays(now, 1)),
  }),
  makeRecord({
    navio: 'Navio B',
    armador: 'Armador B',
    viagem: '003',
    pontoAtracacao: 'BTP-1',
    status: 'Previsto',
    etb: formatBr(addDays(now, 2)),
  }),
  makeRecord({
    navio: 'Navio C',
    armador: 'Armador C',
    viagem: '004',
    pontoAtracacao: 'BTP-2',
    status: 'Previsto',
    eta: formatBr(addDays(now, 1, 12)),
  }),
  makeRecord({
    navio: 'Navio D',
    armador: 'Armador D',
    viagem: '005',
    pontoAtracacao: 'BTP-2',
    status: 'Na Barra',
    etb: formatBr(addDays(now, 2, 9)),
  }),
];

const slots = getBerthSlots(records);

assert.equal(slots.length, 3, 'deve sempre retornar 3 slots');
assert.deepEqual(slots.map((s) => s.berco), ['BTP 1', 'BTP 2', 'BTP 3']);

assert.equal(slots[0].atracado?.navio, 'Navio A', 'BTP 1 deve ter Navio A atracado');
assert.equal(slots[0].proximo?.navio, 'Navio B2', 'BTP 1 proximo deve ser o de ETB mais cedo (Navio B2)');

assert.equal(slots[1].atracado, null, 'BTP 2 nao deve ter navio atracado');
assert.equal(slots[1].proximo?.navio, 'Navio D', 'BTP 2 proximo deve ser Navio D (Navio C nao tem ETB)');

assert.equal(slots[2].atracado, null, 'BTP 3 deve estar livre');
assert.equal(slots[2].proximo, null, 'BTP 3 nao deve ter proximo navio');

console.log('OK: todas as verificacoes de getBerthSlots passaram');
```

- [ ] **Step 3: Run the verification script**

Run: `npx tsx verify-berth-slots.ts`
Expected output: `OK: todas as verificacoes de getBerthSlots passaram` (no `AssertionError` thrown).

If an assertion fails, the error message names which slot/rule broke — fix `getBerthSlots` (not the script) and re-run.

- [ ] **Step 4: Type-check the whole project**

Run: `npm run lint`
Expected: exits with no output/errors (this project's `lint` script is `tsc --noEmit`).

- [ ] **Step 5: Delete the temporary verification script**

Run: `rm verify-berth-slots.ts` (bash) or `Remove-Item verify-berth-slots.ts` (PowerShell)

Confirm with `git status` that `verify-berth-slots.ts` is gone and does not appear as untracked.

- [ ] **Step 6: Commit**

```bash
git add src/services/btpPortalData.ts
git commit -m "feat: add getBerthSlots helper for fixed 3-berth view"
```

---

## Task 2: Restructure "Navios Atracados" into 3 fixed berth slots

**Files:**
- Modify: `src/pages/AtracacaoSaida.tsx`

**Interfaces:**
- Consumes: `getBerthSlots(records: BtpScheduleRecord[]): BerthSlot[]` and `BerthSlot` from `../services/btpPortalData` (Task 1).
- Produces: a `berthSlots: BerthSlot[]` value (always length 3) and an `occupiedBerths: number` value, both used again by Task 3.

- [ ] **Step 1: Update the import from `btpPortalData`**

In `src/pages/AtracacaoSaida.tsx`, replace the current import block:

```ts
import {
  fetchSharedBtpSchedule,
  formatPortalDateTime,
  getDisplayBerco,
  getPortalStatusLabel,
  useSharedBtpSchedule,
} from '../services/btpPortalData';
```

with:

```ts
import {
  fetchSharedBtpSchedule,
  formatPortalDateTime,
  getBerthSlots,
  getPortalStatusLabel,
  useSharedBtpSchedule,
} from '../services/btpPortalData';
```

(`getDisplayBerco` is dropped from this import — it's no longer called directly in this file once Step 2 lands; `getBerthSlots` replaces its use here.)

- [ ] **Step 2: Replace the `atracados`/`occupiedBerths` computation**

Replace:

```ts
  const records = sharedState.records || [];

  const atracados = useMemo(() => {
    return records
      .filter((record) => getPortalStatusLabel(record) === 'Atracado')
      .sort((a, b) => {
        const rankA = Number((getDisplayBerco(a).match(/(\d+)/)?.[1] || '999'));
        const rankB = Number((getDisplayBerco(b).match(/(\d+)/)?.[1] || '999'));

        if (rankA !== rankB) return rankA - rankB;
        return (a.navio || '').localeCompare(b.navio || '');
      });
  }, [records]);

  const occupiedBerths = useMemo(() => {
    return new Set(atracados.map((ship) => getDisplayBerco(ship)).filter(Boolean)).size;
  }, [atracados]);
```

with:

```ts
  const records = sharedState.records || [];

  const berthSlots = useMemo(() => getBerthSlots(records), [records]);

  const occupiedBerths = useMemo(
    () => berthSlots.filter((slot) => slot.atracado !== null).length,
    [berthSlots]
  );
```

- [ ] **Step 3: Point both stat cards at `occupiedBerths`**

Replace:

```tsx
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Navios atracados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{atracados.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Berços ocupados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{occupiedBerths}</p>
        </div>
```

with:

```tsx
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Navios atracados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{occupiedBerths}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Berços ocupados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{occupiedBerths}</p>
        </div>
```

- [ ] **Step 4: Replace the empty-state block + ship grid with the fixed 3-slot grid**

Replace this whole block:

```tsx
      {!loading && !error && atracados.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-[11px]">
          Nenhum navio atracado encontrado no momento.
        </div>
      )}

      {!loading && !error && atracados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {atracados.map((ship, index) => {
            const atracacao = formatPortalDateTime(`${ship.dataatracacao || ''} ${ship.horaatracacao || ''}`.trim());
            const previsaoSaida = formatPortalDateTime(ship.etd || ship.saidaPrevista || '');
            const inicioOperacao = formatPortalDateTime(ship.inicioOperacao || '');

            return (
              <div
                key={`${ship.navio}-${ship.viagem}-${index}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Navio</p>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">{ship.navio || '-'}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                    ATRACADO
                  </span>
                </div>

                <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Armador</span>
                    <span className="font-bold text-slate-900 dark:text-white">{ship.armador || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Berço</span>
                    <span className="font-bold text-slate-900 dark:text-white">{getDisplayBerco(ship)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Viagem</span>
                    <span className="font-bold text-slate-900 dark:text-white">{ship.viagem || '-'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-3 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-semibold">Atracação</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">{atracacao || '-'}</div>

                  <div className="flex items-center gap-2 text-slate-500 mt-2">
                    <Anchor className="w-3.5 h-3.5" />
                    <span className="font-semibold">Início operação</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">{inicioOperacao || '-'}</div>

                  <div className="flex items-center gap-2 text-slate-500 mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold">Saída prevista</span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">{previsaoSaida || '-'}</div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                  <span>Status</span>
                  <span className="font-black text-slate-900 dark:text-white">{getPortalStatusLabel(ship)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
```

with:

```tsx
      {!loading && !error && (
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Navios Atracados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {berthSlots.map((slot) => {
              const ship = slot.atracado;

              if (!ship) {
                return (
                  <div
                    key={slot.berco}
                    className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[220px]"
                  >
                    <Anchor className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                    <p className="text-sm font-black text-slate-400 dark:text-slate-500">Berço livre</p>
                  </div>
                );
              }

              const atracacao = formatPortalDateTime(`${ship.dataatracacao || ''} ${ship.horaatracacao || ''}`.trim());
              const previsaoSaida = formatPortalDateTime(ship.etd || ship.saidaPrevista || '');
              const inicioOperacao = formatPortalDateTime(ship.inicioOperacao || '');

              return (
                <div
                  key={slot.berco}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Navio</p>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{ship.navio || '-'}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                      ATRACADO
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Armador</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.armador || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Berço</span>
                      <span className="font-bold text-slate-900 dark:text-white">{slot.berco}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Viagem</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.viagem || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-3 text-[11px]">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-semibold">Atracação</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{atracacao || '-'}</div>

                    <div className="flex items-center gap-2 text-slate-500 mt-2">
                      <Anchor className="w-3.5 h-3.5" />
                      <span className="font-semibold">Início operação</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{inicioOperacao || '-'}</div>

                    <div className="flex items-center gap-2 text-slate-500 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-semibold">Saída prevista</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{previsaoSaida || '-'}</div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                    <span>Status</span>
                    <span className="font-black text-slate-900 dark:text-white">{getPortalStatusLabel(ship)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: no errors. If TypeScript complains that `getDisplayBerco` is imported but unused, confirm Step 1 removed it from the import list — it's no longer referenced anywhere else in this file (only the old code used it directly).

- [ ] **Step 6: Manual browser check**

Run: `npm run dev`
Open a browser at `http://localhost:3000/atracacao-saida`.

Confirm:
- The "Navios Atracados" section always renders exactly 3 cards, in BTP 1 / BTP 2 / BTP 3 order.
- Any berth with no ship currently atracado shows the dashed "Berço livre" card instead of being skipped.
- Any berth with a ship atracado shows the same card content as before (navio, armador, berço, viagem, atracação, início operação, saída prevista, ATRACADO badge).
- No console errors in the browser dev tools.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AtracacaoSaida.tsx
git commit -m "feat: show fixed 3-berth grid with Livre state on Atracacao/Saida"
```

---

## Task 3: Add the "Próximo Navio" section

**Files:**
- Modify: `src/pages/AtracacaoSaida.tsx`

**Interfaces:**
- Consumes: `berthSlots: BerthSlot[]` from Task 2 (same component, already in scope — no new import needed since `Clock` is already imported).

- [ ] **Step 1: Add the "Próximo Navio" section**

In `src/pages/AtracacaoSaida.tsx`, immediately after the closing `)}` of the "Navios Atracados" block added in Task 2 (and before the final closing `</div>` of the page's root element), add:

```tsx
      {!loading && !error && (
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Próximo Navio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {berthSlots.map((slot) => {
              const ship = slot.proximo;

              if (!ship) {
                return (
                  <div
                    key={`proximo-${slot.berco}`}
                    className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]"
                  >
                    <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                    <p className="text-sm font-black text-slate-400 dark:text-slate-500">Nenhum navio previsto</p>
                  </div>
                );
              }

              const etb = formatPortalDateTime(ship.etb);
              const status = getPortalStatusLabel(ship);

              return (
                <div
                  key={`proximo-${slot.berco}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{ship.navio || '-'}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-black">
                      {status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Armador</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.armador || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Viagem</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.viagem || '-'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold">ETB previsto</span>
                    <span className="ml-auto font-black text-slate-900 dark:text-white">{etb || '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

With `npm run dev` still running (from Task 2), reload `http://localhost:3000/atracacao-saida`.

Confirm:
- A new "Próximo Navio" heading and 3-card row appears below "Navios Atracados".
- Any berth with no upcoming ship (no Previsto/Na Barra record with a parseable ETB) shows the "Nenhum navio previsto" dashed card.
- Any berth with an upcoming ship shows navio, armador, viagem, status badge, and ETB.
- The "Próximo Navio" card for a berth that currently has a ship atracado still shows correctly if a next ship with ETB exists for that same berth (i.e., it doesn't get incorrectly suppressed just because the berth is occupied right now).
- No console errors in the browser dev tools.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AtracacaoSaida.tsx
git commit -m "feat: add Proximo Navio section per berth on Atracacao/Saida"
```
