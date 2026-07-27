import React from 'react';
import {
  Wrench,
  CheckCircle2,
  Cog,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
  Bot,
  Activity,
  BarChart2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { StockAlertBanner } from '../components/ui/StockAlertBanner';
import { UltimasAtualizacoes } from '../components/dashboard/UltimasAtualizacoes';
import { ResumoEscalaStandby } from '../components/dashboard/ResumoEscalaStandby';

export const Dashboard: React.FC = () => {
  const { tools, maintenances, purchases, shifts, aiLogs } = useApp();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Metrics Calculations
  const totalToolsCount = tools.reduce((acc, t) => acc + t.total, 0);
  const availableToolsCount = tools.reduce((acc, t) => acc + t.available, 0);
  const inMaintenanceCount = tools.reduce((acc, t) => acc + t.inMaintenance, 0);
  const pendingPurchasesCount = purchases.filter(
    p => p.status === 'Solicitado' || p.status === 'Aprovado'
  ).length;

  // Chart Data Preparation
  const toolBarData = tools.map(t => ({
    name: t.name.replace(' (Mão de Força)', ''),
    Disponível: t.available,
    Manutenção: t.inMaintenance,
    Mínimo: t.minStock,
  }));

  const maintenanceStatusCounts = [
    { name: 'Aguardando', value: maintenances.filter(m => m.status === 'Aguardando').length, color: '#f59e0b' },
    { name: 'Em Manutenção', value: maintenances.filter(m => m.status === 'Em manutenção').length, color: '#3b82f6' },
    { name: 'Concluído', value: maintenances.filter(m => m.status === 'Concluído').length, color: '#10b981' },
  ].filter(item => item.value > 0);

  // Shifts timeline data
  const shiftTimelineData = [
    { turno: '07-13', movimentacoes: 12 },
    { turno: '13-19', movimentacoes: 18 },
    { turno: '19-01', movimentacoes: 9 },
    { turno: '01-07', movimentacoes: 14 },
  ];

  const latestAIOpinion = aiLogs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Dashboard Operacional
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Visão unificada do estoque e movimentações no Terminal BTP
          </p>
        </div>
        <button
          onClick={() => navigate('/supervisor-ia')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer transition-all"
        >
          <Bot className="w-4 h-4 text-amber-300" />
          <span>Consultar Supervisor IA</span>
        </button>
      </div>

      {/* Real-time Alert Banner */}
      <StockAlertBanner />

      {/* Stat Cards Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <M3Card className="relative overflow-hidden group border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total de Ferramentas
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {totalToolsCount}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                {tools.length} tipos cadastrados
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
          </div>
        </M3Card>

        <M3Card className="relative overflow-hidden group border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Disponíveis
              </p>
              <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {availableToolsCount}
              </h3>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-1 inline-block">
                {Math.round((availableToolsCount / (totalToolsCount || 1)) * 100)}% da frota ativa
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </M3Card>

        <M3Card className="relative overflow-hidden group border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Em Manutenção
              </p>
              <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {inMaintenanceCount}
              </h3>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1 inline-block">
                {maintenances.filter(m => m.status !== 'Concluído').length} ordens de serviço
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Cog className="w-6 h-6" />
            </div>
          </div>
        </M3Card>

        <M3Card className="relative overflow-hidden group border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Compras Pendentes
              </p>
              <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {pendingPurchasesCount}
              </h3>
              <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold mt-1 inline-block">
                Aguardando aprovação/entrega
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>
        </M3Card>
      </div>

      {/* Latest AI Operational Insight Widget */}
      {latestAIOpinion && (
        <M3Card className="bg-gradient-to-br from-slate-900 to-blue-950 text-white border-blue-900/50 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                  Parecer do Supervisor IA
                </span>
                <span className="text-xs text-slate-400">
                  {latestAIOpinion.date} às {latestAIOpinion.time}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200 leading-relaxed max-w-3xl">
                "{latestAIOpinion.opinion}"
              </p>
            </div>
            <button
              onClick={() => navigate('/supervisor-ia')}
              className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <span>Ver Detalhes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </M3Card>
      )}

      {/* 1º: Últimas Atualizações Por Turno e Berço (BTP 1, BTP 2, BTP 3) */}
      <UltimasAtualizacoes />

      {/* 2º: Resumo Pessoal da Escala e Standby */}
      <ResumoEscalaStandby />

      {/* 3º: Módulo de Ferramentas e Gráficos */}
      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart: Quantidade Por Ferramenta */}
        <div className="lg:col-span-2 animate-fade-in">
          <M3Card className="h-full space-y-4 border-none shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                  Quantidade Por Ferramenta
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparativo de estoque disponível vs em manutenção vs limite mínimo
                </p>
              </div>
              <button
                onClick={() => navigate('/ferramentas')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Gerenciar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-72 w-full pt-2 min-h-[288px]">
              {isMounted ? (
                <ResponsiveContainer width="99%" height="100%" minWidth={100} minHeight={200} debounce={50}>
                  <BarChart data={toolBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.12} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '16px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                        padding: '10px 14px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar
                      dataKey="Disponível"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      stroke="none"
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                    <Bar
                      dataKey="Manutenção"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                      stroke="none"
                      isAnimationActive={true}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    />
                    <Bar
                      dataKey="Mínimo"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
                      stroke="none"
                      isAnimationActive={true}
                      animationDuration={1600}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
              )}
            </div>
          </M3Card>
        </div>

        {/* Maintenance Breakdown Pie Chart */}
        <div className="animate-fade-in">
          <M3Card className="h-full space-y-4 flex flex-col justify-between border-none shadow-md">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                Status de Manutenção
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proporção das ordens de serviço ativas na oficina
              </p>
            </div>

            <div className="h-56 w-full flex items-center justify-center min-h-[224px]">
              {maintenanceStatusCounts.length > 0 ? (
                isMounted ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={100} minHeight={150} debounce={50}>
                    <PieChart>
                      <Pie
                        data={maintenanceStatusCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={1400}
                        animationEasing="ease-out"
                      >
                        {maintenanceStatusCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '16px',
                          color: '#fff',
                          fontSize: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                          padding: '10px 14px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                )
              ) : (
                <p className="text-xs text-slate-400 italic">Sem registros recentes de manutenção.</p>
              )}
            </div>

            <button
              onClick={() => navigate('/manutencao')}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Acessar Módulo de Manutenção
            </button>
          </M3Card>
        </div>
      </div>

      {/* Second Row: Shift Movement Area/Line Chart */}
      <div className="animate-fade-in">
        <M3Card className="space-y-4 border-none shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Histórico de Movimentações Por Turno
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Volume de checagem de ferramentas nos 4 turnos diários
              </p>
            </div>
            <button
              onClick={() => navigate('/historico')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Ver Histórico Completo
            </button>
          </div>

          <div className="h-64 w-full pt-2 min-h-[256px]">
            {isMounted ? (
              <ResponsiveContainer width="99%" height="100%" minWidth={100} minHeight={180} debounce={50}>
                <AreaChart data={shiftTimelineData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMovimentacoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.12} />
                  <XAxis
                    dataKey="turno"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: 'none',
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                      padding: '10px 14px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="movimentacoes"
                    stroke="#8b5cf6"
                    strokeWidth={3.5}
                    fillOpacity={1}
                    fill="url(#colorMovimentacoes)"
                    dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }}
                    activeDot={{ r: 8, fill: '#a855f7', strokeWidth: 0 }}
                    isAnimationActive={true}
                    animationDuration={1600}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
            )}
          </div>
        </M3Card>
      </div>
    </div>
  );
};
