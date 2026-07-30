import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  FileJson,
  FileText,
  Info,
  Search,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { importDocumentAndAnalyze } from '../services/importPipeline';
import { consumePlatformFiles, subscribePlatformFiles } from '../services/platformIntake';

function displayValue(value: any, sourceLabel?: string) {
  if (value === null || value === undefined || value === '') {
    return (
      <>
        - <span className="text-[10px] text-slate-400">{sourceLabel === 'not_available_in_document' ? '(nao consta no documento)' : ''}</span>
      </>
    );
  }

  return (
    <>
      {value}{' '}
      {sourceLabel ? (
        <span className="text-[10px] text-slate-400">{sourceLabel === 'extracted' ? '(extraido do PDF)' : ''}</span>
      ) : null}
    </>
  );
}

function kpi(label: string, value: number | string, accent = 'text-cyan-300') {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">{label}</p>
      <p className={`text-xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

export const PlanejamentoSplit: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<'native' | 'ocr' | null>(null);
  const [extractionErrors, setExtractionErrors] = useState<string[]>([]);
  const [showTextViewer, setShowTextViewer] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [selectedBay, setSelectedBay] = useState<any>(null);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);

  useEffect(() => {
    const pendingFiles = consumePlatformFiles();
    if (pendingFiles.length > 0 && !file) {
      setFile(pendingFiles[0]);
    }

    return subscribePlatformFiles((files) => {
      if (files.length > 0) {
        setFile(files[0]);
      }
    });
  }, [file]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onSelectFile = (f?: File) => {
    const fileToUse = f ?? fileRef.current?.files?.[0] ?? null;
    if (fileToUse) setFile(fileToUse);
  };

  const onAnalyze = async () => {
    if (!file) return;

    setParsing(true);
    setProgress(10);
    setErrorMessage(null);
    setSummary(null);
    setExtractedText(null);
    setExtractionErrors([]);
    setLogs([]);
    setOcrProgress(null);
    setCopySuccess(false);
    setSelectedBay(null);
    setSelectedContainer(null);

    try {
      const imported = await importDocumentAndAnalyze(file, {
        onProgress: (pct) => setProgress(pct),
        onOcrProgress: (current, total) => setOcrProgress({ current, total }),
        onLog: (entry) => setLogs((prev) => [...prev, entry]),
      });

      setExtractedText(imported.text);
      setExtractionMethod(imported.extractionMethod === 'sheet' ? 'native' : imported.extractionMethod);
      if (imported.errors.length > 0) {
        setExtractionErrors(imported.errors);
      }

      setSummary(imported.analysis);
      setLogs(imported.logs || []);
      setProgress(100);
      setShowTextViewer(false);
      setShowDeveloper(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao processar o PDF.';
      setErrorMessage(message);
    } finally {
      setParsing(false);
      setOcrProgress(null);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const onSearch = () => {
    if (!search || !summary) {
      setSearchResult(null);
      return;
    }
    const found = (summary.bays || []).find((b: any) => b.id === search.padStart(2, '0'));
    setSearchResult(found ?? { message: 'Bay nao encontrada' });
  };

  const handleCopyText = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setErrorMessage('Erro ao copiar texto para a area de transferencia');
    }
  };

  const handleExportJson = () => {
    if (!extractedText) return;
    const data = {
      fileName: file?.name || 'unknown.pdf',
      extractionMethod,
      extractionTime: new Date().toISOString(),
      text: extractedText,
      errors: extractionErrors,
      analysis: summary || null,
      logs,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `split-inteligente-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const operationalStats = summary?.operationalStats || {};
  const chartData = summary?.chartData || {};
  const bayTable = summary?.bayTable || [];

  const selectedBayPage = useMemo(() => {
    if (!selectedBay || !summary?.developerMode?.pages) return null;
    return summary.developerMode.pages.find((p: any) => (p.bayNumbers || []).includes(selectedBay.id)) || null;
  }, [selectedBay, summary]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] mx-auto">
      <div className="rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-cyan-300/20 bg-[radial-gradient(circle_at_0%_20%,#164e63_0%,#111827_35%,#020617_70%)]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-300/40 text-xs font-black uppercase tracking-wider">
            <FileJson className="w-3.5 h-3.5" />
            Importacao Inteligente - Plano de Estiva
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Split Analyzer OCR + Visao + IA</h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-4xl">
            Selecione um PDF e o sistema executa automaticamente classificacao de paginas, OCR, visao computacional,
            fusao por IA e geracao do mapa operacional completo por Bay, Conves e Porao.
          </p>
        </div>

        {summary && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {kpi('Total', operationalStats.totalContainers || 0, 'text-white')}
            {kpi('Bays', operationalStats.totalBays || 0)}
            {kpi('Conves', operationalStats.deck || 0)}
            {kpi('Porao', operationalStats.hold || 0)}
            {kpi('Descarga', operationalStats.discharge || 0)}
            {kpi('Embarque', operationalStats.loading || 0)}
            {kpi('Reefer', operationalStats.reefer || 0)}
            {kpi('DG / OOG', `${operationalStats.dg || 0} / ${operationalStats.oog || 0}`, 'text-amber-300')}
          </div>
        )}
      </div>

      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-4">
          <UploadCloud className="w-12 h-12 text-cyan-700 mx-auto" />
          <p className="text-sm font-black text-slate-700 dark:text-slate-200">Arraste o PDF de Split aqui</p>
          <p className="text-xs text-slate-400">ou selecione manualmente</p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-black text-xs rounded-xl transition-all"
            >
              Selecionar Arquivo
            </button>
            <button
              disabled={!file || parsing}
              onClick={onAnalyze}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all"
            >
              {parsing ? 'Analisando...' : 'Executar Analise Inteligente'}
            </button>
            <button
              disabled={!summary}
              onClick={() => setShowDeveloper((v) => !v)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" /> {showDeveloper ? 'Ocultar Modo Dev' : 'Modo Dev'}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={() => onSelectFile()}
          />

          {file && <p className="text-xs font-semibold text-slate-500">Arquivo: {file.name}</p>}
        </div>
      </div>

      {parsing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-cyan-700 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-black text-slate-500">Pipeline em execucao... {progress}%</p>

          {ocrProgress && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-black">
              OCR com Gemini Vision: {ocrProgress.current}/{ocrProgress.total} paginas
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-black">
          Erro: {errorMessage}
        </div>
      )}

      {extractionErrors.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-black space-y-1">
          <p>{extractionErrors.length} erro(s) durante a extracao:</p>
          {extractionErrors.map((err, idx) => (
            <p key={`${err}-${idx}`} className="text-[11px]">- {err}</p>
          ))}
        </div>
      )}

      {extractedText && extractionMethod && (
        <div className={`rounded-2xl p-4 border ${extractionMethod === 'ocr' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700">
              <Info className="w-4 h-4" />
              {extractionMethod === 'ocr' ? 'Extracao hibrida com OCR' : 'Texto nativo predominante'}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> {copySuccess ? 'Copiado' : 'Copiar Texto'}
              </button>
              <button
                onClick={handleExportJson}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Exportar JSON
              </button>
              <button
                onClick={() => setShowTextViewer(!showTextViewer)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black"
              >
                {showTextViewer ? 'Ocultar Texto' : 'Ver Texto OCR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Resumo do Documento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <p><span className="text-slate-400">Navio:</span> {displayValue(summary.shipName, summary.shipNameSource)}</p>
              <p><span className="text-slate-400">Viagem:</span> {displayValue(summary.voyage, summary.voyageSource)}</p>
              <p><span className="text-slate-400">Berco:</span> {displayValue(summary.berth, summary.berthSource)}</p>
              <p><span className="text-slate-400">Confianca:</span> {Math.round((summary.confidence || 0) * 100)}%</p>
              <p><span className="text-slate-400">Descarga:</span> {displayValue(summary.discharge, summary.dischargeSource)}</p>
              <p><span className="text-slate-400">Embarque:</span> {displayValue(summary.load, summary.loadSource)}</p>
              <p><span className="text-slate-400">Deck:</span> {operationalStats.deck || 0}</p>
              <p><span className="text-slate-400">Hold:</span> {operationalStats.hold || 0}</p>
            </div>
            <p className="text-xs mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{summary.smartSummary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Mapa Operacional</h3>
              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between"><span>Resumo Geral</span><span>{summary?.operationalMap?.resumoGeral?.total || 0}</span></div>
                <div className="flex justify-between"><span>Conves</span><span>{summary?.operationalMap?.conves || 0}</span></div>
                <div className="flex justify-between"><span>Porao</span><span>{summary?.operationalMap?.porao || 0}</span></div>
                <div className="flex justify-between"><span>Descarga</span><span>{summary?.operationalMap?.descarga || 0}</span></div>
                <div className="flex justify-between"><span>Embarque</span><span>{summary?.operationalMap?.embarque || 0}</span></div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-black"><span>Total</span><span>{summary?.operationalMap?.total || 0}</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Métricas de Pipeline</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">OCR: {summary?.pipelineMetrics?.ocrTimeMs || 0}ms</div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">Visao: {summary?.pipelineMetrics?.visionTimeMs || 0}ms</div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">IA: {summary?.pipelineMetrics?.aiTimeMs || 0}ms</div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">Bays: {summary?.pipelineMetrics?.baysCount || 0}</div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">Containers: {summary?.pipelineMetrics?.containersCount || 0}</div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">Confianca: {Math.round((summary?.pipelineMetrics?.confidence || 0) * 100)}%</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Containers por Bay</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.containersByBay || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bay" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#0f766e" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Conves x Porao</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.deckHoldByBay || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bay" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="deck" fill="#0284c7" name="Conves" />
                    <Bar dataKey="hold" fill="#f97316" name="Porao" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Descarga x Embarque por Bay</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.dischargeLoadByBay || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bay" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="descarga" fill="#16a34a" name="Descarga" />
                    <Bar dataKey="embarque" fill="#7c3aed" name="Embarque" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-3">Reefer e DG por Bay</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(chartData.reeferByBay || []).map((r: any, i: number) => ({ ...r, dg: chartData.dgByBay?.[i]?.dg || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bay" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="reefer" fill="#0891b2" name="Reefer" />
                    <Bar dataKey="dg" fill="#dc2626" name="DG" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black mb-3">Tabela Operacional por Bay</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <th className="text-left p-2">Bay</th>
                    <th className="text-right p-2">Conves</th>
                    <th className="text-right p-2">Porao</th>
                    <th className="text-right p-2">20'</th>
                    <th className="text-right p-2">40'</th>
                    <th className="text-right p-2">45'</th>
                    <th className="text-right p-2">Reefer</th>
                    <th className="text-right p-2">DG</th>
                    <th className="text-right p-2">OOG</th>
                    <th className="text-right p-2">Tank</th>
                    <th className="text-right p-2">Flat</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Confianca</th>
                  </tr>
                </thead>
                <tbody>
                  {bayTable.map((row: any) => (
                    <tr
                      key={row.bay}
                      className="border-b border-slate-200 dark:border-slate-700 hover:bg-cyan-50/70 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => setSelectedBay(summary?.bays?.find((b: any) => b.id === row.bay) || null)}
                    >
                      <td className="p-2 font-black">{row.bay}</td>
                      <td className="p-2 text-right">{row.deck}</td>
                      <td className="p-2 text-right">{row.hold}</td>
                      <td className="p-2 text-right">{row.twenty}</td>
                      <td className="p-2 text-right">{row.forty}</td>
                      <td className="p-2 text-right">{row.fortyFive}</td>
                      <td className="p-2 text-right">{row.reefer}</td>
                      <td className="p-2 text-right">{row.dg}</td>
                      <td className="p-2 text-right">{row.oog}</td>
                      <td className="p-2 text-right">{row.tank}</td>
                      <td className="p-2 text-right">{row.flat}</td>
                      <td className="p-2 text-right font-black">{row.total}</td>
                      <td className="p-2 text-right">{Math.round((row.confidence || 0) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black mb-3">Bays Detectadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(summary.bays || []).map((b: any) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-cyan-400 cursor-pointer"
                  onClick={() => setSelectedBay(b)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-black text-xs">BAY {b.id}</h4>
                    <span className="text-xs font-black text-cyan-700">{b.containerCount} cont.</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <p>Dk: {b.deck || 0}</p>
                    <p>Hd: {b.hold || 0}</p>
                    <p>Rf: {b.reefer || 0}</p>
                    <p>DG: {b.dg || 0}</p>
                    <p>OOG: {b.oog || 0}</p>
                    <p>Total: {b.containerCount || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {selectedBay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">BAY {selectedBay.id} - detalhe operacional</h3>
                <p className="text-[11px] text-slate-500">Total {selectedBay.containerCount} | Conves {selectedBay.deck || 0} | Porao {selectedBay.hold || 0}</p>
              </div>
              <button onClick={() => setSelectedBay(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 overflow-auto max-h-[76vh]">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <h4 className="text-xs font-black mb-2">Imagem ampliada da pagina</h4>
                {selectedBayPage?.image ? (
                  <img src={selectedBayPage.image} alt={`Bay ${selectedBay.id}`} className="w-full rounded-lg border border-slate-200 dark:border-slate-700" />
                ) : (
                  <p className="text-xs text-slate-500">Nao foi possivel associar imagem desta bay.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <h4 className="text-xs font-black mb-2">Containers detectados</h4>
                <div className="space-y-1 max-h-[55vh] overflow-auto">
                  {(selectedBay.containers || []).map((c: any, idx: number) => (
                    <button
                      key={`${c.number || c.position}-${idx}`}
                      onClick={() => setSelectedContainer(c)}
                      className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-[11px] hover:bg-cyan-50 dark:hover:bg-slate-800"
                    >
                      {c.position} - {c.number || 's/ numero'} {c.iso ? `(${c.iso})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedContainer && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black">Container {selectedContainer.number || 's/ numero'}</h3>
              <button onClick={() => setSelectedContainer(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2 text-xs font-semibold">
              <p>Tipo: {selectedContainer.iso || '-'}</p>
              <p>ISO: {selectedContainer.iso || '-'}</p>
              <p>Bay: {selectedContainer.bay || '-'}</p>
              <p>Row: {selectedContainer.row || '-'}</p>
              <p>Tier: {selectedContainer.tier || '-'}</p>
              <p>Deck/Hold: {selectedContainer.deckOrHold || '-'}</p>
              <p>Reefer: {selectedContainer.isReefer ? 'Sim' : 'Nao'}</p>
              <p>DG: {selectedContainer.isDG ? 'Sim' : 'Nao'}</p>
              <p>OOG: {selectedContainer.isOOG ? 'Sim' : 'Nao'}</p>
              <p>Tank: {selectedContainer.isTank ? 'Sim' : 'Nao'}</p>
              <p>Flat: {selectedContainer.isFlat ? 'Sim' : 'Nao'}</p>
              <p>Operacao: {selectedContainer.operation || 'unknown'}</p>
            </div>
          </div>
        </div>
      )}

      {showTextViewer && extractedText && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Texto extraido do PDF</h3>
                <p className="text-[11px] text-slate-400">
                  {extractionMethod === 'ocr' ? 'Extraido via OCR + nativo' : 'Texto nativo'}
                </p>
              </div>
              <button onClick={() => setShowTextViewer(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                {extractedText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {showDeveloper && summary && (
        <div className="bg-black text-emerald-300 rounded-2xl p-4 border border-emerald-900 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
            <Wrench className="w-4 h-4" />
            Modo Desenvolvedor
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-900/70 p-3 bg-emerald-950/30">
              <h4 className="text-xs font-black mb-2">Tempos e Logs</h4>
              <div className="text-[11px] space-y-1">
                <p>Total: {summary?.developerMode?.timing?.totalMs || 0}ms</p>
                <p>OCR: {summary?.developerMode?.timing?.ocrMs || 0}ms</p>
                <p>Visao: {summary?.developerMode?.timing?.visionMs || 0}ms</p>
                <p>IA: {summary?.developerMode?.timing?.aiMs || 0}ms</p>
              </div>
              <div className="mt-3 max-h-40 overflow-auto text-[10px] space-y-1">
                {(summary?.developerMode?.logs || []).map((l: any, idx: number) => (
                  <p key={`${l.stage}-${idx}`}>[{l.elapsedMs}ms] {l.stage} :: {JSON.stringify(l.details)}</p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-900/70 p-3 bg-emerald-950/30">
              <h4 className="text-xs font-black mb-2">JSON Gerado</h4>
              <pre className="text-[10px] whitespace-pre-wrap break-words max-h-56 overflow-auto">
                {JSON.stringify(summary?.finalJson || {}, null, 2)}
              </pre>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/70 p-3 bg-emerald-950/30">
            <h4 className="text-xs font-black mb-2">Paginas Tecnicas (OCR + CV + tipo)</h4>
            <div className="space-y-3 max-h-[420px] overflow-auto">
              {(summary?.developerMode?.pages || []).map((page: any) => (
                <div key={page.pageNumber} className="border border-emerald-900/70 rounded-lg p-2">
                  <p className="text-[11px] font-black">
                    Pagina {page.pageNumber} | Tipo: {page.type} | Confianca: {Math.round((page.confidence || 0) * 100)}%
                  </p>
                  <p className="text-[10px]">Bays: {(page.bayNumbers || []).join(', ') || '-'}</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                    <div>
                      {page.image ? <img src={page.image} alt={`pagina-${page.pageNumber}`} className="w-full rounded border border-emerald-900/70" /> : null}
                    </div>
                    <pre className="text-[10px] whitespace-pre-wrap break-words max-h-56 overflow-auto bg-black/40 rounded p-2 border border-emerald-900/60">
                      {String(page.ocrText || '').slice(0, 5000)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!summary && !parsing && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 p-4 text-xs text-slate-500 dark:text-slate-400">
          O sistema popula automaticamente o painel quando voce seleciona o PDF.
        </div>
      )}

      <div className="fixed right-4 bottom-4 w-[330px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar bay"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
          <button
            onClick={onSearch}
            className="px-2.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {searchResult && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs">
            {searchResult.message ? (
              <p className="font-semibold text-slate-600 dark:text-slate-300">{searchResult.message}</p>
            ) : (
              <div className="space-y-1 text-slate-700 dark:text-slate-200 font-semibold">
                <p>BAY {searchResult.id}</p>
                <p>Total: {searchResult.containerCount}</p>
                <p>Conves: {searchResult.deck || 0} | Porao: {searchResult.hold || 0}</p>
                <button
                  onClick={() => setSelectedBay(searchResult)}
                  className="mt-1 px-2 py-1 rounded-md bg-cyan-700 text-white text-[11px] font-black"
                >
                  Abrir detalhe
                </button>
              </div>
            )}
          </div>
        )}

        {extractionErrors.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 font-bold flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
            <span>{extractionErrors.length} alerta(s) no processamento</span>
          </div>
        )}

        {!summary && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Aguardando analise de PDF
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanejamentoSplit;
