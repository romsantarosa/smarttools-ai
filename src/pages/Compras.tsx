import React, { useState } from 'react';
import {
  ShoppingCart,
  ShoppingBag,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Edit,
  X,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PurchaseRequest, UrgencyLevel, PurchaseStatus } from '../types';
import { M3Card } from '../components/ui/M3Card';
import { M3Badge } from '../components/ui/M3Badge';

export const Compras: React.FC = () => {
  const { tools, purchases, addPurchase, updatePurchaseStatus } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState(tools[0]?.id || '');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [urgency, setUrgency] = useState<UrgencyLevel>('Média');
  const [reason, setReason] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const tool = tools.find(t => t.id === selectedToolId) || tools[0];
    if (!tool) return;

    const qtyNum = typeof quantity === 'number' ? quantity : 1;

    addPurchase({
      toolId: tool.id,
      toolName: tool.name,
      quantity: qtyNum,
      urgency,
      reason: reason || 'Solicitação registrada para análise operacional.',
      status: 'Solicitado',
      requestedBy: 'Registro Operacional',
      estimatedCost,
    });

    setShowModal(false);
    setReason('');
    setQuantity(1);
  };

  const getUrgencyBadge = (u: UrgencyLevel) => {
    switch (u) {
      case 'Alta':
        return <M3Badge label="Alta Urgência" variant="error" />;
      case 'Média':
        return <M3Badge label="Média Urgência" variant="warning" />;
      case 'Baixa':
        return <M3Badge label="Baixa Urgência" variant="neutral" />;
    }
  };

  const getStatusBadge = (s: PurchaseStatus) => {
    switch (s) {
      case 'Solicitado':
        return <M3Badge label="Solicitado" variant="neutral" icon={<Clock className="w-3 h-3" />} />;
      case 'Aprovado':
        return <M3Badge label="Aprovado" variant="info" icon={<CheckCircle2 className="w-3 h-3" />} />;
      case 'Comprado':
        return <M3Badge label="Em Trânsito" variant="warning" icon={<Truck className="w-3 h-3" />} />;
      case 'Recebido':
        return <M3Badge label="Recebido (Estoque Atualizado)" variant="success" icon={<PackageCheck className="w-3 h-3" />} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-purple-600" />
            Solicitação de Compras de Ferramentas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Aquisição de novas varas e spanners para manter o estoque operacional
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Solicitação de Compra</span>
        </button>
      </div>

      {/* Main Table Card */}
      <M3Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Pedidos de Compra Registrados
          </h3>
          <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
            {purchases.length} pedidos no fluxo
          </span>
        </div>

        {/* Mobile Card List (No Horizontal Scrollbar) */}
        <div className="block md:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {purchases.length === 0 && (
            <div className="p-6 text-center text-xs font-bold text-slate-500 bg-white dark:bg-slate-900">
              Nenhuma solicitação pendente.
            </div>
          )}
          {purchases.map(p => (
            <div key={p.id} className="p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{p.toolName}</span>
                </div>
                {getStatusBadge(p.status)}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-700 dark:text-slate-200">Justificativa:</span> {p.reason}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Qtd: <strong className="text-purple-600 dark:text-purple-400">{p.quantity} unid.</strong></span>
                <div>{getUrgencyBadge(p.urgency)}</div>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-mono text-[11px]">{p.date}</span>
                <div className="flex items-center gap-1.5">
                  {p.status === 'Solicitado' && (
                    <button
                      onClick={() => updatePurchaseStatus(p.id, 'Aprovado')}
                      className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Aprovar
                    </button>
                  )}

                  {p.status === 'Aprovado' && (
                    <button
                      onClick={() => updatePurchaseStatus(p.id, 'Comprado')}
                      className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Marcar Comprado
                    </button>
                  )}

                  {p.status === 'Comprado' && (
                    <button
                      onClick={() => updatePurchaseStatus(p.id, 'Recebido')}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title="Dar entrada automática no estoque disponível"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Recebido</span>
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
                <th className="px-3.5 py-3 w-[22%]">Ferramenta</th>
                <th className="px-3.5 py-3 text-center w-[10%]">Qtd</th>
                <th className="px-3.5 py-3 text-center w-[13%]">Urgência</th>
                <th className="px-3.5 py-3 w-[23%]">Motivo do Pedido</th>
                <th className="px-3.5 py-3 text-center w-[11%]">Data</th>
                <th className="px-3.5 py-3 text-center w-[11%]">Status</th>
                <th className="px-3.5 py-3 text-right w-[10%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3.5 py-6 text-center font-bold text-slate-500">
                    Nenhuma solicitação pendente.
                  </td>
                </tr>
              ) : (
                purchases.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white truncate">
                    {p.toolName}
                  </td>

                  <td className="px-3.5 py-3 text-center font-extrabold text-purple-600 dark:text-purple-400">
                    {p.quantity} un
                  </td>

                  <td className="px-3.5 py-3 text-center">{getUrgencyBadge(p.urgency)}</td>

                  <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 truncate" title={p.reason}>
                    {p.reason}
                  </td>

                  <td className="px-3.5 py-3 text-center text-slate-500 font-mono text-[11px]">{p.date}</td>

                  <td className="px-3.5 py-3 text-center">{getStatusBadge(p.status)}</td>

                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'Solicitado' && (
                        <button
                          onClick={() => updatePurchaseStatus(p.id, 'Aprovado')}
                          className="px-2 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Aprovar
                        </button>
                      )}

                      {p.status === 'Aprovado' && (
                        <button
                          onClick={() => updatePurchaseStatus(p.id, 'Comprado')}
                          className="px-2 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Comprado
                        </button>
                      )}

                      {p.status === 'Comprado' && (
                        <button
                          onClick={() => updatePurchaseStatus(p.id, 'Recebido')}
                          className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                          title="Dar entrada automática no estoque disponível"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Recebido</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </M3Card>

      {/* CREATE PURCHASE REQUEST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nova Solicitação de Compra
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ferramenta Solicitada
                </label>
                <select
                  value={selectedToolId}
                  onChange={e => setSelectedToolId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  {tools.length === 0 ? (
                    <option value="">Nenhuma ferramenta cadastrada</option>
                  ) : (
                    tools.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Atual: {t.available} disp | min: {t.minStock})
                    </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantidade Desejada
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
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-purple-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nível de Urgência
                </label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value as UrgencyLevel)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                >
                  <option value="Baixa">Baixa Urgência</option>
                  <option value="Média">Média Urgência</option>
                  <option value="Alta">Alta Urgência (Crítico)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Justificativa Operacional
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex: Escala de navios Post-Panamax prevista para a próxima semana exige reposição imediata..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
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
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md"
                >
                  Enviar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
