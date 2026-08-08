import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Bot, Bus, FileText, HardHat, Layers, ClipboardList, Ship, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import {
  formatPortalDateTime,
  getBerthSlots,
  getPortalStatusLabel,
  useSharedBtpSchedule,
} from '../services/btpPortalData';

type ReportSummary = {
  id: string;
  title: string;
  generatedAt: string;
};

type GeneratedScaleSnapshot = {
  dataAtual?: string;
  turno?: string;
  b1?: number | string;
  b2?: number | string;
  b3?: number | string;
};

type SplitSummarySnapshot = {
  updatedAt?: string;
  fileName?: string;
  shipName?: string;
  berth?: string;
  berthLabel?: string;
  totalContainers?: number;
  totalMovements?: number;
  loading?: number;
  discharge?: number;
  reefer?: number;
  dg?: number;
  oog?: number;
  totalBays?: number;
  deck?: number;
  hold?: number;
};

const readGeneratedReports = (): ReportSummary[] => {
  try {
    const raw = localStorage.getItem('btp_generated_reports');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.generatedAt === 'string')
      .slice(0, 5);
  } catch {
    return [];
  }
};

const readLatestScaleSnapshot = (): GeneratedScaleSnapshot | null => {
  try {
    const directRaw = localStorage.getItem('btp_latest_scale_snapshot');
    if (directRaw) {
      const parsed = JSON.parse(directRaw);
      return parsed && typeof parsed === 'object' ? (parsed as GeneratedScaleSnapshot) : null;
    }

    const raw = localStorage.getItem('btp-history');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const today = new Date().toLocaleDateString('pt-BR');
    const todayEntry = parsed.find((item: any) => item?.dataAtual === today);
    return (todayEntry || parsed[0] || null) as GeneratedScaleSnapshot | null;
  } catch {
    return null;
  }
};

const readLastSplitSnapshot = (): SplitSummarySnapshot | null => {
  try {
    const raw = localStorage.getItem('btp_last_split_summary');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as SplitSummarySnapshot : null;
  } catch {
    return null;
  }
};

type BusStop = {
  ponto: string;
  horario: string;
};

const BUS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const normalizeBerthLabel = (value?: string): string => {
  const upper = (value || '').toUpperCase();
  if (upper.includes('PONTO 1') || upper.includes('BTP 1')) return 'BTP 1';
  if (upper.includes('PONTO 2') || upper.includes('BTP 2')) return 'BTP 2';
  if (upper.includes('PONTO 3') || upper.includes('BTP 3')) return 'BTP 3';
  return value || 'Berço';
};

/** Minutes remaining until the next occurrence of a "HH:MM" clock time, wrapping past midnight. */
const minutesUntil = (horario: string, nowMinutes: number): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(horario || '');
  if (!match) return null;
  const target = Number(match[1]) * 60 + Number(match[2]);
  return (target - nowMinutes + 1440) % 1440;
};

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: 'accent' | 'warning';
  onClick?: () => void;
}> = ({ icon, label, value, tone = 'accent', onClick }) => (
  <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm" onClick={onClick}>
    <div className="flex flex-col gap-2.5">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          tone === 'warning'
            ? 'bg-amber-100 text-amber-600 dark:bg-tc-warning-soft dark:text-tc-warning'
            : 'bg-blue-100 text-blue-600 dark:bg-tc-accent-soft dark:text-tc-accent'
        }`}
      >
        {icon}
      </div>
      <div
        className={`font-mono dark:font-mono-tc text-2xl font-black tabular-nums leading-none ${
          tone === 'warning' ? 'text-amber-600 dark:text-tc-warning' : 'text-slate-900 dark:text-tc-ink-1'
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] font-bold text-slate-500 dark:text-tc-ink-2">{label}</div>
    </div>
  </M3Card>
);

