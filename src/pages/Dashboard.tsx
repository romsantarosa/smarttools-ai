import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, CalendarDays, ClipboardList, HardHat, Ship, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { getPortalStatusLabel, useSharedBtpSchedule } from '../services/btpPortalData';

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

const normalizeBerthLabel = (value?: string): string => {
  const upper = (value || '').toUpperCase();
  if (upper.includes('PONTO 1') || upper.includes('BTP 1')) return 'BTP 1';
  if (upper.includes('PONTO 2') || upper.includes('BTP 2')) return 'BTP 2';
  if (upper.includes('PONTO 3') || upper.includes('BTP 3')) return 'BTP 3';
  return value || 'Berço';
};

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  lines: string[];
  emptyMessage: string;
  onClick?: () => void;
}> = ({ icon, title, lines, emptyMessage, onClick }) => {
  const hasData = lines.length > 0;

  return (
    <M3Card className="border border-slate-200 dark:border-slate-800 shadow-sm" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-2.5 text-slate-700 dark:text-slate-200">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
          {hasData ? (
            <div className="space-y-1">
              {lines.map((line, index) => (
                <p key={`${title}-${index}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          )}
        </div>
      </div>
    </M3Card>
  );
};

export const PainelOperacional: React.FC = () => {
  const navigate = useNavigate();
  const { ships, shifts, berthTurnUpdates, tools, maintenances, purchases } = useApp();
  const sharedState = useSharedBtpSchedule();

  const today = new Date().toISOString().split('T')[0];
  const generatedReports = readGeneratedReports();
  const [latestScaleSnapshot, setLatestScaleSnapshot] = useState<GeneratedScaleSnapshot | null>(() => readLatestScaleSnapshot());
  const [latestSplitSnapshot, setLatestSplitSnapshot] = useState<SplitSummarySnapshot | null>(() => readLastSplitSnapshot());

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
  const programacaoTurno = berthTurnUpdates.filter(update => update.date === today).length;
  const ferramentasCadastradas = tools.length;
  const ferramentasEmManutencao = maintenances.filter(item => item.status !== 'Concluído').length;
  const solicitacoesPendentes = purchases.filter(
    purchase => purchase.status === 'Solicitado' || purchase.status === 'Aprovado' || purchase.status === 'Comprado'
  ).length;

  const atracadosNaBtp = useMemo(() => {
    const records = sharedState.records || [];
    return records.filter((record) => getPortalStatusLabel(record) === 'Atracado').length;
  }, [sharedState.records]);

  const escalaSummaryLines = useMemo(() => {
    if (!latestScaleSnapshot) return [];

    const lines = [`Data: ${latestScaleSnapshot.dataAtual || '—'}`, `Período: ${latestScaleSnapshot.turno || '—'}`];
    const berthValues = [
      ['BTP 1', latestScaleSnapshot.b1],
      ['BTP 2', latestScaleSnapshot.b2],
      ['BTP 3', latestScaleSnapshot.b3],
    ] as const;

    berthValues.forEach(([berth, value]) => {
      const count = Number(value || 0);
      if (count > 0) lines.push(`${berth}: ${count} terno${count > 1 ? 's' : ''}`);
    });

    return lines;
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
          .slice(0, 4)
          .map(([toolName, qty]) => `${qty}x ${toolName}`);

        return `${berth} • ${summary.ternos} terno${summary.ternos > 1 ? 's' : ''}${materialParts.length > 0 ? ` • ${materialParts.join('; ')}` : ''}`;
      });
  }, [berthTurnUpdates, today]);

  const splitSummaryLines = useMemo(() => {
    if (!latestSplitSnapshot) return [];

    const movements = latestSplitSnapshot.totalMovements ?? latestSplitSnapshot.totalContainers ?? 0;
    const berthLabel = latestSplitSnapshot.berthLabel || latestSplitSnapshot.berth || '—';

    return [
      `Navio: ${latestSplitSnapshot.shipName || 'Navio não identificado'}`,
      `Berço: ${berthLabel}`,
      `Movimentos: ${movements}`,
      `Containers: ${latestSplitSnapshot.totalContainers || 0}`,
      `Carga: ${latestSplitSnapshot.loading || 0}`,
      `Descarga: ${latestSplitSnapshot.discharge || 0}`,
    ];
  }, [latestSplitSnapshot]);

  const hasAnyOperationalData =
    naviosEmOperacao > 0 ||
    escalasCarregadas > 0 ||
    programacaoTurno > 0 ||
    ferramentasCadastradas > 0 ||
    solicitacoesPendentes > 0 ||
    generatedReports.length > 0 ||
    atracadosNaBtp > 0 ||
    escalaSummaryLines.length > 0 ||
    ferramentaSummaryLines.length > 0 ||
    splitSummaryLines.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Painel Operacional</h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Resumo executivo da operação com base exclusiva em dados reais cadastrados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SectionCard
          icon={<Ship className="w-5 h-5" />}
          title="Operação"
          lines={naviosEmOperacao > 0 ? [`Navios operantes na BTP: ${naviosEmOperacao}`] : []}
          emptyMessage="Nenhum navio em operação."
          onClick={() => navigate('/navios')}
        />

        <SectionCard
          icon={<HardHat className="w-5 h-5" />}
          title="Escala"
          lines={escalaSummaryLines.length > 0 ? escalaSummaryLines : escalasCarregadas > 0 ? [`Escalas carregadas: ${escalasCarregadas}`] : []}
          emptyMessage="Nenhuma escala gerada ainda."
          onClick={() => navigate('/escala')}
        />

        <SectionCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Programação"
          lines={atracadosNaBtp > 0 ? [`Navios atracados na BTP: ${atracadosNaBtp}`] : programacaoTurno > 0 ? [`Programação do turno: ${programacaoTurno}`] : []}
          emptyMessage="Nenhuma programação disponível."
          onClick={() => navigate('/atracacao-saida')}
        />

        <SectionCard
          icon={<Wrench className="w-5 h-5" />}
          title="Ferramentas"
          lines={ferramentaSummaryLines.length > 0 ? ferramentaSummaryLines : ferramentasCadastradas > 0 ? [
            `Ferramentas cadastradas: ${ferramentasCadastradas}`,
            `Ferramentas em manutenção: ${ferramentasEmManutencao}`,
          ] : []}
          emptyMessage="Nenhuma ferramenta cadastrada."
          onClick={() => navigate('/ferramentas')}
        />

        <SectionCard
          icon={<ClipboardList className="w-5 h-5" />}
          title="Solicitações"
          lines={solicitacoesPendentes > 0 ? [`Solicitações pendentes: ${solicitacoesPendentes}`] : []}
          emptyMessage="Nenhuma solicitação pendente."
        />

        <SectionCard
          icon={<ClipboardList className="w-5 h-5" />}
          title="Planejamento Split"
          lines={splitSummaryLines.length > 0 ? splitSummaryLines : []}
          emptyMessage="Nenhum resumo de split disponível."
          onClick={() => navigate('/planejamento-split')}
        />

        <SectionCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Relatórios"
          lines={
            generatedReports.length > 0
              ? generatedReports.map(report => `${report.title} (${report.generatedAt})`)
              : []
          }
          emptyMessage="Nenhum relatório disponível."
          onClick={() => navigate('/relatorios')}
        />
      </div>

      <M3Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-blue-100 dark:bg-blue-950 p-2.5 text-blue-700 dark:text-blue-300">
            <Bot className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Resumo da IA</h3>
            {!hasAnyOperationalData ? (
              <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                Bem-vindo ao BTP SmartTools AI.

                O sistema está pronto para uso.

                À medida que navios, programações, escalas e ferramentas forem cadastrados ou sincronizados, este painel exibirá automaticamente um resumo da operação.
              </p>
            ) : (
              <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
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
