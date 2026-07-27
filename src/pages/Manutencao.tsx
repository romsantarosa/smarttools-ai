import React, { useState } from 'react';
import {
  Cog,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Edit,
  CheckSquare,
  X,
  Wrench,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MaintenanceItem } from '../types';
import { M3Card } from '../components/ui/M3Card';
import { M3Badge } from '../components/ui/M3Badge';

export const Manutencao: React.FC = () => {
  const { tools, maintenances, addMaintenance, updateMaintenanceStatus, deleteMaintenance, canDeleteRecord } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState(tools[0]?.id || '');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [reason, setReason] = useState('');
  const [responsible, setResponsible] = useState('Oficina Central BTP');
  const [status, setStatus] = useState<MaintenanceItem['status']>('Em manutenção');

  const handleCreateMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const tool = tools.find(t => t.id === selectedToolId) || tools[0];
    if (!tool) return;

    const qtyNum = typeof quantity === 'number' ? quantity : 1;

    addMaintenance({
      toolId: tool.id,
      toolName: tool.name,
      quantity: qtyNum,
      reason: reason || 'Desgaste mecânico natural de operação',
      responsible,
      date: new Date().toISOString().split('T')[0],
      status,
    });

    setShowModal(false);
    setReason('');
    setQuantity(1);
  };

  const getStatusBadge = (s: MaintenanceItem['status']) => {
    switch (s) {
      case 'Aguardando':
        return <M3Badge label="Aguardando" variant="warning" icon={<Clock className="w-3 h-3" />} />;
      case 'Em manutenção':
        return <M3Badge label="Em Manutenção" variant="info" icon={<Cog className="w-3 h-3 animate-spin" />} />;
      case 'Concluído':
        return <M3Badge label="Concluído (Estoque Devolvido)" variant="success" icon={<CheckCircle2 className="w-3 h-3" />} />;
      default:
        return <M3Badge label={s} variant="neutral" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Cog className="w-7 h-7 text-amber-500" />
            Controle de Manutenção de Ferramentas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Gestão de reparos e devolução automática ao estoque operacional
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Enviar Ferramenta para Manutenção</span>
        </button>
      </div>

      {/* Main Table Card */}
      <M3Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Ordens de Manutenção & Reparo
          </h3>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            {maintenances.length} ordens registradas
          </span>
        </div>

        {/* Mobile Card List (No Horizontal Scrollbar) */}
        <div className="block md:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {maintenances.map(m => (
            <div key={m.id} className="p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{m.toolName}</span>
                </div>
                {getStatusBadge(m.status)}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-700 dark:text-slate-200">Motivo:</span> {m.reason}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Qtd: <strong className="text-amber-600 dark:text-amber-400">{m.quantity} unid.</strong></span>
                <span>Resp: {m.responsible}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-mono text-[11px]">{m.date}</span>
                <div className="flex items-center gap-1.5">
                  {m.status !== 'Concluído' && (
                    <button
                      onClick={() => updateMaintenanceStatus(m.id, 'Concluído')}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Concluir e devolver automaticamente ao estoque disponível"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Concluir</span>
                    </button>
                  )}

                  {m.status === 'Aguardando' && (
                    <button
                      onClick={() => updateMaintenanceStatus(m.id, 'Em manutenção')}
                      className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Iniciar
                    </button>
                  )}

                  {canDeleteRecord() && (
                    <button
                      onClick={() => deleteMaintenance(m.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                      title="Excluir Ordem (Apenas Supervisor)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View Table (Fit without horizontal scrollbar) */}
        <div className="hidden md:block w-full">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-3 w-[20%]">Ferramenta</th>
                <th className="px-3.5 py-3 text-center w-[10%]">Qtd</th>
                <th className="px-3.5 py-3 w-[24%]">Motivo / Defeito</th>
                <th className="px-3.5 py-3 w-[16%]">Oficina / Responsável</th>
                <th className="px-3.5 py-3 text-center w-[11%]">Data</th>
                <th className="px-3.5 py-3 text-center w-[11%]">Status</th>
                <th className="px-3.5 py-3 text-right w-[18%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {maintenances.map(m => (
                <tr
                  key={m.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white truncate">
                    <div className="flex items-center gap-2 truncate">
                      <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{m.toolName}</span>
                    </div>
                  </td>

                  <td className="px-3.5 py-3 text-center font-extrabold text-amber-600 dark:text-amber-400">
                    {m.quantity} un
                  </td>

                  <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 truncate" title={m.reason}>
                    {m.reason}
                  </td>

                  <td className="px-3.5 py-3 font-semibold text-slate-700 dark:text-slate-300 truncate" title={m.responsible}>
                    {m.responsible}
                  </td>

                  <td className="px-3.5 py-3 text-center text-slate-500 font-mono text-[11px]">
                    {m.date}
                  </td>

                  <td className="px-3.5 py-3 text-center">{getStatusBadge(m.status)}</td>

                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.status !== 'Concluído' && (
                        <button
                          onClick={() => updateMaintenanceStatus(m.id, 'Concluído')}
                          className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Concluir e devolver ao estoque"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Concluir</span>
                        </button>
                      )}

                      {m.status === 'Aguardando' && (
                        <button
                          onClick={() => updateMaintenanceStatus(m.id, 'Em manutenção')}
                          className="px-2 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Iniciar
                        </button>
                      )}

                      {canDeleteRecord() && (
                        <button
                          onClick={() => deleteMaintenance(m.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Ordem (Apenas Supervisor)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </M3Card>

      {/* CREATE MAINTENANCE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nova Ordem de Manutenção
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaintenance} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ferramenta com Avaria
                </label>
                <select
                  value={selectedToolId}
                  onChange={e => setSelectedToolId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  {tools.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Disponível: {t.available} | Maint: {t.inMaintenance})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade Retirada para Manutenção
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setQuantity('');
                    } else {
                      const p = parseInt(val, 10);
                      if (!isNaN(p)) setQuantity(p);
                    }
                  }}
                  onBlur={() => {
                    if (quantity === '' || (typeof quantity === 'number' && quantity < 1)) setQuantity(1);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-amber-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo / Diagnóstico Preliminar
                </label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex: Fissura na ponteira, trava pneumática travada, haste curvada..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Oficina / Técnico Responsável
                </label>
                <input
                  type="text"
                  required
                  value={responsible}
                  onChange={e => setResponsible(e.target.value)}
                  placeholder="Ex: Oficina Central BTP - Técnico Ricardo"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status Inicial
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as MaintenanceItem['status'])}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value="Aguardando">Aguardando Avaliação</option>
                  <option value="Em manutenção">Em Manutenção Ativa</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 dark:text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md"
                >
                  Registrar Ordem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
