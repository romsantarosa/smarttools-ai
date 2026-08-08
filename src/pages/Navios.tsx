import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ShipInfo } from '../types';
import { inferCompanyByShipName } from '../data/shipsCatalog';
import {
  Ship,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Anchor,
  CheckCircle2,
  Edit2,
  Trash2,
  Database,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  X,
  Save,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Navios: React.FC = () => {
  const { ships, addShip, updateShip, deleteShip, saveBerthTurnUpdate, berthTurnUpdates, config, canDeleteRecord } = useApp();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCastanhaFilter, setSelectedCastanhaFilter] = useState('Todos');
  const [selectedMacacoFilter, setSelectedMacacoFilter] = useState('Todos');
  const [onlyPeDeGalinhaFilter, setOnlyPeDeGalinhaFilter] = useState(false);
  const [onlyWarningsFilter, setOnlyWarningsFilter] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShip, setEditingShip] = useState<ShipInfo | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCastanha, setFormCastanha] = useState('');
  const [formMacaco, setFormMacaco] = useState('');
  const [formPeacao, setFormPeacao] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formHasPeDeGalinha, setFormHasPeDeGalinha] = useState(false);
  const [formTwinStatus, setFormTwinStatus] = useState('');
  const [formWarnings, setFormWarnings] = useState('');

  // Quick Berth Dock Modal State
  const [dockingShip, setDockingShip] = useState<ShipInfo | null>(null);
  const [targetBerth, setTargetBerth] = useState<'Ponto 1' | 'Ponto 2' | 'Ponto 3'>('Ponto 1');
  const [dockNotification, setDockNotification] = useState<string | null>(null);

  // Castanha filter options
  const castanhaOptions = ['Todos', 'Automática', 'Pino', 'Pino duplo', 'Pino misto', 'Inteligente'];

  // Macaco filter options
  const macacoOptions = ['Todos', 'Normal', 'Trava móvel', 'Trava fixa', 'Sem trava', 'Gancho duplo'];

  const getShipCompany = (ship: ShipInfo): string => {
    const inferred = inferCompanyByShipName(ship.name);
    if (!ship.company) return inferred;
    if (ship.company === 'OUTROS' && inferred !== 'OUTROS') return inferred;
    return ship.company;
  };

  // Filtered ships
  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      const matchSearch =
        searchTerm === '' ||
        (ship.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ship.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ship.castanha || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ship.macaco || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCastanha =
        selectedCastanhaFilter === 'Todos' ||
        (ship.castanha || '').toLowerCase().includes(selectedCastanhaFilter.toLowerCase());

      const matchMacaco =
        selectedMacacoFilter === 'Todos' ||
        (ship.macaco || '').toLowerCase().includes(selectedMacacoFilter.toLowerCase());

      const matchPeDeGalinha = !onlyPeDeGalinhaFilter || ship.hasPeDeGalinha;

      const matchWarnings = !onlyWarningsFilter || (ship.warnings && ship.warnings.length > 0);

      return matchSearch && matchCastanha && matchMacaco && matchPeDeGalinha && matchWarnings;
    });
  }, [ships, searchTerm, selectedCastanhaFilter, selectedMacacoFilter, onlyPeDeGalinhaFilter, onlyWarningsFilter]);

  // Counts
  const totalShips = ships.length;
  const countPeDeGalinha = ships.filter(s => s.hasPeDeGalinha).length;
  const countAutomatica = ships.filter(s => s.castanha.toLowerCase().includes('automática')).length;
  const countPino = ships.filter(s => s.castanha.toLowerCase().includes('pino')).length;
  const countWithWarnings = ships.filter(s => s.warnings && s.warnings.length > 0).length;

  const handleOpenAddModal = () => {
    setEditingShip(null);
    setFormName('');
    setFormCastanha('Pino');
    setFormMacaco('Trava móvel');
    setFormPeacao('Pé de galinha dobrado');
    setFormDetails('');
    setFormHasPeDeGalinha(true);
    setFormTwinStatus('');
    setFormWarnings('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ship: ShipInfo) => {
    setEditingShip(ship);
    setFormName(ship.name);
    setFormCastanha(ship.castanha);
    setFormMacaco(ship.macaco);
    setFormPeacao(ship.peacao);
    setFormDetails(ship.details);
    setFormHasPeDeGalinha(ship.hasPeDeGalinha);
    setFormTwinStatus(ship.twinStatus || '');
    setFormWarnings(ship.warnings ? ship.warnings.join(', ') : '');
    setIsModalOpen(true);
  };

  const handleSaveShip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const warningsArray = formWarnings
      ? formWarnings
          .split(',')
          .map(w => w.trim())
          .filter(Boolean)
      : undefined;

    const payload = {
      name: formName.trim().toUpperCase(),
      castanha: formCastanha.trim(),
      macaco: formMacaco.trim(),
      peacao: formPeacao.trim(),
      details: formDetails.trim() || `${formCastanha}, ${formMacaco}, ${formPeacao}`,
      hasPeDeGalinha: formHasPeDeGalinha,
      twinStatus: formTwinStatus.trim() || undefined,
      warnings: warningsArray,
    };

    if (editingShip) {
      updateShip(editingShip.id, payload);
    } else {
      addShip(payload);
    }

    setIsModalOpen(false);
  };

  const handleDeleteShip = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o navio ${name}?`)) {
      deleteShip(id);
    }
  };

  const handleDockShip = () => {
    if (!dockingShip) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentTurn = '07-13'; // Default turn or active turn

    // Find existing update or create new
    const existing = berthTurnUpdates.find(
      u => u.date === todayStr && u.turn === currentTurn && u.berth === targetBerth
    );

    if (existing) {
      saveBerthTurnUpdate({
        ...existing,
        shipName: dockingShip.name,
      });
    } else {
      saveBerthTurnUpdate({
        date: todayStr,
        turn: currentTurn,
        berth: targetBerth,
        shipName: dockingShip.name,
        numTernos: 2,
        gangs: [
          { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
          { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
        ],
        totalMaterials: 0,
        observations: `Atracado via Guia de Navios: ${dockingShip.details}`,
        updatedBy: 'Operador BTP',
      });
    }

    setDockNotification(`Navio ${dockingShip.name} atribuído ao ${targetBerth} com sucesso!`);
    setDockingShip(null);
    setTimeout(() => setDockNotification(null), 4000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 dark:from-tc-bg dark:via-tc-surface-1 dark:to-tc-bg rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800 dark:border-tc-border">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-600/10 dark:bg-tc-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 dark:bg-tc-accent-soft text-blue-300 dark:text-tc-accent border border-blue-400/30 dark:border-tc-border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Base de Dados Operacional BTP
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 dark:bg-tc-good-soft text-emerald-300 dark:text-tc-good border border-emerald-500/30 dark:border-tc-good-line text-[11px] font-bold font-mono dark:font-mono-tc">
                {totalShips > 0 ? `${totalShips} navios cadastrados` : 'Nenhum navio cadastrado'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Ship className="w-8 h-8 text-blue-400 dark:text-tc-accent" />
              <span>Guia & Ficha Técnica de Navios</span>
            </h1>

            <p className="text-[11px] sm:text-xs text-slate-300 dark:text-tc-ink-2 max-w-2xl font-medium leading-relaxed">
              Consulte especificações de peação, tipo de castanha, modelo de macaco e alertas de segurança para o trancamento e destrancamento seguro a bordo dos navios atracados no Terminal BTP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-tc-accent dark:hover:opacity-90 dark:text-tc-bg text-white font-black text-[11px] rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-102 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Navio</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-tc-surface-2 dark:hover:bg-tc-surface-3 text-slate-200 dark:text-tc-ink-2 font-bold text-[11px] rounded-xl border border-slate-700 dark:border-tc-border transition-all flex items-center gap-2"
            >
              <span>Ir para Painel Operacional</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dock Notification Banner */}
        {dockNotification && (
          <div className="mt-4 p-3 bg-emerald-500/20 dark:bg-tc-good-soft border border-emerald-500/40 dark:border-tc-good-line rounded-xl text-emerald-200 dark:text-tc-good text-[11px] font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-tc-good shrink-0" />
            <span>{dockNotification}</span>
          </div>
        )}
      </div>

      {/* Stats Summary Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-tc-accent-soft text-blue-600 dark:text-tc-accent rounded-xl">
            <Ship className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-tc-ink-3 uppercase tracking-wider block">Total Navios</span>
            <span className="text-lg font-black text-slate-900 dark:text-tc-ink-1 font-mono dark:font-mono-tc">{totalShips}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-tc-warning-soft text-amber-600 dark:text-tc-warning rounded-xl">
            <Anchor className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-tc-ink-3 uppercase tracking-wider block">Pé de Galinha</span>
            <span className="text-lg font-black text-slate-900 dark:text-tc-ink-1 font-mono dark:font-mono-tc">{countPeDeGalinha}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-tc-accent-soft text-indigo-600 dark:text-tc-accent rounded-xl">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-tc-ink-3 uppercase tracking-wider block">Automática</span>
            <span className="text-lg font-black text-slate-900 dark:text-tc-ink-1 font-mono dark:font-mono-tc">{countAutomatica}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-100 dark:bg-tc-critical-soft text-rose-600 dark:text-tc-critical rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-tc-ink-3 uppercase tracking-wider block">Com Alertas</span>
            <span className="text-lg font-black text-slate-900 dark:text-tc-ink-1 font-mono dark:font-mono-tc">{countWithWarnings}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-tc-surface-2 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-tc-border shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-tc-ink-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar navio por nome, tipo de castanha, macaco ou detalhes (ex: AMERICO, MAERSK, MSC, SAN, ZIM)..."
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 text-slate-900 dark:text-tc-ink-1 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-tc-accent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-tc-ink-3 hover:text-slate-600 dark:hover:text-tc-ink-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {/* Filter by Castanha */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-tc-surface-1 p-1.5 rounded-xl border border-slate-200 dark:border-tc-border">
              <span className="text-[11px] font-bold text-slate-500 dark:text-tc-ink-3 pl-2">Castanha:</span>
              <select
                value={selectedCastanhaFilter}
                onChange={e => setSelectedCastanhaFilter(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-tc-ink-1 font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {castanhaOptions.map(opt => (
                  <option key={opt} value={opt} className="bg-white dark:bg-tc-surface-1">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Macaco */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-tc-surface-1 p-1.5 rounded-xl border border-slate-200 dark:border-tc-border">
              <span className="text-[11px] font-bold text-slate-500 dark:text-tc-ink-3 pl-2">Macaco:</span>
              <select
                value={selectedMacacoFilter}
                onChange={e => setSelectedMacacoFilter(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-tc-ink-1 font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {macacoOptions.map(opt => (
                  <option key={opt} value={opt} className="bg-white dark:bg-tc-surface-1">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Toggle Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-tc-border-soft">
          <button
            onClick={() => setOnlyPeDeGalinhaFilter(!onlyPeDeGalinhaFilter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              onlyPeDeGalinhaFilter
                ? 'bg-amber-600 dark:bg-tc-warning dark:text-tc-bg text-white shadow-xs'
                : 'bg-slate-100 dark:bg-tc-surface-1 text-slate-600 dark:text-tc-ink-2 hover:bg-slate-200 dark:hover:bg-tc-surface-3'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span>Apenas com Pé de Galinha</span>
          </button>

          <button
            onClick={() => setOnlyWarningsFilter(!onlyWarningsFilter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              onlyWarningsFilter
                ? 'bg-rose-600 dark:bg-tc-critical dark:text-white text-white shadow-xs'
                : 'bg-slate-100 dark:bg-tc-surface-1 text-slate-600 dark:text-tc-ink-2 hover:bg-slate-200 dark:hover:bg-tc-surface-3'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Apenas com Alertas de Segurança</span>
          </button>

          {(searchTerm || selectedCastanhaFilter !== 'Todos' || selectedMacacoFilter !== 'Todos' || onlyPeDeGalinhaFilter || onlyWarningsFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCastanhaFilter('Todos');
                setSelectedMacacoFilter('Todos');
                setOnlyPeDeGalinhaFilter(false);
                setOnlyWarningsFilter(false);
              }}
              className="text-xs text-blue-600 dark:text-tc-accent font-bold hover:underline ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Results Count Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-tc-ink-3 font-bold px-1">
        <span>Exibindo {filteredShips.length} de {totalShips} navios cadastrados</span>
        <span className="font-mono dark:font-mono-tc text-[11px] text-slate-400 dark:text-tc-ink-3">Firebase Collection: ships_btp</span>
      </div>

      {/* Ships Grid */}
      {filteredShips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShips.map(ship => (
            <div
              key={ship.id}
              className="bg-white dark:bg-tc-surface-2 rounded-2xl border border-slate-200 dark:border-tc-border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              {/* Ship Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-tc-accent-soft text-blue-600 dark:text-tc-accent flex items-center justify-center shrink-0">
                      <Ship className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-tc-ink-1 tracking-tight group-hover:text-blue-600 dark:group-hover:text-tc-accent transition-colors">
                        {getShipCompany(ship)} • {ship.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 dark:text-tc-ink-3 font-mono dark:font-mono-tc block">
                        ID: {ship.id}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(ship)}
                      className="p-1.5 text-slate-400 dark:text-tc-ink-3 hover:text-blue-600 dark:hover:text-tc-accent rounded-lg hover:bg-slate-100 dark:hover:bg-tc-surface-3 transition-colors"
                      title="Editar navio"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {canDeleteRecord() && (
                      <button
                        onClick={() => handleDeleteShip(ship.id, ship.name)}
                        className="p-1.5 text-slate-400 dark:text-tc-ink-3 hover:text-rose-600 dark:hover:text-tc-critical rounded-lg hover:bg-slate-100 dark:hover:bg-tc-surface-3 transition-colors"
                        title="Excluir navio (Apenas Supervisor)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Technical Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {/* Castanha Badge */}
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-tc-accent-soft text-blue-700 dark:text-tc-accent font-extrabold text-[11px] border border-blue-200 dark:border-tc-border">
                    🔩 {ship.castanha}
                  </span>

                  {/* Macaco Badge */}
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-tc-surface-1 text-slate-700 dark:text-tc-ink-2 font-extrabold text-[11px] border border-slate-200 dark:border-tc-border">
                    🔧 {ship.macaco}
                  </span>

                  {/* Pé de Galinha Badge */}
                  {ship.hasPeDeGalinha ? (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-tc-warning-soft text-amber-700 dark:text-tc-warning font-extrabold text-[11px] border border-amber-200 dark:border-tc-warning-line">
                      ⚓ Pé de Galinha
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-tc-good-soft text-emerald-700 dark:text-tc-good font-extrabold text-[11px] border border-emerald-200 dark:border-tc-good-line">
                      ✓ Peação Simples
                    </span>
                  )}

                  {/* Twin Status */}
                  {ship.twinStatus && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-tc-accent-soft text-purple-700 dark:text-tc-accent font-black text-[10px] border border-purple-200 dark:border-tc-border">
                      Twin: {ship.twinStatus}
                    </span>
                  )}
                </div>

                {/* Full Specification Description */}
                <div className="p-3 bg-slate-50 dark:bg-tc-surface-1 rounded-xl border border-slate-200/80 dark:border-tc-border-soft text-xs text-slate-700 dark:text-tc-ink-2 space-y-1">
                  <span className="font-bold text-[10px] uppercase text-slate-400 dark:text-tc-ink-3 block tracking-wider">
                    Ficha Técnica Completa:
                  </span>
                  <p className="font-medium text-xs leading-relaxed">
                    {ship.details}
                  </p>
                </div>

                {/* Warnings Section */}
                {ship.warnings && ship.warnings.length > 0 && (
                  <div className="p-2.5 bg-rose-50 dark:bg-tc-critical-soft border border-rose-200 dark:border-tc-critical-line rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-tc-critical flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Alertas / Atenção Operacional:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ship.warnings.map((warn, wIdx) => (
                        <span
                          key={wIdx}
                          className="px-2 py-0.5 bg-rose-200/80 dark:bg-tc-critical/20 text-rose-800 dark:text-tc-critical rounded-md font-bold text-[10px]"
                        >
                          ⚠️ {warn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Quick Dock Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-tc-border-soft flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-tc-ink-3 font-mono dark:font-mono-tc">
                  Ref: {ship.updatedAt || '-'}
                </span>
                <button
                  onClick={() => setDockingShip(ship)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-tc-good hover:bg-blue-600 dark:hover:opacity-90 text-white dark:text-tc-bg font-bold text-[11px] transition-all flex items-center gap-1.5"
                >
                  <Anchor className="w-3.5 h-3.5" />
                  <span>Atracar no Ponto</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-tc-surface-2 rounded-2xl border border-slate-200 dark:border-tc-border space-y-3">
          <Ship className="w-12 h-12 text-slate-300 dark:text-tc-ink-3 mx-auto" />
          <h4 className="font-bold text-slate-700 dark:text-tc-ink-1 text-base">Nenhum navio cadastrado.</h4>
          <p className="text-xs text-slate-400 dark:text-tc-ink-3 max-w-md mx-auto">
            Cadastre o primeiro navio para iniciar o controle operacional.
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-blue-600 dark:bg-tc-accent dark:text-tc-bg text-white rounded-xl text-xs font-bold"
          >
            Limpar Busca
          </button>
        </div>
      )}

      {/* MODAL: Cadastrar / Editar Navio */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-tc-surface-1 rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-200 dark:border-tc-border shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-tc-border pb-4">
              <h3 className="font-black text-slate-900 dark:text-tc-ink-1 text-base flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600 dark:text-tc-accent" />
                <span>{editingShip ? 'Editar Navio' : 'Cadastrar Novo Navio'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 dark:text-tc-ink-3 hover:text-slate-600 dark:hover:text-tc-ink-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShip} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                  Nome do Navio:
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="EX: MAERSK LETICIA, MSC ADONIS..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1 uppercase font-extrabold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                    Tipo de Castanha:
                  </label>
                  <input
                    type="text"
                    required
                    value={formCastanha}
                    onChange={e => setFormCastanha(e.target.value)}
                    placeholder="Ex: Automática, Pino, Pino duplo..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                    Tipo de Macaco:
                  </label>
                  <input
                    type="text"
                    required
                    value={formMacaco}
                    onChange={e => setFormMacaco(e.target.value)}
                    placeholder="Ex: Normal, Trava móvel, Sem trava..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                  Descrição da Peação / Varão:
                </label>
                <input
                  type="text"
                  required
                  value={formPeacao}
                  onChange={e => setFormPeacao(e.target.value)}
                  placeholder="Ex: Pé de galinha dobrado, Simples 2 andares, Varão pesado..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formHasPeDeGalinha}
                    onChange={e => setFormHasPeDeGalinha(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 dark:text-tc-accent focus:ring-blue-500 dark:focus:ring-tc-accent"
                  />
                  <span className="text-slate-700 dark:text-tc-ink-2 font-bold">Possui Pé de Galinha?</span>
                </label>

                <div>
                  <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                    Status do Twin (Opcional):
                  </label>
                  <input
                    type="text"
                    value={formTwinStatus}
                    onChange={e => setFormTwinStatus(e.target.value)}
                    placeholder="Ex: Aberto, Fechado..."
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                  Alertas / Avisos de Segurança (Separar por vírgula):
                </label>
                <input
                  type="text"
                  value={formWarnings}
                  onChange={e => setFormWarnings(e.target.value)}
                  placeholder="Ex: Graxa até altas horas, Navio perigoso, Falta material..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-tc-ink-2 mb-1">
                  Resumo / Ficha Técnica Completa:
                </label>
                <textarea
                  rows={2}
                  value={formDetails}
                  onChange={e => setFormDetails(e.target.value)}
                  placeholder="Texto livre de especificações técnicas..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-tc-border text-slate-600 dark:text-tc-ink-2 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-tc-accent dark:hover:opacity-90 dark:text-tc-bg text-white font-black flex items-center gap-2 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Navio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Dock to Berth */}
      {dockingShip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-tc-surface-1 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-tc-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-tc-border pb-3">
              <h3 className="font-black text-slate-900 dark:text-tc-ink-1 text-base flex items-center gap-2">
                <Anchor className="w-5 h-5 text-blue-600 dark:text-tc-accent" />
                <span>Atracar Navio em Ponto Operacional</span>
              </h3>
              <button
                onClick={() => setDockingShip(null)}
                className="text-slate-400 dark:text-tc-ink-3 hover:text-slate-600 dark:hover:text-tc-ink-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-tc-accent-soft rounded-xl border border-blue-200 dark:border-tc-border space-y-1">
              <span className="text-[10px] text-blue-500 dark:text-tc-accent uppercase font-black">Navio Selecionado:</span>
              <p className="font-black text-sm text-blue-900 dark:text-tc-ink-1">{getShipCompany(dockingShip)} • {dockingShip.name}</p>
              <p className="text-xs text-blue-700 dark:text-tc-ink-2">{dockingShip.details}</p>
            </div>

            <div className="space-y-2 text-xs font-bold">
              <label className="block text-slate-700 dark:text-tc-ink-2">
                Selecione o Ponto Operacional no Terminal:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Ponto 1', 'Ponto 2', 'Ponto 3'] as const).map(ponto => (
                  <button
                    key={ponto}
                    type="button"
                    onClick={() => setTargetBerth(ponto)}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all border ${
                      targetBerth === ponto
                        ? 'bg-blue-600 dark:bg-tc-accent text-white dark:text-tc-bg border-blue-600 dark:border-tc-accent shadow-md'
                        : 'bg-slate-100 dark:bg-tc-surface-2 text-slate-700 dark:text-tc-ink-2 border-slate-200 dark:border-tc-border'
                    }`}
                  >
                    {ponto}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                onClick={() => setDockingShip(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-tc-border text-slate-600 dark:text-tc-ink-2 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleDockShip}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-tc-accent dark:hover:opacity-90 dark:text-tc-bg text-white font-black text-xs flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Atracação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
