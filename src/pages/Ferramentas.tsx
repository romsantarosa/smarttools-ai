import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Minus,
  QrCode,
  Ship,
  Clock,
  UserCheck,
  Building,
  Save,
  CheckCircle2,
  X,
  PlusCircle,
  TrendingDown,
  Layers,
  LayoutGrid,
  List,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ToolItem, ShiftTurn } from '../types';
import { M3Card } from '../components/ui/M3Card';
import { M3Badge } from '../components/ui/M3Badge';

export const Ferramentas: React.FC = () => {
  const { tools, addTool, updateTool, deleteTool, addShift, config, user } = useApp();

  // Layout View Mode state ('grid' avoids horizontal scroll on all screen sizes)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Shift registration form state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [operator, setOperator] = useState(config.operatorsList[0] || '');
  const [supervisor, setSupervisor] = useState(user?.name || config.supervisorsList[0] || '');
  const [turn, setTurn] = useState<ShiftTurn>('07-13');
  const [shipName, setShipName] = useState('');
  const [voyage, setVoyage] = useState('');
  const [berth, setBerth] = useState(config.activeBerths[0] || '');
  const [observations, setObservations] = useState('');
  const [shiftSuccessMsg, setShiftSuccessMsg] = useState('');

  // Tool Edit / Add Modal State
  const [showToolModal, setShowToolModal] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolItem | null>(null);
  const [toolName, setToolName] = useState('');
  const [toolAvailable, setToolAvailable] = useState<number | ''>('');
  const [toolInMaint, setToolInMaint] = useState<number | ''>(0);
  const [toolMinStock, setToolMinStock] = useState<number | ''>('');
  const [toolCategory, setToolCategory] = useState<ToolItem['category']>('Varas de Destravamento');

  // QR Code Readiness Modal State
  const [qrModalTool, setQrModalTool] = useState<ToolItem | null>(null);

  // Handlers
  const handleOpenNewToolModal = () => {
    setEditingTool(null);
    setToolName('');
    setToolAvailable('');
    setToolInMaint(0);
    setToolMinStock('');
    setToolCategory('Varas de Destravamento');
    setShowToolModal(true);
  };

  const handleOpenEditToolModal = (tool: ToolItem) => {
    setEditingTool(tool);
    setToolName(tool.name);
    setToolAvailable(tool.available);
    setToolInMaint(tool.inMaintenance);
    setToolMinStock(tool.minStock);
    setToolCategory(tool.category);
    setShowToolModal(true);
  };

  const handleSaveTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName.trim()) return;

    const availNum = typeof toolAvailable === 'number' ? toolAvailable : 0;
    const maintNum = typeof toolInMaint === 'number' ? toolInMaint : 0;
    const minStockNum = typeof toolMinStock === 'number' ? toolMinStock : 1;

    if (editingTool) {
      updateTool(editingTool.id, {
        name: toolName,
        available: availNum,
        inMaintenance: maintNum,
        minStock: minStockNum,
        category: toolCategory,
      });
    } else {
      addTool({
        name: toolName,
        available: availNum,
        inMaintenance: maintNum,
        minStock: minStockNum,
        category: toolCategory,
        qrCodePrefix: `BTP-${toolName.substring(0, 3).toUpperCase()}`,
      });
    }
    setShowToolModal(false);
  };

  const handleRegisterShift = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    addShift({
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].substring(0, 5),
      operatorName: operator,
      supervisorName: supervisor,
      turn,
      shipName,
      voyage,
      berth,
      observations: observations || 'Movimentação realizada sem ocorrências.',
      movements: tools.map(t => ({
        toolId: t.id,
        toolName: t.name,
        quantityOut: 0,
        quantityIn: 0,
      })),
      status: 'Finalizado',
    });

    setShiftSuccessMsg('Registro de turno e movimentação salvo com sucesso!');
    setTimeout(() => {
      setShiftSuccessMsg('');
      setShowShiftModal(false);
      setObservations('');
    }, 2000);
  };

  const handleQuickQtyChange = (tool: ToolItem, field: 'available' | 'inMaintenance', delta: number) => {
    const currentVal = tool[field];
    const newVal = Math.max(0, currentVal + delta);
    updateTool(tool.id, { [field]: newVal });
  };

  const getStockStatusBadge = (available: number, minStock: number) => {
    if (available <= Math.ceil(minStock / 2)) {
      return <M3Badge label="Crítico" variant="error" />;
    }
    if (available <= minStock) {
      return <M3Badge label="Atenção" variant="warning" />;
    }
    return <M3Badge label="Normal" variant="success" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-7 h-7 text-blue-600" />
            Ferramentas Operacionais
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Controle automatizado por quantidade de estoque de travas e varas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowShiftModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Movimentação de Turno</span>
          </button>

          <button
            onClick={handleOpenNewToolModal}
            className="px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Nova Ferramenta</span>
          </button>
        </div>
      </div>

      {/* Main Inventory Section - Encaixe perfeito sem scroll lateral */}
      <M3Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>Estoque Operacional Ativo</span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {tools.length} tipos
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Edição direta de quantidades e parâmetros sem necessidade de rolar a tela lateralmente
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards de Edição</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabela Compacta</span>
            </button>
          </div>
        </div>

        {/* MODE 1: GRID CARDS (Default - Fits 100% screen without horizontal scroll) */}
        {viewMode === 'grid' ? (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30 dark:bg-slate-950/20">
            {tools.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhuma ferramenta cadastrada.</p>
              </div>
            ) : (
              tools.map(tool => (
              <div
                key={tool.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-all space-y-4"
              >
                {/* Header info */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                          {tool.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {tool.qrCodePrefix} • {tool.category}
                        </p>
                      </div>
                    </div>
                    {getStockStatusBadge(tool.available, tool.minStock)}
                  </div>
                </div>

                {/* Direct Quantity Adjusters */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  {/* Disponível */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      Disponível
                    </span>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleQuickQtyChange(tool, 'available', -1)}
                        className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-700 dark:text-slate-300 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Diminuir disponível"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 px-1">
                        {tool.available}
                      </span>
                      <button
                        onClick={() => handleQuickQtyChange(tool, 'available', 1)}
                        className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Aumentar disponível"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Em Manutenção */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      Em Manutenção
                    </span>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleQuickQtyChange(tool, 'inMaintenance', -1)}
                        className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-700 dark:text-slate-300 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Diminuir manutenção"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 px-1">
                        {tool.inMaintenance}
                      </span>
                      <button
                        onClick={() => handleQuickQtyChange(tool, 'inMaintenance', 1)}
                        className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-300 hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Aumentar manutenção"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Totals info */}
                <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-400">
                  <span>
                    Estoque Total: <strong className="text-slate-900 dark:text-white">{tool.available + tool.inMaintenance}</strong>
                  </span>
                  <span>
                    Mínimo: <strong className="text-slate-500">{tool.minStock}</strong>
                  </span>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setQrModalTool(tool)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    title="Simulador de QR Code"
                  >
                    <QrCode className="w-4 h-4 text-blue-500" />
                    <span className="hidden sm:inline">QR Code</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditToolModal(tool)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar Ferramenta</span>
                    </button>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          /* MODE 2: COMPACT RESPONSIVE TABLE (No horizontal scroll) */
          <div className="w-full">
            <table className="w-full text-left text-xs table-fixed">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-[35%] sm:w-[30%]">Ferramenta</th>
                  <th className="p-3 text-center w-[22%] sm:w-[20%]">Disponível</th>
                  <th className="p-3 text-center hidden sm:table-cell w-[18%]">Manutenção</th>
                  <th className="p-3 text-center hidden md:table-cell w-[12%]">Total</th>
                  <th className="p-3 text-center hidden lg:table-cell w-[10%]">Status</th>
                  <th className="p-3 text-right w-[43%] sm:w-[32%] md:w-[20%]">Editar / Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                {tools.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center font-bold text-slate-500">
                      Nenhuma ferramenta cadastrada.
                    </td>
                  </tr>
                ) : (
                  tools.map(tool => (
                  <tr
                    key={tool.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3 font-bold text-slate-900 dark:text-white truncate">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 shrink-0 flex items-center justify-center">
                          <Wrench className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="truncate text-xs font-bold">{tool.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{tool.qrCodePrefix}</p>
                        </div>
                      </div>
                    </td>

                    {/* Disponível com ajuste rápido */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 p-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                        <button
                          onClick={() => handleQuickQtyChange(tool, 'available', -1)}
                          className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-xs hover:bg-emerald-200 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-black text-xs text-emerald-700 dark:text-emerald-300 min-w-[1.2rem]">
                          {tool.available}
                        </span>
                        <button
                          onClick={() => handleQuickQtyChange(tool, 'available', 1)}
                          className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-xs hover:bg-emerald-200 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Em manutenção */}
                    <td className="p-3 text-center hidden sm:table-cell">
                      <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-1 rounded-lg border border-amber-200 dark:border-amber-800/60">
                        <button
                          onClick={() => handleQuickQtyChange(tool, 'inMaintenance', -1)}
                          className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs hover:bg-amber-200 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-black text-xs text-amber-700 dark:text-amber-300 min-w-[1.2rem]">
                          {tool.inMaintenance}
                        </span>
                        <button
                          onClick={() => handleQuickQtyChange(tool, 'inMaintenance', 1)}
                          className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs hover:bg-amber-200 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Total */}
                    <td className="p-3 text-center font-black text-xs hidden md:table-cell">
                      {tool.available + tool.inMaintenance}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center hidden lg:table-cell">
                      {getStockStatusBadge(tool.available, tool.minStock)}
                    </td>

                    {/* Ações / Editar diretamente na tela */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setQrModalTool(tool)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg cursor-pointer"
                          title="QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditToolModal(tool)}
                          className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </M3Card>

      {/* SHIFT MOVEMENT REGISTRATION MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-8 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Registrar Movimentação de Turno
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Log de desengate/engate e passagem de bastão operacional
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftSuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 rounded-2xl flex items-center gap-3 font-bold text-sm">
                <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
                <span>{shiftSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleRegisterShift} className="space-y-4">
                {/* Auto Date & Time Banner */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Data Automática: {new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Hora Automática: {new Date().toLocaleTimeString('pt-BR').substring(0, 5)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Operador */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Operador Responsável
                    </label>
                    <select
                      value={operator}
                      onChange={e => setOperator(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                    >
                      {config.operatorsList.length === 0 ? (
                        <option value="">Nenhum operador cadastrado</option>
                      ) : (
                        config.operatorsList.map(op => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Supervisor */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Supervisor de Turno
                    </label>
                    <select
                      value={supervisor}
                      onChange={e => setSupervisor(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                    >
                      {config.supervisorsList.length === 0 ? (
                        <option value="">Nenhum supervisor cadastrado</option>
                      ) : (
                        config.supervisorsList.map(sup => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Turno */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Turno Operacional
                    </label>
                    <select
                      value={turn}
                      onChange={e => setTurn(e.target.value as ShiftTurn)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                    >
                      <option value="07-13">Turno 1 (07:00 - 13:00)</option>
                      <option value="13-19">Turno 2 (13:00 - 19:00)</option>
                      <option value="19-01">Turno 3 (19:00 - 01:00)</option>
                      <option value="01-07">Turno 4 (01:00 - 07:00)</option>
                    </select>
                  </div>

                  {/* Berço */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Berço de Atracação
                    </label>
                    <select
                      value={berth}
                      onChange={e => setBerth(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                    >
                      {config.activeBerths.length === 0 ? (
                        <option value="">Nenhum berço configurado</option>
                      ) : (
                        config.activeBerths.map(b => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Navio */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Navio
                    </label>
                    <input
                      type="text"
                      required
                      value={shipName}
                      onChange={e => setShipName(e.target.value)}
                      placeholder="Ex: Cap San Augustin"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>

                  {/* Viagem */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Viagem (Código BTP)
                    </label>
                    <input
                      type="text"
                      required
                      value={voyage}
                      onChange={e => setVoyage(e.target.value)}
                      placeholder="Ex: COD-OPERACAO"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Observações Operacionais
                  </label>
                  <textarea
                    rows={3}
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Especifique intercorrências, varas trocadas ou avarias observadas nas manobras..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md"
                  >
                    Salvar Registro de Turno
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT / ADD TOOL MODAL */}
      {showToolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingTool ? 'Editar Cadastro de Ferramenta' : 'Nova Ferramenta Operacional'}
              </h3>
              <button
                onClick={() => setShowToolModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTool} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Ferramenta
                </label>
                <input
                  type="text"
                  required
                  value={toolName}
                  onChange={e => setToolName(e.target.value)}
                  placeholder="Ex: Vara 12 metros"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={toolCategory}
                  onChange={e => setToolCategory(e.target.value as ToolItem['category'])}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="Varas de Destravamento">Varas de Destravamento</option>
                  <option value="Mão de Força & Trava">Mão de Força & Trava</option>
                  <option value="Equipamentos Especiais">Equipamentos Especiais</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantidade Disponível
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={toolAvailable}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setToolAvailable('');
                      } else {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) setToolAvailable(Math.max(0, parsed));
                      }
                    }}
                    onBlur={() => {
                      if (toolAvailable === '') setToolAvailable(0);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Em Manutenção
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={toolInMaint}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setToolInMaint('');
                      } else {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) setToolInMaint(Math.max(0, parsed));
                      }
                    }}
                    onBlur={() => {
                      if (toolInMaint === '') setToolInMaint(0);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Estoque Mínimo de Segurança
                </label>
                <input
                  type="number"
                  min="1"
                  value={toolMinStock}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setToolMinStock('');
                    } else {
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed)) setToolMinStock(parsed);
                    }
                  }}
                  onBlur={() => {
                    if (toolMinStock === '' || (typeof toolMinStock === 'number' && toolMinStock < 1)) {
                      setToolMinStock(1);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-red-600"
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                Estoque Total Calculado: <span className="font-extrabold">{(typeof toolAvailable === 'number' ? toolAvailable : 0) + (typeof toolInMaint === 'number' ? toolInMaint : 0)}</span> unidades
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                {editingTool ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir '${editingTool.name}'?`)) {
                        deleteTool(editingTool.id);
                        setShowToolModal(false);
                      }
                    }}
                    className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowToolModal(false)}
                    className="px-4 py-2 font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR CODE / FUTURE ASSET TRACKING READINESS MODAL */}
      {qrModalTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                Controle Individual por Patrimônio (Módulo Futuro)
              </span>
              <button onClick={() => setQrModalTool(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl inline-block border-2 border-dashed border-blue-400">
              <QrCode className="w-28 h-28 text-slate-800 dark:text-white mx-auto" />
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {qrModalTool.name}
              </h4>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Prefixo Patrimonial: <span className="font-bold text-blue-600">{qrModalTool.qrCodePrefix}-001</span> a{' '}
                <span className="font-bold text-blue-600">{qrModalTool.qrCodePrefix}-0{qrModalTool.total}</span>
              </p>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
              Este sistema foi desenhado para escalabilidade imediata. Quando o BTP implementar tags QR Code individuais em cada haste de vara, a leitura efetuará a baixa automatizada sem alterar a arquitetura atual.
            </p>

            <button
              onClick={() => setQrModalTool(null)}
              className="w-full py-2 bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs rounded-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
