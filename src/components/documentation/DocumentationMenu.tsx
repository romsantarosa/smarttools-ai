import React from 'react';
import { FileStack } from 'lucide-react';
import { DocumentationMenuItem, DocumentationSectionId } from '../../types/documentation';

interface DocumentationMenuProps {
  items: DocumentationMenuItem[];
  activeId: DocumentationSectionId;
  onSelect: (id: DocumentationSectionId) => void;
}

export const DocumentationMenu: React.FC<DocumentationMenuProps> = ({ items, activeId, onSelect }) => {
  return (
    <aside className="rounded-2xl border border-slate-200 dark:border-tc-border bg-white dark:bg-tc-surface-2 p-3 sm:p-4 h-full">
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <FileStack className="w-4 h-4 text-blue-600 dark:text-tc-accent" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-tc-ink-2">Módulos</h3>
      </div>

      <div className="space-y-1 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto pr-1">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-tc-ink-2 hover:bg-slate-100 dark:hover:bg-tc-surface-3'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
};