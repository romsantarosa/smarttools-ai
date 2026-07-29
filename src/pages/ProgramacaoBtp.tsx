import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  RefreshCw,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

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

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
  'Atracado': 'success',
  'Fundeado': 'info',
  'Previsto': 'primary',
  'Em Operação': 'warning',
  'Saído': 'default',
};

function getStatusColor(status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  return statusColors[status] || 'default';
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BtpScheduleRecord | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Buscar dados do servidor
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[ProgramacaoBtp] Buscando dados de programação BTP...');

      const response = await fetch('/api/btp-schedule', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data || []);
        setLastUpdate(new Date());
        console.log(`[ProgramacaoBtp] ${result.data?.length || 0} registros carregados`);
      } else {
        throw new Error(result.error || 'Falha ao buscar dados');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao buscar dados';
      console.error('[ProgramacaoBtp] Erro:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados na montagem
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Configurar auto-refresh a cada 5 minutos
  useEffect(() => {
    refreshIntervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchData]);

  // Filtrar dados
  const filteredData = data.filter((record) => {
    const navioMatch = record.navio.toLowerCase().includes(searchNavio.toLowerCase());
    const bercoMatch = record.berco.toLowerCase().includes(searchBerco.toLowerCase());
    const dataMatch = !searchData || 
      record.datachegada.includes(searchData) || 
      record.dataatracacao.includes(searchData) ||
      record.datasaida.includes(searchData);

    return navioMatch && bercoMatch && dataMatch;
  });

  // Ordenar dados
  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = (a[sortBy] || '').toString().toLowerCase();
    const bValue = (b[sortBy] || '').toString().toLowerCase();

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Manipuladores
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    fetchData();
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
    } catch (err) {
      console.error('Erro ao copiar:', err);
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

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `programacao-btp-${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
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
        html += `<td>${record.navio}</td>`;
        html += `<td>${record.viagem}</td>`;
        html += `<td>${record.armador}</td>`;
        html += `<td>${record.berco}</td>`;
        html += `<td>${record.status}</td>`;
        html += `<td>${record.eta}</td>`;
        html += `<td>${record.etb}</td>`;
        html += `<td>${record.etd}</td>`;
        html += `<td>${record.datachegada}</td>`;
        html += `<td>${record.horachegada}</td>`;
        html += `<td>${record.dataatracacao}</td>`;
        html += `<td>${record.horaatracacao}</td>`;
        html += `<td>${record.datasaida}</td>`;
        html += `<td>${record.horasaida}</td>`;
        html += `<td>${record.operacao}</td>`;
        html += `<td>${record.terminal}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table>';

      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `programacao-btp-${new Date().toISOString().split('T')[0]}.xls`);
      link.click();
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      setError('Erro ao exportar Excel');
    }
  };

  const handleViewDetails = (record: BtpScheduleRecord) => {
    setSelectedRecord(record);
    setDetailsOpen(true);
  };

  const columns = [
    { key: 'navio', label: 'Navio', width: '200px' },
    { key: 'viagem', label: 'Viagem', width: '120px' },
    { key: 'berco', label: 'Berço', width: '80px' },
    { key: 'status', label: 'Status', width: '120px' },
    { key: 'eta', label: 'ETA', width: '100px' },
    { key: 'etb', label: 'ETB', width: '100px' },
    { key: 'etd', label: 'ETD', width: '100px' },
    { key: 'operacao', label: 'Operação', width: '120px' },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          📋 PROGRAMAÇÃO BTP
          {loading && <CircularProgress size={24} />}
        </Typography>

        {/* Info Bar */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body2">
              Total de registros: <strong>{sortedData.length}</strong>
            </Typography>
            {lastUpdate && (
              <Typography variant="body2" sx={{ color: 'gray' }}>
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </Typography>
            )}
          </Box>
          <Button
            startIcon={<RefreshCw size={18} />}
            onClick={handleRefresh}
            disabled={loading}
            variant="contained"
            size="small"
          >
            Atualizar
          </Button>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {copySuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCopySuccess(false)}>
            ✓ Tabela copiada para a área de transferência!
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
            <TextField
              label="Pesquisar Navio"
              value={searchNavio}
              onChange={(e) => setSearchNavio(e.target.value)}
              size="small"
              placeholder="Ex: MAERSK"
            />
            <TextField
              label="Pesquisar Berço"
              value={searchBerco}
              onChange={(e) => setSearchBerco(e.target.value)}
              size="small"
              placeholder="Ex: BTP-1"
            />
            <TextField
              label="Pesquisar Data"
              value={searchData}
              onChange={(e) => setSearchData(e.target.value)}
              size="small"
              placeholder="DD/MM/YYYY"
              type="text"
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Copiar tabela para área de transferência">
              <Button
                startIcon={<Copy size={18} />}
                onClick={handleCopyTable}
                size="small"
                variant="outlined"
              >
                Copiar
              </Button>
            </Tooltip>
            <Tooltip title="Exportar como CSV">
              <Button
                startIcon={<Download size={18} />}
                onClick={handleExportCSV}
                size="small"
                variant="outlined"
              >
                CSV
              </Button>
            </Tooltip>
            <Tooltip title="Exportar como Excel">
              <Button
                startIcon={<Download size={18} />}
                onClick={handleExportExcel}
                size="small"
                variant="outlined"
              >
                Excel
              </Button>
            </Tooltip>
          </Box>
        </Paper>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Table */}
        {!loading && sortedData.length > 0 && (
          <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#1976d2' }}>
                  <TableCell sx={{ width: '40px', bgcolor: '#1976d2', color: 'white' }} />
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      sx={{ width: column.width, bgcolor: '#1976d2', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort(column.key)}
                    >
                      <TableSortLabel
                        active={sortBy === column.key}
                        direction={sortDirection}
                        sx={{ color: 'white !important' }}
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.map((record, index) => (
                  <React.Fragment key={index}>
                    <TableRow sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                      <TableCell sx={{ width: '40px' }}>
                        <IconButton
                          size="small"
                          onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                        >
                          {expandedRow === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{record.navio}</TableCell>
                      <TableCell>{record.viagem}</TableCell>
                      <TableCell>{record.berco}</TableCell>
                      <TableCell>
                        <Chip
                          label={record.status}
                          size="small"
                          color={getStatusColor(record.status)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{record.eta}</TableCell>
                      <TableCell>{record.etb}</TableCell>
                      <TableCell>{record.etd}</TableCell>
                      <TableCell>{record.operacao}</TableCell>
                    </TableRow>

                    {/* Expandable Row */}
                    {expandedRow === index && (
                      <TableRow sx={{ bgcolor: '#f9f9f9' }}>
                        <TableCell colSpan={9}>
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              Detalhes Completos
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'gray' }}>
                                  Armador
                                </Typography>
                                <Typography variant="body2">{record.armador}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'gray' }}>
                                  Terminal
                                </Typography>
                                <Typography variant="body2">{record.terminal}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'gray' }}>
                                  Data/Hora de Chegada
                                </Typography>
                                <Typography variant="body2">
                                  {record.datachegada} {record.horachegada}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'gray' }}>
                                  Data/Hora de Atracação
                                </Typography>
                                <Typography variant="body2">
                                  {record.dataatracacao} {record.horaatracacao}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'gray' }}>
                                  Data/Hora de Saída
                                </Typography>
                                <Typography variant="body2">
                                  {record.datasaida} {record.horasaida}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Empty State */}
        {!loading && sortedData.length === 0 && !error && (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
            <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <Typography color="textSecondary">Nenhum registro encontrado com os filtros aplicados.</Typography>
          </Paper>
        )}

        {/* No Data State */}
        {!loading && data.length === 0 && !error && (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9' }}>
            <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <Typography color="textSecondary">Nenhum dado disponível. Clique em Atualizar para carregar.</Typography>
          </Paper>
        )}
      </motion.div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalhes do Navio</DialogTitle>
        <DialogContent>
          {selectedRecord && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography>
                <strong>Navio:</strong> {selectedRecord.navio}
              </Typography>
              <Typography>
                <strong>Viagem:</strong> {selectedRecord.viagem}
              </Typography>
              <Typography>
                <strong>Armador:</strong> {selectedRecord.armador}
              </Typography>
              <Typography>
                <strong>Berço:</strong> {selectedRecord.berco}
              </Typography>
              <Typography>
                <strong>Status:</strong> {selectedRecord.status}
              </Typography>
              <Typography>
                <strong>Operação:</strong> {selectedRecord.operacao}
              </Typography>
              <Typography>
                <strong>Terminal:</strong> {selectedRecord.terminal}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProgramacaoBtp;