const KvRow: React.FC<{ label: string; value: React.ReactNode; pending?: boolean }> = ({ label, value, pending }) => (
  <div className="flex items-center justify-between gap-3 text-xs py-1 border-t border-slate-100 dark:border-tc-border-soft first:border-t-0 first:pt-0">
    <span className="font-semibold text-slate-500 dark:text-tc-ink-3">{label}</span>
    <span
      className={`font-mono dark:font-mono-tc font-bold text-right ${
        pending ? 'text-amber-600 dark:text-tc-warning' : 'text-slate-900 dark:text-tc-ink-1'
      }`}
    >
      {value}
    </span>
  </div>
);

const DetailCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ icon, title, onClick, children }) => (
  <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm h-full" onClick={onClick}>
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-slate-500 dark:text-tc-accent">{icon}</span>
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-tc-ink-1">{title}</h3>
    </div>
    <div className="space-y-1">{children}</div>
  </M3Card>
);

export const PainelOperacional: React.FC = () => {
  const navigate = useNavigate();
  const { ships, shifts, berthTurnUpdates, tools, maintenances, purchases } = useApp();
  const sharedState = useSharedBtpSchedule();

  const today = new Date().toISOString().split('T')[0];
  const generatedReports = readGeneratedReports();
  const [latestScaleSnapshot, setLatestScaleSnapshot] = useState<GeneratedScaleSnapshot | null>(() => readLatestScaleSnapshot());
  const [latestSplitSnapshot, setLatestSplitSnapshot] = useState<SplitSummarySnapshot | null>(() => readLastSplitSnapshot());
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [busError, setBusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBusSchedule = async () => {
      try {
        const response = await fetch('/api/bus-schedule');
        const result = await response.json();
        if (cancelled) return;

        if (result.success && Array.isArray(result.data)) {
          setBusStops(result.data);
          setBusError(result.error || null);
        } else {
          setBusError(result.error || 'Não foi possível carregar os horários de ônibus.');
        }
      } catch {
        if (!cancelled) setBusError('Não foi possível carregar os horários de ônibus.');
      }
    };

    fetchBusSchedule();
    const interval = setInterval(fetchBusSchedule, BUS_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const syncScaleSnapshot = () => setLatestScaleSnapshot(readLatestScaleSnapshot());
    const syncSplitSnapshot = () => setLatestSplitSnapshot(readLastSplitSnapshot());

    syncScaleSnapshot();
    syncSplitSnapshot();
    window.addEventListener('storage', syncScaleSnapshot);
    window.addEventListener('storage', syncSplitSnapshot);
    window.addEventListener('btp-scale-snapshot-updated', syncScaleSnapshot);
    window.addEventListener('btp-split-snapshot-updated', syncSplitSnapshot);

    return () => {
      window.removeEventListener('storage', syncScaleSnapshot);
      window.removeEventListener('storage', syncSplitSnapshot);
      window.removeEventListener('btp-scale-snapshot-updated', syncScaleSnapshot);
      window.removeEventListener('btp-split-snapshot-updated', syncSplitSnapshot);
    };
  }, []);

  const naviosEmOperacao = ships.length;
  const escalasCarregadas = shifts.length;
  const ferramentasCadastradas = tools.length;
  const ferramentasEmManutencao = maintenances.filter(item => item.status !== 'Concluído').length;
  const solicitacoesPendentes = purchases.filter(
    purchase => purchase.status === 'Solicitado' || purchase.status === 'Aprovado' || purchase.status === 'Comprado'
  ).length;

  const berthSlots = useMemo(() => getBerthSlots(sharedState.records || []), [sharedState.records]);
  const berthsOccupied = berthSlots.filter(slot => slot.atracado !== null).length;

  const scaleBars = useMemo(() => {
    if (!latestScaleSnapshot) return [];
    const values = [
      ['BTP 1', Number(latestScaleSnapshot.b1 || 0)],
      ['BTP 2', Number(latestScaleSnapshot.b2 || 0)],
      ['BTP 3', Number(latestScaleSnapshot.b3 || 0)],
    ] as const;
    const max = Math.max(1, ...values.map(([, v]) => v));
    return values.map(([label, value]) => ({ label, value, pct: Math.round((value / max) * 100) }));
  }, [latestScaleSnapshot]);

  const ferramentaSummaryLines = useMemo(() => {
    const recordsForToday = berthTurnUpdates.filter(update => update.date === today);
    if (recordsForToday.length === 0) return [];

    const grouped = new Map<string, { ternos: number; materials: Map<string, number> }>();

    recordsForToday.forEach((update) => {
      const berth = normalizeBerthLabel(update.berth);
      const current = grouped.get(berth) || { ternos: 0, materials: new Map<string, number>() };
      current.ternos += update.numTernos || 0;

      update.gangs.forEach((gang) => {
        gang.materials.forEach((material) => {
          current.materials.set(material.toolName, (current.materials.get(material.toolName) || 0) + material.quantity);
        });
      });

      grouped.set(berth, current);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([berth, summary]) => {
        const materialParts = Array.from(summary.materials.entries())
          .filter(([, qty]) => qty > 0)
          .slice(0, 3)
          .map(([toolName, qty]) => `${qty}x ${toolName}`);

        return `${berth} • ${summary.ternos} terno${summary.ternos > 1 ? 's' : ''}${materialParts.length > 0 ? ` • ${materialParts.join('; ')}` : ''}`;
      });
  }, [berthTurnUpdates, today]);

  const splitBerthLabel = latestSplitSnapshot?.berthLabel || latestSplitSnapshot?.berth || '—';
  const splitBerthPending = !latestSplitSnapshot?.berthLabel && !latestSplitSnapshot?.berth;
  const splitMovements = latestSplitSnapshot?.totalMovements ?? latestSplitSnapshot?.totalContainers ?? 0;

  const busSummaryLines = useMemo(() => {
    if (busStops.length === 0) return [];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let nextIndex = -1;
    let nextDelta = Infinity;
    busStops.forEach((stop, index) => {
      const delta = minutesUntil(stop.horario, nowMinutes);
      if (delta !== null && delta < nextDelta) {
        nextDelta = delta;
        nextIndex = index;
      }
    });
    return busStops.map((stop, index) => ({ ...stop, isNext: index === nextIndex }));
  }, [busStops]);

  const hasAnyOperationalData =
    naviosEmOperacao > 0 ||
    escalasCarregadas > 0 ||
    ferramentasCadastradas > 0 ||
    solicitacoesPendentes > 0 ||
    generatedReports.length > 0 ||
    berthsOccupied > 0 ||
    scaleBars.some(bar => bar.value > 0) ||
    ferramentaSummaryLines.length > 0 ||
    Boolean(latestSplitSnapshot) ||
    busSummaryLines.length > 0;

  const dateChip = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-tc-ink-1">Painel Operacional</h2>
          <p className="text-xs font-medium text-slate-500 dark:text-tc-ink-3">
            Resumo executivo da operação com base exclusiva em dados reais cadastrados.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono dark:font-mono-tc text-xs font-bold text-slate-600 dark:text-tc-ink-2 bg-white dark:bg-tc-surface-1 border border-slate-200 dark:border-tc-border px-3.5 py-2 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-tc-good dark:shadow-[0_0_0_3px_var(--color-tc-good-soft)]" />
          <span className="uppercase">{dateChip}</span>
        </div>
      </div>

      {/* HERO — atracação (fonte de verdade: os 3 berços fixos do terminal) */}
      <M3Card
        className="border border-slate-200 dark:border-tc-border shadow-sm cursor-pointer hover:border-blue-300 dark:hover:border-tc-accent-line transition-colors"
        onClick={() => navigate('/atracacao-saida')}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-tc-ink-1">Programação — Atracação</h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3 mt-0.5">
              {berthsOccupied} de 3 berços ocupados agora
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-tc-ink-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-tc-good" />Atracado
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-tc-ink-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-tc-warning" />Na barra
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-tc-ink-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-tc-accent" />Previsto
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-tc-ink-2">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-tc-ink-3" />Livre
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {berthSlots.map((slot) => {
            if (slot.atracado) {
              const saida = formatPortalDateTime(slot.atracado.etd || slot.atracado.saidaPrevista) || '—';
              return (
                <div
                  key={slot.berco}
                  className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 p-4"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 dark:bg-tc-good" />
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono dark:font-mono-tc font-black text-xs px-2 py-0.5 rounded-md bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border text-slate-700 dark:text-tc-ink-1">
                      {slot.berco}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-tc-good-soft dark:text-tc-good">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />Atracado
                    </span>
                  </div>
                  <p className="font-mono dark:font-mono-tc font-bold text-sm text-slate-900 dark:text-tc-ink-1 mb-2 leading-snug">
                    {slot.atracado.navio || 'Navio não identificado'}
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-400 dark:text-tc-ink-3">Saída prevista</span>
                    <span className="font-mono dark:font-mono-tc font-bold text-slate-700 dark:text-tc-ink-2">{saida}</span>
                  </div>
                </div>
              );
            }

            if (slot.proximo) {
              const status = getPortalStatusLabel(slot.proximo);
              const etb = formatPortalDateTime(slot.proximo.etb) || '—';
              const isNaBarra = status === 'Na Barra';
              return (
                <div
                  key={slot.berco}
                  className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 p-4"
                >
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                      isNaBarra ? 'bg-amber-500 dark:bg-tc-warning' : 'bg-blue-500 dark:bg-tc-accent'
                    }`}
                  />
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono dark:font-mono-tc font-black text-xs px-2 py-0.5 rounded-md bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border text-slate-700 dark:text-tc-ink-1">
                      {slot.berco}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        isNaBarra
                          ? 'bg-amber-100 text-amber-700 dark:bg-tc-warning-soft dark:text-tc-warning'
                          : 'bg-blue-100 text-blue-700 dark:bg-tc-accent-soft dark:text-tc-accent'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{status}
                    </span>
                  </div>
                  <p className="font-mono dark:font-mono-tc font-bold text-sm text-slate-900 dark:text-tc-ink-1 mb-2 leading-snug">
                    {slot.proximo.navio || 'Navio não identificado'}
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-400 dark:text-tc-ink-3">ETB previsto</span>
                    <span className="font-mono dark:font-mono-tc font-bold text-slate-700 dark:text-tc-ink-2">{etb}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={slot.berco}
                className="rounded-xl border border-dashed border-slate-300 dark:border-tc-border p-4 flex flex-col items-center justify-center text-center gap-1.5 min-h-[128px]"
              >
                <Anchor className="w-5 h-5 text-slate-300 dark:text-tc-ink-3" />
                <span className="font-mono dark:font-mono-tc font-black text-xs text-slate-400 dark:text-tc-ink-3">{slot.berco}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-tc-ink-3">Berço livre</span>
              </div>
            );
          })}
        </div>
      </M3Card>

      {/* Contadores simples */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatTile
          icon={<Ship className="w-4.5 h-4.5" />}
          label="Navios operantes"
          value={naviosEmOperacao}
          onClick={() => navigate('/navios')}
        />
        <StatTile
          icon={<ClipboardList className="w-4.5 h-4.5" />}
          label="Solicitações pendentes"
          value={solicitacoesPendentes}
          tone={solicitacoesPendentes > 0 ? 'warning' : 'accent'}
        />
        <StatTile
          icon={<FileText className="w-4.5 h-4.5" />}
          label="Relatórios disponíveis"
          value={generatedReports.length}
          onClick={() => navigate('/relatorios')}
        />
      </div>

      {/* Cartões ricos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard icon={<HardHat className="w-4 h-4" />} title="Escala" onClick={() => navigate('/escala')}>
          {latestScaleSnapshot ? (
            <>
              <KvRow label="Data" value={latestScaleSnapshot.dataAtual || '—'} />
              <KvRow label="Período" value={latestScaleSnapshot.turno || '—'} />
              <div className="pt-2 space-y-1.5">
                {scaleBars.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2.5">
                    <span className="font-mono dark:font-mono-tc text-[10px] font-bold text-slate-500 dark:text-tc-ink-2 w-10 shrink-0">
                      {bar.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-tc-surface-1 border border-slate-200/60 dark:border-tc-border-soft overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 dark:bg-tc-accent"
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                    <span className="font-mono dark:font-mono-tc text-[10px] font-black text-slate-700 dark:text-tc-ink-1 w-4 text-right">
                      {bar.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3">
              {escalasCarregadas > 0 ? `Escalas carregadas: ${escalasCarregadas}` : 'Nenhuma escala gerada ainda.'}
            </p>
          )}
        </DetailCard>

        <DetailCard icon={<Wrench className="w-4 h-4" />} title="Ferramentas" onClick={() => navigate('/ferramentas')}>
          {ferramentaSummaryLines.length > 0 ? (
            <div className="space-y-1.5">
              {ferramentaSummaryLines.map((line, index) => (
                <p key={index} className="text-xs font-semibold text-slate-700 dark:text-tc-ink-2 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          ) : ferramentasCadastradas > 0 ? (
            <>
              <KvRow label="Ferramentas cadastradas" value={ferramentasCadastradas} />
              <KvRow
                label="Em manutenção"
                value={ferramentasEmManutencao}
                pending={ferramentasEmManutencao > 0}
              />
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3">Nenhuma ferramenta cadastrada.</p>
          )}
        </DetailCard>

        <DetailCard icon={<Layers className="w-4 h-4" />} title="Planejamento Split" onClick={() => navigate('/planejamento-split')}>
          {latestSplitSnapshot ? (
            <>
              <KvRow label="Navio" value={latestSplitSnapshot.shipName || 'Navio não identificado'} />
              <KvRow label="Berço" value={splitBerthPending ? 'Não definido' : splitBerthLabel} pending={splitBerthPending} />
              <KvRow label="Movimentos" value={splitMovements} />
              <KvRow label="Containers" value={latestSplitSnapshot.totalContainers || 0} />
              <KvRow label="Carga" value={latestSplitSnapshot.loading || 0} />
              <KvRow label="Descarga" value={latestSplitSnapshot.discharge || 0} />
              {splitBerthPending && (
                <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-tc-warning-soft dark:text-tc-warning">
                  Aguardando confirmação de berço
                </span>
              )}
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3">Nenhum resumo de split disponível.</p>
          )}
        </DetailCard>

        <DetailCard icon={<Bus className="w-4 h-4" />} title="Próxima saída · Ônibus BTP">
          {busSummaryLines.length > 0 ? (
            <div className="space-y-1.5">
              {busSummaryLines.map((stop, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                    stop.isNext
                      ? 'bg-blue-50 dark:bg-tc-accent-soft border border-blue-200 dark:border-tc-accent-line'
                      : 'bg-slate-50 dark:bg-tc-surface-1 border border-slate-200/60 dark:border-tc-border-soft'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700 dark:text-tc-ink-1 flex items-center gap-1.5">
                    {stop.ponto}
                    {stop.isNext && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-600 dark:bg-tc-accent text-white dark:text-tc-bg">
                        Próximo
                      </span>
                    )}
                  </span>
                  <span className="font-mono dark:font-mono-tc font-black text-xs text-slate-900 dark:text-tc-ink-1">
                    {stop.horario || '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3">
              {busError || 'Carregando horários de ônibus...'}
            </p>
          )}
        </DetailCard>
      </div>

      <M3Card className="border border-slate-200 dark:border-tc-border shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-blue-100 dark:bg-tc-accent-soft p-2.5 text-blue-700 dark:text-tc-accent">
            <Bot className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-tc-ink-1">Resumo da IA</h3>
            {!hasAnyOperationalData ? (
              <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-tc-ink-2 whitespace-pre-line">
                Bem-vindo ao BTP SmartTools AI.

                O sistema está pronto para uso.

                À medida que navios, programações, escalas e ferramentas forem cadastrados ou sincronizados, este painel exibirá automaticamente um resumo da operação.
              </p>
            ) : (
              <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-tc-ink-2">
                O resumo automático da operação está ativo e será atualizado conforme entradas reais de navios, escala, programação,
                ferramentas, solicitações e relatórios.
              </p>
            )}
          </div>
        </div>
      </M3Card>
    </div>
  );
};

export const Dashboard = PainelOperacional;
