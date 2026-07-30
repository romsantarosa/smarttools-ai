import React from 'react';
import { Bot, CalendarDays, ClipboardList, HardHat, Ship, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';

type ReportSummary = {
  id: string;
  title: string;
  generatedAt: string;
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

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  lines: string[];
  emptyMessage: string;
}> = ({ icon, title, lines, emptyMessage }) => {
  const hasData = lines.length > 0;

  return (
    <M3Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
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
  const { ships, shifts, berthTurnUpdates, tools, maintenances, purchases } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const generatedReports = readGeneratedReports();

  const naviosEmOperacao = ships.length;
  const escalasCarregadas = shifts.length;
  const programacaoTurno = berthTurnUpdates.filter(update => update.date === today).length;
  const ferramentasCadastradas = tools.length;
  const ferramentasEmManutencao = maintenances.filter(item => item.status !== 'Concluído').length;
  const solicitacoesPendentes = purchases.filter(
    purchase => purchase.status === 'Solicitado' || purchase.status === 'Aprovado' || purchase.status === 'Comprado'
  ).length;

  const hasAnyOperationalData =
    naviosEmOperacao > 0 ||
    escalasCarregadas > 0 ||
    programacaoTurno > 0 ||
    ferramentasCadastradas > 0 ||
    solicitacoesPendentes > 0 ||
    generatedReports.length > 0;

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
          lines={naviosEmOperacao > 0 ? [`Navios em operação: ${naviosEmOperacao}`] : []}
          emptyMessage="Nenhum navio em operação."
        />

        <SectionCard
          icon={<HardHat className="w-5 h-5" />}
          title="Escala"
          lines={escalasCarregadas > 0 ? [`Escalas carregadas: ${escalasCarregadas}`] : []}
          emptyMessage="Nenhuma escala disponível."
        />

        <SectionCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Programação"
          lines={programacaoTurno > 0 ? [`Programação do turno: ${programacaoTurno}`] : []}
          emptyMessage="Nenhuma programação disponível."
        />

        <SectionCard
          icon={<Wrench className="w-5 h-5" />}
          title="Ferramentas"
          lines={
            ferramentasCadastradas > 0
              ? [
                  `Quantidade de ferramentas cadastradas: ${ferramentasCadastradas}`,
                  `Ferramentas em manutenção: ${ferramentasEmManutencao}`,
                ]
              : []
          }
          emptyMessage="Nenhuma ferramenta cadastrada."
        />

        <SectionCard
          icon={<ClipboardList className="w-5 h-5" />}
          title="Solicitações"
          lines={solicitacoesPendentes > 0 ? [`Solicitações pendentes: ${solicitacoesPendentes}`] : []}
          emptyMessage="Nenhuma solicitação pendente."
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
