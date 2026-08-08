import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Ship,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Layers,
  Settings2,
} from 'lucide-react';

interface ShipDatabaseInfoCardProps {
  shipName: string;
  compact?: boolean;
}

export const ShipDatabaseInfoCard: React.FC<ShipDatabaseInfoCardProps> = ({
  shipName,
  compact = false,
}) => {
  const { ships } = useApp();

  if (!shipName || shipName.trim() === '' || shipName === 'Sem Navio Atracado' || shipName === 'Aguardando Serviço') {
    return null;
  }

  const cleanInput = shipName.trim().toLowerCase();

  // Find exact or partial match in ships database
  const matchedShip = ships.find(
    s => s.name.trim().toLowerCase() === cleanInput
  ) || ships.find(
    s => s.name.trim().toLowerCase().includes(cleanInput) || cleanInput.includes(s.name.trim().toLowerCase())
  );

  if (!matchedShip) {
    return (
      <div className="p-3 rounded-xl bg-slate-100 dark:bg-tc-surface-1/60 border border-slate-200 dark:border-tc-border/80 text-xs text-slate-500 dark:text-tc-ink-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Navio <strong>"{shipName}"</strong> não possui ficha técnica no Guia de Navios.</span>
        </div>
      </div>
    );
  }

  const castanhaClean = (matchedShip.castanha || '').toLowerCase();
  const detailsClean = (matchedShip.details || '').toLowerCase();
  const peacaoClean = (matchedShip.peacao || '').toLowerCase();

  const isInteligente = castanhaClean.includes('inteligente') || detailsClean.includes('inteligente');
  const isAutomatica = castanhaClean.includes('automática') || castanhaClean.includes('automatica');
  const hasPeDeGalinha = matchedShip.hasPeDeGalinha || peacaoClean.includes('pé de galinha') || peacaoClean.includes('pe de galinha');

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 flex-wrap text-xs bg-slate-100 dark:bg-tc-surface-1/80 p-2 rounded-xl border border-slate-200 dark:border-tc-border">
        <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
          <Ship className="w-3.5 h-3.5 text-blue-600" />
          <span>{matchedShip.name}</span>
        </span>

        {/* Castanha Badge */}
        <span
          className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
            isInteligente
              ? 'bg-purple-100 dark:bg-tc-accent-soft text-purple-800 dark:text-tc-accent border border-purple-300 dark:border-tc-accent-line'
              : isAutomatica
              ? 'bg-emerald-100 dark:bg-tc-good-soft text-emerald-800 dark:text-tc-good border border-emerald-300 dark:border-tc-good-line'
              : 'bg-blue-100 dark:bg-tc-accent-soft text-blue-800 dark:text-tc-accent border border-blue-300 dark:border-tc-accent-line'
          }`}
        >
          {isInteligente ? <Sparkles className="w-3 h-3 text-purple-600" /> : <Zap className="w-3 h-3" />}
          <span>Castanha: {matchedShip.castanha}</span>
        </span>

        {/* Pé de galinha Badge */}
        <span
          className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
            hasPeDeGalinha
              ? 'bg-amber-100 dark:bg-tc-warning-soft text-amber-900 dark:text-tc-warning border border-amber-300 dark:border-tc-warning-line'
              : 'bg-slate-200 dark:bg-tc-surface-3 text-slate-700 dark:text-tc-ink-2'
          }`}
        >
          <span>{hasPeDeGalinha ? '🐔 Pé de Galinha' : 'Sem Pé de Galinha'}</span>
        </span>

        {/* Macaco */}
        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-100 dark:bg-tc-accent-soft text-indigo-800 dark:text-tc-accent border border-indigo-300 dark:border-tc-accent-line">
          Macaco: {matchedShip.macaco}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-tc-ink-1 dark:to-tc-ink-2/80 border-2 border-blue-200 dark:border-tc-accent-line/60 shadow-xs space-y-2.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 dark:border-tc-border pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600 text-white font-black dark:bg-tc-accent dark:text-tc-bg">
            <Ship className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-tc-accent tracking-wider">
                Ficha Técnica da Base de Navios
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-tc-good-soft text-emerald-700 dark:text-tc-good">
                Banco BTP
              </span>
            </div>
            <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {matchedShip.name}
            </h5>
          </div>
        </div>

        {/* Quick Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs ${
              isInteligente
                ? 'bg-purple-600 text-white'
                : isAutomatica
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {isInteligente ? <Sparkles className="w-3.5 h-3.5 text-amber-300" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Castanha {matchedShip.castanha}</span>
          </span>

          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs ${
              hasPeDeGalinha
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-200 dark:bg-tc-surface-3 text-slate-700 dark:text-tc-ink-2'
            }`}
          >
            <span>{hasPeDeGalinha ? '🐔 Com Pé de Galinha' : 'Sem Pé de Galinha'}</span>
          </span>
        </div>
      </div>

      {/* Grid of Technical Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Castanha Info */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-tc-surface-1/90 border border-slate-200/80 dark:border-tc-border">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">
            Tipo de Castanha
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
            {isInteligente && <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
            {matchedShip.castanha}
          </span>
        </div>

        {/* Macaco Info */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-tc-surface-1/90 border border-slate-200/80 dark:border-tc-border">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">
            Macaco / Trava
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white">
            {matchedShip.macaco}
          </span>
        </div>

        {/* Peação / Pé de Galinha Info */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-tc-surface-1/90 border border-slate-200/80 dark:border-tc-border">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">
            Peação do Navio
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white">
            {matchedShip.peacao}
          </span>
        </div>
      </div>

      {/* Details & Warnings */}
      <div className="space-y-1.5 pt-1">
        {matchedShip.details && (
          <p className="text-xs text-slate-600 dark:text-tc-ink-2 font-medium">
            <strong className="font-bold text-slate-800 dark:text-tc-ink-1">Detalhes:</strong> {matchedShip.details}
          </p>
        )}

        {matchedShip.warnings && matchedShip.warnings.length > 0 && (
          <div className="p-2 rounded-xl bg-red-50 dark:bg-tc-critical-soft/40 border border-red-200 dark:border-tc-critical-line text-xs text-red-800 dark:text-tc-critical font-bold flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="uppercase text-[10px] font-black tracking-wider block text-red-700 dark:text-tc-critical">
                Atenção Especial na Operação:
              </span>
              <span>{matchedShip.warnings.join(' • ')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
