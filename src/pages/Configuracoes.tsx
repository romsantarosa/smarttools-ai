import React, { useState } from 'react';
import {
  Settings,
  Building,
  Moon,
  Sun,
  Database,
  Save,
  CheckCircle2,
  RefreshCw,
  Sliders,
  KeyRound,
  Lock,
  Mail,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { isFirebaseConfigured } from '../services/firebase';
import { getFirebaseErrorMessage } from '../services/authService';

export const Configuracoes: React.FC = () => {
  const {
    user,
    config,
    updateConfig,
    toggleTheme,
    resetToDefaultData,
    changePassword,
    sendPasswordReset,
  } = useApp();

  const [companyName, setCompanyName] = useState(config.companyName);
  const [cnpj, setCnpj] = useState(config.cnpj);
  const [terminalName, setTerminalName] = useState(config.terminalName);
  const [savedMsg, setSavedMsg] = useState('');

  // Password change form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      companyName,
      cnpj,
      terminalName,
    });
    setSavedMsg('Configurações atualizadas com sucesso!');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess('');
    setPwdError('');

    if (newPassword.length < 6) {
      setPwdError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    setPwdLoading(true);
    try {
      await changePassword(newPassword);
      setPwdSuccess('Senha alterada com sucesso no Firebase!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(getFirebaseErrorMessage(err));
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSendEmailReset = async () => {
    if (!user?.email) return;
    setPwdSuccess('');
    setPwdError('');
    setPwdLoading(true);

    try {
      await sendPasswordReset(user.email);
      setPwdSuccess(`E-mail de troca de senha enviado para ${user.email}! Verifique sua caixa de entrada.`);
    } catch (err: any) {
      setPwdError(getFirebaseErrorMessage(err));
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            Configurações do Sistema
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Parâmetros do terminal BTP, nível de segurança do usuário e conexões
          </p>
        </div>
      </div>

      {savedMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 rounded-2xl font-bold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Alterar Senha / Segurança de Acesso Firebase */}
      <M3Card className="space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <KeyRound className="w-4 h-4 text-amber-500" />
          Segurança da Conta & Alteração de Senha (Firebase)
        </h3>

        {user && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Usuário Logado: {user.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  E-mail: {user.email} • Perfil: {user.role}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendEmailReset}
              disabled={pwdLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar E-mail de Troca</span>
            </button>
          </div>
        )}

        {pwdError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwdError}</span>
          </div>
        )}

        {pwdSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pwdLoading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            <span>{pwdLoading ? 'Atualizando Senha...' : 'Alterar Senha no Firebase'}</span>
          </button>
        </form>
      </M3Card>

      {/* Empresa & Terminal Parameters */}
      <M3Card className="space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Building className="w-4 h-4 text-blue-600" />
          Dados da Empresa e Terminal Portuário
        </h3>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Razão Social / Empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                CNPJ da Unidade
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Terminal
              </label>
              <input
                type="text"
                value={terminalName}
                onChange={e => setTerminalName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Parâmetros</span>
          </button>
        </form>
      </M3Card>

      {/* Theme & Visual Identity Card */}
      <M3Card className="space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-purple-600" />
          Aparência do Sistema (Material Design 3)
        </h3>

        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs">
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              Modo do Tema
            </span>
            <span className="text-slate-500 text-[11px]">
              Alternar entre o visual Claro e Escuro (Dark Mode para turnos noturnos)
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            {config.themeMode === 'light' ? (
              <>
                <Moon className="w-4 h-4 text-purple-600" />
                <span>Ativar Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Ativar Light Mode</span>
              </>
            )}
          </button>
        </div>
      </M3Card>

      {/* Firebase & Storage Status */}
      <M3Card className="space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Database className="w-4 h-4 text-emerald-600" />
          Integração Banco de Dados & Firebase Cloud Firestore
        </h3>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Status da Conexão Firebase:
            </span>
            {isFirebaseConfigured ? (
              <span className="text-emerald-600 font-extrabold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                Conectado (Cloud Firestore & Auth Ativos)
              </span>
            ) : (
              <span className="text-blue-600 font-extrabold bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 rounded-full">
                Modo Local Ativo
              </span>
            )}
          </div>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Coleções preparadas no Firestore: <code className="font-bold">users, usuarios, ferramentas, manutencoes, compras, relatorios, configuracoes</code>. Usuários criados são gravados em tempo real na coleção <code className="font-bold">users</code> com e-mail, nome e perfil.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={resetToDefaultData}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-red-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restaurar Dados Padrão do Terminal BTP</span>
          </button>
        </div>
      </M3Card>
    </div>
  );
};
