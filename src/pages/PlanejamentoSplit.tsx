import React, { useState, useRef } from 'react';
import { Box, Button, Typography, Paper, LinearProgress, TextField, IconButton, Chip } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import { parsePDF } from '../services/pdfService';
import { analyzeSplit } from '../services/aiService';

function displayValue(value: any, sourceLabel?: string) {
  if (value === null || value === undefined || value === '') {
    return <>— <small style={{ opacity: 0.6 }}>{sourceLabel === 'not_available_in_document' ? '(não consta no documento)' : ''}</small></>;
  }
  return <>{value} {sourceLabel ? <small style={{ opacity: 0.8 }}>{sourceLabel === 'extracted' ? '(extraído do PDF)' : ''}</small> : null}</>;
}

export const PlanejamentoSplit: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrorMessage(null);
    setSummary(null);

    console.log('[PlanejamentoSplit] Iniciando análise do PDF:', file.name);

    try {
      const parsed = await parsePDF(file, (pct) => setProgress(pct));

      // Log temporário de depuração — remova depois de validar com PDFs reais
      console.log('--- TEXTO EXTRAÍDO DO PDF (depuração) ---');
      console.log(parsed.text);

      console.log('[PlanejamentoSplit] Leitura do PDF concluída. Iniciando análise...');
      setProgress(50);

      const analysis = await analyzeSplit(parsed);
      setSummary(analysis);
      setProgress(100);
      console.log('[PlanejamentoSplit] Análise finalizada com sucesso.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao analisar o Split.';
      console.error('[PlanejamentoSplit] Falha na análise:', err);
      setErrorMessage(message);
    } finally {
      setParsing(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const onSearch = () => {
    if (!search || !summary) return setSearchResult(null);
    const found = (summary.bays || []).find((b: any) => b.id === search.padStart(2, '0'));
    setSearchResult(found ?? { message: 'Bay não encontrada nas tabelas de alerta' });
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

      {errorMessage && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid #f44336' }}>
          <Typography color="error">Erro: {errorMessage}</Typography>
        </Paper>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Resumo do Navio</Typography>
            <Typography>Nome: {displayValue(summary.shipName, summary.shipNameSource)}</Typography>
            <Typography>Viagem: {displayValue(summary.voyage, summary.voyageSource)}</Typography>
            <Typography>Operador: {displayValue(summary.operator, summary.operatorSource)}</Typography>
            <Typography>ETA: {displayValue(summary.eta, summary.etaSource)}</Typography>
            <Typography>ETB: {displayValue(summary.etb, summary.etbSource)}</Typography>
            <Typography>Berço: {displayValue(summary.berth, summary.berthSource)}</Typography>
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Resumo da operação</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              <Typography>Descarga (total): {displayValue(summary.discharge, summary.dischargeSource)}</Typography>
              <Typography>Descarga (restante): {summary.dischargeRemaining ?? '—'}</Typography>
              <Typography>Embarque (total): {displayValue(summary.load, summary.loadSource)}</Typography>
              <Typography>Embarque (restante): {summary.loadRemaining ?? '—'}</Typography>
              <Typography>Reefers Positivos: {summary.reefersPositive ?? 0}</Typography>
              <Typography>Reefers Negativos: {summary.reefersNegative ?? 0}</Typography>
              <Typography>IMO: {summary.imo ?? 0}</Typography>
              <Typography>OOG: {summary.oog ?? 0}</Typography>
              <Typography>Direct Delivery: {summary.directDelivery ?? 0}</Typography>
              <Typography>
                Total geral (descarga+embarque): {summary.dischargeSource === 'extracted' || summary.loadSource === 'extracted' ? summary.total : displayValue(null, 'not_available_in_document')}
              </Typography>
            </Box>
          </Paper>

          {summary.alerts?.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">Alertas</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {summary.alerts.map((a: string) => (
                  <Chip key={a} label={a} sx={{ bgcolor: '#fff3cd' }} />
                ))}
              </Box>
            </Paper>
          )}

          {summary.cranePlanSource === 'extracted' ? (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">Plano de Guindastes (QC Plan)</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {summary.cranePlan.map((c: any) => (
                  <Paper key={c.crane} sx={{ p: 1 }}>
                    <Typography variant="subtitle2">{c.crane}</Typography>
                    <Typography variant="caption">Total: {c.total} | Restante: {c.remaining}</Typography>
                  </Paper>
                ))}
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ p: 2, mb: 2, opacity: 0.7 }}>
              <Typography variant="h6">Plano de Guindastes (QC Plan)</Typography>
              <Typography variant="body2">
                Não disponível neste PDF — essa informação está apenas na imagem da página 1 (captura de tela do sistema), sem texto extraível.
              </Typography>
            </Paper>
          )}

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Bays com contêineres em alerta</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Somente bays citadas nas tabelas de alerta do PDF (dados reais). Os mapas de bay do
              relatório são gráficos visuais e não contêm contagem de movimentos em texto.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {(!summary.bays || summary.bays.length === 0) && (
                <Typography sx={{ opacity: 0.7 }}>Nenhuma bay com contêineres de alerta foi encontrada.</Typography>
              )}
              {summary.bays?.map((b: any) => (
                <Paper key={b.id} sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">BAY {b.id}</Typography>
                    <Typography>{b.containerCount} contêiner(es)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    {b.sections.map((s: string) => <Chip key={s} size="small" label={s} />)}
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {b.containers.map((c: any) => (
                      <Typography key={c.cntrNo ?? c.stowage} variant="body2">
                        {c.stowage} — {c.cntrNo ?? 's/ ID'} {c.iso ? `(${c.iso})` : ''}
                        {c.imdgClasses ? ` | IMDG: ${c.imdgClasses}` : ''}
                        {c.oog ? ` | OOG: ${c.oog}` : ''}
                        {c.weight ? ` | ${c.weight}t` : ''}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
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
                <Typography>Contêineres: {searchResult.containerCount}</Typography>
                <Typography>Seções: {searchResult.sections.join(', ')}</Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default PlanejamentoSplit;
