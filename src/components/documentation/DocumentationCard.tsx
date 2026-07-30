import React from 'react';
import { M3Card } from '../ui/M3Card';

interface DocumentationCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const DocumentationCard: React.FC<DocumentationCardProps> = ({
  title,
  subtitle,
  children,
  className = '',
}) => {
  return (
    <M3Card className={`border border-slate-200 dark:border-slate-800 shadow-sm ${className}`}>
      <div className="space-y-3">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </M3Card>
  );
};