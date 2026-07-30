import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpenCheck, Loader2, Sparkles, X } from 'lucide-react';
import { startDocumentationUpdate } from '../../services/documentationAutomationService';

function routeToScreenName(pathname: string): string {
  const routeNameMap: Record<string, string> = {
    '/': 'Painel Operacional',
    '/escala': 'Escala',
    '/programacao-btp': 'Programação BTP',
    '/atracacao-saida': 'Atracação/Saída Navios',
    '/navios': 'Navios',
    '/ferramentas': 'Ferramentas',
    '/manutencao': 'Manutenção',
    '/compras': 'Solicitação de Compras',
    '/supervisor-ia': 'Supervisor IA',
    '/relatorios': 'Relatórios',
    '/historico': 'Histórico',
    '/configuracoes': 'Configurações',
    '/perfil': 'Perfil',
    '/planejamento-split': 'Planejamento Split',
    '/sobre': 'Sobre',
    '/documentacao': 'Documentação',
  };

  return routeNameMap[pathname] ?? 'Tela Atual';
}

export const DocumentationUpdateButton: React.FC = () => {
  const location = useLocation();
  const [isRunning, setIsRunning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const screenName = useMemo(() => routeToScreenName(location.pathname), [location.pathname]);

  const handleUpdate = async () => {
    setIsRunning(true);
    try {
      const result = await startDocumentationUpdate(location.pathname, screenName);
      setResultMessage(
        `Pipeline preparado para ${result.screenName}. ${result.steps.length} etapas configuradas para futura automação.`
      );
      setShowResult(true);
    } catch {
      setResultMessage('Não foi possível iniciar a atualização da documentação.');
      setShowResult(true);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={handleUpdate}
        disabled={isRunning}
        className="fixed left-3 bottom-3 sm:left-5 sm:bottom-5 z-40 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-black shadow-lg border border-slate-700 dark:border-slate-300 flex items-center gap-2 transition-colors"
        title="Atualizar documentação da tela atual"
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenCheck className="w-4 h-4" />}
        <span>📖 Atualizar documentação</span>
      </button>

      {showResult ? (
        <div className="fixed left-3 right-3 sm:left-5 sm:right-auto sm:bottom-20 bottom-18 sm:max-w-sm z-40 rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 shadow-xl p-3.5 animate-fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Atualização da documentação
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">{resultMessage}</p>
            </div>
            <button onClick={() => setShowResult(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};