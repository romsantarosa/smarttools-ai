import React, { useEffect, useState, useRef } from 'react';
import {
  UploadCloud,
  Search,
  Copy,
  Download,
  Info,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
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

export const PlanejamentoSplit: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<'native' | 'ocr' | null>(null);
  const [extractionErrors, setExtractionErrors] = useState<string[]>([]);
  const [showTextViewer, setShowTextViewer] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);

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
    setOcrProgress(null);
    setCopySuccess(false);

    try {
      const imported = await importDocumentAndAnalyze(
        file,
        (pct) => setProgress(pct),
        (current, total) => setOcrProgress({ current, total })
      );

      setExtractedText(imported.text);
      setExtractionMethod(imported.extractionMethod === 'sheet' ? 'native' : imported.extractionMethod);
      if (imported.errors.length > 0) {
        setExtractionErrors(imported.errors);
      }

      setSummary(imported.analysis);
      setProgress(100);
      setShowTextViewer(false);
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
    setSearchResult(found ?? { message: 'Bay nao encontrada nas tabelas de alerta' });
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
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `split-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Analise de Planejamento Split
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Planejamento Split</h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Envie o PDF, extraia os dados do planejamento e gere o resumo operacional padronizado.
          </p>
        </div>
      </div>

      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-4">
          <UploadCloud className="w-12 h-12 text-blue-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Arraste o arquivo Split (.PDF) aqui</p>
          <p className="text-xs text-slate-400">ou</p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all"
            >
              Selecionar Arquivo
            </button>
            <button
              disabled={!file || parsing}
              onClick={onAnalyze}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all"
            >
              {parsing ? 'Analisando...' : 'Analisar Split'}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={() => onSelectFile()}
          />

          {file && <p className="text-xs font-semibold text-slate-500">Arquivo selecionado: {file.name}</p>}
        </div>
      </div>

      {parsing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold text-slate-500">Processando... {progress}%</p>

          {ocrProgress && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold">
              OCR com Gemini Vision: {ocrProgress.current}/{ocrProgress.total} paginas
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold">
          Erro: {errorMessage}
        </div>
      )}

      {extractionErrors.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold space-y-1">
          <p>{extractionErrors.length} erro(s) durante a extracao:</p>
          {extractionErrors.map((err, idx) => (
            <p key={`${err}-${idx}`} className="text-[11px]">- {err}</p>
          ))}
        </div>
      )}

      {extractedText && extractionMethod && (
        <div className={`rounded-2xl p-4 border ${extractionMethod === 'ocr' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Info className="w-4 h-4" />
              {extractionMethod === 'ocr' ? 'OCR com Gemini Vision' : 'Texto nativo do PDF'}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> {copySuccess ? 'Copiado' : 'Copiar Texto'}
              </button>
              <button
                onClick={handleExportJson}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Exportar JSON
              </button>
              <button
                onClick={() => setShowTextViewer(!showTextViewer)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold"
              >
                {showTextViewer ? 'Ocultar Texto' : 'Ver Texto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTextViewer && extractedText && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Texto extraido do PDF</h3>
                <p className="text-[11px] text-slate-400">
                  {extractionMethod === 'ocr' ? 'Extraido via OCR (Gemini Vision)' : 'Texto nativo'}
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

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                {copySuccess ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => setShowTextViewer(false)}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Resumo do Navio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <p><span className="text-slate-400">Nome:</span> {displayValue(summary.shipName, summary.shipNameSource)}</p>
              <p><span className="text-slate-400">Viagem:</span> {displayValue(summary.voyage, summary.voyageSource)}</p>
              <p><span className="text-slate-400">Operador:</span> {displayValue(summary.operator, summary.operatorSource)}</p>
              <p><span className="text-slate-400">ETA:</span> {displayValue(summary.eta, summary.etaSource)}</p>
              <p><span className="text-slate-400">ETB:</span> {displayValue(summary.etb, summary.etbSource)}</p>
              <p><span className="text-slate-400">Berco:</span> {displayValue(summary.berth, summary.berthSource)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Resumo da Operacao</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <p><span className="text-slate-400">Descarga total:</span> {displayValue(summary.discharge, summary.dischargeSource)}</p>
              <p><span className="text-slate-400">Descarga restante:</span> {summary.dischargeRemaining ?? '-'}</p>
              <p><span className="text-slate-400">Embarque total:</span> {displayValue(summary.load, summary.loadSource)}</p>
              <p><span className="text-slate-400">Embarque restante:</span> {summary.loadRemaining ?? '-'}</p>
              <p><span className="text-slate-400">Reefers positivos:</span> {summary.reefersPositive ?? 0}</p>
              <p><span className="text-slate-400">Reefers negativos:</span> {summary.reefersNegative ?? 0}</p>
              <p><span className="text-slate-400">IMO:</span> {summary.imo ?? 0}</p>
              <p><span className="text-slate-400">OOG:</span> {summary.oog ?? 0}</p>
              <p><span className="text-slate-400">Direct Delivery:</span> {summary.directDelivery ?? 0}</p>
            </div>
          </div>

          {summary.alerts?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Alertas</h3>
              <div className="flex flex-wrap gap-2">
                {summary.alerts.map((a: string) => (
                  <span key={a} className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-black">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">Bays com conteineres em alerta</h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Somente bays citadas nas tabelas de alerta do PDF (dados reais).
            </p>

            {(!summary.bays || summary.bays.length === 0) && (
              <p className="text-xs text-slate-500 font-semibold">Nenhuma bay com conteineres de alerta foi encontrada.</p>
            )}

            <div className="space-y-3">
              {summary.bays?.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-black text-xs">BAY {b.id}</h4>
                    <span className="text-xs font-bold text-slate-500">{b.containerCount} conteiner(es)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {b.sections.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {b.containers.map((c: any) => (
                      <p key={c.cntrNo ?? c.stowage}>
                        {c.stowage} - {c.cntrNo ?? 's/ ID'} {c.iso ? `(${c.iso})` : ''}
                        {c.imdgClasses ? ` | IMDG: ${c.imdgClasses}` : ''}
                        {c.oog ? ` | OOG: ${c.oog}` : ''}
                        {c.weight ? ` | ${c.weight}t` : ''}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">Resumo Inteligente</h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{summary.smartSummary}</p>
          </div>
        </motion.div>
      )}

      {!summary && !parsing && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 p-4 text-xs text-slate-500 dark:text-slate-400">
          Solte um PDF, imagem, planilha ou TXT aqui para iniciar a importação automática.
        </div>
      )}

      <div className="fixed right-4 bottom-4 w-[320px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar bay"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
          <button
            onClick={onSearch}
            className="px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
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
                <p>Conteineres: {searchResult.containerCount}</p>
                <p>Secoes: {searchResult.sections.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanejamentoSplit;
