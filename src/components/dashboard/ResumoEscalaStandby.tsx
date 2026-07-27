import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Ship, 
  ArrowRight, 
  CalendarDays, 
  Search, 
  Layers, 
  ShieldCheck, 
  AlertCircle,
  ChevronRight,
  Anchor
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useApp } from '../../context/AppContext';
import { OPERADORES_INICIAIS } from '../../data/initialOperators';
import { M3Card } from '../ui/M3Card';

export const ResumoEscalaStandby: React.FC = () => {
  const navigate = useNavigate();
  const { user: appUser } = useApp();
  const userId = auth?.currentUser?.uid || appUser?.id || 'user-default';

  const [history, setHistory] = useState<any[]>([]);
  const [dataAtual, setDataAtual] = useState(() => new Date().toLocaleDateString('pt-BR'));
  const [turno, setTurno] = useState('7h às 13h');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'bercos' | 'standby' | 'ausentes'>('bercos');

  // Firestore & local sync
  useEffect(() => {
    if (db && userId) {
      try {
        const historyRef = collection(db, 'users', userId, 'history');
        const unsubscribe = onSnapshot(historyRef, (snapshot) => {
          const data = snapshot.docs.map(doc => doc.data());
          data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setHistory(data);
        }, (err) => {
          console.warn("Firestore history read error:", err);
        });
        return () => unsubscribe();
      } catch (e) {
        console.warn("Firestore setup error:", e);
      }
    } else {
      try {
        const local = localStorage.getItem('btp-history');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) setHistory(parsed);
        }
      } catch (e) {
        console.warn("Local storage read error:", e);
      }
    }
  }, [userId]);

  // Find saved scale for selected date & turn or latest for date
  const selectedScale = useMemo(() => {
    if (history.length === 0) return null;
    const exact = history.find(e => e.dataAtual === dataAtual && e.turno === turno);
    if (exact) return exact;
    const sameDate = history.find(e => e.dataAtual === dataAtual);
    if (sameDate) return sameDate;
    return history[0]; // fallback to most recent
  }, [history, dataAtual, turno]);

  // Calculate distribution build
  const scaleData = useMemo(() => {
    if (!selectedScale) {
      // Generate default fallback representation if no scale saved yet
      const defaultTotal = OPERADORES_INICIAIS.length;
      return {
        isFallback: true,
        dataAtual,
        turno,
        b1Ternos: 0,
        b2Ternos: 0,
        b3Ternos: 0,
        escalados: [],
        standby: OPERADORES_INICIAIS,
        absent: [],
        unavailable: [],
        ships: { 'BTP 01': 'Aguardando Navio', 'BTP 02': 'Aguardando Navio', 'BTP 03': 'Aguardando Navio' }
      };
    }

    const safeUnavailable = Array.isArray(selectedScale.unavailableMats) ? selectedScale.unavailableMats : [];
    const safeAbsent = Array.isArray(selectedScale.absentMats) ? selectedScale.absentMats : [];
    const safeDismissed = Array.isArray(selectedScale.dismissedMats) ? selectedScale.dismissedMats : [];
    const safeManual = selectedScale.manualAssignments || {};

    const assignedMats = Object.values(safeManual).flatMap((entries: any) => entries.map((e: any) => e.mat));
    const operantes = OPERADORES_INICIAIS.filter(op => 
      !safeUnavailable.includes(op.mat) && !assignedMats.includes(op.mat)
    );

    const originalStartOp = OPERADORES_INICIAIS[selectedScale.indexInicio || 0] || OPERADORES_INICIAIS[0];
    let newIndexInicio = operantes.findIndex(op => op.mat === originalStartOp.mat);
    if (newIndexInicio === -1) newIndexInicio = 0;

    const listaTrabalho = [
      ...operantes.slice(newIndexInicio),
      ...operantes.slice(0, newIndexInicio)
    ];

    let poolIdx = 0;
    const HOMENS_POR_TERNO = 4;

    const localConfigBercos = [
      { id: 'b1', nome: "BTP 01", qtd: Number(selectedScale.b1) || 0 },
      { id: 'b2', nome: "BTP 02", qtd: Number(selectedScale.b2) || 0 },
      { id: 'b3', nome: "BTP 03", qtd: Number(selectedScale.b3) || 0 }
    ];

    const bercosResultado: any[] = [];
    localConfigBercos.forEach(b => {
      const ternos: any[] = [];
      if (b.qtd > 0) {
        for (let i = 1; i <= b.qtd; i++) {
          const ternoOps: any[] = [];
          for (let k = 0; k < HOMENS_POR_TERNO && poolIdx < listaTrabalho.length; k++) {
            const op = listaTrabalho[poolIdx];
            ternoOps.push({
              ...op,
              isAbsent: safeAbsent.includes(op.mat),
              isDismissed: safeDismissed.includes(op.mat)
            });
            poolIdx++;
          }
          ternos.push({ num: i, id: `${b.nome}-${i}`, operadores: ternoOps });
        }
      }
      bercosResultado.push({
        nome: b.nome,
        qtdTernos: b.qtd,
        shipName: selectedScale.navios?.[b.nome] || '',
        ternos
      });
    });

    const standbyPool = listaTrabalho.slice(poolIdx)
      .filter(op => !safeAbsent.includes(op.mat))
      .map(op => ({ ...op, isDismissed: safeDismissed.includes(op.mat) }));

    const absentList = OPERADORES_INICIAIS.filter(op => safeAbsent.includes(op.mat));
    const unavailableList = OPERADORES_INICIAIS.filter(op => safeUnavailable.includes(op.mat));

    return {
      isFallback: false,
      dataAtual: selectedScale.dataAtual,
      turno: selectedScale.turno,
      b1Ternos: selectedScale.b1 || 0,
      b2Ternos: selectedScale.b2 || 0,
      b3Ternos: selectedScale.b3 || 0,
      bercos: bercosResultado,
      standby: standbyPool,
      absent: absentList,
      unavailable: unavailableList,
      ships: selectedScale.navios || {}
    };
  }, [selectedScale, dataAtual, turno]);

  // Counts
  const totalEscalados = useMemo(() => {
    if (!scaleData.bercos) return 0;
    return scaleData.bercos.reduce((acc: number, b: any) => {
      return acc + b.ternos.reduce((tAcc: number, t: any) => tAcc + t.operadores.length, 0);
    }, 0);
  }, [scaleData]);

  const totalStandby = scaleData.standby?.length || 0;
  const totalAusentes = (scaleData.absent?.length || 0) + (scaleData.unavailable?.length || 0);

  // Search filter
  const filterOps = (list: any[]) => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(op => op.nome.toLowerCase().includes(q) || op.mat.includes(q));
  };

  const turnosDisponiveis = ['1 às 7h', '7h às 13h', '13 às 19h', '19 às 1h'];

  return (
    <M3Card className="space-y-5 border-none shadow-md overflow-hidden bg-white dark:bg-slate-900">
      {/* Widget Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Resumo Pessoal de Escala & Standby
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento em tempo real da distribuição dos operadores e reserva no terminal
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Date, Turn, Quick Link */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Turn Selector */}
          <select
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            {turnosDisponiveis.map(t => (
              <option key={t} value={t}>Turno: {t}</option>
            ))}
          </select>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{scaleData.dataAtual || dataAtual}</span>
          </div>

          {/* Link to full Escala page */}
          <button
            onClick={() => navigate('/escala')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <span>Gerenciar Escala</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Escalados</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
            {totalEscalados}
          </p>
          <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 font-medium mt-0.5">
            Alocados nos ternos ativos
          </p>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Standby (Reserva)</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">
            {totalStandby}
          </p>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium mt-0.5">
            Disponíveis para apoio
          </p>
        </div>

        <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ausentes / Afast.</span>
            <UserX className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1">
            {totalAusentes}
          </p>
          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-medium mt-0.5">
            Licença ou indisponível
          </p>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Ativos</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
            {totalEscalados + totalStandby}
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium mt-0.5">
            Efetivo operacional
          </p>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('bercos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'bercos'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Escala Por Berço
          </button>
          <button
            onClick={() => setActiveTab('standby')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'standby'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Standby (Reserva)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
              {totalStandby}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ausentes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ausentes'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Ausentes</span>
            {totalAusentes > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
                {totalAusentes}
              </span>
            )}
          </button>
        </div>

        {/* Filter Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por operador ou mat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'bercos' && (
        <div className="space-y-4">
          {scaleData.isFallback ? (
            <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nenhuma escala salva encontrada para o dia {scaleData.dataAtual} ({scaleData.turno}).
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                Acesse a tela de Escala BTP para gerar e salvar a distribuição dos operadores para este turno.
              </p>
              <button
                onClick={() => navigate('/escala')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
              >
                <span>Criar Nova Escala</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scaleData.bercos?.map((berco: any) => {
                const shipName = berco.shipName || 'Sem Navio Atribuído';
                return (
                  <div 
                    key={berco.nome}
                    className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Berth Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-sm text-[#003366] dark:text-blue-400 flex items-center gap-1.5">
                          <Anchor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          {berco.nome}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {berco.qtdTernos} {berco.qtdTernos === 1 ? 'Terno' : 'Ternos'}
                        </span>
                      </div>

                      {/* Ship Subtitle */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 mb-3">
                        <Ship className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-bold truncate" title={shipName}>{shipName}</span>
                      </div>

                      {/* Ternos List */}
                      {berco.ternos?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum terno ativado para este berço.</p>
                      ) : (
                        <div className="space-y-3">
                          {berco.ternos?.map((terno: any) => {
                            const filteredOperators = filterOps(terno.operadores);
                            return (
                              <div key={terno.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                                  Terno {terno.num} ({terno.operadores.length} homens)
                                </span>
                                <div className="space-y-1">
                                  {filteredOperators.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Sem resultados para busca.</p>
                                  ) : (
                                    filteredOperators.map((op: any) => (
                                      <div 
                                        key={op.mat}
                                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/60 transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                                            {op.mat}
                                          </span>
                                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate" title={op.nome}>
                                            {op.nome}
                                          </span>
                                        </div>
                                        {op.isDismissed && (
                                          <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                                            LIBERADO
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'standby' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Operadores em Reserva (Standby) - {scaleData.standby?.length || 0} disponíveis
            </h4>
          </div>

          {filterOps(scaleData.standby || []).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80">
              <p className="text-xs text-slate-500 font-bold">Nenhum operador em standby encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filterOps(scaleData.standby || []).map((op: any) => (
                <div 
                  key={op.mat}
                  className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-lg shrink-0">
                      {op.mat}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={op.nome}>
                      {op.nome}
                    </span>
                  </div>
                  {op.isDismissed ? (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full shrink-0">
                      Liberado
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full shrink-0">
                      Pronto
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ausentes' && (
        <div className="space-y-3">
          <h4 className="font-extrabold text-xs text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <UserX className="w-4 h-4 text-rose-600" />
            Operadores Ausentes / Indisponíveis - {totalAusentes} registros
          </h4>

          {totalAusentes === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Nenhum operador registrado como ausente neste turno!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[...(scaleData.absent || []), ...(scaleData.unavailable || [])].map((op: any) => (
                <div 
                  key={op.mat}
                  className="bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 rounded-xl p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-lg shrink-0">
                      {op.mat}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={op.nome}>
                      {op.nome}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">
                    Afastado
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </M3Card>
  );
};
