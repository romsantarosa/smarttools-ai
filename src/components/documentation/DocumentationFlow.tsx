import React from 'react';
import { GitBranchPlus } from 'lucide-react';

interface DocumentationFlowProps {
  steps: string[];
}

export const DocumentationFlow: React.FC<DocumentationFlowProps> = ({ steps }) => {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={`${step}-${index}`}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 px-3 py-2.5"
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
            {index + 1}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <GitBranchPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            {step}
          </p>
        </div>
      ))}
    </div>
  );
};