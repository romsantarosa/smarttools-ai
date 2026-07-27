import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Printer, 
  RotateCcw, 
  ClipboardList, 
  ArrowRightLeft, 
  Share2, 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  MessageCircle, 
  FileText, 
  UserX, 
  UserCheck, 
  MoreVertical, 
  ArrowLeftRight, 
  ArrowRight, 
  Save, 
  History, 
  Copy, 
  Trash2, 
  CalendarDays, 
  Clock, 
  BarChart2, 
  GripVertical, 
  UploadCloud,
  Ship
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { auth, db } from '../services/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { useApp } from '../context/AppContext';

// Polyfill for ReadableStream async iterator, required by pdfjs-dist on some mobile browsers
(function() {
    try {
        if (typeof Symbol !== 'undefined' && !(Symbol as any).asyncIterator) {
            (Symbol as any).asyncIterator = Symbol.for("Symbol.asyncIterator");
        }
        
        if (typeof ReadableStream !== 'undefined' && !(ReadableStream.prototype as any)[Symbol.asyncIterator]) {
            (ReadableStream.prototype as any)[Symbol.asyncIterator] = async function* (this: any) {
                const reader = this.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) return;
                        yield value;
                    }
                } finally {
                    reader.releaseLock();
                }
            };
        }
    } catch (e) {
        console.warn("Failed to apply ReadableStream polyfill", e);
    }
})();

