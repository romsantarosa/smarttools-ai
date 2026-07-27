import React, { useState, useMemo } from 'react';
import {
  Clock,
  Anchor,
  Ship,
  Users,
  Wrench,
  Plus,
  Minus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
  Calendar,
  Search,
  Database,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ShiftTurn, BerthTurnUpdate, GangDetail, GangMaterial } from '../../types';
import { M3Card } from '../ui/M3Card';
import { ShipDatabaseInfoCard } from '../ui/ShipDatabaseInfoCard';

export const UltimasAtualizacoes: React.FC = () => {
  const { berthTurnUpdates, saveBerthTurnUpdate, tools, user, ships, canEditRecord, canDeleteRecord } = useApp();

  const [activeTurn, setActiveTurn] = useState<ShiftTurn>('07-13');
  const [activeBerth, setActiveBerth] = useState<'Ponto 1' | 'Ponto 2' | 'Ponto 3'>('Ponto 1');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDayMatrix, setShowDayMatrix] = useState(false);

  const turnsList: { id: ShiftTurn; label: string; timeRange: string }[] = [
    { id: '07-13', label: 'Turno 1', timeRange: '07h - 13h' },
    { id: '13-19', label: 'Turno 2', timeRange: '13h - 19h' },
    { id: '19-01', label: 'Turno 3', timeRange: '19h - 01h' },
    { id: '01-07', label: 'Turno 4', timeRange: '01h - 07h' },
  ];

  const berthsList: ('Ponto 1' | 'Ponto 2' | 'Ponto 3')[] = ['Ponto 1', 'Ponto 2', 'Ponto 3'];

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  // Distinct dates recorded in database with summary info
  const distinctRecordedDates = useMemo(() => {
    const map = new Map<string, { date: string; count: number; ships: Set<string> }>();
    berthTurnUpdates.forEach(u => {
      if (!u.date) return;
      if (!map.has(u.date)) {
        map.set(u.date, { date: u.date, count: 0, ships: new Set() });
      }
      const entry = map.get(u.date)!;
      entry.count += 1;
      if (u.shipName && u.shipName !== 'Sem Navio Atracado') {
        entry.ships.add(u.shipName);
      }
    });

    const arr = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    return arr;
  }, [berthTurnUpdates]);

  // Filtered dates based on search query (e.g. searching "23/07", "2026-07-23", or ship name)
  const filteredRecordedDates = useMemo(() => {
    if (!searchQuery.trim()) return distinctRecordedDates;
    const q = searchQuery.trim().toLowerCase();
    return distinctRecordedDates.filter(d => {
      const dateBR = formatDateBR(d.date);
      const shipsStr = Array.from(d.ships).join(' ').toLowerCase();
      return (
        d.date.includes(q) ||
        dateBR.includes(q) ||
        shipsStr.includes(q)
      );
    });
  }, [distinctRecordedDates, searchQuery]);

  // All records for currently selected date
  const recordsForSelectedDate = useMemo(() => {
    return berthTurnUpdates.filter(u => u.date === selectedDate);
  }, [berthTurnUpdates, selectedDate]);

  // Find current record for selected Date, Turn & Berth
  const currentRecord = berthTurnUpdates.find(
    u => u.turn === activeTurn && u.berth === activeBerth && u.date === selectedDate
  );

  // Form State for editing / creating
  const [shipName, setShipName] = useState(currentRecord?.shipName || '');
  const [numTernos, setNumTernos] = useState<number>(currentRecord?.numTernos ?? 2);
  const [gangs, setGangs] = useState<GangDetail[]>(currentRecord?.gangs || []);
  const [observations, setObservations] = useState(currentRecord?.observations || '');

  // Material adder state per gang: { [gangIndex]: { toolId: string, qty: string } }
  const [gangAdders, setGangAdders] = useState<{ [gangIndex: number]: { toolId: string; qty: string } }>({});

  const getGangAdder = (gIndex: number) => {
    const defaultToolId = tools[0]?.id || '';
    const current = gangAdders[gIndex];
    return {
      toolId: current?.toolId || defaultToolId,
      qty: current?.qty ?? '2',
    };
  };

  const updateGangAdder = (gIndex: number, field: 'toolId' | 'qty', val: string) => {
    setGangAdders(prev => ({
      ...prev,
      [gIndex]: {
        toolId: field === 'toolId' ? val : (prev[gIndex]?.toolId || tools[0]?.id || ''),
        qty: field === 'qty' ? val : (prev[gIndex]?.qty ?? '2'),
      },
    }));
  };

  // When date, turn, or berth changes, sync form state with corresponding record
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const found = berthTurnUpdates.find(
      u => u.turn === activeTurn && u.berth === activeBerth && u.date === newDate
    );

    setIsEditing(false);
    if (found) {
      setShipName(found.shipName);
      setNumTernos(found.numTernos);
      setGangs(found.gangs);
      setObservations(found.observations);
    } else {
      setShipName('');
      setNumTernos(2);
      setGangs([
        { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
        { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
      ]);
      setObservations('');
    }
  };

  const handleTurnChange = (turn: ShiftTurn) => {
    setActiveTurn(turn);
    const found = berthTurnUpdates.find(
      u => u.turn === turn && u.berth === activeBerth && u.date === selectedDate
    );

    setIsEditing(false);
    if (found) {
      setShipName(found.shipName);
      setNumTernos(found.numTernos);
      setGangs(found.gangs);
      setObservations(found.observations);
    } else {
      setShipName('');
      setNumTernos(2);
      setGangs([
        { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
        { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
      ]);
      setObservations('');
    }
  };

  const handleBerthChange = (berth: 'Ponto 1' | 'Ponto 2' | 'Ponto 3') => {
    setActiveBerth(berth);
    const found = berthTurnUpdates.find(
      u => u.turn === activeTurn && u.berth === berth && u.date === selectedDate
    );

    setIsEditing(false);
    if (found) {
      setShipName(found.shipName);
      setNumTernos(found.numTernos);
      setGangs(found.gangs);
      setObservations(found.observations);
    } else {
      setShipName('');
      setNumTernos(2);
      setGangs([
        { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
        { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
      ]);
      setObservations('');
    }
  };

  const startEdit = () => {
    const found = berthTurnUpdates.find(
      u => u.turn === activeTurn && u.berth === activeBerth && u.date === selectedDate
    );
    if (found) {
      setShipName(found.shipName);
      setNumTernos(found.numTernos);
      setGangs(found.gangs.length > 0 ? found.gangs : [
        { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
        { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
      ]);
      setObservations(found.observations);
    } else {
      setShipName('');
      setNumTernos(2);
      setGangs([
        { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
        { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
      ]);
      setObservations('');
    }
    setIsEditing(true);
  };

  // Adjust number of gangs (ternos)
  const handleNumTernosChange = (newCount: number) => {
    const val = Math.max(0, Math.min(6, newCount));
    setNumTernos(val);
    setGangs(prev => {
      const nextGangs: GangDetail[] = [];
      for (let i = 1; i <= val; i++) {
        const existing = prev.find(g => g.gangNumber === i);
        if (existing) {
          nextGangs.push(existing);
        } else {
          nextGangs.push({
            gangNumber: i,
            materials: [],
            totalMaterialsCount: 0,
          });
        }
      }
      return nextGangs;
    });
  };

  // Add material to specific gang
  const handleAddMaterialToGang = (gangIndex: number) => {
    const { toolId, qty } = getGangAdder(gangIndex);
    const qtyNum = Math.max(1, parseInt(qty, 10) || 1);
    const tool = tools.find(t => t.id === toolId) || tools[0];

    if (!tool) return;

    setGangs(prevGangs => {
      const updated = [...prevGangs];
      const gang = { ...updated[gangIndex] };
      const existingMatIndex = gang.materials.findIndex(m => m.toolId === tool.id);

      let newMaterials: GangMaterial[] = [];
      if (existingMatIndex >= 0) {
        newMaterials = [...gang.materials];
        newMaterials[existingMatIndex] = {
          ...newMaterials[existingMatIndex],
          quantity: newMaterials[existingMatIndex].quantity + qtyNum,
        };
      } else {
        newMaterials = [
          ...gang.materials,
          {
            id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            toolId: tool.id,
            toolName: tool.name,
            quantity: qtyNum,
          },
        ];
      }

      const totalMat = newMaterials.reduce((sum, m) => sum + m.quantity, 0);
      updated[gangIndex] = {
        ...gang,
        materials: newMaterials,
        totalMaterialsCount: totalMat,
      };

      return updated;
    });

    // Reset quantity back to default '2'
    updateGangAdder(gangIndex, 'qty', '2');
  };

  // Remove material from gang
  const handleRemoveMaterial = (gangIndex: number, materialId: string) => {
    setGangs(prevGangs => {
      const updated = [...prevGangs];
      const gang = { ...updated[gangIndex] };
      const newMaterials = gang.materials.filter(m => m.id !== materialId);
      const totalMat = newMaterials.reduce((sum, m) => sum + m.quantity, 0);

      updated[gangIndex] = {
        ...gang,
        materials: newMaterials,
        totalMaterialsCount: totalMat,
      };

      return updated;
    });
  };

  // Clear all materials from a specific gang in EDIT mode
  const handleClearGangMaterials = (gangIndex: number) => {
    setGangs(prevGangs => {
      const updated = [...prevGangs];
      if (!updated[gangIndex]) return prevGangs;
      updated[gangIndex] = {
        ...updated[gangIndex],
        materials: [],
        totalMaterialsCount: 0,
      };
      return updated;
    });
  };

  // Clear all materials from a specific gang directly in VIEW mode
  const handleViewModeClearGang = (gangNumber: number) => {
    if (!currentRecord) return;
    const updatedGangs = currentRecord.gangs.map(g => {
      if (g.gangNumber === gangNumber) {
        return { ...g, materials: [], totalMaterialsCount: 0 };
      }
      return g;
    });

    const newTotal = updatedGangs.reduce((sum, g) => sum + g.totalMaterialsCount, 0);

    saveBerthTurnUpdate({
      id: currentRecord.id,
      date: currentRecord.date,
      turn: currentRecord.turn,
      berth: currentRecord.berth,
      shipName: currentRecord.shipName,
      numTernos: currentRecord.numTernos,
      gangs: updatedGangs,
      totalMaterials: newTotal,
      observations: currentRecord.observations,
      updatedBy: user?.name || 'Operador BTP',
    });
  };

  // Update material quantity unit by unit or directly
  const handleUpdateMaterialQuantity = (
    gangIndex: number,
    materialId: string,
    deltaOrValue: number,
    isAbsolute: boolean = false
  ) => {
    setGangs(prevGangs => {
      const updated = [...prevGangs];
      const gang = { ...updated[gangIndex] };
      const matIndex = gang.materials.findIndex(m => m.id === materialId);
      if (matIndex < 0) return prevGangs;

      const newMaterials = [...gang.materials];
      const currentQty = newMaterials[matIndex].quantity;
      const targetQty = isAbsolute ? deltaOrValue : currentQty + deltaOrValue;

      if (!isAbsolute && targetQty <= 0) {
        newMaterials.splice(matIndex, 1);
      } else {
        newMaterials[matIndex] = {
          ...newMaterials[matIndex],
          quantity: Math.max(0, targetQty),
        };
      }

      const totalMat = newMaterials.reduce((sum, m) => sum + m.quantity, 0);
      updated[gangIndex] = {
        ...gang,
        materials: newMaterials,
        totalMaterialsCount: totalMat,
      };

      return updated;
    });
  };

  // Submit Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up materials with 0 quantity before saving
    const cleanedGangs = gangs.map(g => {
      const filteredMaterials = g.materials.filter(m => m.quantity > 0);
      return {
        ...g,
        materials: filteredMaterials,
        totalMaterialsCount: filteredMaterials.reduce((sum, m) => sum + m.quantity, 0),
      };
    });

    const totalBerthMaterials = cleanedGangs.reduce(
      (acc, g) => acc + g.totalMaterialsCount,
      0
    );

    saveBerthTurnUpdate({
      date: selectedDate,
      turn: activeTurn,
      berth: activeBerth,
      shipName: shipName.trim() || 'Sem Navio Atracado',
      numTernos: numTernos,
      gangs: cleanedGangs,
      totalMaterials: totalBerthMaterials,
      observations: observations.trim() || 'Sem observações registradas.',
      updatedBy: user?.name || 'Operador BTP',
    });

    setIsEditing(false);
  };

  return (
    <M3Card className="space-y-5 border-2 border-slate-200 dark:border-slate-800 shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Últimas Atualizações por Turno e Ponto
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Gravado no Banco de Dados (Firestore)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Histórico diário gravado por turno (07-13, 13-19, 19-01, 01-07), navio, ternos e alocação de ferramentas
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowDayMatrix(!showDayMatrix)}
            className={`px-3 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
              showDayMatrix
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showDayMatrix ? 'Ocultar Visão Geral do Dia' : 'Visão Geral do Dia (Matriz 4 Turnos)'}</span>
            {showDayMatrix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!isEditing && (
            canEditRecord(currentRecord?.updatedBy) ? (
              <button
                onClick={startEdit}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Atualizar / Editar Turno</span>
              </button>
            ) : (
              <div
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                title={`Registro criado por ${currentRecord?.updatedBy || 'outro operador'}. Operadores só podem editar seus próprios lançamentos.`}
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Somente Leitura ({currentRecord?.updatedBy || 'Outro operador'})</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Date Search & Selector Section (Busca por Data e Histórico no Banco) */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <label className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5 mb-0.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Data do Serviço Operacional & Busca no Banco</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha ou busque qualquer data registrada no banco de dados para puxar o histórico por turno
            </p>
          </div>

          {/* Quick Date Inputs & Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Search Input for Date / Ship */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar data (ex: 23/07) ou Navio..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-44 sm:w-52"
              />
            </div>

            {/* Date Picker */}
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => handleDateChange(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                selectedDate === todayStr
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(getYesterdayStr())}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                selectedDate === getYesterdayStr()
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              Ontem
            </button>
          </div>
        </div>

        {/* List of Recorded Dates Pills (Datas com Lançamentos no Banco) */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Datas Gravadas no Banco de Dados ({filteredRecordedDates.length}):</span>
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Limpar busca
              </button>
            )}
          </div>

          {filteredRecordedDates.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {filteredRecordedDates.map(item => {
                const isSelected = item.date === selectedDate;
                const dateBR = formatDateBR(item.date);
                return (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => handleDateChange(item.date)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{dateBR}</span>
                    <span
                      className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-black ${
                        isSelected
                          ? 'bg-blue-500 text-white dark:bg-blue-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.count} {item.count === 1 ? 'registro' : 'registros'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-1">
              Nenhuma data gravada encontrada para o filtro "{searchQuery}".
            </p>
          )}
        </div>
      </div>

      {/* Full Day Overview Matrix (Visão Geral de Todos os 4 Turnos para a Data Selecionada) */}
      {showDayMatrix && (
        <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-900 space-y-3">
          <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-800/60 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h4 className="text-xs font-black uppercase text-purple-900 dark:text-purple-200 tracking-wider">
                Visão Geral do Dia: {formatDateBR(selectedDate)} (4 Turnos x 3 Pontos)
              </h4>
            </div>
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
              Clique em qualquer card para selecionar o turno e ponto
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {turnsList.map(t => {
              const turnRecords = recordsForSelectedDate.filter(r => r.turn === t.id);
              const isCurrentTurnSelected = activeTurn === t.id;

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border space-y-2 transition-all ${
                    isCurrentTurnSelected
                      ? 'bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
                      : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                      <Clock className="w-3 h-3 text-purple-600" />
                      {t.label} ({t.timeRange})
                    </span>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded-md">
                      {turnRecords.length}/3 Pontos
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {berthsList.map(b => {
                      const rec = turnRecords.find(r => r.berth === b);
                      const isSelectedCell = activeTurn === t.id && activeBerth === b;

                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setActiveTurn(t.id);
                            setActiveBerth(b);
                            setIsEditing(false);
                          }}
                          className={`w-full p-2 rounded-lg text-left text-xs transition-all border flex items-center justify-between cursor-pointer ${
                            isSelectedCell
                              ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                              : rec
                              ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
                              : 'bg-slate-100/50 dark:bg-slate-800/30 text-slate-400 border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1 font-extrabold">
                              <span>{b}:</span>
                              <span className="truncate">
                                {rec ? rec.shipName : 'Sem Informação'}
                              </span>
                            </div>
                            {rec && (
                              <div className={`text-[10px] font-medium flex items-center gap-2 mt-0.5 ${isSelectedCell ? 'text-blue-100' : 'text-slate-500'}`}>
                                <span>{rec.numTernos} ternos</span>
                                <span>•</span>
                                <span>{rec.totalMaterials} mats</span>
                              </div>
                            )}
                          </div>

                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ml-1 ${
                              rec
                                ? 'bg-emerald-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            title={rec ? 'Lançamento Gravado' : 'Sem Informação Gravada'}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Turn Tabs (Abas por Turno) */}
      <div>
        <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 block">
          2. Selecionar Turno Operacional
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {turnsList.map(t => {
            const isActive = activeTurn === t.id;
            const turnRecordCount = recordsForSelectedDate.filter(r => r.turn === t.id).length;

            return (
              <button
                key={t.id}
                onClick={() => handleTurnChange(t.id)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{t.label}</span>
                  {turnRecordCount > 0 && (
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-300' : 'bg-emerald-500'}`} />
                  )}
                </div>
                <span className={`text-[10px] font-mono ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                  {t.timeRange}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Berth Tabs (Abas por Ponto: Ponto 1, Ponto 2, Ponto 3) */}
      <div>
        <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 block">
          3. Selecionar Ponto Operacional (Ponto 1 | Ponto 2 | Ponto 3)
        </label>
        <div className="flex items-center gap-2">
          {berthsList.map(b => {
            const isActive = activeBerth === b;
            const bRecord = berthTurnUpdates.find(
              u => u.turn === activeTurn && u.berth === b && u.date === selectedDate
            );
            const bShip = bRecord ? bRecord.shipName : 'Aguardando Serviço';

            return (
              <button
                key={b}
                onClick={() => handleBerthChange(b)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Anchor className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400 dark:text-blue-600' : 'text-slate-400'}`} />
                  <span>{b}</span>
                  {bRecord && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </div>
                <span className={`text-[10px] font-bold truncate max-w-[130px] ${isActive ? 'text-blue-300 dark:text-blue-600 font-extrabold' : 'text-slate-400'}`}>
                  {bShip}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Section: View Mode or Edit Form Mode */}
      {!isEditing ? (
        <div className="space-y-4 pt-2">
          {/* Main Info Card for Berth & Vessel */}
          {currentRecord ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
                        Navio em Operação - {activeBerth}
                      </span>
                      <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        Gravado no Banco
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {currentRecord.shipName || 'Sem Navio Atracado'}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Data: {formatDateBR(currentRecord.date || selectedDate)}</span>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>{currentRecord.numTernos ?? 0} Ternos de Trabalho</span>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    <span>{currentRecord.totalMaterials ?? 0} Materiais Totais</span>
                  </span>
                </div>
              </div>

              {/* Technical Ficha Specs from Database */}
              {currentRecord.shipName && currentRecord.shipName !== 'Sem Navio Atracado' && (
                <ShipDatabaseInfoCard shipName={currentRecord.shipName} />
              )}

            {/* Gangs List (Materiais em Cada Terno) */}
            <div className="space-y-2 pt-1">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                <span>Alocação de Ferramentas e Materiais Por Terno:</span>
              </h5>

              {currentRecord?.gangs && currentRecord.gangs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentRecord.gangs.map(g => (
                    <div
                      key={g.gangNumber}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          Terno {g.gangNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                            {g.totalMaterialsCount || g.materials.reduce((sum, m) => sum + m.quantity, 0)} materiais
                          </span>
                          {g.materials.length > 0 && canEditRecord(currentRecord?.updatedBy) && (
                            <button
                              type="button"
                              onClick={() => handleViewModeClearGang(g.gangNumber)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                              title={`Limpar materiais do Terno ${g.gangNumber}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {g.materials.length > 0 ? (
                        <ul className="space-y-1">
                          {g.materials.map(mat => (
                            <li
                              key={mat.id}
                              className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                            >
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                • {mat.toolName}
                              </span>
                              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                                {mat.quantity} un
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Nenhum material alocado para este terno.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  Nenhum terno cadastrado para este ponto no turno atual.
                </p>
              )}
            </div>

            {/* Campo Observação */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
              <span className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Observação do Turno</span>
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                "{currentRecord?.observations || 'Sem observações registradas.'}"
              </p>
            </div>

            {/* Footer Metadata */}
            {currentRecord && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Última atualização: {currentRecord.updatedAt}</span>
                <span>Resp: {currentRecord.updatedBy}</span>
              </div>
            )}
          </div>
          ) : (
            /* Empty State for Date without record */
            <div className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Sem Informação Gravada para {formatDateBR(selectedDate)}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Ainda não existe lançamento para o{' '}
                  <strong className="text-amber-800 dark:text-amber-300 font-extrabold">
                    {turnsList.find(t => t.id === activeTurn)?.label} ({activeTurn})
                  </strong>{' '}
                  no{' '}
                  <strong className="text-amber-800 dark:text-amber-300 font-extrabold">
                    {activeBerth}
                  </strong>{' '}
                  no dia {formatDateBR(selectedDate)}. O serviço ainda vai entrar.
                </p>
              </div>
              <button
                type="button"
                onClick={startEdit}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Lançamento para este Turno</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* EDIT FORM MODE */
        <form onSubmit={handleSave} className="space-y-4 p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-800/80 border-2 border-blue-500/30">
          <div className="flex items-center justify-between border-b border-blue-200 dark:border-slate-700 pb-2">
            <h4 className="text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-blue-600" />
              <span>Editar Registro: {activeBerth} ({activeTurn})</span>
            </h4>
            <span className="text-xs font-bold text-slate-500">Preencha os campos abaixo</span>
          </div>

          {/* Campo: Data do Serviço */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Data do Serviço Operacional</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Campo: Nome do Navio (Puxa do Banco de Dados BTP) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-blue-600" />
                <span>Nome do Navio</span>
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                  {ships.length} Cadastrados no Banco
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShipName(shipName === 'Sem Navio Atracado' ? '' : 'Sem Navio Atracado')}
                className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {shipName === 'Sem Navio Atracado' ? 'Limpar' : '+ Definir "Sem Navio"'}
              </button>
            </div>
            <div className="relative">
              <Ship className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                list="vessels-database-list"
                value={shipName}
                onChange={e => setShipName(e.target.value)}
                placeholder="Digite ou escolha o navio na base de dados (ex: Cap San Augustin, AMERICO VESPUCIO...)"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="vessels-database-list">
                {ships.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} • Castanha: {s.castanha} • {s.hasPeDeGalinha ? 'Com Pé de Galinha' : 'Sem Pé de Galinha'}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Visualização em tempo real das informações puxadas do Banco */}
            {shipName && (
              <div className="mt-2.5">
                <ShipDatabaseInfoCard shipName={shipName} />
              </div>
            )}
          </div>

          {/* Campo: Número de Ternos */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Número de Ternos de Trabalho
            </label>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleNumTernosChange(num)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    numTernos === num
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {num === 0 ? 'Sem Terno' : `${num} ${num === 1 ? 'Terno' : 'Ternos'}`}
                </button>
              ))}
            </div>
          </div>

          {/* Campo: Materiais em cada terno (Adicionar e definir número de materiais) */}
          {numTernos > 0 && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Quantos Materiais em Cada Terno / Adicionar Materiais:
              </label>

              {gangs.map((g, gIndex) => (
                <div
                  key={g.gangNumber}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400">
                      Terno {g.gangNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        Total no Terno: <strong>{g.totalMaterialsCount} materiais</strong>
                      </span>
                      {g.materials.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleClearGangMaterials(gIndex)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer"
                          title={`Limpar todos os materiais do Terno ${g.gangNumber}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List of materials currently in this gang */}
                  {g.materials.length > 0 ? (
                    <div className="space-y-2">
                      {g.materials.map(m => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200/60 dark:border-slate-700/60"
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {m.toolName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {/* Decrement 1 unit */}
                            <button
                              type="button"
                              onClick={() => handleUpdateMaterialQuantity(gIndex, m.id, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-black flex items-center justify-center cursor-pointer transition-colors"
                              title="Diminuir 1 unidade"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            {/* Direct unit value input */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                min="0"
                                max="999"
                                value={m.quantity === 0 ? '' : m.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const raw = e.target.value;
                                  const val = raw === '' ? 0 : parseInt(raw, 10);
                                  handleUpdateMaterialQuantity(gIndex, m.id, isNaN(val) ? 0 : val, true);
                                }}
                                className="w-9 text-center font-black text-blue-600 dark:text-blue-400 font-mono text-xs focus:outline-hidden"
                              />
                              <span className="text-[10px] font-bold text-slate-400">un</span>
                            </div>

                            {/* Increment 1 unit */}
                            <button
                              type="button"
                              onClick={() => handleUpdateMaterialQuantity(gIndex, m.id, 1)}
                              className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-black flex items-center justify-center cursor-pointer transition-colors"
                              title="Adicionar 1 unidade"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete item */}
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(gIndex, m.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer ml-1"
                              title="Remover este material do terno"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Nenhum material adicionado a este terno ainda.
                    </p>
                  )}

                  {/* Form inline to Add Material to this gang */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                    <select
                      value={getGangAdder(gIndex).toolId}
                      onChange={e => updateGangAdder(gIndex, 'toolId', e.target.value)}
                      className="flex-1 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      {tools.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Disp: {t.available})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500">Qtd:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={getGangAdder(gIndex).qty}
                        onFocus={e => e.target.select()}
                        onChange={e => updateGangAdder(gIndex, 'qty', e.target.value)}
                        className="w-16 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center text-slate-900 dark:text-white"
                      />

                      <button
                        type="button"
                        onClick={() => handleAddMaterialToGang(gIndex)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Campo: Observação */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Campo Observação do Ponto
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Digite observações sobre o navio, ocorrências de ferramentas ou restrições no ponto..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar Atualização</span>
            </button>
          </div>
        </form>
      )}
    </M3Card>
  );
};
