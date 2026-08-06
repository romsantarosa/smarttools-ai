import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileJson,
  FileText,
  Info,
  Pencil,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
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
import { analyzeSplitFromFile, type SplitBayAnalysisResult, type SplitBayRow } from '../services/splitBayReaderService';
import {
  computeFileSha256,
  deleteSplitRecord,
  findRecordByFileHash,
  getLatestRecordPerBerth,
  getRecordsByBerth,
  saveSplitRecord,
  updateSplitRecord,
  SPLIT_BERTHS,
  type SplitBerth,
  type SplitRecord,
} from '../services/splitPersistenceService';

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

function normalizeBerthLabel(value?: string): string {
  const raw = (value || '').toString().trim();
  if (!raw) return '—';

  const upper = raw.toUpperCase();
  if (upper.includes('PONTO 1') || upper.includes('BTP 1')) return 'BTP 1';
  if (upper.includes('PONTO 2') || upper.includes('BTP 2')) return 'BTP 2';
  if (upper.includes('PONTO 3') || upper.includes('BTP 3')) return 'BTP 3';
  if (upper.includes('BTP')) return raw;

  return raw;
}

function persistSplitSnapshot(snapshot: Record<string, any>) {
  try {
    const normalizedSnapshot = {
      ...snapshot,
      updatedAt: snapshot.updatedAt || new Date().toISOString(),
    };

    const existingRaw = localStorage.getItem('btp_split_analysis_history');
    const history = existingRaw ? JSON.parse(existingRaw) : [];

    const nextHistory = [normalizedSnapshot, ...Array.isArray(history) ? history : []]
      .filter((item) => item && typeof item === 'object')
      .slice(0, 12);

    localStorage.setItem('btp_split_analysis_history', JSON.stringify(nextHistory));
    localStorage.setItem('btp_last_split_summary', JSON.stringify(normalizedSnapshot));
    window.dispatchEvent(new Event('btp-split-snapshot-updated'));
  } catch {
    // noop
  }
}

const SPLIT_BERTH_CACHE_KEY = 'btp_split_by_berth_v1';
const BERTH_CARDS = ['BTP 1', 'BTP 2', 'BTP 3'];

interface SavedBerthSplit {
  berthLabel: string;
  savedAt: string;
  fileName: string;
  extractionMethod: 'native' | 'ocr' | null;
  extractedText: string | null;
  analysis: any;
}

// Remove imagens em base64 do modo desenvolvedor antes de gravar no localStorage (evita estourar a cota).
function stripHeavyAnalysisData(analysis: any): any {
  if (!analysis || typeof analysis !== 'object') return analysis;

  const pages = analysis?.developerMode?.pages;
  if (!Array.isArray(pages)) return analysis;

  return {
    ...analysis,
    developerMode: {
      ...analysis.developerMode,
      pages: pages.map((page: any) => ({ ...page, image: null })),
    },
  };
}

