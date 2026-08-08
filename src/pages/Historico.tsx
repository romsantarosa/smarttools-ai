import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  User,
  Ship,
  Clock,
  Wrench,
  Cog,
  ShoppingCart,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { M3Badge } from '../components/ui/M3Badge';

export const Historico: React.FC = () => {
  const { shifts, maintenances, purchases, tools } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTurn, setFilterTurn] = useState<string>('todos');
  const [filterType, setFilterType] = useState<string>('todos');

  // Combined Timeline Events
  const shiftEvents = shifts.map(s => ({
    id: s.id,
    type: 'Shift',
    title: `Registro de Turno: ${s.shipName} (${s.berth})`,
    subtitle: `Operador: ${s.operatorName} | Sup: ${s.supervisorName}`,
    date: s.date,
    time: s.time,
    turn: s.turn,
    badgeLabel: 'Turno Registrado',
    badgeVariant: 'info' as const,
    details: s.observations,
  }));

  const maintEvents = maintenances.map(m => ({
    id: m.id,
    type: 'Maintenance',
    title: `Manutenção: ${m.toolName} (${m.quantity} unid)`,
    subtitle: `Responsável: ${m.responsible}`,
    date: m.date,
    time: m.time || '10:00',
    turn: '13-19',
    badgeLabel: `Manutenção: ${m.status}`,
    badgeVariant: m.status === 'Concluído' ? ('success' as const) : ('warning' as const),
    details: m.reason,
  }));

  const purchaseEvents = purchases.map(p => ({
    id: p.id,
    type: 'Purchase',
    title: `Solicitação de Compra: ${p.toolName} (${p.quantity} unid)`,
    subtitle: `Solicitante: ${p.requestedBy} | Urgência: ${p.urgency}`,
    date: p.date,
    time: '14:00',
    turn: '13-19',
    badgeLabel: `Compra: ${p.status}`,
    badgeVariant: p.status === 'Recebido' ? ('success' as const) : ('neutral' as const),
    details: p.reason,
  }));

  const allEvents = [...shiftEvents, ...maintEvents, ...purchaseEvents].sort(
    (a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()
  );

  const filteredEvents = allEvents.filter(ev => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTurn = filterTurn === 'todos' || ev.turn === filterTurn;
    const matchesType = filterType === 'todos' || ev.type === filterType;

    return matchesSearch && matchesTurn && matchesType;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <History className="w-7 h-7 text-blue-600" />
            Histórico Operacional de Movimentações
          </h2>
          <p className="text-xs text-slate-500 dark:text-tc-ink-3 mt-1 font-medium">
            Rastreabilidade completa de todas as passagens de turno, reparos e compras
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <M3Card className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Bar */}
          <div className="relative col-span-1 sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por Navio, Operador, Ferramenta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-1 text-xs font-medium"
            />
          </div>

          {/* Filter Type */}
          <div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-1 text-xs font-bold"
            >
              <option value="todos">Todos os Eventos</option>
              <option value="Shift">Apenas Turnos / Navios</option>
              <option value="Maintenance">Apenas Manutenção</option>
              <option value="Purchase">Apenas Compras</option>
            </select>
          </div>

          {/* Filter Turn */}
          <div>
            <select
              value={filterTurn}
              onChange={e => setFilterTurn(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-1 text-xs font-bold"
            >
              <option value="todos">Todos os Turnos</option>
              <option value="07-13">Turno 07:00 - 13:00</option>
              <option value="13-19">Turno 13:00 - 19:00</option>
              <option value="19-01">Turno 19:00 - 01:00</option>
              <option value="01-07">Turno 01:00 - 07:00</option>
            </select>
          </div>
        </div>
      </M3Card>

      {/* Timeline List */}
      <div className="space-y-3">
        {filteredEvents.length > 0 ? (
          filteredEvents.map(ev => (
            <M3Card
              key={`${ev.type}-${ev.id}`}
              className="hover:shadow-md transition-all border-l-4 border-l-blue-600"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {ev.title}
                    </span>
                    <M3Badge label={ev.badgeLabel} variant={ev.badgeVariant} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{ev.subtitle}</p>
                  <p className="text-xs text-slate-700 dark:text-tc-ink-2 italic pt-1">
                    "{ev.details}"
                  </p>
                </div>

                <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                  <p>{ev.date}</p>
                  <p>{ev.time}</p>
                </div>
              </div>
            </M3Card>
          ))
        ) : (
          <M3Card className="text-center py-10 text-slate-400 text-xs">
            Nenhum evento encontrado para os filtros selecionados.
          </M3Card>
        )}
      </div>
    </div>
  );
};
