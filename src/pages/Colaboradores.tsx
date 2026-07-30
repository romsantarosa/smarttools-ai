import React, { useMemo, useState } from 'react';
import { Users, Save, RotateCcw, Plus, Trash2, FileJson } from 'lucide-react';
import { Operador, OPERADORES_INICIAIS, setOperadoresIniciais, resetOperadoresIniciais } from '../data/initialOperators';

const parseBulkLines = (raw: string): Operador[] => {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d{3,8})\s+(.+)$/);
      if (!match) return null;
      return {
        mat: match[1].trim(),
        nome: match[2].trim().replace(/\s+/g, ' '),
      };
    })
    .filter((item): item is Operador => Boolean(item));
};

export const Colaboradores: React.FC = () => {
  const [lista, setLista] = useState<Operador[]>(() => [...OPERADORES_INICIAIS]);
  const [bulkInput, setBulkInput] = useState('');
  const [mat, setMat] = useState('');
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const jsonPreview = useMemo(() => JSON.stringify(lista, null, 2), [lista]);

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 2500);
  };

  const addManual = () => {
    const m = mat.trim();
    const n = nome.trim().replace(/\s+/g, ' ');

    if (!m || !n) {
      showStatus('Informe matrícula e nome completo.', 'error');
      return;
    }

    if (lista.some((op) => op.mat === m)) {
      showStatus('Matrícula já existe na lista.', 'error');
      return;
    }

    setLista((prev) => [...prev, { mat: m, nome: n }]);
    setMat('');
    setNome('');
  };

  const addBulk = () => {
    const parsed = parseBulkLines(bulkInput);
    if (parsed.length === 0) {
      showStatus('Nenhuma linha válida para importar.', 'error');
      return;
    }

    setLista((prev) => {
      const exists = new Set(prev.map((op) => op.mat));
      const merged = [...prev];
      parsed.forEach((op) => {
        if (!exists.has(op.mat)) {
          merged.push(op);
          exists.add(op.mat);
        }
      });
      return merged;
    });

    setBulkInput('');
    showStatus('Colaboradores adicionados na lista local.', 'success');
  };

  const removeOperator = (matricula: string) => {
    setLista((prev) => prev.filter((op) => op.mat !== matricula));
  };

  const saveList = () => {
    setOperadoresIniciais(lista);
    showStatus('Lista salva. Escala BTP já usa esses colaboradores.', 'success');
  };

  const restoreDefault = () => {
    resetOperadoresIniciais();
    setLista([...OPERADORES_INICIAIS]);
    showStatus('Lista padrão restaurada.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 text-slate-800 dark:text-slate-100 transition-colors">
      {status && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 rounded-full text-sm font-bold shadow-lg ${
            status.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="mb-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#003366] text-white flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#003366] dark:text-blue-400">Colaboradores de Bordo</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Cadastro manual em JSON para alimentar a Escala BTP.
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-3">
              Inserção Manual
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2 mb-4">
              <input
                value={mat}
                onChange={(e) => setMat(e.target.value)}
                placeholder="Matrícula"
                className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={addManual}
                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 justify-center"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300 mb-2">
              Adição em Lote (uma linha por colaborador)
            </h3>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="475 MANOEL MESSIAS DOS REIS VITOR"
              className="w-full min-h-[140px] p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
            />
            <button
              type="button"
              onClick={addBulk}
              className="mt-3 px-4 py-2 rounded-xl bg-[#003366] hover:bg-[#0a4f94] text-white font-bold"
            >
              Importar Linhas
            </button>
          </section>

          <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                JSON Gerado
              </h2>
              <span className="text-xs font-bold text-slate-500">{lista.length} colaboradores</span>
            </div>
            <textarea
              value={jsonPreview}
              readOnly
              className="w-full min-h-[240px] p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveList}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar na Escala
              </button>
              <button
                type="button"
                onClick={restoreDefault}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restaurar Padrão
              </button>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-3">
            Lista Atual de Colaboradores
          </h2>
          <div className="overflow-auto max-h-[420px] rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                <tr>
                  <th className="text-left p-2.5">Matrícula</th>
                  <th className="text-left p-2.5">Nome Completo</th>
                  <th className="text-right p-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((op) => (
                  <tr key={op.mat} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">{op.mat}</td>
                    <td className="p-2.5">{op.nome}</td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeOperator(op.mat)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-slate-500">
                      Nenhum colaborador cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1">
            <FileJson className="w-4 h-4" />
            O select Primeiro do trabalho na Escala usa esta lista e inicia no colaborador 475 quando disponível.
          </p>
        </section>
      </div>
    </div>
  );
};
