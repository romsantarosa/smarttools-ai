import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { DocumentationFAQItem } from '../../types/documentation';

interface DocumentationFAQProps {
  items: DocumentationFAQItem[];
}

export const DocumentationFAQ: React.FC<DocumentationFAQProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={`${item.question}-${index}`}
            className="rounded-2xl border border-slate-200 dark:border-tc-border bg-white/80 dark:bg-tc-bg/40 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full px-4 py-3 text-left flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-tc-accent" />
                {item.question}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen ? (
              <div className="px-4 pb-4">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-tc-ink-2">{item.answer}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};