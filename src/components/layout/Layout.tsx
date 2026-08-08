import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { DocumentationUpdateButton } from '../documentation/DocumentationUpdateButton';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-[100svh] bg-slate-50 dark:bg-tc-bg text-slate-800 dark:text-tc-ink-1 flex flex-col font-sans transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />

        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 pb-20 sm:pb-6">
          <Outlet />
        </main>

        <DocumentationUpdateButton />

        <footer className="py-4 px-6 text-center text-xs text-slate-500 dark:text-tc-ink-3 border-t border-slate-200/80 dark:border-tc-border-soft bg-white/50 dark:bg-tc-bg/60 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              © {new Date().getFullYear()} BTP - Brasil Terminal Portuário S.A. Todos os direitos reservados.
            </span>
            <span className="font-semibold text-blue-600 dark:text-tc-accent">
              BTP SmartTools AI — Controle de Ferramentas Operacionais
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
