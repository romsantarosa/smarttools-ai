import React from 'react';
import { ImagePlus, Camera } from 'lucide-react';

interface DocumentationImageProps {
  label?: string;
}

export const DocumentationImage: React.FC<DocumentationImageProps> = ({ label = 'Espaço reservado para futura captura automática da tela.' }) => {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-tc-border bg-white/80 dark:bg-tc-bg/40 p-5 sm:p-6">
      <div className="flex flex-col items-center justify-center text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-tc-surface-1 flex items-center justify-center text-slate-500 dark:text-tc-ink-2">
          <ImagePlus className="w-6 h-6" />
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-tc-ink-1">Documentação em construção.</p>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-tc-ink-3">{label}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-tc-accent font-semibold">
          <Camera className="w-3.5 h-3.5" />
          Captura automática será habilitada futuramente
        </span>
      </div>
    </div>
  );
};