if (pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

import { OPERADORES_INICIAIS, Operador } from '../data/initialOperators';

export const Escala: React.FC = () => {
  const { user: appUser, ships } = useApp();
  const userId = auth?.currentUser?.uid || appUser?.id || 'user-default';

  const [indexInicio, setIndexInicio] = useState(0);
  const [b1, setB1] = useState<number | ''>('');
  const [b2, setB2] = useState<number | ''>('');
  const [b3, setB3] = useState<number | ''>('');
  const [turno, setTurno] = useState('1 às 7h');
  const [dataAtual, setDataAtual] = useState(() => new Date().toLocaleDateString('pt-BR'));
  const [observacoes, setObservacoes] = useState('');
  const [gerado, setGerado] = useState(false);
  const [loadingShips, setLoadingShips] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const [navios, setNavios] = useState<Record<string, string>>({
    'BTP 01': '',
    'BTP 02': '',
    'BTP 03': ''
  });

  const [berthingDates, setBerthingDates] = useState<Record<string, string>>({
    'BTP 01': '',
    'BTP 02': '',
    'BTP 03': ''
  });

  // Auto populate ships from AppContext if available
  useEffect(() => {
    if (ships && ships.length > 0) {
      const shipMap: Record<string, string> = { 'BTP 01': '', 'BTP 02': '', 'BTP 03': '' };
      const dateMap: Record<string, string> = { 'BTP 01': '', 'BTP 02': '', 'BTP 03': '' };

      ships.forEach(s => {
        const berthClean = (s?.berth || '').toUpperCase();
        if (berthClean.includes('01') || berthClean.includes('BTP 1')) {
          shipMap['BTP 01'] = s.name;
          dateMap['BTP 01'] = s.eta || '';
        } else if (berthClean.includes('02') || berthClean.includes('BTP 2')) {
          shipMap['BTP 02'] = s.name;
          dateMap['BTP 02'] = s.eta || '';
        } else if (berthClean.includes('03') || berthClean.includes('BTP 3')) {
          shipMap['BTP 03'] = s.name;
          dateMap['BTP 03'] = s.eta || '';
        }
      });

      setNavios(prev => ({ ...prev, ...shipMap }));
      setBerthingDates(prev => ({ ...prev, ...dateMap }));
    }
  }, [ships]);

  // Estrutura: { 'BTP 01-4': { paraBerco: 'BTP 03', paraTerno: 1 } }
  const [vinculos, setVinculos] = useState<Record<string, { paraBerco: string, paraTerno: number }>>({});
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [operatorMenu, setOperatorMenu] = useState<{ ternoId: string, op: Operador, x: number, y: number } | null>(null);

  const [unavailableMats, setUnavailableMats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('btp-unavailable-mats');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [manualAssignments, setManualAssignments] = useState<Record<string, { mat: string; replacing?: string }[]>>(() => {
    try {
      const saved = localStorage.getItem('btp-manual-assignments');
      const parsed = saved ? JSON.parse(saved) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (e) {
      return {};
    }
  });

  const [absentMats, setAbsentMats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('btp-absent-mats');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [condicionadoMats, setCondicionadoMats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('btp-condicionado-mats');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [dismissedMats, setDismissedMats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('btp-dismissed-mats');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  // LocalStorage persistence
  useEffect(() => {
    localStorage.setItem('btp-unavailable-mats', JSON.stringify(unavailableMats));
  }, [unavailableMats]);

  useEffect(() => {
    localStorage.setItem('btp-absent-mats', JSON.stringify(absentMats));
  }, [absentMats]);

  useEffect(() => {
    localStorage.setItem('btp-condicionado-mats', JSON.stringify(condicionadoMats));
  }, [condicionadoMats]);

  useEffect(() => {
    localStorage.setItem('btp-dismissed-mats', JSON.stringify(dismissedMats));
  }, [dismissedMats]);

  useEffect(() => {
    localStorage.setItem('btp-manual-assignments', JSON.stringify(manualAssignments));
  }, [manualAssignments]);

  const [showManagePersonnel, setShowManagePersonnel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  
  // Share states
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [globalToast, setGlobalToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [statsDrawerOpen, setStatsDrawerOpen] = useState(false);
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [historyFilterTurno, setHistoryFilterTurno] = useState('');
  const [historyFilterB1, setHistoryFilterB1] = useState('');
  const [historyFilterB2, setHistoryFilterB2] = useState('');
  const [historyFilterB3, setHistoryFilterB3] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Firestore sync for history with local fallback
  useEffect(() => {
    if (db && userId) {
      try {
        const historyRef = collection(db, 'users', userId, 'history');
        const unsubscribe = onSnapshot(historyRef, (snapshot) => {
          const data = snapshot.docs.map(doc => doc.data());
          data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setHistory(data);
        }, (err) => {
          console.warn("Firestore snapshot error:", err);
        });
        return () => unsubscribe();
      } catch (e) {
        console.warn("Could not setup Firestore sync:", e);
      }
    } else {
      try {
        const local = localStorage.getItem('btp-history');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) setHistory(parsed);
        }
      } catch (e) {
        console.warn("Error reading local history:", e);
      }
    }
  }, [userId]);

  const formatIsoToPtBr = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatPtBrToIso = (ptBrStr: string) => {
    if (!ptBrStr) return '';
    const parts = ptBrStr.split('/');
    if (parts.length !== 3) return '';
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const changeDateByDays = (days: number) => {
    const iso = formatPtBrToIso(dataAtual);
    const baseDate = iso ? new Date(iso + 'T12:00:00') : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const yyyy = baseDate.getFullYear();
    setDataAtual(`${dd}/${mm}/${yyyy}`);
  };

  const setTodayDate = () => {
    setDataAtual(new Date().toLocaleDateString('pt-BR'));
  };

  const savedScaleForCurrentDateAndTurn = useMemo(() => {
    return history.find(e => e.dataAtual === dataAtual && e.turno === turno);
  }, [history, dataAtual, turno]);

  const savedScalesForCurrentDate = useMemo(() => {
    return history.filter(e => e.dataAtual === dataAtual);
  }, [history, dataAtual]);

  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      if (historyFilterDate && !entry.dataAtual?.includes(historyFilterDate)) return false;
      if (historyFilterTurno && entry.turno !== historyFilterTurno) return false;
      if (historyFilterB1 && (entry.b1 || 0).toString() !== historyFilterB1) return false;
      if (historyFilterB2 && (entry.b2 || 0).toString() !== historyFilterB2) return false;
      if (historyFilterB3 && (entry.b3 || 0).toString() !== historyFilterB3) return false;
      return true;
    });
  }, [history, historyFilterDate, historyFilterTurno, historyFilterB1, historyFilterB2, historyFilterB3]);

  const groupedHistoryByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredHistory.forEach(entry => {
      const dateKey = entry.dataAtual || 'Sem Data';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });

    const entries = Object.entries(groups);
    entries.sort((a, b) => {
      const parseDate = (dStr: string) => {
        const parts = dStr.split('/');
        if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        return 0;
      };
      return parseDate(b[0]) - parseDate(a[0]);
    });

    return entries;
  }, [filteredHistory]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setGlobalToast({ message, type });
    setTimeout(() => setGlobalToast(null), 3000);
  };

  const saveToHistory = async (customMessage?: any) => {
    const messageStr = typeof customMessage === 'string' ? customMessage : undefined;
    const existingEntry = history.find(e => e.dataAtual === dataAtual && e.turno === turno);
    const entryId = existingEntry ? String(existingEntry.id) : Date.now().toString();

    const newEntry = {
      userId,
      id: entryId,
      timestamp: new Date().toISOString(),
      dataAtual,
      turno,
      observacoes,
      b1: b1 === '' ? 0 : b1, 
      b2: b2 === '' ? 0 : b2, 
      b3: b3 === '' ? 0 : b3,
      indexInicio,
      navios,
      berthingDates,
      vinculos,
      unavailableMats,
      absentMats,
      dismissedMats,
      condicionadoMats,
      manualAssignments
    };
    
    try {
      if (db) {
        await setDoc(doc(db, 'users', userId, 'history', newEntry.id), newEntry);
      } else {
        const localHist = JSON.parse(localStorage.getItem('btp-history') || '[]');
        const filtered = localHist.filter((item: any) => String(item.id) !== entryId);
        const updated = [newEntry, ...filtered];
        localStorage.setItem('btp-history', JSON.stringify(updated));
        setHistory(updated);
      }
      showToast(messageStr || `Escala do dia ${dataAtual} (${turno}) salva com sucesso!`);
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar no histórico', 'error');
    }
  };

  const deleteFromHistory = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'users', userId, 'history', id));
      } else {
        const updated = history.filter(item => item.id !== id);
        localStorage.setItem('btp-history', JSON.stringify(updated));
        setHistory(updated);
      }
      showToast('Histórico apagado.', 'success');
    } catch (e) {
      showToast('Erro ao apagar histórico', 'error');
    }
  };

  const onDragEndHistory = async (result: DropResult) => {
    if (!result.destination) return;
    
    if (historyFilterDate || historyFilterTurno || historyFilterB1 || historyFilterB2 || historyFilterB3) {
      showToast('Desative os filtros para reordenar o histórico.', 'error');
      return;
    }

    const { source, destination } = result;

    setHistory((prev) => {
      const updated = Array.from(prev);
      const [reorderedItem] = updated.splice(source.index, 1);
      updated.splice(destination.index, 0, reorderedItem);
      
      if (db) {
        const batch = writeBatch(db);
        const now = Date.now();
        updated.forEach((item: any, index: number) => {
          const docRef = doc(db, 'users', userId, 'history', String(item.id));
          const newTimestamp = new Date(now - index * 1000).toISOString();
          item.timestamp = newTimestamp;
          batch.update(docRef, { timestamp: newTimestamp });
        });
        batch.commit().catch(console.error);
      } else {
        localStorage.setItem('btp-history', JSON.stringify(updated));
      }
      
      return updated;
    });
  };

  const loadFromHistory = (entry: any, type: 'all' | 'config' | 'data') => {
    if (type === 'all' || type === 'config') {
      setB1(entry.b1);
      setB2(entry.b2);
      setB3(entry.b3);
      setVinculos(entry.vinculos || {});
      setNavios(entry.navios || { 'BTP 01': '', 'BTP 02': '', 'BTP 03': '' });
      setBerthingDates(entry.berthingDates || { 'BTP 01': '', 'BTP 02': '', 'BTP 03': '' });
      setTurno(entry.turno);
      setObservacoes(entry.observacoes || '');
    }
    
    if (type === 'all' || type === 'data') {
      setUnavailableMats(entry.unavailableMats || []);
      setAbsentMats(entry.absentMats || []);
      setDismissedMats(entry.dismissedMats || []);
      setCondicionadoMats(entry.condicionadoMats || []);
      setManualAssignments(entry.manualAssignments || {});
      setIndexInicio(entry.indexInicio || 0);
    }

    if (type === 'all') {
      setGerado(true);
    } else if (type === 'config') {
      setGerado(false);
    }

    setHistoryModalOpen(false);
    showToast(`Escala (${type === 'all' ? 'Completa' : type === 'config' ? 'Config.' : 'Dados'}) carregada!`);
  };

  const turnosDisponiveis = ['1 às 7h', '7h às 13h', '13 às 19h', '19 às 1h'];

  const handleAddVinculo = (origemId: string, paraBerco: string, paraTerno: number) => {
    const destinoId = `${paraBerco}-${paraTerno}`;
    
    setVinculos(prev => ({
      ...prev,
      [origemId]: { paraBerco, paraTerno }
    }));

    setManualAssignments(prev => {
      if (prev[origemId] && prev[origemId].length > 0) {
        return {
          ...prev,
          [destinoId]: [...prev[origemId]]
        };
      }
      return prev;
    });

    setMenuAberto(null);
  };

  const handleRemoveVinculo = (origemId: string) => {
    setVinculos(prev => {
      const newMap = { ...prev };
      delete newMap[origemId];
      return newMap;
    });
  };

  const configBercos = [
    { id: 'b1', nome: "BTP 01", qtd: Number(b1) || 0 },
    { id: 'b2', nome: "BTP 02", qtd: Number(b2) || 0 },
    { id: 'b3', nome: "BTP 03", qtd: Number(b3) || 0 }
  ];

  const buildEscala = (params: any) => {
    if (!params.gerado) return null;

    try {
      const localConfigBercos = [
        { id: 'b1', nome: "BTP 01", qtd: Number(params.b1) || 0 },
        { id: 'b2', nome: "BTP 02", qtd: Number(params.b2) || 0 },
        { id: 'b3', nome: "BTP 03", qtd: Number(params.b3) || 0 }
      ];

      const safeUnavailable = Array.isArray(params.unavailableMats) ? params.unavailableMats : [];
      const safeAbsent = Array.isArray(params.absentMats) ? params.absentMats : [];
      const safeDismissed = Array.isArray(params.dismissedMats) ? params.dismissedMats : [];
      const safeCondicionado = Array.isArray(params.condicionadoMats) ? params.condicionadoMats : [];
      const safeManual: Record<string, { mat: string; replacing?: string }[]> = params.manualAssignments || {};

      const assignedMats = Object.values(safeManual).flatMap(entries => entries.map(e => e.mat));
      const operantes = OPERADORES_INICIAIS.filter(op => 
        !safeUnavailable.includes(op.mat) && !assignedMats.includes(op.mat)
      );
      const totalOperantes = operantes.length;

      if (totalOperantes === 0) return null;

      const originalStartOp = OPERADORES_INICIAIS[params.indexInicio || 0] || OPERADORES_INICIAIS[0];
      let newIndexInicio = operantes.findIndex(op => op.mat === originalStartOp.mat);
      if (newIndexInicio === -1) newIndexInicio = 0;

      const listaTrabalho = [
        ...operantes.slice(newIndexInicio),
        ...operantes.slice(0, newIndexInicio)
      ];

      let poolIdx = 0;
      const HOMENS_POR_TERNO = 4;
      
      const originalTernos: any[] = [];
      localConfigBercos.forEach(b => {
        if (b.qtd > 0) {
          for (let i = 1; i <= b.qtd; i++) {
            originalTernos.push({ nome: b.nome, num: i, id: `${b.nome}-${i}` });
          }
        }
      });

      const baseOpsMap: Record<string, any[]> = {};
      
      originalTernos.forEach(terno => {
        const ops = [];
        for (let i = 0; i < HOMENS_POR_TERNO && poolIdx < listaTrabalho.length; i++) {
          const op = listaTrabalho[poolIdx];
          ops.push({ 
            ...op, 
            isAbsent: safeAbsent.includes(op.mat), 
            isDismissed: safeDismissed.includes(op.mat),
            isCondicionado: safeCondicionado.includes(op.mat)
          });
          poolIdx++;
        }
        baseOpsMap[terno.id] = ops;
      });

      const maxTernosPorBerco: Record<string, number> = {};
      localConfigBercos.forEach(b => maxTernosPorBerco[b.nome] = b.qtd);
      
      for (const srcId in params.vinculos || {}) {
        const v = params.vinculos[srcId];
        maxTernosPorBerco[v.paraBerco] = Math.max(maxTernosPorBerco[v.paraBerco] || 0, v.paraTerno);
      }

      const resultadoPre: any[] = [];
      Object.entries(maxTernosPorBerco).forEach(([nome, qtd]) => {
        if (qtd > 0) {
          const ternos: any[] = [];
          for (let i = 1; i <= qtd; i++) {
            ternos.push({ num: i, operadores: [], incompleto: false, id: `${nome}-${i}` });
          }
          resultadoPre.push({ nome, ternos });
        }
      });

      const infoVinculos: Record<string, string> = {};
      
      const parent: Record<string, string> = {};
      const find = (id: string): string => {
        if (!parent[id] || parent[id] === id) return id;
        return find(parent[id]);
      };
      const unite = (id1: string, id2: string) => {
        const root1 = find(id1);
        const root2 = find(id2);
        if (root1 !== root2) {
          parent[root2] = root1;
        }
      };

      for (const srcId in params.vinculos || {}) {
        const v = params.vinculos[srcId];
        unite(srcId, `${v.paraBerco}-${v.paraTerno}`);
      }

      resultadoPre.forEach(berco => {
        berco.ternos.forEach((terno: any) => {
          const ternoId = terno.id;
          const rootId = find(ternoId);

          let targetOps = baseOpsMap[rootId] || baseOpsMap[ternoId];
          
          if (targetOps) {
            terno.operadores = targetOps.map((o: any) => ({...o}));
          } else {
            terno.operadores = []; 
          }

          if (safeManual[ternoId]) {
            safeManual[ternoId].forEach(entry => {
              const op = OPERADORES_INICIAIS.find(o => o.mat === entry.mat);
              if (op && !terno.operadores.find((existing: any) => existing.mat === entry.mat)) {
                const replacingOp = entry.replacing ? OPERADORES_INICIAIS.find(o => o.mat === entry.replacing) : null;
                
                const manualOp = { 
                  ...op, 
                  isManual: true,
                  replacingName: replacingOp ? replacingOp.nome : undefined,
                  replacingMat: entry.replacing,
                  isDismissed: safeDismissed.includes(op.mat),
                  isCondicionado: safeCondicionado.includes(op.mat)
                };

                let insertIndex = -1;
                for (let j = 0; j < terno.operadores.length; j++) {
                  if (terno.operadores[j].isAbsent && (!entry.replacing || terno.operadores[j].mat === entry.replacing)) {
                    const next = terno.operadores[j + 1];
                    if (!next || !(next as any).isManual) {
                      insertIndex = j + 1;
                      break;
                    }
                  }
                }

                if (insertIndex !== -1) {
                  terno.operadores.splice(insertIndex, 0, manualOp);
                } else {
                  terno.operadores.push(manualOp);
                }
              }
            });
          }

          terno.incompleto = terno.operadores.filter((o: any) => !o.isAbsent && !o.isDismissed).length < HOMENS_POR_TERNO;

          let vemDe = "";
          for (const srcId in params.vinculos || {}) {
            const v = params.vinculos[srcId];
            if (`${v.paraBerco}-${v.paraTerno}` === ternoId) {
              vemDe = srcId;
              break;
            }
          }
          
          let label = "";
          if (vemDe) label += `Vem de ${vemDe}`;
          if (params.vinculos && params.vinculos[ternoId]) {
            const v = params.vinculos[ternoId];
            if (label) label += " | ";
            label += `Vai para ${v.paraBerco} T ${v.paraTerno}`;
          }
          if (label) infoVinculos[ternoId] = label;
        });
      });

      const standbyPool = listaTrabalho.slice(poolIdx).filter(op => !safeAbsent.includes(op.mat)).map(op => ({ ...op, isDismissed: safeDismissed.includes(op.mat), isCondicionado: safeCondicionado.includes(op.mat) }));

      return {
        resultado: resultadoPre,
        standby: standbyPool,
        totalNecessario: poolIdx, 
        totalDisponivel: totalOperantes,
        unavailable: OPERADORES_INICIAIS.filter(op => safeUnavailable.includes(op.mat)),
        absent: OPERADORES_INICIAIS.filter(op => safeAbsent.includes(op.mat)).map(op => {
          let replacedBy = null;
          for (const tid in safeManual) {
            const entry = safeManual[tid].find(e => e.replacing === op.mat);
            if (entry) {
              replacedBy = OPERADORES_INICIAIS.find(o => o.mat === entry.mat);
              break;
            }
          }
          return { ...op, replacedBy };
        }),
        infoVinculos,
        dismissed: OPERADORES_INICIAIS.filter(op => safeDismissed.includes(op.mat))
      };
    } catch (err) {
      console.error("Erro ao construir escala:", err);
      return null;
    }
  };

  const escala = useMemo(() => {
    return buildEscala({ gerado, indexInicio, b1, b2, b3, vinculos, unavailableMats, absentMats, manualAssignments, dismissedMats, condicionadoMats });
  }, [gerado, indexInicio, b1, b2, b3, vinculos, unavailableMats, absentMats, manualAssignments, dismissedMats, condicionadoMats]);

  const historyStatsData = useMemo(() => {
    const stats: Record<string, any> = {};
    
    const formatName = (fullName: string) => {
      const parts = fullName.split(' ');
      if (parts.length <= 2) return fullName;
      return `${parts[0]} ${parts[parts.length - 1]}`;
    };

    OPERADORES_INICIAIS.forEach(op => {
       stats[op.mat] = {
           mat: op.mat,
           nome: formatName(op.nome),
           fullName: op.nome,
           worked: 0,
           absent: 0,
           dismissed: 0,
           condicionado: 0,
           subIn: 0, 
           subOut: 0
       };
    });

    history.forEach(entry => {
       (entry.absentMats || []).forEach((mat: string) => {
           if (stats[mat]) stats[mat].absent++;
       });

       (entry.dismissedMats || []).forEach((mat: string) => {
           if (stats[mat]) stats[mat].dismissed++;
       });
       
       (entry.condicionadoMats || []).forEach((mat: string) => {
           if (stats[mat]) stats[mat].condicionado++;
       });
       
       const escalaData = buildEscala({ ...entry, gerado: true });
       if (escalaData && escalaData.resultado) {
           escalaData.resultado.forEach((berco: any) => {
              berco.ternos.forEach((terno: any) => {
                  terno.operadores.forEach((op: any) => {
                      if (!op.isAbsent && !op.isDismissed && stats[op.mat]) {
                          if (op.isManual) {
                              stats[op.mat].subIn++;
                              if (op.replacingMat && stats[op.replacingMat]) {
                                  stats[op.replacingMat].subOut++;
                              }
                          } else {
                              stats[op.mat].worked++;
                          }
                      }
                  });
              });
           });
       }
    });

    return Object.values(stats).sort((a, b) => (b.worked + b.subIn + b.condicionado) - (a.worked + a.subIn + a.condicionado));
  }, [history]);

  const handleGerar = () => {
    if (!b1 && !b2 && !b3) {
      showToast("Por favor, informe a quantidade de ternos em pelo menos um berço.", "error");
      return;
    }
    setGerado(false);
    setTimeout(() => {
      setGerado(true);
      saveToHistory(`Escala do dia ${dataAtual} (${turno}) gerada e salva com sucesso!`);
      setTimeout(() => {
        const resultEl = document.getElementById('displayResultado');
        if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 50);
  };

  const handleLimpar = () => {
    setB1('');
    setB2('');
    setB3('');
    setIndexInicio(0);
    setGerado(false);
    setVinculos({});
    setAbsentMats([]);
    setDismissedMats([]);
    setManualAssignments({});
    setOperatorMenu(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setGerado(true);

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            try {
              styleTags[i].innerHTML = styleTags[i].innerHTML.replace(/oklch\([^)]+\)/g, '#3b82f6');
            } catch (e) {
              console.warn("Could not patch style tag", e);
            }
          }

          const styleTag = clonedDoc.createElement('style');
          styleTag.innerHTML = `
            * {
              color-scheme: light !important;
              --tw-bg-opacity: 1 !important;
              --tw-text-opacity: 1 !important;
              --tw-border-opacity: 1 !important;
            }
            .bg-blue-600 { background-color: #2563eb !important; }
            .bg-indigo-600 { background-color: #4f46e5 !important; }
            .bg-green-600 { background-color: #16a34a !important; }
            .bg-red-600 { background-color: #dc2626 !important; }
            .text-\\[\\#003366\\] { color: #003366 !important; }
            .bg-\\[\\#003366\\] { background-color: #003366 !important; }
          `;
          clonedDoc.head.appendChild(styleTag);

          const hiddenElements = clonedDoc.querySelectorAll('.print\\:hidden');
          hiddenElements.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });

          const container = clonedDoc.querySelector('.max-w-4xl');
          if (container) {
            (container as HTMLElement).classList.remove('shadow-lg', 'rounded-xl');
            (container as HTMLElement).style.margin = '0';
            (container as HTMLElement).style.padding = '20px';
            (container as HTMLElement).style.maxWidth = '100%';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = 210;
      const calculatedHeight = canvas.height * (imgWidth / canvas.width);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidth, calculatedHeight]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, calculatedHeight, undefined, 'FAST');
      pdf.save(`Escala_BTP_${dataAtual.replace(/\//g, '-')}_${turno.replace(/\s/g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Tente novamente ou use a opção de IMPRIMIR e imprima como PDF no navegador.');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showToast('Por favor, selecione um arquivo PDF válido.', 'error');
        return;
      }
      setPdfFile(file);
      showToast('PDF selecionado com sucesso! Clique em GERAR ESCALA DE IMPORTAÇÃO.');
    }
  };

  const handleGenerateFromPDF = async () => {
    if (!pdfFile || processingPdf) return;
    setProcessingPdf(true);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const items = textContent.items as any[];
        const yMap: { [y: number]: { text: string, x: number }[] } = {};
        const TOLERANCE = 5;
        
        items.forEach(item => {
          const y = item.transform[5];
          const text = (item.str || "").trim();
          if (!text) return;

          let foundY = Object.keys(yMap).map(Number).find(key => Math.abs(key - y) <= TOLERANCE);
          if (foundY === undefined) {
             foundY = y;
             yMap[foundY] = [];
          }
          yMap[foundY].push({ text, x: item.transform[4] });
        });
        
        const sortedY = Object.keys(yMap).map(Number).sort((a, b) => b - a);
        sortedY.forEach(y => {
          const sortedItems = yMap[y].sort((a, b) => a.x - b.x);
          const lineStr = sortedItems.map(i => i.text).join("  ");
          fullText += lineStr + "\n";
        });
      }

      const textUpper = fullText.toUpperCase();
      let extractedTurno = "";
      if (/1 \s*[AàÀa]*\s*S\s*7H|01(:00|H)\s*-\s*07(:00|H)|Q4/i.test(textUpper)) {
         extractedTurno = "1 às 7h";
      } else if (/7H\s*[AàÀa]*\s*S\s*13H|07(:00|H)\s*-\s*13(:00|H)|Q1/i.test(textUpper)) {
         extractedTurno = "7h às 13h";
      } else if (/13H?\s*[AàÀa]*\s*S\s*19H|13(:00|H)\s*-\s*19(:00|H)|Q2/i.test(textUpper)) {
         extractedTurno = "13 às 19h";
      } else if (/19H?\s*[AàÀa]*\s*S\s*1H|19(:00|H)\s*-\s*01(:00|H)|Q3/i.test(textUpper)) {
         extractedTurno = "19 às 1h";
      }

      const dateMatch = fullText.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
      let extractedDate = "";
      if (dateMatch) {
         extractedDate = dateMatch[1].replace(/-/g, '/');
      }

      const allocations: { mat: string, berco: string }[] = [];
      const lines = fullText.split('\n');

      lines.forEach(line => {
        OPERADORES_INICIAIS.forEach(op => {
          const cleanMat = op.mat.replace(/^0+/, "");
          const matRegex = new RegExp(`(?:^|\\s)(0*${cleanMat})(?:\\s|$)`);
          
          if (matRegex.test(line)) {
            const bercoMatch = line.match(/BTP\s*0?([1-3])/i);

            if (bercoMatch) {
              const bercoLabel = `BTP 0${bercoMatch[1]}`;
              allocations.push({
                mat: op.mat,
                berco: bercoLabel
              });
            }
          }
        });
      });

      const opsByBerco: Record<string, string[]> = { "BTP 01": [], "BTP 02": [], "BTP 03": [] };
      const flatPdfMats: string[] = [];
      allocations.forEach(a => {
        if (!opsByBerco[a.berco].includes(a.mat)) {
          opsByBerco[a.berco].push(a.mat);
          flatPdfMats.push(a.mat);
        }
      });

      let foundCount = 0;
      let firstOperatorMat: string | null = allocations.find(a => a.berco === "BTP 01")?.mat || (allocations.length > 0 ? allocations[0].mat : null);
      const maxTernosFound: Record<string, number> = { "BTP 01": 0, "BTP 02": 0, "BTP 03": 0 };

      Object.keys(opsByBerco).forEach(berco => {
        const ops = opsByBerco[berco];
        const numTernos = Math.ceil(ops.length / 4);
        maxTernosFound[berco] = numTernos;
        foundCount += ops.length;
      });

      let globalStartIndex = 0;
      if (firstOperatorMat) {
        globalStartIndex = Math.max(0, OPERADORES_INICIAIS.findIndex(o => o.mat === firstOperatorMat));
        setIndexInicio(globalStartIndex);
      }

      const calculatedUnavailableMats: string[] = [];
      let requiredRemaining = foundCount;
      let currIdx = globalStartIndex;
      let maxScans = OPERADORES_INICIAIS.length * 2; 
      
      while (requiredRemaining > 0 && maxScans > 0) {
        const mat = OPERADORES_INICIAIS[currIdx % OPERADORES_INICIAIS.length].mat;
        if (flatPdfMats.includes(mat)) {
           requiredRemaining--;
        } else {
           calculatedUnavailableMats.push(mat);
        }
        currIdx++;
        maxScans--;
      }

      setAbsentMats([]);
      setDismissedMats([]);
      setUnavailableMats(calculatedUnavailableMats);
      setManualAssignments({});

      if (foundCount > 0) {
        if (extractedTurno) setTurno(extractedTurno);
        if (extractedDate) setDataAtual(extractedDate);
        setB1(maxTernosFound["BTP 01"] > 0 ? maxTernosFound["BTP 01"] as any : "");
        setB2(maxTernosFound["BTP 02"] > 0 ? maxTernosFound["BTP 02"] as any : "");
        setB3(maxTernosFound["BTP 03"] > 0 ? maxTernosFound["BTP 03"] as any : "");

        setGerado(true);
        showToast(`${foundCount} operadores identificados. Ausentes na lista marcados como indisponíveis.`, "success");
      } else {
        showToast("Nenhuma informação identificada no PDF. Verifique o padrão do arquivo.", "error");
      }

    } catch (error: any) {
      console.error("Erro ao processar PDF:", error);
      showToast(`Erro técnico ao ler o PDF: ${error?.message || 'Erro desconhecido'}`, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPdfFile(null);
      setProcessingPdf(false);
    }
  };

  const getShareLink = () => {
    const params = new URLSearchParams();
    params.set('start', indexInicio.toString());
    params.set('b1', (b1 || 0).toString());
    params.set('b2', (b2 || 0).toString());
    params.set('b3', (b3 || 0).toString());
    params.set('turno', turno);
    params.set('dataAtual', dataAtual);
    params.set('obs', encodeURIComponent(observacoes));
    params.set('gerado', gerado.toString());
    params.set('navios', JSON.stringify(navios));
    params.set('vinculos', JSON.stringify(vinculos));
    params.set('unavailable', JSON.stringify(unavailableMats));
    return `${window.location.origin}${window.location.pathname}#/escala?${params.toString()}`;
  };

  const handleWhatsAppShare = () => {
    const link = getShareLink();
    const message = `Olá, segue a Escala BTP do dia ${dataAtual} (${turno}):\n\n${link}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const toggleOperatorAvailability = (mat: string) => {
    setUnavailableMats(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(mat) ? current.filter(m => m !== mat) : [...current, mat];
    });
    setAbsentMats(prev => prev.filter(m => m !== mat));
    setDismissedMats(prev => prev.filter(m => m !== mat));
    setCondicionadoMats(prev => prev.filter(m => m !== mat));
  };

  const toggleOperatorAbsence = (mat: string) => {
    setAbsentMats(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(mat) ? current.filter(m => m !== mat) : [...current, mat];
    });
    setUnavailableMats(prev => prev.filter(m => m !== mat));
    setDismissedMats(prev => prev.filter(m => m !== mat));
    setCondicionadoMats(prev => prev.filter(m => m !== mat));
  };

  const assignToTerno = (mat: string, ternoId: string, replacing?: string) => {
    setManualAssignments(prev => {
      const current = prev[ternoId] || [];
      if (current.some(e => e.mat === mat)) return prev;
      return {
        ...prev,
        [ternoId]: [...current, { mat, replacing }]
      };
    });
  };

  const unassignFromTerno = (mat: string, ternoId: string) => {
    setManualAssignments(prev => {
      const current = prev[ternoId] || [];
      const filtered = current.filter(e => e.mat !== mat);
      const copy = { ...prev };
      if (filtered.length === 0) {
        delete copy[ternoId];
      } else {
        copy[ternoId] = filtered;
      }
      return copy;
    });
  };

  const toggleOperatorDismissal = (mat: string) => {
    setDismissedMats(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(mat) ? current.filter(m => m !== mat) : [...current, mat];
    });
    setAbsentMats(prev => prev.filter(m => m !== mat));
    setCondicionadoMats(prev => prev.filter(m => m !== mat));
    setManualAssignments(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(ternoId => {
        const filtered = (next[ternoId] || []).filter(entry => entry.mat !== mat);
        if (filtered.length !== (next[ternoId] || []).length) {
          next[ternoId] = filtered;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  const toggleOperatorCondicionado = (mat: string) => {
    setCondicionadoMats(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(mat) ? current.filter(m => m !== mat) : [...current, mat];
    });
    setAbsentMats(prev => prev.filter(m => m !== mat));
    setDismissedMats(prev => prev.filter(m => m !== mat));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 text-slate-800 dark:text-slate-100 transition-colors">
      {globalToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-6 py-3 rounded-full shadow-lg font-bold text-sm animate-in slide-in-from-top-4 fade-in duration-300 ${
          globalToast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {globalToast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {globalToast.message}
        </div>
      )}

      <div ref={printRef} className="max-w-4xl mx-auto bg-white dark:bg-slate-800/90 rounded-2xl shadow-xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 print:shadow-none print:p-0 print:border-0">
        <header className="border-b-4 border-[#003366] dark:border-blue-500 mb-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-[#003366] dark:bg-blue-600 p-3 rounded-xl flex items-center justify-center shrink-0 w-20 h-14 shadow-md">
               <svg width="100%" height="100%" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 25 Q15 5 30 15 T50 25 T70 15 T95 25" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2"/>
                  <text x="50" y="28" fill="white" fontSize="24" fontWeight="800" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">BTP</text>
               </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#003366] dark:text-white flex items-center gap-2 tracking-tight">
                Escala: Operadores de Bordo
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase">Brasil Terminal Portuário</p>
            </div>
          </div>
          <div className="text-right text-sm font-semibold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-5 py-3 rounded-2xl flex flex-col items-end min-w-[280px] shrink-0 gap-2">
            <div className="flex flex-col items-end gap-1.5 w-full">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-slate-500">Data:</span>
                <input 
                  type="text" 
                  value={dataAtual} 
                  onChange={(e) => setDataAtual(e.target.value)}
                  className="bg-transparent border-b border-dashed border-slate-400 hover:border-slate-600 focus:outline-none focus:border-[#003366] text-right font-bold text-slate-800 dark:text-slate-100"
                  size={10}
                  title="Data da escala (no formato DD/MM/AAAA)"
                />
                <label className="relative cursor-pointer text-slate-500 hover:text-blue-600 transition-colors p-1" title="Selecionar Data no Calendário">
                  <CalendarDays className="w-4 h-4" />
                  <input 
                    type="date" 
                    value={formatPtBrToIso(dataAtual)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDataAtual(formatIsoToPtBr(e.target.value));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>

              {/* Quick day navigation */}
              <div className="flex items-center gap-1 text-[11px] print:hidden">
                <button 
                  type="button"
                  onClick={() => changeDateByDays(-1)}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                  title="Dia Anterior"
                >
                  ‹ Anterior
                </button>
                <button 
                  type="button"
                  onClick={setTodayDate}
                  className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 hover:bg-blue-200 text-blue-800 dark:text-blue-300 font-bold transition-colors"
                  title="Hoje"
                >
                  Hoje
                </button>
                <button 
                  type="button"
                  onClick={() => changeDateByDays(1)}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                  title="Próximo Dia"
                >
                  Próximo ›
                </button>
              </div>

              {/* Saved Scale status badges */}
              {savedScaleForCurrentDateAndTurn ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 print:hidden">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Escala Salva para esta data/turno</span>
                  <button
                    type="button"
                    onClick={() => loadFromHistory(savedScaleForCurrentDateAndTurn, 'all')}
                    className="underline hover:text-emerald-900 dark:hover:text-emerald-100 ml-1 text-[11px]"
                  >
                    (Recarregar)
                  </button>
                </div>
              ) : savedScalesForCurrentDate.length > 0 ? (
                <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 print:hidden">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{savedScalesForCurrentDate.length} escala(s) salvas nesta data</span>
                  <button
                    type="button"
                    onClick={() => setHistoryModalOpen(true)}
                    className="underline hover:text-amber-900 dark:hover:text-amber-100 ml-1 text-[11px]"
                  >
                    (Ver)
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[#003366] dark:text-blue-400 font-black text-base justify-end w-full">
              <Clock className="w-4 h-4" />
              <span>TURNO {turno}</span>
            </div>
            {observacoes && (
              <div className="w-full text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl text-left border border-amber-200 dark:border-amber-800/60 whitespace-pre-line print:text-[10px]">
                <strong className="block mb-0.5">Observações:</strong>
                {observacoes}
              </div>
            )}
          </div>
        </header>

        {/* Form Controls */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 print:hidden items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              1º da Escala (Início):
            </label>
            <select
              value={indexInicio}
              onChange={(e) => setIndexInicio(parseInt(e.target.value))}
              className={`w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-sm font-medium ${
                (Array.isArray(unavailableMats) && unavailableMats.includes(OPERADORES_INICIAIS[indexInicio]?.mat)) 
                  ? 'border-rose-500 text-rose-600' 
                  : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
              }`}
            >
              {OPERADORES_INICIAIS.map((op, idx) => (
                <option key={op.mat} value={idx} className={(Array.isArray(unavailableMats) && unavailableMats.includes(op.mat)) ? 'text-rose-500' : ''}>
                  {(Array.isArray(unavailableMats) && unavailableMats.includes(op.mat)) ? '✖ ' : ''}{op.mat} - {op.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Horário do Turno:
            </label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-slate-100"
              title="Selecione o horário correspondente ao turno da escala"
            >
              {turnosDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mb-4 print:hidden">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Observações Gerais (Opcional):
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px] text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-y"
            placeholder="Ex: Operações podem atrasar devido à chuva, operador X em treinamento..."
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 print:hidden items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Ternos BTP 01:</label>
            <input
              type="number"
              min="0"
              value={b1}
              onChange={(e) => setB1(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100"
              title="Quantidade de ternos alocados para o berço BTP 01"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Ternos BTP 02:</label>
            <input
              type="number"
              min="0"
              value={b2}
              onChange={(e) => setB2(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100"
              title="Quantidade de ternos alocados para o berço BTP 02"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Ternos BTP 03:</label>
            <input
              type="number"
              min="0"
              value={b3}
              onChange={(e) => setB3(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100"
              title="Quantidade de ternos alocados para o berço BTP 03"
            />
          </div>
        </section>

        {/* Import PDF Section */}
        <section className="mb-6 print:hidden">
          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Importação Automática de PDF de Bordo
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95 text-xs ${
                    pdfFile ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300' : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {pdfFile ? 'ALTERAR PDF' : 'SELECIONAR PDF DE BORDO'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                />
                
                {pdfFile && (
                  <button
                    onClick={handleGenerateFromPDF}
                    disabled={processingPdf}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-emerald-700 transition-all shadow-lg text-xs disabled:opacity-50"
                  >
                    {processingPdf ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        PROCESSANDO...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        GERAR ESCALA DO PDF
                      </>
                    )}
                  </button>
                )}

                <div className="flex-1">
                  {pdfFile ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold truncate max-w-[200px]">{pdfFile.name}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300/80 font-medium">
                      O leitor inteligente detecta operadores engajados e distribui os ternos automaticamente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Manage personnel button */}
        <div className="mb-6 print:hidden">
          <button
            onClick={() => setShowManagePersonnel(!showManagePersonnel)}
            className={`flex items-center gap-2 font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm ${
              showManagePersonnel 
                ? 'bg-[#003366] text-white' 
                : 'bg-white dark:bg-slate-900 text-[#003366] dark:text-blue-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            {showManagePersonnel ? 'CONCLUIR GESTÃO DE PESSOAL' : 'GERENCIAR INDISPONÍVEIS (FÉRIAS / ATESTADOS)'}
            {Array.isArray(unavailableMats) && unavailableMats.length > 0 && (
              <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px]">
                {unavailableMats.length}
              </span>
            )}
          </button>
        </div>

        {showManagePersonnel && (
          <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/60 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl animate-in fade-in duration-300 print:hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-[#003366] dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                CONTROLE DE DISPONIBILIDADE INDIVIDUAL
              </h3>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Filtrar por nome ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {OPERADORES_INICIAIS.filter(op => 
                op.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                op.mat.includes(searchTerm)
              ).map(op => {
                const isOut = Array.isArray(unavailableMats) && unavailableMats.includes(op.mat);
                return (
                  <button
                    key={op.mat}
                    onClick={() => toggleOperatorAvailability(op.mat)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isOut 
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold opacity-60 uppercase">{op.mat}</span>
                      <span className="text-[11px] font-bold truncate w-32">{op.nome}</span>
                    </div>
                    {isOut ? (
                      <div className="bg-rose-500 text-white p-1 rounded-full">
                        <X className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="bg-slate-100 dark:bg-slate-700 text-slate-400 p-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6 print:hidden">
          <button
            onClick={handleGerar}
            className="flex-1 bg-[#003366] hover:bg-[#002244] text-white font-black py-3 px-6 rounded-xl transition-all shadow-md text-sm"
          >
            GERAR ESCALA
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-slate-800 transition-colors shadow-sm text-xs"
          >
            <Printer className="w-4 h-4" />
            IMPRIMIR
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#003366] text-white font-bold py-2.5 px-4 rounded-xl hover:bg-blue-900 transition-colors shadow-sm text-xs"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            WHATSAPP
          </button>
          <button
            onClick={saveToHistory}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-xs"
          >
            <Save className="w-4 h-4" />
            SALVAR
          </button>
          <button
            onClick={() => setStatsDrawerOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-xs"
          >
            <BarChart2 className="w-4 h-4" />
            ESTATÍSTICAS
          </button>
          <button
            onClick={() => setHistoryModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-purple-700 transition-colors shadow-sm text-xs"
          >
            <History className="w-4 h-4" />
            HISTÓRICO
          </button>
          <button
            onClick={handleLimpar}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl hover:bg-slate-300 transition-colors shadow-sm text-xs"
          >
            <RotateCcw className="w-4 h-4" />
            LIMPAR
          </button>
        </div>

        {/* Display Schedule Results */}
        <div id="displayResultado" className="space-y-6">
          {!gerado && (
            <div className="text-center text-slate-500 dark:text-slate-400 py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#003366] dark:text-blue-400" />
              <p className="font-bold text-sm">Informe a quantidade de ternos e clique em "Gerar Escala" ou selecione um PDF.</p>
            </div>
          )}

          {escala && escala.totalNecessario > escala.totalDisponivel && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 p-4 mb-6 rounded-r-xl">
              <p className="text-rose-700 dark:text-rose-300 font-bold text-sm">
                AVISO: Faltam operadores para completar a escala (Disponíveis: {escala.totalDisponivel}).
              </p>
            </div>
          )}

          {escala?.resultado.map((berco, bIdx) => (
            <div key={bIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <h3 className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 text-lg font-bold text-[#003366] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {berco.nome}
                </span>
                {navios[berco.nome] && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                      🚢 {navios[berco.nome]}
                    </span>
                  </div>
                )}
              </h3>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {berco.ternos.map((terno: any, tIdx: number) => {
                  const ternoId = `${berco.nome}-${terno.num}`;
                  const vinculoInfo = escala.infoVinculos[ternoId];
                  const isOrigem = !!vinculos[ternoId];
                  const isDestino = vinculoInfo && vinculoInfo.startsWith('Vem de');
                  
                  return (
                    <div
                      key={tIdx}
                      className={`border-l-4 p-4 rounded-xl shadow-sm relative group transition-all ${
                        terno.incompleto 
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20' 
                          : (isOrigem || isDestino)
                            ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' 
                            : 'border-emerald-500 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex flex-col">
                          <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            TERNO {terno.num}
                          </span>
                          {terno.operadores.some((o: any) => o.isAbsent) && (
                            <span className={`text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 mt-0.5 ${
                              terno.incompleto ? 'text-rose-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${terno.incompleto ? 'bg-rose-500' : 'bg-emerald-600'}`}></span>
                              {terno.incompleto ? 'PRECISA DE OPERADOR' : 'SUBSTITUIÇÃO EFETUADA'}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 print:hidden">
                          {isOrigem ? (
                            <button
                              onClick={() => handleRemoveVinculo(ternoId)}
                              className="p-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                              title="Remover Vínculo"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : !isDestino && (
                            <div className="relative">
                              <button
                                onClick={() => setMenuAberto(menuAberto === ternoId ? null : ternoId)}
                                className={`p-1 rounded-lg transition-colors ${
                                  menuAberto === ternoId ? 'bg-slate-200 text-[#003366]' : 'text-slate-400 hover:bg-slate-200 hover:text-[#003366]'
                                }`}
                                title="Vincular a outro berço"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              
                              {menuAberto === ternoId && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(null)} />
                                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl z-50 w-48 p-2 text-xs print:hidden">
                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase px-1">Vincular para:</p>
                                    {configBercos.filter(b => b.nome !== berco.nome).map(b => (
                                      <div key={b.id} className="mb-2 last:mb-0 border-t border-slate-100 dark:border-slate-700 pt-1">
                                        <p className="text-[9px] font-bold text-[#003366] dark:text-blue-400 px-1">{b.nome}</p>
                                        <div className="grid grid-cols-5 gap-1 mt-1">
                                          {[1, 2, 3, 4, 5].map((num) => {
                                            const isBooked = Object.values(vinculos).some((v: any) => v.paraBerco === b.nome && v.paraTerno === num);
                                            return (
                                              <button
                                                key={num}
                                                disabled={isBooked}
                                                onClick={() => handleAddVinculo(ternoId, b.nome, num)}
                                                className={`text-[10px] p-1 rounded-lg text-center transition-colors font-bold ${
                                                  isBooked 
                                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-[#003366] hover:text-white'
                                                }`}
                                              >
                                                T{num}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {vinculoInfo && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                            isOrigem ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            <ArrowRightLeft className="w-3 h-3" /> {vinculoInfo}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        {terno.operadores.map((op: Operador & { isAbsent?: boolean; isManual?: boolean; isDismissed?: boolean; isCondicionado?: boolean; replacingName?: string; replacingMat?: string }) => (
                          <div 
                            key={op.mat} 
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOperatorMenu({
                                ternoId: ternoId,
                                op: op,
                                x: rect.left,
                                y: rect.bottom + window.scrollY
                              });
                            }}
                            className={`flex items-center gap-2 text-xs p-1.5 rounded-lg cursor-pointer transition-colors ${
                              op.isAbsent 
                                ? 'bg-rose-50/50 text-rose-500 dark:text-rose-400' 
                                : op.isDismissed
                                  ? 'bg-emerald-50/50 text-emerald-600'
                                  : op.isCondicionado
                                    ? 'bg-amber-50/50 text-amber-700 dark:text-amber-300'
                                    : (op as any).isManual 
                                      ? 'bg-emerald-50/50 text-emerald-700 dark:text-emerald-300 font-bold' 
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                            }`}
                            title="Clique para opções de operador"
                          >
                            <span className={`font-mono font-bold w-10 shrink-0 ${
                              op.isAbsent ? 'text-rose-300 line-through' : op.isDismissed ? 'text-emerald-300 line-through' : op.isCondicionado ? 'text-amber-500' : (op as any).isManual ? 'text-emerald-600' : 'text-[#003366] dark:text-blue-400'
                            }`}>
                              {op.mat}
                            </span>
                            <span className={`truncate flex-1 ${
                              op.isAbsent 
                                ? 'line-through italic opacity-70' 
                                : op.isDismissed
                                  ? 'line-through italic opacity-70'
                                  : op.isCondicionado
                                    ? 'italic'
                                    : (op as any).isManual 
                                      ? 'font-bold' 
                                      : ''
                            }`}>
                              {op.nome}
                              {op.isCondicionado && (
                                <span className="text-[8px] px-1 rounded ml-1 font-bold bg-amber-100 text-amber-800">
                                  COND.
                                </span>
                              )}
                              {(op as any).isManual && !op.isCondicionado && (
                                <span className={`text-[8px] px-1 rounded ml-1 font-bold ${
                                  (op as any).replacingName 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {(op as any).replacingName ? `SUBST. ${(op as any).replacingName.split(' ')[0]}` : 'SUBST.'}
                                </span>
                              )}
                            </span>
                            <MoreVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
                          </div>
                        ))}
                        {terno.operadores.filter((o: any) => !o.isAbsent).length === 0 && (
                          <span className="text-xs text-rose-500 italic block mt-1">Sem operadores ativos</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Standby Section */}
          {escala && escala.standby.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <h3 className="bg-slate-100 dark:bg-slate-800 px-6 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span>STANDBY (Disponíveis)</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full font-bold">{escala.standby.length} pessoas</span>
              </h3>
              <div className="bg-blue-50/50 dark:bg-blue-950/30 px-6 py-2 border-b border-blue-100 dark:border-blue-900/40">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium italic">
                  * Os primeiros da lista ficam de reserva/reforço operacional.
                </p>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {escala.standby.map((op: any) => (
                  <div 
                    key={op.mat} 
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setOperatorMenu({
                        ternoId: 'standby',
                        op: op,
                        x: rect.left,
                        y: rect.bottom + window.scrollY
                      });
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-xs cursor-pointer transition-all"
                  >
                    <span className="font-mono font-bold w-9 shrink-0 text-[#003366] dark:text-blue-400">{op.mat}</span>
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-300 font-medium">{op.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Absences Section */}
          {escala && escala.absent.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl overflow-hidden shadow-sm">
              <h3 className="bg-rose-50 dark:bg-rose-950/40 px-6 py-3 text-sm font-bold text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900/40 flex justify-between items-center">
                <span>Faltas Confirmadas (Neste Turno)</span>
                <span className="text-xs bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full font-bold">{escala.absent.length} pessoas</span>
              </h3>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {escala.absent.map((op: any) => (
                  <div key={op.mat} className="flex flex-col gap-1 p-2.5 bg-rose-50/30 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 text-xs">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                      <span className="font-mono">{op.mat}</span>
                      <span className="truncate line-through opacity-70">{op.nome}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable Section */}
          {escala && escala.unavailable.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <h3 className="bg-slate-50 dark:bg-slate-800 px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span>Indisponíveis (Férias / Atestados)</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full font-bold">{escala.unavailable.length} pessoas</span>
              </h3>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {escala.unavailable.map((op: Operador) => (
                  <div key={op.mat} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-400">
                    <span className="font-mono font-bold w-9 shrink-0">✖ {op.mat}</span>
                    <span className="truncate line-through opacity-70">{op.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* History Modal */}
        {historyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="bg-[#003366] p-4 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Escalas Salvas
                </h3>
                <button 
                  onClick={() => setHistoryModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                {/* Date Filter Bar */}
                <div className="mb-4 flex flex-col sm:flex-row gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex-1 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <input 
                      type="text" 
                      placeholder="Filtrar por data (ex: 24/07/2026)..."
                      value={historyFilterDate}
                      onChange={(e) => setHistoryFilterDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="w-full sm:w-44">
                    <select
                      value={historyFilterTurno}
                      onChange={(e) => setHistoryFilterTurno(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">Todos os Turnos</option>
                      {turnosDisponiveis.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {(historyFilterDate || historyFilterTurno) && (
                    <button
                      onClick={() => { setHistoryFilterDate(''); setHistoryFilterTurno(''); }}
                      className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 rounded-lg hover:bg-rose-100 transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">Nenhuma escala salva no histórico ainda.</p>
                  </div>
                ) : groupedHistoryByDate.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <p className="font-bold">Nenhuma escala encontrada com os filtros selecionados.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedHistoryByDate.map(([dateGroup, items]) => (
                      <div key={dateGroup} className="space-y-3">
                        <div className="flex items-center gap-2 border-b-2 border-blue-600/30 dark:border-blue-500/30 pb-2">
                          <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="font-black text-sm text-[#003366] dark:text-blue-300">
                            Escalas do Dia: <span className="text-blue-600 dark:text-blue-400">{dateGroup}</span>
                          </h4>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 rounded-full font-bold ml-auto">
                            {items.length} {items.length === 1 ? 'escala' : 'escalas'}
                          </span>
                        </div>

                        <div className="space-y-3 pl-2">
                          {items.map((entry: any) => (
                            <div 
                              key={String(entry.id)}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-4 transition-all hover:border-blue-300 dark:hover:border-blue-700"
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded-lg text-blue-700 dark:text-blue-300 shrink-0">
                                    <Clock className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="font-black text-[#003366] dark:text-blue-400 text-sm">Turno: {entry.turno}</h5>
                                    <p className="text-xs text-slate-400 mt-0.5">Salvo em {new Date(entry.timestamp).toLocaleString('pt-BR')}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                                    {entry.b1 || 0} B1 | {entry.b2 || 0} B2 | {entry.b3 || 0} B3
                                  </span>
                                  <button
                                    onClick={() => deleteFromHistory(entry.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors ml-2"
                                    title="Apagar Histórico"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                                <button
                                  onClick={() => loadFromHistory(entry, 'config')}
                                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  COPIAR TERNOS
                                </button>
                                <button
                                  onClick={() => loadFromHistory(entry, 'data')}
                                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  COPIAR DISPONÍVEIS
                                </button>
                                <button
                                  onClick={() => {
                                    loadFromHistory(entry, 'all');
                                    setHistoryModalOpen(false);
                                  }}
                                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  CARREGAR ESCALA
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Drawer */}
        {statsDrawerOpen && (
          <>
            <div 
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 print:hidden"
              onClick={() => setStatsDrawerOpen(false)}
            />
            <div className="fixed top-0 right-0 h-full w-[360px] max-w-full bg-white dark:bg-slate-800 shadow-2xl z-[110] flex flex-col print:hidden">
              <div className="bg-[#003366] p-4 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  <BarChart2 className="w-5 h-5" />
                  Estatísticas da Escala
                </h3>
                <button 
                  onClick={() => setStatsDrawerOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 mb-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 p-2.5 rounded-xl text-center font-medium">
                  Relatório baseado em {history.length} escalas salvas.
                </p>

                <div className="space-y-3">
                  {historyStatsData.slice(0, 50).map((stat: any, index: number) => {
                    const totalWorked = stat.worked + stat.subIn;
                    if (totalWorked === 0 && stat.condicionado === 0) return null;
                    
                    return (
                      <div key={stat.mat} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div>
                            <h4 className="font-bold text-[#003366] dark:text-blue-400 text-xs">
                              #{index + 1} {stat.fullName}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{stat.mat}</span>
                          </div>
                          <div className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {totalWorked} turnos
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Operator Context Menu */}
        {operatorMenu && (
          <>
            <div 
              className="fixed inset-0 z-[110]" 
              onClick={() => setOperatorMenu(null)}
            />
            <div 
              className="fixed z-[120] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl w-60 p-1.5 animate-in fade-in duration-150 print:hidden text-xs"
              style={{ 
                left: Math.min(operatorMenu.x, window.innerWidth - 250), 
                top: Math.min(operatorMenu.y, window.innerHeight - 250) 
              }}
            >
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 mb-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Opções para:</p>
                <p className="text-xs font-bold text-[#003366] dark:text-blue-400 truncate">{operatorMenu.op.nome}</p>
              </div>

              <button
                onClick={() => {
                  toggleOperatorDismissal(operatorMenu.op.mat);
                  setOperatorMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
              >
                <UserCheck className="w-4 h-4 text-emerald-500" /> Dispensar Operador
              </button>

              <button
                onClick={() => {
                  toggleOperatorCondicionado(operatorMenu.op.mat);
                  setOperatorMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
              >
                <AlertCircle className="w-4 h-4 text-amber-500" />
                {condicionadoMats.includes(operatorMenu.op.mat) ? 'Limpar Condicionado' : 'Marcar Condicionado'}
              </button>

              {operatorMenu.ternoId !== 'standby' && (
                <button
                  onClick={() => {
                    toggleOperatorAbsence(operatorMenu.op.mat);
                    setOperatorMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <UserX className="w-4 h-4 text-rose-500" />
                  {absentMats.includes(operatorMenu.op.mat) ? 'Limpar Falta' : 'Marcar Falta / Atestado'}
                </button>
              )}

              {operatorMenu.ternoId !== 'standby' && (operatorMenu.op as any).isManual && (
                <button
                  onClick={() => {
                    unassignFromTerno(operatorMenu.op.mat, operatorMenu.ternoId);
                    setOperatorMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" /> Remover Substituição
                </button>
              )}

              {operatorMenu.ternoId === 'standby' && (
                <button
                  onClick={() => {
                    const idx = OPERADORES_INICIAIS.findIndex(o => o.mat === operatorMenu.op.mat);
                    if (idx !== -1) {
                      setIndexInicio(idx);
                      if (!gerado) setGerado(true);
                    }
                    setOperatorMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border-t border-slate-100 dark:border-slate-700 mt-1"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Definir como 1º da Escala
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