function loadBerthSplitCache(): Record<string, SavedBerthSplit> {
  try {
    const raw = localStorage.getItem(SPLIT_BERTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveBerthSplitCache(cache: Record<string, SavedBerthSplit>) {
  try {
    localStorage.setItem(SPLIT_BERTH_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[PlanejamentoSplit] Falha ao salvar cache de split por berco:', err);
  }
}

function formatSplitMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Analisando...';
  return value.toLocaleString('pt-BR');
}

function kpi(label: string, value: number | string | null | undefined, accent = 'text-cyan-300') {
  const displayValue = value === null || value === undefined ? '—' : value;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">{label}</p>
      <p className={`text-xl font-black ${accent}`}>{displayValue}</p>
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

  const [berthCache, setBerthCache] = useState<Record<string, SavedBerthSplit>>(() => loadBerthSplitCache());
  const [activeBerth, setActiveBerth] = useState<string | null>(null);
  const [showLegacyMode, setShowLegacyMode] = useState(false);

  // ---- Novo fluxo determinístico de SPLIT (página 1 + perfil do navio) ----
  const splitFileRef = useRef<HTMLInputElement | null>(null);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitFileHash, setSplitFileHash] = useState<string | null>(null);
  const [splitAnalyzing, setSplitAnalyzing] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitResult, setSplitResult] = useState<SplitBayAnalysisResult | null>(null);
  const [splitEditableBays, setSplitEditableBays] = useState<SplitBayRow[]>([]);
  const [splitVesselName, setSplitVesselName] = useState('');
  const [splitVoyage, setSplitVoyage] = useState('');
  const [splitConfirmed, setSplitConfirmed] = useState(false);
  const [splitSelectedBerth, setSplitSelectedBerth] = useState<SplitBerth | null>(null);
  const [splitSavedRecord, setSplitSavedRecord] = useState<SplitRecord | null>(null);
  const [splitDuplicateRecord, setSplitDuplicateRecord] = useState<SplitRecord | null>(null);
  const [splitPendingFile, setSplitPendingFile] = useState<File | null>(null);
  const [splitShowCrop, setSplitShowCrop] = useState(false);
  const [splitHistoryFilter, setSplitHistoryFilter] = useState<'TODOS' | SplitBerth>('TODOS');
  const [splitRecordsVersion, setSplitRecordsVersion] = useState(0);

  // ---- Edição/exclusão de SPLIT já salvo ----
  const [editingRecord, setEditingRecord] = useState<SplitRecord | null>(null);
  const [editBays, setEditBays] = useState<SplitBayRow[]>([]);
  const [editVessel, setEditVessel] = useState('');
  const [editVoyage, setEditVoyage] = useState('');
  const [editBerth, setEditBerth] = useState<SplitBerth | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const latestPerBerth = useMemo(() => getLatestRecordPerBerth(), [splitRecordsVersion]);
  const splitHistoryRecords = useMemo(() => getRecordsByBerth(splitHistoryFilter), [splitHistoryFilter, splitRecordsVersion]);

  const splitComputedTotals = useMemo(() => {
    const totalMoves = splitEditableBays.reduce((sum, row) => sum + (row.total ?? 0), 0);
    const totalDischarge = splitEditableBays.reduce((sum, row) => sum + row.discharge, 0);
    const totalLoad = splitEditableBays.reduce((sum, row) => sum + row.load, 0);
    const numberOfActiveBays = splitEditableBays.filter((row) => (row.total ?? 0) > 0).length;
    return {
      totalDischarge,
      totalLoad,
      totalMoves,
      numberOfActiveBays,
    };
  }, [splitEditableBays]);

  const splitChartData = useMemo(
    () =>
      splitEditableBays
        .filter((row) => (row.total ?? 0) > 0 || row.discharge > 0 || row.load > 0)
        .map((row) => ({ bay: row.bay, descarga: row.discharge, embarque: row.load })),
    [splitEditableBays]
  );

  const resetSplitFlow = () => {
    setSplitResult(null);
    setSplitEditableBays([]);
    setSplitConfirmed(false);
    setSplitSelectedBerth(null);
    setSplitError(null);
    setSplitSavedRecord(null);
    setSplitDuplicateRecord(null);
    setSplitPendingFile(null);
    setSplitVesselName('');
    setSplitVoyage('');
    setSplitFileHash(null);
  };

  const onSplitFileSelected = (f?: File) => {
    const fileToUse = f ?? splitFileRef.current?.files?.[0] ?? null;
    if (!fileToUse) return;
    resetSplitFlow();
    setSplitFile(fileToUse);
  };

  const onSplitDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onSplitFileSelected(f);
  };

  const applyAnalysisResult = (result: SplitBayAnalysisResult) => {
    setSplitResult(result);
    setSplitEditableBays(result.bays);
    setSplitVesselName(result.vessel || '');
    setSplitVoyage(result.voyage || '');
  };

  const onAnalyzeSplitClick = async () => {
    if (!splitFile) return;
    resetSplitFlow();
    setSplitAnalyzing(true);

    try {
      const hash = await computeFileSha256(splitFile);
      setSplitFileHash(hash);

      const existing = findRecordByFileHash(hash);
      if (existing) {
        setSplitDuplicateRecord(existing);
        setSplitPendingFile(splitFile);
        return;
      }

      const result = await analyzeSplitFromFile(splitFile);
      applyAnalysisResult(result);
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'Erro inesperado ao analisar o SPLIT.');
    } finally {
      setSplitAnalyzing(false);
    }
  };

  const onOpenSavedDuplicate = () => {
    if (!splitDuplicateRecord) return;
    setSplitVesselName(splitDuplicateRecord.vessel);
    setSplitVoyage(splitDuplicateRecord.voyage || '');
    setSplitEditableBays(
      splitDuplicateRecord.bayData.map((row) => ({
        ...row,
        totalConfidence: 1,
        totalNeedsReview: false,
        compositionMismatch: row.discharge + row.load !== row.total,
        confidence: 1,
        needsReview: false,
      }))
    );
    setSplitSelectedBerth(splitDuplicateRecord.berth);
    setSplitSavedRecord(splitDuplicateRecord);
    setSplitConfirmed(true);
    setSplitDuplicateRecord(null);
    setSplitPendingFile(null);
  };

  const onReanalyzeAnyway = async () => {
    const pending = splitPendingFile;
    setSplitDuplicateRecord(null);
    setSplitPendingFile(null);
    if (!pending) return;

    setSplitAnalyzing(true);
    setSplitError(null);
    try {
      const result = await analyzeSplitFromFile(pending);
      applyAnalysisResult(result);
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'Erro inesperado ao analisar o SPLIT.');
    } finally {
      setSplitAnalyzing(false);
    }
  };

  function makeBayFieldUpdater(setter: React.Dispatch<React.SetStateAction<SplitBayRow[]>>) {
    return (index: number, field: 'dsDeck' | 'ldDeck' | 'dsHold' | 'ldHold', rawValue: string) => {
      setter((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          const numeric = rawValue.trim() === '' ? null : Math.max(0, Math.round(Number(rawValue)));
          const safeNumeric = numeric !== null && Number.isFinite(numeric) ? numeric : null;
          const next: SplitBayRow = { ...row, [field]: safeNumeric };
          const discharge = (next.dsDeck ?? 0) + (next.dsHold ?? 0);
          const load = (next.ldDeck ?? 0) + (next.ldHold ?? 0);
          // O TOTAL OFICIAL (caixa branca) nunca é recalculado a partir de descarga/embarque.
          const compositionMismatch = next.total !== null && discharge + load !== next.total;
          return {
            ...next,
            discharge,
            load,
            confidence: 1,
            compositionMismatch,
            needsReview: next.totalNeedsReview || compositionMismatch,
          };
        })
      );
    };
  }

  function makeBayTotalUpdater(setter: React.Dispatch<React.SetStateAction<SplitBayRow[]>>) {
    return (index: number, rawValue: string) => {
      setter((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          const numeric = rawValue.trim() === '' ? null : Math.max(0, Math.round(Number(rawValue)));
          const safeNumeric = numeric !== null && Number.isFinite(numeric) ? numeric : null;
          const compositionMismatch = safeNumeric !== null && row.discharge + row.load !== safeNumeric;
          return {
            ...row,
            total: safeNumeric,
            totalConfidence: 1,
            totalNeedsReview: safeNumeric === null,
            compositionMismatch,
            needsReview: safeNumeric === null || compositionMismatch,
          };
        })
      );
    };
  }

  const updateSplitBayField = makeBayFieldUpdater(setSplitEditableBays);
  const updateSplitBayTotal = makeBayTotalUpdater(setSplitEditableBays);

  const onConfirmSplitAnalysis = () => {
    setSplitConfirmed(true);
  };

  const onBackToReview = () => {
    setSplitConfirmed(false);
    setSplitSelectedBerth(null);
  };

  const onSaveSplit = () => {
    if (!splitSelectedBerth || !splitFile || !splitFileHash) return;

    if (splitEditableBays.some((row) => row.total === null)) {
      setSplitError('Existem bays sem o TOTAL oficial confirmado. Preencha o total (caixa branca) de todas as bays antes de salvar.');
      return;
    }

    const record = saveSplitRecord({
      vessel: splitVesselName.trim() || 'Navio não identificado',
      voyage: splitVoyage.trim() || null,
      berth: splitSelectedBerth,
      totalContainers: splitComputedTotals.totalMoves,
      totalDischarge: splitComputedTotals.totalDischarge,
      totalLoad: splitComputedTotals.totalLoad,
      activeBays: splitComputedTotals.numberOfActiveBays,
      bayData: splitEditableBays.map(({ bay, dsDeck, ldDeck, dsHold, ldHold, discharge, load, total }) => ({
        bay,
        dsDeck,
        ldDeck,
        dsHold,
        ldHold,
        discharge,
        load,
        total: total ?? 0,
      })),
      confidence: splitResult?.confidence ?? 1,
      sourceFileHash: splitFileHash,
      fileName: splitFile.name,
    });

    setSplitSavedRecord(record);
    setSplitRecordsVersion((v) => v + 1);
  };

  const onStartNewSplitAnalysis = () => {
    resetSplitFlow();
    setSplitFile(null);
    if (splitFileRef.current) splitFileRef.current.value = '';
  };

  const updateEditBayField = makeBayFieldUpdater(setEditBays);
  const updateEditBayTotal = makeBayTotalUpdater(setEditBays);

  const editComputedTotals = useMemo(() => {
    const totalMoves = editBays.reduce((sum, row) => sum + (row.total ?? 0), 0);
    const totalDischarge = editBays.reduce((sum, row) => sum + row.discharge, 0);
    const totalLoad = editBays.reduce((sum, row) => sum + row.load, 0);
    const numberOfActiveBays = editBays.filter((row) => (row.total ?? 0) > 0).length;
    return { totalDischarge, totalLoad, totalMoves, numberOfActiveBays };
  }, [editBays]);

  const onStartEditRecord = (record: SplitRecord) => {
    setDeleteConfirmId(null);
    setEditingRecord(record);
    setEditVessel(record.vessel);
    setEditVoyage(record.voyage || '');
    setEditBerth(record.berth);
    setEditBays(
      record.bayData.map((row) => ({
        ...row,
        totalConfidence: 1,
        totalNeedsReview: row.total === null,
        compositionMismatch: row.discharge + row.load !== row.total,
        confidence: 1,
        needsReview: row.total === null || row.discharge + row.load !== row.total,
      }))
    );
  };

  const onCancelEdit = () => {
    setEditingRecord(null);
    setEditBays([]);
    setEditVessel('');
    setEditVoyage('');
    setEditBerth(null);
  };

  const onSaveEdit = () => {
    if (!editingRecord || !editBerth) return;

    if (editBays.some((row) => row.total === null)) {
      setSplitError('Existem bays sem o TOTAL oficial confirmado. Preencha o total (caixa branca) de todas as bays antes de salvar.');
      return;
    }

    updateSplitRecord(editingRecord.id, {
      vessel: editVessel.trim() || 'Navio não identificado',
      voyage: editVoyage.trim() || null,
      berth: editBerth,
      totalContainers: editComputedTotals.totalMoves,
      totalDischarge: editComputedTotals.totalDischarge,
      totalLoad: editComputedTotals.totalLoad,
      activeBays: editComputedTotals.numberOfActiveBays,
      bayData: editBays.map(({ bay, dsDeck, ldDeck, dsHold, ldHold, discharge, load, total }) => ({
        bay,
        dsDeck,
        ldDeck,
        dsHold,
        ldHold,
        discharge,
        load,
        total: total ?? 0,
      })),
      confidence: editingRecord.confidence,
    });

    setSplitRecordsVersion((v) => v + 1);
    onCancelEdit();
  };

  const onRequestDelete = (id: string) => {
    setEditingRecord(null);
    setDeleteConfirmId(id);
  };

  const onConfirmDelete = (id: string) => {
    deleteSplitRecord(id);
    setSplitRecordsVersion((v) => v + 1);
    setDeleteConfirmId(null);
  };

  const onCancelDelete = () => setDeleteConfirmId(null);

  // Restaura a ultima analise salva ao reabrir a pagina/app, para nao perder o que ja foi processado.
  useEffect(() => {
    const entries = Object.values(berthCache);
    if (entries.length === 0) return;

    const mostRecent = entries.reduce((latest, entry) =>
      !latest || new Date(entry.savedAt).getTime() > new Date(latest.savedAt).getTime() ? entry : latest
    , entries[0]);

    if (mostRecent) {
      setSummary(mostRecent.analysis);
      setExtractedText(mostRecent.extractedText);
      setExtractionMethod(mostRecent.extractionMethod);
      setActiveBerth(mostRecent.berthLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadBerth = (berthKey: string) => {
    const entry = berthCache[berthKey];
    if (!entry) return;

    setSummary(entry.analysis);
    setExtractedText(entry.extractedText);
    setExtractionMethod(entry.extractionMethod);
    setActiveBerth(berthKey);
    setSelectedBay(null);
    setSelectedContainer(null);
    setSearch('');
    setSearchResult(null);
    setErrorMessage(null);
    setExtractionErrors([]);
    setShowTextViewer(false);
    setShowDeveloper(false);
  };

  const handleRemoveBerth = (berthKey: string) => {
    const nextCache = { ...berthCache };
    delete nextCache[berthKey];
    setBerthCache(nextCache);
    saveBerthSplitCache(nextCache);

    if (activeBerth === berthKey) {
      setActiveBerth(null);
      setSummary(null);
      setExtractedText(null);
    }
  };

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

      const summaryPayload = imported.analysis || {};
      const headlineMetrics = {
        total: summaryPayload.operationSummary?.totalMovements ?? null,
        discharge: summaryPayload.operationSummary?.discharge?.total ?? null,
        loading: summaryPayload.operationSummary?.loading?.total ?? null,
        deck: summaryPayload.qcPlanSummary?.deckTotal ?? null,
        hold: summaryPayload.qcPlanSummary?.holdTotal ?? null,
        bays: summaryPayload.bays?.length ?? summaryPayload.operationalStats?.totalBays ?? null,
        reefer: summaryPayload.operationalStats?.reefer ?? null,
        dg: summaryPayload.operationalStats?.dg ?? null,
        oog: summaryPayload.operationalStats?.oog ?? null,
      };
      const snapshot = {
        updatedAt: new Date().toISOString(),
        fileName: file?.name || 'split.pdf',
        shipName: summaryPayload.shipName || 'Navio não identificado',
        berth: summaryPayload.berth || '—',
        berthLabel: normalizeBerthLabel(summaryPayload.berth || '—'),
        totalContainers: headlineMetrics.total ?? 0,
        totalMovements: headlineMetrics.total ?? 0,
        loading: headlineMetrics.loading ?? 0,
        discharge: headlineMetrics.discharge ?? 0,
        reefer: headlineMetrics.reefer ?? 0,
        dg: headlineMetrics.dg ?? 0,
        oog: headlineMetrics.oog ?? 0,
        totalBays: headlineMetrics.bays ?? 0,
        deck: headlineMetrics.deck ?? 0,
        hold: headlineMetrics.hold ?? 0,
      };

      console.log('[SPLIT][FINAL RESULT]', imported.analysis);
      console.log('[SPLIT][OPERATION SUMMARY]', imported.analysis?.operationSummary);
      console.log('[SPLIT][QC PLAN]', imported.analysis?.qcPlanSummary);
      console.log('[SPLIT][LEGACY STATISTICS]', imported.analysis?.operationalStats);
      console.log('[SPLIT][PDF NATIVE TEXT]', imported.text);

      persistSplitSnapshot(snapshot);

      const berthKey = normalizeBerthLabel(summaryPayload.berth || '—');
      if (BERTH_CARDS.includes(berthKey)) {
        const berthEntry: SavedBerthSplit = {
          berthLabel: berthKey,
          savedAt: new Date().toISOString(),
          fileName: file.name,
          extractionMethod: imported.extractionMethod === 'sheet' ? 'native' : imported.extractionMethod,
          extractedText: imported.text,
          analysis: stripHeavyAnalysisData(imported.analysis),
        };
        const nextCache = { ...berthCache, [berthKey]: berthEntry };
        setBerthCache(nextCache);
        saveBerthSplitCache(nextCache);
        setActiveBerth(berthKey);
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
  const operationalSummary = summary?.operationSummary || summary?.operationalSummary || null;
  const qcPlanSummary = summary?.qcPlanSummary || null;
  const validation = summary?.validation || null;
  const chartData = summary?.chartData || {};
  const bayTable = summary?.bayTable || [];

  const headlineMetrics = {
    total: operationalSummary?.totalMovements ?? null,
    discharge: operationalSummary?.discharge?.total ?? null,
    loading: operationalSummary?.loading?.total ?? null,
    deck: qcPlanSummary?.deckTotal ?? null,
    hold: qcPlanSummary?.holdTotal ?? null,
    bays: summary?.bays?.length ?? operationalStats.totalBays ?? null,
    reefer: operationalStats.reefer ?? null,
    dg: operationalStats.dg ?? null,
    oog: operationalStats.oog ?? null,
  };

  const headlineSources = {
    total: 'PDF Summary',
    discharge: 'PDF Summary',
    loading: 'PDF Summary',
    deck: 'QC Plan',
    hold: 'QC Plan',
    bays: 'Legacy Vision',
    reefer: 'Legacy Vision',
    dg: 'Legacy Vision',
    oog: 'Legacy Vision',
  };

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
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Split Analyzer OCR</h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-4xl">
            Selecione um PDF e o sistema executa automaticamente classificação de páginas, OCR, visão computacional,
            fusao por IA e geração do mapa operacional completo por Bay, Conves e Porão.
          </p>
        </div>

        {summary && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {kpi('Total', headlineMetrics.total, 'text-white')}
            {kpi('Bays', headlineMetrics.bays)}
            {kpi('Conves', headlineMetrics.deck)}
            {kpi('Porao', headlineMetrics.hold)}
            {kpi('Descarga', headlineMetrics.discharge)}
            {kpi('Embarque', headlineMetrics.loading)}
            {kpi('Reefer', headlineMetrics.reefer)}
            {kpi('DG / OOG', `${headlineMetrics.dg ?? 0} / ${headlineMetrics.oog ?? 0}`, 'text-amber-300')}
          </div>
        )}
      </div>

      {/* ===== Painel Operacional oficial: BTP 1 / BTP 2 / BTP 3 (navio atualmente salvo em cada berço) ===== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Anchor className="w-4 h-4 text-cyan-600" /> Painel Operacional - Berços
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SPLIT_BERTHS.map((berth) => {
            const record = latestPerBerth[berth];
            return (
              <div
                key={berth}
                className={`rounded-xl border p-4 ${
                  record ? 'border-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/20' : 'border-dashed border-slate-200 dark:border-slate-700 opacity-70'
                }`}
              >
                <h4 className="font-black text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{berth}</h4>
                {record ? (
                  <div className="space-y-1">
                    <p className="font-black text-slate-900 dark:text-white text-sm truncate">{record.vessel}</p>
                    {record.voyage && <p className="text-[11px] text-slate-500">Viagem {record.voyage}</p>}
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 pt-1">
                      <span>Descarga {record.totalDischarge}</span>
                      <span>Embarque {record.totalLoad}</span>
                    </div>
                    <p className="text-xs font-black text-cyan-700 dark:text-cyan-300">Total {record.totalContainers} · {record.activeBays} bays</p>
                    <p className="text-[10px] text-slate-400">
                      {record.updatedAt ? `Editado em ${new Date(record.updatedAt).toLocaleString('pt-BR')}` : new Date(record.createdAt).toLocaleString('pt-BR')}
                    </p>

                    {deleteConfirmId === record.id ? (
                      <div className="pt-2 space-y-1.5">
                        <p className="text-[11px] font-black text-rose-700">Apagar este SPLIT de {berth}?</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => onConfirmDelete(record.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={onCancelDelete}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 pt-2">
                        <button
                          onClick={() => onStartEditRecord(record)}
                          className="px-2.5 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-black flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        <button
                          onClick={() => onRequestDelete(record.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-[11px] font-black flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Apagar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-semibold">Nenhum SPLIT salvo</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editingRecord && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-cyan-300 dark:border-cyan-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-cyan-600" /> Editando SPLIT — {editingRecord.berth}
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              Salvo em {new Date(editingRecord.createdAt).toLocaleString('pt-BR')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 space-y-1 block">
              Navio
              <input
                value={editVessel}
                onChange={(e) => setEditVessel(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
              />
            </label>
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 space-y-1 block">
              Viagem
              <input
                value={editVoyage}
                onChange={(e) => setEditVoyage(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">BERÇO DE ATRACAÇÃO</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SPLIT_BERTHS.map((berth) => (
                <button
                  key={berth}
                  onClick={() => setEditBerth(berth)}
                  className={`px-3 py-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 ${
                    editBerth === berth
                      ? 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-400'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border ${editBerth === berth ? 'bg-cyan-600 border-cyan-600' : 'border-slate-400'}`} />
                  {berth}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpi('Total de contêineres', editComputedTotals.totalMoves, 'text-cyan-700')}
            {kpi('Descarga', editComputedTotals.totalDischarge)}
            {kpi('Embarque', editComputedTotals.totalLoad)}
            {kpi('Bays em operação', editComputedTotals.numberOfActiveBays)}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <th className="text-left p-2">Bay</th>
                  <th className="text-right p-2">Total oficial</th>
                  <th className="text-right p-2">DS-DECK</th>
                  <th className="text-right p-2">LD-DECK</th>
                  <th className="text-right p-2">DS-HOLD</th>
                  <th className="text-right p-2">LD-HOLD</th>
                  <th className="text-right p-2">Descarga</th>
                  <th className="text-right p-2">Embarque</th>
                </tr>
              </thead>
              <tbody>
                {editBays.map((row, idx) => (
                  <tr
                    key={`${row.bay}-${idx}`}
                    className={`border-b border-slate-200 dark:border-slate-700 ${row.compositionMismatch ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="p-2 font-black">BAY {row.bay}</td>
                    <td className="p-1 text-right">
                      <input
                        type="number"
                        min={0}
                        value={row.total ?? ''}
                        placeholder={row.total === null ? '?' : ''}
                        onChange={(e) => updateEditBayTotal(idx, e.target.value)}
                        className="w-20 text-right px-1.5 py-1 rounded-lg border border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-800 text-xs font-black"
                      />
                    </td>
                    {(['dsDeck', 'ldDeck', 'dsHold', 'ldHold'] as const).map((field) => (
                      <td key={field} className="p-1 text-right">
                        <input
                          type="number"
                          min={0}
                          value={row[field] ?? ''}
                          placeholder={row[field] === null ? '?' : ''}
                          onChange={(e) => updateEditBayField(idx, field, e.target.value)}
                          className="w-16 text-right px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                        />
                      </td>
                    ))}
                    <td className={`p-2 text-right font-bold ${row.compositionMismatch ? 'text-amber-600' : ''}`}>{row.discharge}</td>
                    <td className={`p-2 text-right font-bold ${row.compositionMismatch ? 'text-amber-600' : ''}`}>{row.load}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button onClick={onCancelEdit} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300">
              Cancelar
            </button>
            <button
              disabled={!editBerth}
              onClick={onSaveEdit}
              className="px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> SALVAR ALTERAÇÕES
            </button>
          </div>
        </div>
      )}

      {/* ===== Novo SPLIT: analisa SOMENTE a página 1 (perfil longitudinal do navio) ===== */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onSplitDrop}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileJson className="w-4 h-4 text-cyan-600" /> Novo SPLIT
          </h3>
          {splitResult && (
            <span className="text-[11px] font-bold text-slate-400">
              Região:{' '}
              {splitResult.regionSource === 'text-anchors'
                ? 'âncoras de texto (confiável)'
                : splitResult.regionSource === 'vision-fallback'
                ? 'visão computacional (fallback)'
                : 'página inteira (revisar)'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 font-medium mt-1">
          Analisa somente a página 1 e o recorte do perfil do navio (DS-DECK/LD-DECK/DS-HOLD/LD-HOLD). Páginas 2+ e demais tabelas são ignoradas.
        </p>

        {!splitSavedRecord && !splitConfirmed && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center space-y-3 mt-3">
            <UploadCloud className="w-10 h-10 text-cyan-700 mx-auto" />
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">Arraste o PDF de Split aqui</p>
            <p className="text-xs text-slate-400">ou selecione manualmente</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => splitFileRef.current?.click()}
                className="px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-black text-xs rounded-xl transition-all"
              >
                Selecionar Arquivo
              </button>
              <button
                disabled={!splitFile || splitAnalyzing}
                onClick={onAnalyzeSplitClick}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all"
              >
                {splitAnalyzing ? 'Analisando...' : 'Analisar SPLIT'}
              </button>
            </div>
            <input
              ref={splitFileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={() => onSplitFileSelected()}
            />
            {splitFile && <p className="text-xs font-semibold text-slate-500">Arquivo: {splitFile.name}</p>}
          </div>
        )}

        {splitError && (
          <div className="mt-3 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-black">
            Erro: {splitError}
          </div>
        )}

        {splitDuplicateRecord && (
          <div className="mt-3 p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
            <p className="text-xs font-black text-amber-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Este SPLIT já foi analisado anteriormente.
            </p>
            <div className="text-xs font-semibold text-amber-800 space-y-0.5">
              <p>Navio: {splitDuplicateRecord.vessel}</p>
              <p>Data/hora: {new Date(splitDuplicateRecord.createdAt).toLocaleString('pt-BR')}</p>
              <p>Berço: {splitDuplicateRecord.berth}</p>
              <p>
                Resultado salvo: Total {splitDuplicateRecord.totalContainers} (Descarga {splitDuplicateRecord.totalDischarge} / Embarque{' '}
                {splitDuplicateRecord.totalLoad})
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onOpenSavedDuplicate} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black">
                ABRIR ANÁLISE SALVA
              </button>
              <button onClick={onReanalyzeAnyway} className="px-3 py-2 rounded-lg bg-white border border-amber-400 text-amber-800 text-xs font-black">
                ANALISAR NOVAMENTE
              </button>
            </div>
          </div>
        )}

        {splitAnalyzing && (
          <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-black">
            Lendo somente a página 1 e o perfil do navio...
          </div>
        )}

        {splitResult && !splitSavedRecord && (
          <div className="mt-4 space-y-4">
            <div className="text-sm font-black text-slate-900 dark:text-white">SPLIT ANALISADO</div>

            <div
              className={`p-3 rounded-xl border text-xs font-black ${
                splitResult.needsReview ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              {splitResult.needsReview ? 'Leitura do SPLIT precisa de confirmação.' : 'Leitura concluída com boa confiança.'} Confiança geral:{' '}
              {Math.round(splitResult.confidence * 100)}%
            </div>

            {splitResult.warnings.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-[11px] text-amber-800 font-semibold space-y-1">
                {splitResult.warnings.map((w, idx) => (
                  <p key={idx}>- {w}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-black text-slate-600 dark:text-slate-300 space-y-1 block">
                Navio
                <input
                  value={splitVesselName}
                  onChange={(e) => setSplitVesselName(e.target.value)}
                  disabled={splitConfirmed}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold disabled:opacity-70"
                />
              </label>
              <label className="text-xs font-black text-slate-600 dark:text-slate-300 space-y-1 block">
                Viagem
                <input
                  value={splitVoyage}
                  onChange={(e) => setSplitVoyage(e.target.value)}
                  disabled={splitConfirmed}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold disabled:opacity-70"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {kpi('Total de contêineres', splitComputedTotals.totalMoves, 'text-cyan-700')}
              {kpi('Descarga', splitComputedTotals.totalDischarge)}
              {kpi('Embarque', splitComputedTotals.totalLoad)}
              {kpi('Bays em operação', splitComputedTotals.numberOfActiveBays)}
            </div>

            {splitChartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={splitChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bay" tickFormatter={(bay: string) => `BAY ${bay}`} />
                    <YAxis />
                    <Tooltip labelFormatter={(bay) => `BAY ${bay}`} />
                    <Legend />
                    <Bar dataKey="descarga" fill="#16a34a" name="Descarga" />
                    <Bar dataKey="embarque" fill="#7c3aed" name="Embarque" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <th className="text-left p-2">Bay</th>
                    <th className="text-right p-2">Total oficial</th>
                    <th className="text-right p-2">DS-DECK</th>
                    <th className="text-right p-2">LD-DECK</th>
                    <th className="text-right p-2">DS-HOLD</th>
                    <th className="text-right p-2">LD-HOLD</th>
                    <th className="text-right p-2">Descarga</th>
                    <th className="text-right p-2">Embarque</th>
                  </tr>
                </thead>
                <tbody>
                  {splitEditableBays.map((row, idx) => (
                    <tr
                      key={`${row.bay}-${idx}`}
                      className={`border-b border-slate-200 dark:border-slate-700 ${row.needsReview ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
                    >
                      <td className="p-2 font-black">BAY {row.bay}</td>
                      <td className="p-1 text-right">
                        <input
                          type="number"
                          min={0}
                          value={row.total ?? ''}
                          placeholder={row.total === null ? '?' : ''}
                          disabled={splitConfirmed}
                          onChange={(e) => updateSplitBayTotal(idx, e.target.value)}
                          className={`w-20 text-right px-1.5 py-1 rounded-lg border text-xs font-black disabled:opacity-70 ${
                            row.totalNeedsReview ? 'border-amber-400 bg-amber-50' : 'border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-800'
                          }`}
                        />
                      </td>
                      {(['dsDeck', 'ldDeck', 'dsHold', 'ldHold'] as const).map((field) => (
                        <td key={field} className="p-1 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row[field] ?? ''}
                            placeholder={row[field] === null ? '?' : ''}
                            disabled={splitConfirmed}
                            onChange={(e) => updateSplitBayField(idx, field, e.target.value)}
                            className={`w-16 text-right px-1.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-70 ${
                              row[field] === null ? 'border-amber-400 bg-amber-50' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                            }`}
                          />
                        </td>
                      ))}
                      <td className={`p-2 text-right font-bold ${row.compositionMismatch ? 'text-amber-600' : ''}`}>{row.discharge}</td>
                      <td className={`p-2 text-right font-bold ${row.compositionMismatch ? 'text-amber-600' : ''}`}>{row.load}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {splitEditableBays.some((row) => row.compositionMismatch) && (
              <p className="text-[11px] text-amber-700 font-bold">
                Bays com fundo destacado: a soma de descarga+embarque não bate com o TOTAL OFICIAL (caixa branca). O total oficial foi mantido —
                confirme manualmente a composição (descarga/embarque) dessas bays.
              </p>
            )}
            <p className="text-[11px] text-slate-400 font-semibold">
              O TOTAL OFICIAL de cada bay vem da linha de caixas brancas acima do perfil do navio — nunca é recalculado a partir de
              DS-DECK/LD-DECK/DS-HOLD/LD-HOLD. Campos em destaque (?) não puderam ser confirmados automaticamente — confira visualmente e corrija
              antes de confirmar.
            </p>

            {splitResult.croppedImageDataUrl && (
              <div>
                <button
                  onClick={() => setSplitShowCrop((v) => !v)}
                  className="text-[11px] font-black text-cyan-700 flex items-center gap-1"
                >
                  {splitShowCrop ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{' '}
                  {splitShowCrop ? 'Ocultar recorte analisado' : 'Ver recorte analisado (perfil do navio)'}
                </button>
                {splitShowCrop && (
                  <img
                    src={splitResult.croppedImageDataUrl}
                    alt="Perfil do navio recortado"
                    className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                )}
              </div>
            )}

            {!splitConfirmed ? (
              <div className="flex justify-end">
                <button
                  onClick={onConfirmSplitAnalysis}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> CONFIRMAR ANÁLISE
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">BERÇO DE ATRACAÇÃO</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SPLIT_BERTHS.map((berth) => (
                    <button
                      key={berth}
                      onClick={() => setSplitSelectedBerth(berth)}
                      className={`px-3 py-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 ${
                        splitSelectedBerth === berth
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-400'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border ${splitSelectedBerth === berth ? 'bg-cyan-600 border-cyan-600' : 'border-slate-400'}`} />
                      {berth}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button onClick={onBackToReview} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300">
                    Voltar e corrigir
                  </button>
                  <button
                    disabled={!splitSelectedBerth}
                    onClick={onSaveSplit}
                    className="px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-black"
                  >
                    SALVAR SPLIT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {splitSavedRecord && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-300 bg-emerald-50 space-y-2">
            <p className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> SPLIT salvo em {splitSavedRecord.berth}
            </p>
            <div className="text-xs font-semibold text-emerald-900 space-y-0.5">
              <p>
                Navio: {splitSavedRecord.vessel}
                {splitSavedRecord.voyage ? ` · Viagem ${splitSavedRecord.voyage}` : ''}
              </p>
              <p>
                Total: {splitSavedRecord.totalContainers} (Descarga {splitSavedRecord.totalDischarge} / Embarque {splitSavedRecord.totalLoad})
              </p>
              <p>Bays em operação: {splitSavedRecord.activeBays}</p>
              <p>{new Date(splitSavedRecord.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            <button
              onClick={onStartNewSplitAnalysis}
              className="mt-1 px-3 py-2 rounded-lg bg-white border border-emerald-400 text-emerald-800 text-xs font-black flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Analisar novo arquivo
            </button>
          </div>
        )}
      </div>

      {/* ===== Histórico por berço (registros independentes) ===== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">SPLITS SALVOS</h3>
          <div className="flex gap-1.5 flex-wrap">
            {(['TODOS', ...SPLIT_BERTHS] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setSplitHistoryFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${
                  splitHistoryFilter === filterKey ? 'bg-cyan-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {filterKey}
              </button>
            ))}
          </div>
        </div>

        {splitHistoryRecords.length === 0 ? (
          <p className="text-xs text-slate-400 font-semibold">Nenhum SPLIT salvo ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {splitHistoryRecords.map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">{record.berth}</p>
                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{record.vessel}</p>
                <p className="text-[11px] font-bold text-slate-500">
                  Split: Descarga {record.totalDischarge} / Embarque {record.totalLoad}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(record.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                  {record.updatedAt ? ' · editado' : ''}
                </p>

                {deleteConfirmId === record.id ? (
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[11px] font-black text-rose-700">Apagar este registro?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onConfirmDelete(record.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={onCancelDelete}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-black text-slate-600 dark:text-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5 pt-2">
                    <button
                      onClick={() => onStartEditRecord(record)}
                      className="px-2.5 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-black flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => onRequestDelete(record.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-[11px] font-black flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Apagar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setShowLegacyMode((v) => !v)}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
        >
          <Wrench className="w-3.5 h-3.5" /> {showLegacyMode ? 'Ocultar Modo Legado' : 'Modo Legado (análise multi-página / IA — somente inspeção)'}
        </button>
      </div>

      {showLegacyMode && (
      <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Splits Salvos por Berço (legado)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BERTH_CARDS.map((berthKey) => {
            const entry = berthCache[berthKey];
            const isActive = activeBerth === berthKey;
            const bayCount = entry?.analysis?.bays?.length ?? entry?.analysis?.operationalStats?.totalBays ?? 0;
            const containerCount = entry?.analysis?.operationSummary?.totalMovements ?? entry?.analysis?.pipelineMetrics?.containersCount ?? 0;

            return (
              <div
                key={berthKey}
                onClick={() => entry && handleLoadBerth(berthKey)}
                className={`rounded-xl border p-3 transition-all ${
                  isActive
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30'
                    : entry
                    ? 'border-slate-200 dark:border-slate-700 hover:border-cyan-400 cursor-pointer'
                    : 'border-dashed border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-xs text-slate-900 dark:text-white">{berthKey}</h4>
                  {entry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBerth(berthKey);
                      }}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remover analise salva"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {entry ? (
                  <div className="space-y-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <p className="font-black text-slate-800 dark:text-slate-100 truncate">
                      {entry.analysis?.shipName || 'Navio não identificado'}
                    </p>
                    <p>{bayCount} bays · {containerCount} mov.</p>
                    <p className="text-slate-400">{new Date(entry.savedAt).toLocaleString('pt-BR')}</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Nenhuma analise salva</p>
                )}
              </div>
            );
          })}
        </div>
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
              <p><span className="text-slate-400">Deck:</span> {qcPlanSummary?.deckTotal !== null && qcPlanSummary?.deckTotal !== undefined ? qcPlanSummary.deckTotal : 'Analisando...'}</p>
              <p><span className="text-slate-400">Hold:</span> {qcPlanSummary?.holdTotal !== null && qcPlanSummary?.holdTotal !== undefined ? qcPlanSummary.holdTotal : 'Analisando...'}</p>
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
              <h4 className="text-xs font-black mb-2">Headline Metrics (Fonte)</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-[10px]">
                {Object.entries(headlineMetrics).map(([key, value]) => (
                  <div key={key} className="rounded border border-emerald-900/50 p-2">
                    <p className="font-black uppercase">{key}</p>
                    <p>{value === null || value === undefined ? '—' : value}</p>
                    <p className="text-emerald-400">Fonte: {headlineSources[key as keyof typeof headlineSources]}</p>
                  </div>
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
      </>
      )}
    </div>
  );
};

export default PlanejamentoSplit;
