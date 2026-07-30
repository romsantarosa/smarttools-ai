import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BtpShipRecord, BtpSummaryResponse } from '../types';
import { safeFetchJson } from '../utils/apiUtils';
import {
  Ship,
  Anchor,
  Clock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Database,
  ExternalLink,
  Code,
  Copy,
  Check,
  Download,
  Server,
  ArrowRightLeft,
  Navigation,
  FileText,
  UploadCloud,
  X,
  Plus,
  Key,
  Edit3,
  Sliders,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AtracacaoSaida: React.FC = () => {
  const { saveBerthTurnUpdate, berthTurnUpdates } = useApp();
  const navigate = useNavigate();

  const [data, setData] = useState<BtpSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'atracados' |
'previstas' |
'andamento' |
'confirmadas' |
'encerradas' |
'fundeados' |
'api'
>('atracados');
  const [berthFilter, setBerthFilter] = useState<'Todos' | 'BTP-1' | 'BTP-2' | 'BTP-3'>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync / Import Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'paste' | 'manual' | 'credentials'>('paste');
  const [rawPastedText, setRawPastedText] = useState<string>('');
  const [parsingLoading, setParsingLoading] = useState<boolean>(false);

  // Credentials State
  const [sppUser, setSppUser] = useState<string>(localStorage.getItem('SPP_USER') || '');
  const [sppPassword, setSppPassword] = useState<string>(localStorage.getItem('SPP_PASSWORD') || '');

  // Manual Ship Form State
  const [manualShip, setManualShip] = useState<Partial<BtpShipRecord>>({
    imo: '',
    navio: '',
    mv: '',
    berco: 'BTP-1',
    horario: '12:00',
    data: new Date().toISOString().split('T')[0],
    movimento: 'Atracado',
    situacao: 'Operando',
    agencia: '',
    pratico: '',
  });

  // Fetch BTP Data from SMARTTOOLS API
  const fetchBtpData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRefresh ? '/api/btp/resumo?refresh=true' : '/api/btp/resumo';
      const json = await safeFetchJson<BtpSummaryResponse>(url);

const normalize = (ships: any[] = []) =>
  ships.map(ship => ({
    ...ship,
    berco: ship.berco || ship.loc1 || ship.loc2,
    horario: ship.horario || ship.passagem,
    data: ship.data || ship.pob,
    situacao: ship.situacao || 'Operando',
  }));

json.atracados = normalize(json.atracados);
json.previstas = normalize(json.previstas);
json.andamento = normalize(json.andamento);
json.confirmadas = normalize(json.confirmadas);
json.encerradas = normalize(json.encerradas);
json.movimentos = normalize(json.movimentos);
json.fundeados = normalize(json.fundeados);
      console.log("JSON DA API:", json);

      // Check if local override exists in localStorage
      const storedData = localStorage.getItem('BTP_CUSTOM_REAL_DATA');
      if (storedData) {
        try {
          const parsedLocal = JSON.parse(storedData);
          setData({
            ...json,
            atracados: parsedLocal.atracados || json.atracados,
            previstas: parsedLocal.previstas || json.previstas,
            movimentos: parsedLocal.movimentos || json.movimentos,
            fundeados: parsedLocal.fundeados || json.fundeados,
            isMockData: false,
          });
        } catch {
          console.log("ATRACADOS:", json.atracados.length);
console.log("PREVISTAS:", json.previstas.length);
console.log("MOVIMENTOS:", json.movimentos.length);
          setData(json);
        }
      } else {
        setData(json);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados BTP:', err);
      setError(err?.message || 'Não foi possível conectar à SMARTTOOLS API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBtpData();
    const interval = setInterval(() => {
      fetchBtpData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Submit Pasted Text from SPPilots
  const handleParseTextSubmit = async () => {
    if (!rawPastedText.trim()) {
      alert('Por favor, cole o texto da tabela do site SPPilots.');
      return;
    }
    setParsingLoading(true);
    try {
      const resJson = await safeFetchJson<{ success: boolean; error?: string; updated?: any }>('/api/btp/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawPastedText }),
      });
      if (resJson.success && resJson.updated) {
        localStorage.setItem('BTP_CUSTOM_REAL_DATA', JSON.stringify(resJson.updated));
        setData({
          atracados: resJson.updated.atracados || [],
          previstos: resJson.updated.previstos || [],
          movimentos: resJson.updated.movimentos || [],
          fundeados: resJson.updated.fundeados || [],
          timestamp: new Date().toISOString(),
          cacheTimeRemainingSeconds: 300,
          isMockData: false,
        });
        setNotification('Tabela da SPPilots processada e atualizada em tempo real!');
        setIsSyncModalOpen(false);
        setRawPastedText('');
      } else {
        alert(resJson.error || 'Não foi possível processar o texto colado.');
      }
    } catch (err: any) {
      alert('Erro ao processar: ' + err.message);
    } finally {
      setParsingLoading(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Submit Manual Ship Addition
  const handleAddManualShip = async () => {
    if (!manualShip.navio || !manualShip.imo) {
      alert('Por favor, preencha o Nome do Navio e o IMO.');
      return;
    }

    const newRecord: BtpShipRecord = {
      imo: manualShip.imo,
      navio: manualShip.navio.toUpperCase(),
      mv: manualShip.mv || `MV-${Math.floor(1000 + Math.random() * 9000)}`,
      movimento: manualShip.movimento || 'Atracado',
      berco: manualShip.berco || 'BTP-1',
      horario: manualShip.horario || '12:00',
      data: manualShip.data || new Date().toISOString().split('T')[0],
      situacao: manualShip.situacao || 'Operando',
      agencia: manualShip.agencia || 'Agência SPPilots',
      pratico: manualShip.pratico || 'Praticagem Santos',
      loc1: manualShip.berco || 'BTP-1',
      loc2: '-',
    };

    const currentAtracados = data?.atracados || [];
    const currentPrevistas = data?.previstas || [];
    const currentMovimentos = data?.movimentos || [];
    const currentFundeados = data?.fundeados || [];

    let updatedAtracados = [...currentAtracados];
    let updatedPrevistas = [...currentPrevistas];
    let updatedMovimentos = [...currentMovimentos];
    let updatedFundeados = [...currentFundeados];

    if (newRecord.movimento === 'Atracado') {
      updatedAtracados = [newRecord, ...updatedAtracados];
    } else if (newRecord.movimento === 'Atracação' || newRecord.movimento === 'Previsto') {
      updatedPrevistas = [newRecord, ...updatedPrevistas];
    } else if (newRecord.movimento === 'Fundeado') {
      updatedFundeados = [newRecord, ...updatedFundeados];
    } else {
      updatedMovimentos = [newRecord, ...updatedMovimentos];
    }

    const updatedObj = {
      atracados: updatedAtracados,
      previstas: updatedPrevistas,
      movimentos: updatedMovimentos,
      fundeados: updatedFundeados,
};

    localStorage.setItem('BTP_CUSTOM_REAL_DATA', JSON.stringify(updatedObj));
    
    // Sync with backend
    await safeFetchJson('/api/btp/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedObj),
    });

    setData({
  atracados: updatedAtracados,
  previstas: updatedPrevistas,
  movimentos: updatedMovimentos,
  fundeados: updatedFundeados,
  timestamp: new Date().toISOString(),
  cacheTimeRemainingSeconds: 300,
  isMockData: false,
});

    setNotification(`Navio ${newRecord.navio} inserido na tabela da SPPilots!`);
    setIsSyncModalOpen(false);
    setTimeout(() => setNotification(null), 4000);
  };

  // Save Credentials
  const handleSaveCredentials = () => {
    localStorage.setItem('SPP_USER', sppUser);
    localStorage.setItem('SPP_PASSWORD', sppPassword);
    setNotification('Credenciais do portal SPPilots salvas para sincronização automática!');
    setIsSyncModalOpen(false);
    setTimeout(() => setNotification(null), 4000);
  };

  // Reset to Default Data
  const handleResetData = async () => {
    localStorage.removeItem('BTP_CUSTOM_REAL_DATA');
    await fetchBtpData(true);
    setNotification('Dados redefinidos para estado vazio.');
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter helper
  const filterRecords = (records: BtpShipRecord[] = []) => {
    return records.filter(item => {
      const berth = item.berco || item.loc1 || item.loc2 || '';

const matchBerth =
  berthFilter === 'Todos' ||
  berth.toUpperCase().includes(berthFilter.toUpperCase());

      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        searchTerm === '' ||
        (item.navio || '').toLowerCase().includes(searchLower) ||
        (item.imo || '').toLowerCase().includes(searchLower) ||
        (item.mv || '').toLowerCase().includes(searchLower) ||
        (item.agencia || '').toLowerCase().includes(searchLower);

      return matchBerth && matchSearch;
    });
  };

  const filteredAtracados = useMemo(() => filterRecords(data?.atracados), [data, berthFilter, searchTerm]);
  const filteredPrevistas = useMemo(() => filterRecords(data?.previstas), [data, berthFilter, searchTerm]);
  const filteredMovimentos = useMemo(() => filterRecords(data?.movimentos), [data, berthFilter, searchTerm]);
  const filteredFundeados = useMemo(() => filterRecords(data?.fundeados), [data, berthFilter, searchTerm]);

  // Quick action: Assign Ship from Atracados to Escala BTP
  const handleAssignToEscala = (ship: BtpShipRecord) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentTurn = '07-13'; // Default active turn
    const targetBerthMap: Record<string, 'Ponto 1' | 'Ponto 2' | 'Ponto 3'> = {
      'BTP-1': 'Ponto 1',
      'BTP-2': 'Ponto 2',
      'BTP-3': 'Ponto 3',
    };
    const targetBerth = targetBerthMap[ship.berco] || 'Ponto 1';

    const existing = berthTurnUpdates.find(
      u => u.date === todayStr && u.turn === currentTurn && u.berth === targetBerth
    );

    if (existing) {
      saveBerthTurnUpdate({
        ...existing,
        shipName: ship.navio,
        observations: `${existing.observations || ''} | Sincronizado via SMARTTOOLS API (IMO: ${ship.imo}, MV: ${ship.mv || 'N/A'})`,
      });
    } else {
      saveBerthTurnUpdate({
        date: todayStr,
        turn: currentTurn,
        berth: targetBerth,
        shipName: ship.navio,
        numTernos: 2,
        gangs: [
          { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
          { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
        ],
        totalMaterials: 0,
        observations: `Sincronizado via SMARTTOOLS API (IMO: ${ship.imo}, MV: ${ship.mv || 'N/A'})`,
        updatedBy: 'Operador BTP API',
      });
    }

    setNotification(`Navio ${ship.navio} vinculado ao ${targetBerth} na Escala BTP!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const copyToClipboard = (text: string, endpointKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpointKey);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const splitDateTime = (value?: string): { date?: string; time?: string } => {
    if (!value) return {};
    const normalized = value.trim().replace(/\s+/g, ' ');
    const brMatch = normalized.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?/);
    if (brMatch) {
      return { date: brMatch[1], time: brMatch[2] };
    }

    const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2})(?::\d{2})?)?/);
    if (isoMatch) {
      return { date: isoMatch[1], time: isoMatch[2] };
    }

    return {};
  };

  const hasDateOrTime = (value?: string): boolean => Boolean(value && value.trim() && value.trim() !== '-');

  const readDateTimeFromRecord = (record: BtpShipRecord | Record<string, any>): { date?: string; time?: string } => {
    const rec: Record<string, any> = record as Record<string, any>;

    const directDate =
      rec.data ||
      rec.pob ||
      rec.dataatracacao ||
      rec.dataAtracacao ||
      rec.datachegada ||
      rec.atracacaoData ||
      rec.etbDate ||
      '';

    const directTime =
      rec.horario ||
      rec.passagem ||
      rec.horaatracacao ||
      rec.horaAtracacao ||
      rec.horachegada ||
      rec.atracacaoHora ||
      rec.etbTime ||
      '';

    const combinedSource =
      rec.atracacao ||
      rec.datahoraatracacao ||
      rec.dataHoraAtracacao ||
      rec.etb ||
      '';

    const parsedCombined = splitDateTime(typeof combinedSource === 'string' ? combinedSource : '');

    return {
      date: directDate || parsedCombined.date,
      time: directTime || parsedCombined.time,
    };
  };

  const resolveRecordDateTime = (ship: BtpShipRecord): { date: string; time: string } => {
    const ownDateTime = readDateTimeFromRecord(ship);
    if (hasDateOrTime(ownDateTime.date) || hasDateOrTime(ownDateTime.time)) {
      return {
        date: ownDateTime.date || '-',
        time: ownDateTime.time || '-',
      };
    }

    const allRecords: BtpShipRecord[] = [
      ...(data?.movimentos || []),
      ...(data?.andamento || []),
      ...(data?.confirmadas || []),
      ...(data?.encerradas || []),
      ...(data?.previstas || []),
      ...(data?.atracados || []),
      ...(data?.fundeados || []),
    ];

    const targetImo = (ship.imo || '').trim().toUpperCase();
    const targetNavio = (ship.navio || '').trim().toUpperCase();

    const candidates = allRecords.filter((record) => {
      const recImo = (record.imo || '').trim().toUpperCase();
      const recNavio = (record.navio || '').trim().toUpperCase();
      const sameShip = (targetImo && recImo === targetImo) || (targetNavio && recNavio === targetNavio);

      if (!sameShip) {
        return false;
      }

      const dateTime = readDateTimeFromRecord(record);
      return hasDateOrTime(dateTime.date) || hasDateOrTime(dateTime.time);
    });

    const candidate = candidates
      .map((record) => {
        const dateTime = readDateTimeFromRecord(record);
        const recMov = (record.movimento || '').toUpperCase();

        let score = 0;
        if (/ATRAC/.test(recMov)) score += 40;
        if (/ENTRADA|CHEGADA/.test(recMov)) score += 25;
        if (/OPERANDO/.test(recMov)) score += 15;
        if (hasDateOrTime(dateTime.date)) score += 10;
        if (hasDateOrTime(dateTime.time)) score += 10;

        const parsed = splitDateTime(`${dateTime.date || ''} ${dateTime.time || ''}`.trim());
        const timestamp = parsed.date
          ? new Date(`${parsed.date.includes('/') ? parsed.date.split('/').reverse().join('-') : parsed.date}T${parsed.time || '00:00'}:00`).getTime()
          : 0;

        return { record, dateTime, score, timestamp: Number.isNaN(timestamp) ? 0 : timestamp };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.timestamp - a.timestamp;
      })[0];

    if (candidate) {
      const candidateDateTime = candidate.dateTime;
      return {
        date: candidateDateTime.date || '-',
        time: candidateDateTime.time || '-',
      };
    }

    return { date: '-', time: '-' };
  };

  // Export JSON Report
  const exportJsonReport = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smarttools-btp-resumo-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                SMARTTOOLS API v2.0 • SPPilots
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Sincronização operacional ativa
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Navigation className="w-8 h-8 text-blue-400" />
              <span>Atracação / Saída de Navios (BTP)</span>
            </h1>

            <p className="text-[11px] sm:text-xs text-slate-300 max-w-3xl font-medium leading-relaxed">
              Painel operacional de navios nos berços <span className="font-bold text-white">BTP-1, BTP-2 e BTP-3</span>.
              Sincronize ou cole diretamente os dados oficiais do portal de praticagem <span className="text-amber-300 font-bold">sppilots.com.br</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Colar / Sincronizar SPPilots</span>
            </button>
            <button
              onClick={() => fetchBtpData(true)}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar API</span>
            </button>
            <button
              onClick={exportJsonReport}
              disabled={!data}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar JSON</span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-[11px] font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
            <Anchor className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Atracados BTP</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {data?.atracados?.length || 0} Navios
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Previstos</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {data?.previstas?.length || 0} Manobras
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Movimentos</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {data?.movimentos?.length || 0} Registros
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Próx. Refresh</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
              {data?.cacheRemainingSeconds ? `${Math.floor(data.cacheRemainingSeconds / 60)}m ${data.cacheRemainingSeconds % 60}s` : '300s'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por navio, IMO (ex: 9845321), MV ou Agência..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Berth Filter Chips & Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Berço BTP:
              </span>
              {(['Todos', 'BTP-1', 'BTP-2', 'BTP-3'] as const).map(berth => (
                <button
                  key={berth}
                  onClick={() => setBerthFilter(berth)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    berthFilter === berth
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {berth}
                </button>
              ))}
            </div>

            {data && (
              <button
                onClick={handleResetData}
                title="Redefinir para estado vazio"
                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 hover:text-rose-600 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
              >
                Resetar
              </button>
            )}
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('atracados')}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'atracados'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Anchor className="w-4 h-4" />
            <span>Navios Atracados ({filteredAtracados.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('previstas')}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'previstas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Manobras Previstas ({filteredPrevistas.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('movimentos')}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'movimentos'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Movimentos ({filteredMovimentos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fundeados')}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'fundeados'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Ship className="w-4 h-4" />
            <span>Fundeados Barra ({filteredFundeados.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-2 cursor-pointer ml-auto ${
              activeTab === 'api'
                ? 'bg-slate-900 text-amber-400 dark:bg-slate-800 shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Code className="w-4 h-4 text-amber-400" />
            <span>SMARTTOOLS API JSON</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
          <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
            Conectando ao portal SPPilots e extraindo tabela BTP...
          </p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h4 className="font-extrabold text-rose-800 dark:text-rose-200 text-sm">Falha na integração com o portal</h4>
          <p className="text-[11px] text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchBtpData(true)}
            className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-[11px] cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: Navios Atracados */}
          {activeTab === 'atracados' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
                <span>Navios atualmente amarrados e operando nos berços BTP</span>
                <span className="flex items-center gap-2">
                  <span>Total: {filteredAtracados.length} navios</span>
                  <button
                    onClick={() => {
                      setModalTab('manual');
                      setIsSyncModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Navio
                  </button>
                </span>
              </div>

              {filteredAtracados.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {filteredAtracados.map((ship, idx) => (
                    (() => {
                      const atracacao = resolveRecordDateTime(ship);
                      return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-blue-500 transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs">
                            {ship.berco || ship.loc1 || ship.loc2}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                            ● {ship.status || ship.situacao || 'Operando'}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                            {ship.navio}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
                            <span>IMO: {ship.imo}</span>
                            {ship.mv && <span>• MV: {ship.mv}</span>}
                          </div>
                        </div>

<div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-[11px]">

  <div className="flex items-center justify-between">
    <span className="text-slate-400 font-semibold">📅 Atracação no berço:</span>
    <span className="font-bold text-slate-900 dark:text-white font-mono">
      {atracacao.date}
    </span>
  </div>

  <div className="flex items-center justify-between">
    <span className="text-slate-400 font-semibold">🕒 Hora da atracação:</span>
    <span className="font-bold text-slate-900 dark:text-white font-mono">
      {atracacao.time}
    </span>
  </div>

  {ship.agencia && (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 font-semibold">Agência:</span>
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {ship.agencia}
      </span>
    </div>
  )}

  {ship.pratico && (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 font-semibold">Prático:</span>
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {ship.pratico}
      </span>
    </div>
  )}

</div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleAssignToEscala(ship)}
                          className="w-full py-2 bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Anchor className="w-3.5 h-3.5" />
                          <span>Vincular à Escala BTP do Turno</span>
                        </button>
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-[11px]">
                  Nenhum navio atracado encontrado para os filtros selecionados.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Manobras Previstas */}
          {activeTab === 'previstos' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3">IMO</th>
                        <th className="p-3">NAVIO</th>
                        <th className="p-3">MV</th>
                        <th className="p-3">MOVIMENTO</th>
                        <th className="p-3">BERÇO BTP</th>
                        <th className="p-3">HORÁRIO / DATA</th>
                        <th className="p-3">SITUAÇÃO</th>
                        <th className="p-3">AGÊNCIA / PRÁTICO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                      {filteredPrevistas.map((ship, idx) => {
                        const previstoDateTime = resolveRecordDateTime(ship);
                        return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-slate-500">{ship.imo}</td>
                          <td className="p-3 font-black text-slate-900 dark:text-white">{ship.navio}</td>
                          <td className="p-3 font-mono text-slate-400">{ship.mv || '-'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                              {ship.movimento}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-white">
                              {ship.berco}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            {previstoDateTime.time} ({previstoDateTime.date})
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                              {ship.situacao || ship.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {ship.agencia} • {ship.pratico}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Movimentos de Navios */}
          {activeTab === 'movimentos' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3.5">IMO</th>
                      <th className="p-3.5">NAVIO</th>
                      <th className="p-3.5">MV</th>
                      <th className="p-3.5">MOVIMENTO</th>
                      <th className="p-3.5">LOC #1 → LOC #2</th>
                      <th className="p-3.5">HORÁRIO / DATA</th>
                      <th className="p-3.5">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                    {filteredMovimentos.map((item, idx) => {
                      const movimentoDateTime = resolveRecordDateTime(item);
                      return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3.5 font-mono text-slate-500">{item.imo}</td>
                        <td className="p-3.5 font-black text-slate-900 dark:text-white">{item.navio}</td>
                        <td className="p-3.5 font-mono text-slate-400">{item.mv || '-'}</td>
                        <td className="p-3.5 font-bold text-blue-600 dark:text-blue-400">{item.movimento}</td>
                        <td className="p-3.5 font-mono text-[11px]">
                          {item.loc1 || item.berco} → {item.loc2 || '-'}
                        </td>
                        <td className="p-3.5 font-mono">
                          {movimentoDateTime.time} ({movimentoDateTime.date})
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Navios Fundeados */}
          {activeTab === 'fundeados' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFundeados.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black text-xs rounded-lg">
                      FUNDEADO NA BARRA
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">IMO: {item.imo}</span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">{item.navio}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Destino programado: <span className="font-bold text-slate-700 dark:text-slate-200">{item.berco}</span>
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs space-y-1">
                    <p className="text-slate-500 font-bold">Localização no Fondeadeiro:</p>
                    <p className="font-mono text-slate-900 dark:text-white font-extrabold">{item.loc1}</p>
                    <p className="text-amber-600 dark:text-amber-400 font-bold mt-1">Status: {item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: SMARTTOOLS API Documentation & JSON */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-base text-amber-400 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    <span>Documentação REST Endpoints • SMARTTOOLS API</span>
                  </h3>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono text-xs rounded-lg font-bold">
                    HTTP 200 OK
                  </span>
                </div>

                <p className="text-xs text-slate-300 font-medium">
                  A SMARTTOOLS API disponibiliza os dados filtrados em formato JSON estruturado.
                  O servidor backend executa cache automático de 5 minutos (300 segundos).
                </p>

                {/* List of endpoints */}
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/btp/resumo', desc: 'Resumo completo (atracados, previstos, movimentos, fundeados)' },
                    { method: 'GET', path: '/btp/atracados', desc: 'Lista de navios atracados nos berços BTP-1, BTP-2, BTP-3' },
                    { method: 'GET', path: '/btp/previstos', desc: 'Manobras de entrada e saída previstas para os berços BTP' },
                    { method: 'GET', path: '/btp/movimentos', desc: 'Histórico recente de movimentações filtradas BTP' },
                    { method: 'GET', path: '/btp/fundeados', desc: 'Navios fundeados na barra aguardando atracação na BTP' },
                  ].map((ep, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-blue-600 font-mono font-black text-white rounded text-[10px]">
                          {ep.method}
                        </span>
                        <code className="text-amber-300 font-bold font-mono">{ep.path}</code>
                        <span className="text-slate-400 text-[11px] hidden sm:inline">{ep.desc}</span>
                      </div>

                      <button
                        onClick={() => copyToClipboard(window.location.origin + ep.path, ep.path)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedEndpoint === ep.path ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw JSON Code Viewer */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3 font-mono">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Raw Output JSON (/api/btp/resumo)</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(data, null, 2), 'raw_json')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedEndpoint === 'raw_json' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="text-[11px] text-emerald-400 max-h-96 overflow-y-auto scrollbar-thin p-3 bg-slate-900/60 rounded-xl">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* SPPILOTS SYNC / IMPORT MODAL */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Sincronizar com SPPilots Real</h3>
                  <p className="text-xs text-slate-300">Cole tabelas ou insira credenciais para espelhar login.sppilots.com.br</p>
                </div>
              </div>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 gap-2">
              <button
                onClick={() => setModalTab('paste')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  modalTab === 'paste'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Colar Tabela SPPilots
              </button>
              <button
                onClick={() => setModalTab('manual')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  modalTab === 'manual'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Adicionar Navio Manual
              </button>
              <button
                onClick={() => setModalTab('credentials')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  modalTab === 'credentials'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Credenciais SPP
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalTab === 'paste' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Acesse o site <a href="https://login.sppilots.com.br/servicos" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline">login.sppilots.com.br/servicos</a>, selecione e copie (Ctrl+C) a tabela de navios/manobras e cole no campo abaixo. Nosso extrator filtrará automaticamente os registros BTP.
                  </p>

                  <textarea
                    rows={8}
                    value={rawPastedText}
                    onChange={e => setRawPastedText(e.target.value)}
                    placeholder="Cole aqui o texto ou tabela copiado do site da SPPilots... Ex:&#10;9845321  MAERSK LETICIA  BTP-1  06:15  Atracado..."
                    className="w-full p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={handleParseTextSubmit}
                    disabled={parsingLoading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {parsingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    <span>Processar Tabela e Atualizar Tela</span>
                  </button>
                </div>
              )}

              {modalTab === 'manual' && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Nome do Navio *</label>
                    <input
                      type="text"
                      value={manualShip.navio}
                      onChange={e => setManualShip({ ...manualShip, navio: e.target.value })}
                      placeholder="Ex: MAERSK LISBOA"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">IMO *</label>
                    <input
                      type="text"
                      value={manualShip.imo}
                      onChange={e => setManualShip({ ...manualShip, imo: e.target.value })}
                      placeholder="Ex: 9845321"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Berço BTP *</label>
                    <select
                      value={manualShip.berco}
                      onChange={e => setManualShip({ ...manualShip, berco: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="BTP-1">BTP-1</option>
                      <option value="BTP-2">BTP-2</option>
                      <option value="BTP-3">BTP-3</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Status / Movimento</label>
                    <select
                      value={manualShip.movimento}
                      onChange={e => setManualShip({ ...manualShip, movimento: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="Atracado">Atracado</option>
                      <option value="Atracação">Atracação Prevista</option>
                      <option value="Entrada">Entrada / Movimento</option>
                      <option value="Fundeado">Fundeado na Barra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Horário (HH:mm)</label>
                    <input
                      type="text"
                      value={manualShip.horario}
                      onChange={e => setManualShip({ ...manualShip, horario: e.target.value })}
                      placeholder="Ex: 14:30"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Agência Marítima</label>
                    <input
                      type="text"
                      value={manualShip.agencia}
                      onChange={e => setManualShip({ ...manualShip, agencia: e.target.value })}
                      placeholder="Ex: Maersk / MSC"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div className="col-span-2 pt-2">
                    <button
                      onClick={handleAddManualShip}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Salvar Navio na Tabela BTP</span>
                    </button>
                  </div>
                </div>
              )}

              {modalTab === 'credentials' && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-600 dark:text-slate-300">
                    Insira o usuário e senha do portal Praticagem de Santos (<span className="font-bold">login.sppilots.com.br</span>). As credenciais são armazenadas em ambiente seguro no backend e utilizadas exclusivamente para requisições com cache.
                  </p>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Usuário SPPilots (SPP_USER)</label>
                    <input
                      type="text"
                      value={sppUser}
                      onChange={e => setSppUser(e.target.value)}
                      placeholder="Ex: usuario.btp@empresa.com.br"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Senha SPPilots (SPP_PASSWORD)</label>
                    <input
                      type="password"
                      value={sppPassword}
                      onChange={e => setSppPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <button
                    onClick={handleSaveCredentials}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>Salvar Credenciais</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
