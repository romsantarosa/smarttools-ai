import React from 'react';
import { Clock3 } from 'lucide-react';
import { DocumentationVersionEntry } from '../../types/documentation';

interface DocumentationVersionProps {
  entries: DocumentationVersionEntry[];
}

export const DocumentationVersion: React.FC<DocumentationVersionProps> = ({ entries }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-[11px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
        <div className="col-span-3">Versão</div>
        <div className="col-span-3">Data</div>
        <div className="col-span-6">Descrição</div>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {entries.map((entry) => (
          <div key={`${entry.version}-${entry.date}`} className="grid grid-cols-12 gap-2 px-4 py-3 bg-white dark:bg-slate-900">
            <div className="col-span-3 text-xs font-bold text-slate-900 dark:text-white">{entry.version}</div>
            <div className="col-span-3 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-slate-500" />
              {entry.date}
            </div>
            <div className="col-span-6 text-xs text-slate-600 dark:text-slate-300">{entry.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};