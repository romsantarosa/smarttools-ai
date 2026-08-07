import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Calendar,
  Clock,
  RefreshCw,
  Ship,
} from 'lucide-react';
import {
  fetchSharedBtpSchedule,
  formatPortalDateTime,
  getBerthSlots,
  getPortalStatusLabel,
  useSharedBtpSchedule,
} from '../services/btpPortalData';

export const AtracacaoSaida: React.FC = () => {
  const sharedState = useSharedBtpSchedule();
  const [refreshing, setRefreshing] = useState(false);

  const records = sharedState.records || [];

  const berthSlots = useMemo(() => getBerthSlots(records), [records]);

  const occupiedBerths = useMemo(
    () => berthSlots.filter((slot) => slot.atracado !== null).length,
    [berthSlots]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSharedBtpSchedule(true);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = sharedState.loading || refreshing;
  const error = sharedState.error;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
              <Ship className="w-3.5 h-3.5" />
              Portal BTP • Painel operacional
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Atracação / Saída de Navios</h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Exibe apenas os navios efetivamente atracados no terminal, com base na mesma fonte do Portal BTP usada pela Programação BTP.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Navios atracados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{occupiedBerths}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Berços ocupados</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{occupiedBerths}</p>
        </div>
      </div>


      {loading && (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Carregando navios atracados do Portal BTP...</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h4 className="font-extrabold text-rose-800 dark:text-rose-200 text-sm">Falha na integração com o Portal BTP</h4>
          <p className="text-[11px] text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Navios Atracados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {berthSlots.map((slot) => {
              const ship = slot.atracado;

              if (!ship) {
                return (
                  <div
                    key={slot.berco}
                    className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[220px]"
                  >
                    <Anchor className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                    <p className="text-sm font-black text-slate-400 dark:text-slate-500">Berço livre</p>
                  </div>
                );
              }

              const atracacao = formatPortalDateTime(`${ship.dataatracacao || ''} ${ship.horaatracacao || ''}`.trim());
              const previsaoSaida = formatPortalDateTime(ship.etd || ship.saidaPrevista || '');
              const inicioOperacao = formatPortalDateTime(ship.inicioOperacao || '');

              return (
                <div
                  key={slot.berco}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Navio</p>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{ship.navio || '-'}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                      ATRACADO
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Armador</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.armador || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Berço</span>
                      <span className="font-bold text-slate-900 dark:text-white">{slot.berco}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Viagem</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.viagem || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-3 text-[11px]">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-semibold">Atracação</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{atracacao || '-'}</div>

                    <div className="flex items-center gap-2 text-slate-500 mt-2">
                      <Anchor className="w-3.5 h-3.5" />
                      <span className="font-semibold">Início operação</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{inicioOperacao || '-'}</div>

                    <div className="flex items-center gap-2 text-slate-500 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-semibold">Saída prevista</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{previsaoSaida || '-'}</div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                    <span>Status</span>
                    <span className="font-black text-slate-900 dark:text-white">{getPortalStatusLabel(ship)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Próximo Navio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {berthSlots.map((slot) => {
              const ship = slot.proximo;

              if (!ship) {
                return (
                  <div
                    key={`proximo-${slot.berco}`}
                    className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[180px]"
                  >
                    <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                    <p className="text-sm font-black text-slate-400 dark:text-slate-500">Nenhum navio previsto</p>
                  </div>
                );
              }

              const etb = formatPortalDateTime(ship.etb);
              const status = getPortalStatusLabel(ship);

              return (
                <div
                  key={`proximo-${slot.berco}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{slot.berco}</p>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{ship.navio || '-'}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-black">
                      {status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Armador</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.armador || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Viagem</span>
                      <span className="font-bold text-slate-900 dark:text-white">{ship.viagem || '-'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold">ETB previsto</span>
                    <span className="ml-auto font-black text-slate-900 dark:text-white">{etb || '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
