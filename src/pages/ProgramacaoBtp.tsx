import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Download,
  Copy,
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
  if (key.includes('atracado')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key.includes('fundeado')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (key.includes('previsto')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (key.includes('opera')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (key.includes('sa')) return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export const ProgramacaoBtp: React.FC = () => {
  const [data, setData] = useState<BtpScheduleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [searchNavio, setSearchNavio] = useState('');
  const [searchBerco, setSearchBerco] = useState('');
  const [searchData, setSearchData] = useState('');
  const [sortBy, setSortBy] = useState<string>('navio');
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
    const bercoMatch = (record.berco || '').toLowerCase().includes(searchBerco.toLowerCase());
    const dataMatch =
      !searchData ||
      (record.datachegada || '').includes(searchData) ||
      (record.dataatracacao || '').includes(searchData) ||
      (record.datasaida || '').includes(searchData);

    return navioMatch && bercoMatch && dataMatch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
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
            row.status,
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
        'ETA',
        'ETB',
        'ETD',
        'Data Chegada',
        'Hora Chegada',
        'Data Atracação',
        'Hora Atracação',
        'Data Saída',
        'Hora Saída',
        'Operação',
        'Terminal',
      ];

      const rows = sortedData.map((record) => [
        record.navio,
        record.viagem,
        record.armador,
        record.berco,
        record.status,
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
        'ETA',
        'ETB',
        'ETD',
        'Data Chegada',
        'Hora Chegada',
        'Data Atracação',
        'Hora Atracação',
        'Data Saída',
        'Hora Saída',
        'Operação',
        'Terminal',
      ];

      let html = '<table border="1"><thead><tr>';
      headers.forEach((h) => (html += `<th>${h}</th>`));
      html += '</tr></thead><tbody>';

      sortedData.forEach((record) => {
        html += '<tr>';
        html += `<td>${record.navio || ''}</td>`;
        html += `<td>${record.viagem || ''}</td>`;
        html += `<td>${record.armador || ''}</td>`;
        html += `<td>${record.berco || ''}</td>`;
        html += `<td>${record.status || ''}</td>`;
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
    { key: 'navio', label: 'Navio' },
    { key: 'viagem', label: 'Viagem' },
    { key: 'berco', label: 'Berço' },
    { key: 'status', label: 'Status' },
    { key: 'eta', label: 'ETA' },
    { key: 'etb', label: 'ETB' },
    { key: 'etd', label: 'ETD' },
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
                    <th key={column.key} className="p-3 text-left whitespace-nowrap">
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
                {sortedData.map((record, index) => (
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
                      <td className="p-3 font-black text-slate-900 dark:text-white">{record.navio || '-'}</td>
                      <td className="p-3">{record.viagem || '-'}</td>
                      <td className="p-3">{record.berco || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-black ${getStatusClass(record.status || '')}`}>
                          {record.status || '-'}
                        </span>
                      </td>
                      <td className="p-3">{record.eta || '-'}</td>
                      <td className="p-3">{record.etb || '-'}</td>
                      <td className="p-3">{record.etd || '-'}</td>
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
                              <p className="font-semibold">{record.datachegada || '-'} {record.horachegada || ''}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Data/Hora Atracação</p>
                              <p className="font-semibold">{record.dataatracacao || '-'} {record.horaatracacao || ''}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-bold uppercase tracking-wider">Data/Hora Saída</p>
                              <p className="font-semibold">{record.datasaida || '-'} {record.horasaida || ''}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
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
