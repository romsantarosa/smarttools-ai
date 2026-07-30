import React from 'react';

interface DocumentationSectionProps {
  title: string;
  placeholder?: string;
  children?: React.ReactNode;
}

export const DocumentationSection: React.FC<DocumentationSectionProps> = ({
  title,
  placeholder = 'Documentação em construção.',
  children,
}) => {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 sm:p-5 space-y-2">
      <h4 className="text-xs sm:text-sm font-black tracking-wide text-slate-900 dark:text-white uppercase">
        {title}
      </h4>
      {children ? children : <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">{placeholder}</p>}
    </section>
  );
};