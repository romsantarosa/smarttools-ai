import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Download,
  Copy,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Ship,
  Search,
  Filter,
} from 'lucide-react';

interface BtpScheduleRecord {
  navio: string;
  viagem: string;
  armador: string;
  berco: string;
  status: string;
  eta: string;
  etb: string;
  etd: string;
  datachegada: string;
  horachegada: string;
  dataatracacao: string;
  horaatracacao: string;
  datasaida: string;
  horasaida: string;
  operacao: string;
  terminal: string;
  [key: string]: string;
}

type SortDirection = 'asc' | 'desc';

const REFRESH_INTERVAL = 5 * 60 * 1000;

function getStatusClass(status: string): string {
  const key = status.toLowerCase();
  if (key.includes('desatracado')) return 'bg-green-200 text-green-900 border-green-400';
  if (key.includes('atracado')) return 'bg-orange-200 text-orange-900 border-orange-400';
  if (key.includes('na barra')) return 'bg-yellow-200 text-yellow-900 border-yellow-400';
  if (key.includes('previsto')) return 'bg-white text-slate-800 border-slate-400';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function hasValue(value?: string): boolean {
  return Boolean((value || '').trim());
}

function normalizeBercoLabel(value?: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const match = upper.match(/BTP\s*[- ]?([123])/);
  if (match) return `BTP ${match[1]}`;

  return raw;
}

function getDisplayBerco(record: BtpScheduleRecord): string {
  return normalizeBercoLabel(record.pontoAtracacao) || normalizeBercoLabel(record.berco) || '-';
}

function parsePortalDateTime(raw?: string): Date | null {
  const value = (raw || '').trim();
  if (!value) return null;

  // dd/MM/yyyy HH:mm(:ss)
  const brWithTime = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (brWithTime) {
    const day = Number(brWithTime[1]);
    const month = Number(brWithTime[2]);
    const year = Number(brWithTime[3]);
    const hours = Number(brWithTime[4]);
    const minutes = Number(brWithTime[5]);
    const seconds = Number(brWithTime[6] || 0);
    return new Date(year, month - 1, day, hours, minutes, seconds, 0);
  }

  // dd/MM/yyyy
  const brDateOnly = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDateOnly) {
    const day = Number(brDateOnly[1]);
    const month = Number(brDateOnly[2]);
    const year = Number(brDateOnly[3]);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  return null;
}

function formatPortalDateTime(value?: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  const brWithTime = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (brWithTime) {
    return `${brWithTime[1]}/${brWithTime[2]}/${brWithTime[3]} ${brWithTime[4]}:${brWithTime[5]}`;
  }

  const isoWithTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoWithTime) {
    return `${isoWithTime[3]}/${isoWithTime[2]}/${isoWithTime[1]} ${isoWithTime[4]}:${isoWithTime[5]}`;
  }

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    return `${timeOnly[1].padStart(2, '0')}:${timeOnly[2]}`;
  }

  return trimmed;
}

function getPrevistoArrivalProgress(record: BtpScheduleRecord): number | null {
  // Para navio previsto, ETB representa melhor a proximidade operacional de atracação.
  const referenceDate = parsePortalDateTime(record.etb) || parsePortalDateTime(record.eta);
  if (!referenceDate) return null;

  const now = new Date();
  const remainingMs = referenceDate.getTime() - now.getTime();

  // Enquanto continuar "Previsto", nunca mostrar 100% para não sugerir que já atracou.
  if (remainingMs <= 0) return 99;

  // Janela visual de 5 dias: faltando 1 dia => ~80%.
  const horizonMs = 5 * 24 * 60 * 60 * 1000;
  const progress = ((horizonMs - remainingMs) / horizonMs) * 100;
  return Math.max(8, Math.min(99, Math.round(progress)));
}

function getAtracadoRemainingProgress(record: BtpScheduleRecord): number | null {
  const endDate = parsePortalDateTime(record.etd);
  if (!endDate) return null;

  const startDate =
    parsePortalDateTime(`${record.dataatracacao || ''} ${record.horaatracacao || ''}`.trim()) ||
    parsePortalDateTime(record.etb);

  const now = new Date();

  if (startDate && endDate.getTime() > startDate.getTime()) {
    const totalMs = endDate.getTime() - startDate.getTime();
    const remainingMs = endDate.getTime() - now.getTime();

    if (remainingMs <= 0) return 0;
    if (remainingMs >= totalMs) return 100;

    return Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)));
  }

  // Fallback: sem início confiável, usa janela de 48h até o ETD.
  const remainingMs = endDate.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  const horizonMs = 48 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, Math.round((remainingMs / horizonMs) * 100)));
}

