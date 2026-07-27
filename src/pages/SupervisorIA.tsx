import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  Building2,
  Cpu,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { M3Badge } from '../components/ui/M3Badge';
import { safeFetchJson } from '../utils/apiUtils';

export const SupervisorIA: React.FC = () => {
  const { tools, maintenances, purchases, shifts, aiLogs, addAILog, user } = useApp();

  const [loading, setLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<{
    opinion: string;
    recommendations: string[];
    riskLevel: 'BAIXO' | 'MÉDIO' | 'ALTO';
    isFallback?: boolean;
  } | null>(aiLogs[0] ? {
    opinion: aiLogs[0].opinion,
    recommendations: aiLogs[0].recommendations,
    riskLevel: aiLogs[0].riskLevel,
  } : null);

  const [customQuestion, setCustomQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: 'user' | 'ai'; text: string; time: string }>
  >([
    {
      sender: 'ai',
      text: 'Olá! Sou o Supervisor IA da BTP. Clique em "Analisar Operação" para a checagem em tempo real ou faça uma pergunta sobre a alocação de ferramentas.',
      time: new Date().toLocaleTimeString().substring(0, 5),
    },
  ]);

  const handleAnalyzeOperation = async (customPrompt?: string) => {
    setLoading(true);

    try {
      const data = await safeFetchJson('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: tools,
          maintenance: maintenances,
          purchases: purchases,
          history: shifts.slice(0, 3),
          customPrompt,
        }),
      });

      if (data.success) {
        const result = {
          opinion: data.opinion,
          recommendations: data.recommendations || [],
          riskLevel: (data.riskLevel as 'BAIXO' | 'MÉDIO' | 'ALTO') || 'BAIXO',
          isFallback: data.isFallback,
        };

        setCurrentAnalysis(result);

        // Add to global logs
        addAILog({
          supervisorName: user?.name || 'Supervisor IA BTP',
          opinion: data.opinion,
          recommendations: data.recommendations || [],
          riskLevel: result.riskLevel,
        });

        if (customPrompt) {
          setChatHistory(prev => [
            ...prev,
            {
              sender: 'ai',
              text: data.opinion,
              time: new Date().toLocaleTimeString().substring(0, 5),
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Error analyzing operation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || loading) return;

    const q = customQuestion;
    setCustomQuestion('');

    setChatHistory(prev => [
      ...prev,
      { sender: 'user', text: q, time: new Date().toLocaleTimeString().substring(0, 5) },
    ]);

    handleAnalyzeOperation(q);
  };

  const getRiskBadge = (level?: 'BAIXO' | 'MÉDIO' | 'ALTO') => {
    switch (level) {
      case 'ALTO':
        return <M3Badge label="Risco Alto de Paralisação" variant="error" />;
      case 'MÉDIO':
        return <M3Badge label="Risco Médio - Requer Atenção" variant="warning" />;
      default:
        return <M3Badge label="Risco Baixo - Operação Normal" variant="success" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Panel */}
      <div className="text-center space-y-3 bg-gradient-to-b from-blue-900 to-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden border border-blue-800/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 mb-1">
          <Bot className="w-10 h-10" />
        </div>

        <h2 className="text-3xl font-black tracking-tight">
          Supervisor IA BTP
        </h2>
        <p className="text-xs text-blue-200 max-w-xl mx-auto leading-relaxed">
          Inteligência Artificial Generativa alimentada com Gemini 3.6 Flash para análise preditiva da disponibilidade de varas e travas nos berços de atracação.
        </p>

        <div className="pt-2">
          <button
            onClick={() => handleAnalyzeOperation()}
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-lg shadow-amber-400/30 inline-flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                <span>Analisando Operação em Tempo Real...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>Analisar Operação Agora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Opinion Result Card */}
      {currentAnalysis && (
        <M3Card className="border-2 border-blue-500/30 dark:border-blue-700/40 shadow-xl space-y-5 bg-gradient-to-b from-white to-blue-50/30 dark:from-slate-900 dark:to-slate-900/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Parecer Técnico do Supervisor IA
                </h3>
                <p className="text-[11px] text-slate-500">
                  Gerado automaticamente via Gemini AI Engine
                </p>
              </div>
            </div>
            {getRiskBadge(currentAnalysis.riskLevel)}
          </div>

          {/* Parecer Text */}
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-300">
              Parecer Profissional da Operação
            </h4>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed italic">
              "{currentAnalysis.opinion}"
            </p>
          </div>

          {/* Recommendations List */}
          {currentAnalysis.recommendations && currentAnalysis.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-blue-600" />
                Recomendações Acionáveis para a Equipe de Turno
              </h4>
              <ul className="space-y-2">
                {currentAnalysis.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-200 font-medium flex items-start gap-2.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </M3Card>
      )}

      {/* Interactive AI Chat Assistant */}
      <M3Card className="space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Pergunte ao Supervisor IA da Operação
          </h3>
        </div>

        {/* Chat Messages */}
        <div className="h-64 overflow-y-auto space-y-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-xl p-3.5 rounded-2xl text-xs font-medium leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-xs'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-600 font-bold p-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Gerando resposta do Supervisor IA...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendQuestion} className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={e => setCustomQuestion(e.target.value)}
            placeholder="Ex: Qual o estoque de varas de 6m para o turno das 13h no Berço 2?"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
          />
          <button
            type="submit"
            disabled={loading || !customQuestion.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span>Perguntar</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </M3Card>
    </div>
  );
};
