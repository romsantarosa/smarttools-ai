import React, { useState, useRef } from 'react';
import { Box, Button, Typography, Paper, LinearProgress, TextField, IconButton, Input } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import { parsePDF } from '../services/pdfService';
import { analyzeSplit } from '../services/aiService';

export const PlanejamentoSplit: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onSelectFile = (f?: File) => {
    const fileToUse = f ?? fileRef.current?.files?.[0] ?? null;
    if (fileToUse) setFile(fileToUse);
  };

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);

  const onAnalyze = async () => {
    if (!file) return;
    setParsing(true);
    setProgress(10);
    try {
      const parsed = await parsePDF(file);
      setProgress(50);
      const analysis = await analyzeSplit(parsed);
      setSummary(analysis);
      setProgress(100);
    } catch (err) {
      console.error(err);
    } finally {
      setParsing(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const onSearch = () => {
    if (!search || !summary) return setSearchResult(null);
    const found = (summary.bays || []).find((b: any) => b.id === search.padStart(2, '0'));
    setSearchResult(found ?? { message: 'Bay não encontrada' });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>PLANEJAMENTO SPLIT</Typography>

      <Paper sx={{ p: 2, mb: 2 }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CloudUploadIcon sx={{ fontSize: 48, opacity: 0.8 }} />
          <Typography>Arraste o Split (.PDF)</Typography>
          <Typography>ou</Typography>
          <Button variant="contained" onClick={() => fileRef.current?.click()}>Selecionar Arquivo</Button>
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={() => onSelectFile()} />
          {file && <Typography variant="body2">Arquivo: {file.name}</Typography>}
          <Button variant="outlined" disabled={!file || parsing} onClick={onAnalyze}>Analisar Split</Button>
        </Box>
      </Paper>

      {parsing && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption">Processando... {progress}%</Typography>
        </Box>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Resumo do Navio</Typography>
            <Typography>
              Nome: {summary.shipName ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.shipNameSource ?? 'estimated'}</small>
            </Typography>
            <Typography>
              Viagem: {summary.voyage ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.voyageSource ?? 'estimated'}</small>
            </Typography>
            <Typography>
              Operador: {summary.operator ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.operatorSource ?? 'estimated'}</small>
            </Typography>
            <Typography>
              ETA: {summary.eta ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.etaSource ?? 'estimated'}</small>
            </Typography>
            <Typography>
              ETB: {summary.etb ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.etbSource ?? 'estimated'}</small>
            </Typography>
            <Typography>
              Berço: {summary.berth ?? '—'} {' - '}
              <small style={{ opacity: 0.8 }}>{summary.berthSource ?? 'estimated'}</small>
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Resumo da operação</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <Typography>Descarga: {summary.discharge ?? 0}</Typography>
              <Typography>Embarque: {summary.load ?? 0}</Typography>
              <Typography>Reefers Positivos: {summary.reefersPositive ?? 0}</Typography>
              <Typography>Reefers Negativos: {summary.reefersNegative ?? 0}</Typography>
              <Typography>IMO: {summary.imo ?? 0}</Typography>
              <Typography>OOG: {summary.oog ?? 0}</Typography>
              <Typography>Direct Delivery: {summary.directDelivery ?? 0}</Typography>
              <Typography>Total de movimentos: {summary.total ?? 0}</Typography>
            </Box>
          </Paper>

          {summary.alerts?.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">Alertas</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {summary.alerts.map((a: string) => (
                  <Paper key={a} sx={{ p: 1, bgcolor: '#fff3cd' }}>{a}</Paper>
                ))}
              </Box>
            </Paper>
          )}

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Divisão por turno</Typography>
            {summary.shifts?.map((s: any, idx: number) => (
              <Box key={idx} sx={{ my: 1 }}>
                <Typography>🕐 Turno {s.range}</Typography>
                <Typography>Seu Terno: {s.team ?? '—'}</Typography>
                <Typography>Resumo do turno — Bays previstas:</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{(s.bays ?? []).map((b: string) => <Paper key={b} sx={{ p: 1 }}>{b}</Paper>)}</Box>
              </Box>
            ))}
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Bays detalhadas</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {summary.bays?.map((b: any) => (
                <Paper key={b.id} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">BAY {b.id}</Typography>
                    <Typography>{b.movements} movimentos</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                    {b.operations.map((op: string) => <Paper key={op} sx={{ p: 0.5 }}>{op}</Paper>)}
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress variant="determinate" value={b.progressPct ?? 0} />
                    <Typography variant="caption">{b.progressPct ?? 0}%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Typography>Classificação: {b.classification}</Typography>
                    <Typography>Reefers: {b.reefers}</Typography>
                    <Typography>IMO: {b.imo}</Typography>
                    <Typography>OOG: {b.oog}</Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Divisão por turno</Typography>
            {summary.shifts?.map((s: any, idx: number) => (
              <Box key={idx} sx={{ my: 1 }}>
                <Typography>🕐 Turno {s.range}</Typography>
                <Typography>Seu Terno: {s.team ?? '—'}</Typography>
                <Typography>Resumo do turno — Bays previstas:</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{(s.bays ?? []).map((b: string) => <Paper key={b} sx={{ p: 1 }}>{b}</Paper>)}</Box>
              </Box>
            ))}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Resumo Inteligente</Typography>
            <Typography>{summary.smartSummary}</Typography>
          </Paper>
        </motion.div>
      )}

      <Box sx={{ position: 'fixed', right: 16, bottom: 16, width: 320 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" placeholder="Pesquisar Bay" value={search} onChange={(e) => setSearch(e.target.value)} />
          <IconButton onClick={onSearch} sx={{ bgcolor: 'background.paper' }}><SearchIcon /></IconButton>
        </Box>
        {searchResult && (
          <Paper sx={{ mt: 1, p: 1 }}>
            {searchResult.message ? (
              <Typography>{searchResult.message}</Typography>
            ) : (
              <Box>
                <Typography>BAY {searchResult.id}</Typography>
                <Typography>Movimentos: {searchResult.movements}</Typography>
                <Typography>Operações: {searchResult.operations.join(', ')}</Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default PlanejamentoSplit;