function getPortalStatusLabel(record: BtpScheduleRecord): string {
  const rawPortalStatus = (record.status || '').toLowerCase();
  const sourceText = [
    record.status,
    record.operacao,
    record.movimento,
    record.situacao,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const etbDate = parsePortalDateTime(record.etb);
  const now = new Date();
  const hasExplicitPrevisto = rawPortalStatus.includes('previst') || sourceText.includes('previst');

  if (sourceText.includes('desatrac')) return 'Desatracado';
  if (hasValue(record.datasaida) || hasValue(record.horasaida)) return 'Desatracado';

  // Regra portal operacional: ETB vencido indica navio atracado (se não desatracou).
  if (etbDate && etbDate.getTime() <= now.getTime()) return 'Atracado';

  if (sourceText.includes('atracad')) return 'Atracado';
  if (hasExplicitPrevisto) return 'Previsto';
  if (sourceText.includes('barra') || sourceText.includes('fundeado')) return 'Na Barra';

  // Fallback estrutural compatível com a lista de atracação do portal.
  if (hasValue(record.dataatracacao) || hasValue(record.horaatracacao)) return 'Atracado';
  if (hasValue(record.datachegada) || hasValue(record.horachegada)) {
    // Quando o portal já traz "Previsto", não degradar para "Na Barra" apenas por ter data/hora de chegada.
    return hasExplicitPrevisto ? 'Previsto' : 'Na Barra';
  }

  return 'Previsto';
}

function getStatusRank(status: string): number {
  const label = status;
  if (label === 'Atracado') return 1;
  if (label === 'Na Barra') return 2;
  if (label === 'Previsto') return 3;
  if (label === 'Desatracado') return 4;
  return 5;
}

function parseBrDateTime(dateValue?: string, timeValue?: string): number {
  if (!dateValue) return Number.MAX_SAFE_INTEGER;

  const cleanDate = dateValue.trim();
  const cleanTime = (timeValue || '').trim();

  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/;

  let year = 0;
  let month = 0;
  let day = 0;

  if (ddmmyyyy.test(cleanDate)) {
    const match = cleanDate.match(ddmmyyyy);
    if (!match) return Number.MAX_SAFE_INTEGER;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else if (yyyymmdd.test(cleanDate)) {
    const match = cleanDate.match(yyyymmdd);
    if (!match) return Number.MAX_SAFE_INTEGER;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    return Number.MAX_SAFE_INTEGER;
  }

  let hours = 0;
  let minutes = 0;
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function getRecordDateRank(record: BtpScheduleRecord): number {
  const atracacao = parseBrDateTime(record.dataatracacao, record.horaatracacao);
  if (atracacao !== Number.MAX_SAFE_INTEGER) return atracacao;

  const chegada = parseBrDateTime(record.datachegada, record.horachegada);
  if (chegada !== Number.MAX_SAFE_INTEGER) return chegada;

  const saida = parseBrDateTime(record.datasaida, record.horasaida);
  if (saida !== Number.MAX_SAFE_INTEGER) return saida;

  return Number.MAX_SAFE_INTEGER;
}

export const ProgramacaoBtp: React.FC = () => {
  const [data, setData] = useState<BtpScheduleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [searchNavio, setSearchNavio] = useState('');
  const [searchBerco, setSearchBerco] = useState('');
  const [searchData, setSearchData] = useState('');
  const [sortBy, setSortBy] = useState<string>('data');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/btp-schedule', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const records = result.data || [];
        setData(records);
        setLastUpdate(new Date());

        if (records.length === 0) {
          setError('Nenhuma programação disponível.');
        } else {
          setError(null);
        }
      } else {
        throw new Error(result.error || 'Falha ao buscar dados');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao buscar dados';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    refreshIntervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchData]);

  const filteredData = data.filter((record) => {
    const navioMatch = (record.navio || '').toLowerCase().includes(searchNavio.toLowerCase());
    const bercoSearchSource = `${record.berco || ''} ${record.pontoAtracacao || ''} ${getDisplayBerco(record)}`.toLowerCase();
    const bercoMatch = bercoSearchSource.includes(searchBerco.toLowerCase());
    const dataMatch =
      !searchData ||
      (record.datachegada || '').includes(searchData) ||
      (record.dataatracacao || '').includes(searchData) ||
      (record.datasaida || '').includes(searchData);

    return navioMatch && bercoMatch && dataMatch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'data') {
      const aRank = getRecordDateRank(a);
      const bRank = getRecordDateRank(b);
      if (aRank < bRank) return sortDirection === 'asc' ? -1 : 1;
      if (aRank > bRank) return sortDirection === 'asc' ? 1 : -1;

      // Within the same date, keep a fixed operational priority.
      const aStatusRank = getStatusRank(getPortalStatusLabel(a));
      const bStatusRank = getStatusRank(getPortalStatusLabel(b));
      if (aStatusRank < bStatusRank) return -1;
      if (aStatusRank > bStatusRank) return 1;

      return (a.navio || '').localeCompare(b.navio || '');
    }

    const aValue = (a[sortBy] || '').toString().toLowerCase();
    const bValue = (b[sortBy] || '').toString().toLowerCase();

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const handleCopyTable = async () => {
    try {
      const tableText = sortedData
        .map((row) =>
          [
            row.navio,
            row.viagem,
            row.armador,
            row.berco,
            getPortalStatusLabel(row),
            row.eta,
            row.etb,
            row.etd,
            row.operacao,
          ].join('\t')
        )
        .join('\n');

      await navigator.clipboard.writeText(tableText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setError('Erro ao copiar tabela para a área de transferência');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'Navio',
        'Viagem',
        'Armador',
        'Berço',
        'Status',
        'Chegada no Porto',
        'Atracado na BTP',
        'Saída da BTP',
        'Data Chegada',
        'Hora Chegada',
        'Data Atracação',
        'Hora Atracação',
        'Data Saída',
        'Hora Saída',
        'Operação',
        'Terminal',
        'Comprimento do Navio',
        'Código CODESP',
        'Ponto de Atracação',
        'Nº Viagem Descarga',
        'Início Operação',
        'Fim de Operação',
        'Saída',
        'Tipo de Operação',
        'Dead Line',
        'Direção Atracação',
        'Nº Viagem Embarque',
      ];

      const rows = sortedData.map((record) => [
        record.navio,
        record.viagem,
        record.armador,
        getDisplayBerco(record),
        getPortalStatusLabel(record),
        record.eta,
        record.etb,
        record.etd,
        record.datachegada,
        record.horachegada,
        record.dataatracacao,
        record.horaatracacao,
        record.datasaida,
        record.horasaida,
        record.operacao,
        record.terminal,
        record.comprimentoNavio,
        record.codigoCodesp,
        record.pontoAtracacao,
        record.numeroViagemDescarga,
        record.inicioOperacao,
        record.fimOperacao,
        record.saida,
        record.tipoOperacao,
        record.deadLine,
        record.direcaoAtracacao,
        record.numeroViagemEmbarque,
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell || ''}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `programacao-btp-${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
    } catch {
      setError('Erro ao exportar CSV');
    }
  };

  const handleExportExcel = () => {
    try {
      const headers = [
        'Navio',
        'Viagem',
        'Armador',
        'Berço',
        'Status',
        'Chegada no Porto',
        'Atracado na BTP',
        'Saída da BTP',
        'Data Chegada',
        'Hora Chegada',
        'Data Atracação',
        'Hora Atracação',
        'Data Saída',
        'Hora Saída',
        'Operação',
        'Terminal',
        'Comprimento do Navio',
        'Código CODESP',
        'Ponto de Atracação',
        'Nº Viagem Descarga',
        'Início Operação',
        'Fim de Operação',
        'Saída',
        'Tipo de Operação',
        'Dead Line',
        'Direção Atracação',
        'Nº Viagem Embarque',
      ];

      let html = '<table border="1"><thead><tr>';
      headers.forEach((h) => (html += `<th>${h}</th>`));
      html += '</tr></thead><tbody>';

      sortedData.forEach((record) => {
        html += '<tr>';
        html += `<td>${record.navio || ''}</td>`;
        html += `<td>${record.viagem || ''}</td>`;
        html += `<td>${record.armador || ''}</td>`;
        html += `<td>${getDisplayBerco(record)}</td>`;
        html += `<td>${getPortalStatusLabel(record)}</td>`;
        html += `<td>${record.eta || ''}</td>`;
        html += `<td>${record.etb || ''}</td>`;
        html += `<td>${record.etd || ''}</td>`;
        html += `<td>${record.datachegada || ''}</td>`;
        html += `<td>${record.horachegada || ''}</td>`;
        html += `<td>${record.dataatracacao || ''}</td>`;
        html += `<td>${record.horaatracacao || ''}</td>`;
        html += `<td>${record.datasaida || ''}</td>`;
        html += `<td>${record.horasaida || ''}</td>`;
        html += `<td>${record.operacao || ''}</td>`;
        html += `<td>${record.terminal || ''}</td>`;
        html += `<td>${record.comprimentoNavio || ''}</td>`;
        html += `<td>${record.codigoCodesp || ''}</td>`;
        html += `<td>${getDisplayBerco(record) === '-' ? '' : getDisplayBerco(record)}</td>`;
        html += `<td>${record.numeroViagemDescarga || ''}</td>`;
        html += `<td>${record.inicioOperacao || ''}</td>`;
        html += `<td>${record.fimOperacao || ''}</td>`;
        html += `<td>${record.saida || ''}</td>`;
        html += `<td>${record.tipoOperacao || ''}</td>`;
        html += `<td>${record.deadLine || ''}</td>`;
        html += `<td>${record.direcaoAtracacao || ''}</td>`;
        html += `<td>${record.numeroViagemEmbarque || ''}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table>';

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `programacao-btp-${new Date().toISOString().split('T')[0]}.xls`);
      link.click();
    } catch {
      setError('Erro ao exportar Excel');
    }
  };

  const columns = [
    { key: 'data', label: 'Data' },
    { key: 'navio', label: 'Navio' },
    { key: 'viagem', label: 'Viagem' },
    { key: 'berco', label: 'Berço' },
    { key: 'status', label: 'Status' },
    { key: 'etb', label: 'Atracado na BTP' },
    { key: 'inicioOperacao', label: 'Início Operação' },
    { key: 'etd', label: 'Saída da BTP' },
    { key: 'operacao', label: 'Operação' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
              <Ship className="w-3.5 h-3.5" />
              Programação Operacional BTP
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Programação BTP</h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Consulta em tempo real da fila operacional de navios com filtros, ordenação e exportação.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registros</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{sortedData.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Atualização</p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '--:--:--'}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auto Refresh</p>
          <p className="text-sm font-black text-slate-900 dark:text-white">A cada 5 minutos</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <button onClick={() => setError(null)} className="text-rose-700 hover:underline">Fechar</button>
        </div>
      )}

      {copySuccess && (
        <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold">
          Tabela copiada para a área de transferência.
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-wider">Filtros</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchNavio}
              onChange={(e) => setSearchNavio(e.target.value)}
              placeholder="Pesquisar navio"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            />
          </div>
          <input
            value={searchBerco}
            onChange={(e) => setSearchBerco(e.target.value)}
            placeholder="Pesquisar berço"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
          <input
            value={searchData}
            onChange={(e) => setSearchData(e.target.value)}
            placeholder="Pesquisar data"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyTable}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Carregando programação...</p>
        </div>
      )}

      {!loading && sortedData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                <tr>
                  <th className="p-3 w-12" />
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="p-3 text-left whitespace-nowrap"
                    >
                      <button
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 font-black hover:text-blue-600"
                      >
                        {column.label}
                        {sortBy === column.key ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                {sortedData.map((record, index) => {
                  const statusLabel = getPortalStatusLabel(record);
                  const previstoProgress = statusLabel === 'Previsto' ? getPrevistoArrivalProgress(record) : null;
                  const atracadoProgress = statusLabel === 'Atracado' ? getAtracadoRemainingProgress(record) : null;

                  return (
                  <React.Fragment key={`${record.navio}-${record.viagem}-${index}`}>
                    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {expandedRow === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="p-3">
                        {formatPortalDateTime(record.dataatracacao || record.datachegada || record.datasaida) || '-'}
                      </td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">{record.navio || '-'}</td>
                      <td className="p-3">{record.viagem || '-'}</td>
                      <td className="p-3">{getDisplayBerco(record)}</td>
                      <td className="p-3">
                        <div className="inline-flex flex-col gap-1 min-w-[120px]">
                          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-black ${getStatusClass(statusLabel)}`}>
                            {statusLabel}
                          </span>
                          {statusLabel === 'Previsto' && previstoProgress !== null && (
                            <>
                              <div
                                className="h-1.5 w-full rounded-full bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 overflow-hidden"
                                title={`Proximidade da chegada: ${previstoProgress}%`}
                              >
                                <div
                                  className="h-full bg-red-500 dark:bg-red-400 transition-all duration-500"
                                  style={{ width: `${previstoProgress}%` }}
                                />
                              </div>
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-300">
                                <ArrowRight className="w-3 h-3" />
                                <span>{previstoProgress}% para atracar</span>
                              </div>
                            </>
                          )}
                          {statusLabel === 'Atracado' && atracadoProgress !== null && (
                            <>
                              <div
                                className="h-1.5 w-full rounded-full bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-900/60 overflow-hidden"
                                title={`Tempo restante até saída prevista: ${atracadoProgress}%`}
                              >
                                <div
                                  className="h-full bg-yellow-500 dark:bg-yellow-400 transition-all duration-500"
                                  style={{ width: `${atracadoProgress}%` }}
                                />
                              </div>
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-700 dark:text-yellow-300">
                                <ArrowLeft className="w-3 h-3" />
                                <span>{atracadoProgress}% para terminar</span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{formatPortalDateTime(record.etb) || '-'}</td>
                      <td className="p-3">{formatPortalDateTime(record.inicioOperacao) || '-'}</td>
                      <td className="p-3">{formatPortalDateTime(record.etd) || '-'}</td>
                      <td className="p-3">{record.operacao || '-'}</td>
                    </tr>

                    {expandedRow === index && (
                      <tr className="bg-slate-50 dark:bg-slate-800/40">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Armador</p>
                              <p className="font-semibold">{record.armador || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Terminal</p>
                              <p className="font-semibold">{record.terminal || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Data/Hora Chegada</p>
                              <p className="font-semibold">{formatPortalDateTime(`${record.datachegada || ''} ${record.horachegada || ''}`.trim()) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Data/Hora Atracação</p>
                              <p className="font-semibold">{formatPortalDateTime(`${record.dataatracacao || ''} ${record.horaatracacao || ''}`.trim()) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Data/Hora Saída</p>
                              <p className="font-semibold">{formatPortalDateTime(`${record.datasaida || ''} ${record.horasaida || ''}`.trim()) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Chegada Prevista</p>
                              <p className="font-semibold">{formatPortalDateTime(record.chegadaPrevista || record.eta) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Atracação</p>
                              <p className="font-semibold">{formatPortalDateTime(record.atracacao || record.etb) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Saída Prevista</p>
                              <p className="font-semibold">{formatPortalDateTime(record.saidaPrevista || record.etd) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Comprimento do Navio</p>
                              <p className="font-semibold">{record.comprimentoNavio || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Código CODESP</p>
                              <p className="font-semibold">{record.codigoCodesp || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Ponto de Atracação</p>
                              <p className="font-semibold">{getDisplayBerco(record)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Nº Viagem Descarga</p>
                              <p className="font-semibold">{record.numeroViagemDescarga || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Início Operação</p>
                              <p className="font-semibold">{formatPortalDateTime(record.inicioOperacao) || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Fim de Operação</p>
                              <p className="font-semibold">{record.fimOperacao || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Saída</p>
                              <p className="font-semibold">{record.saida || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Tipo de Operação</p>
                              <p className="font-semibold">{record.tipoOperacao || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Dead Line</p>
                              <p className="font-semibold">{record.deadLine || record.deadline || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Direção Atracação</p>
                              <p className="font-semibold">{record.direcaoAtracacao || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Nº Viagem Embarque</p>
                              <p className="font-semibold">{record.numeroViagemEmbarque || '-'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && sortedData.length === 0 && (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300 text-base">Nenhuma programação disponível.</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Faça uma atualização para buscar novos registros do portal BTP.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgramacaoBtp;
