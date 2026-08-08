import React from 'react';
import { AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const StockAlertBanner: React.FC = () => {
  const { tools } = useApp();

  const criticalItems = tools.filter(t => t.available <= Math.max(1, Math.floor(t.minStock / 2)));
  const warningItems = tools.filter(
    t => t.available <= t.minStock && t.available > Math.max(1, Math.floor(t.minStock / 2))
  );

  if (criticalItems.length > 0) {
    return (
      <div className="bg-red-50 dark:bg-tc-critical-soft/60 border-l-4 border-red-600 p-4 rounded-xl shadow-xs mb-6 flex items-start gap-3.5 animate-fade-in">
        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-tc-critical shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-red-900 dark:text-tc-critical">
            Alerta Vermelho: Estoque Crítico Atingido
          </h4>
          <p className="text-xs text-red-700 dark:text-tc-critical mt-1">
            As seguintes ferramentas estão abaixo do limite mínimo de segurança para atracação:{' '}
            <span className="font-semibold underline">
              {criticalItems.map(i => `${i.name} (${i.available} disp.)`).join(', ')}
            </span>
            . Recomenda-se acionar o Supervisor IA ou abrir Solicitação de Compra emergencial.
          </p>
        </div>
      </div>
    );
  }

  if (warningItems.length > 0) {
    return (
      <div className="bg-amber-50 dark:bg-tc-warning-soft/60 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs mb-6 flex items-start gap-3.5 animate-fade-in">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-tc-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-amber-900 dark:text-tc-warning">
            Alerta Amarelo: Estoque Próximo do Mínimo
          </h4>
          <p className="text-xs text-amber-700 dark:text-tc-warning mt-1">
            Atenção para as ferramentas:{' '}
            <span className="font-semibold">
              {warningItems.map(i => `${i.name} (${i.available} disp / min: ${i.minStock})`).join(', ')}
            </span>
            . Monitore as liberações da oficina de manutenção antes do início do próximo turno.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 dark:bg-tc-good-soft/50 border-l-4 border-emerald-500 p-3.5 rounded-xl shadow-xs mb-6 flex items-center gap-3">
      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-tc-good shrink-0" />
      <p className="text-xs font-semibold text-emerald-900 dark:text-tc-good">
        Alerta Verde: Estoque Operacional Normal — Todas as ferramentas atendem aos requisitos mínimos do terminal.
      </p>
    </div>
  );
};
