import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { UserRole, ShiftTurn } from '../types';
import {
  UserCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Check,
  Lock,
  Eye,
  Trash2,
  PlusCircle,
  Clock,
  Briefcase,
  Phone,
  Mail,
  BadgeCheck,
  Award,
  Sparkles,
  AlertCircle,
  Save,
  RotateCcw,
} from 'lucide-react';

export const Perfil: React.FC = () => {
  const { user, updateUserProfile, isSupervisor, isOperator, berthTurnUpdates, maintenances, purchases } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    registrationNumber: user?.registrationNumber || '',
    role: user?.role || 'Operador',
    phone: user?.phone || '(13) 99781-4200',
    shiftTurn: user?.shiftTurn || '07-13',
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!user) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: formData.name,
      email: formData.email,
      registrationNumber: formData.registrationNumber,
      role: formData.role as UserRole,
      phone: formData.phone,
      shiftTurn: formData.shiftTurn as ShiftTurn,
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleQuickRoleSwitch = (newRole: UserRole) => {
    updateUserProfile({ role: newRole });
    setFormData(prev => ({ ...prev, role: newRole }));
  };

  // User activity stats
  const myUpdates = berthTurnUpdates.filter(
    u => u.updatedBy && u.updatedBy.toLowerCase().trim() === user.name.toLowerCase().trim()
  );
  const myMaintenances = maintenances.filter(
    m => m.responsible && m.responsible.toLowerCase().trim() === user.name.toLowerCase().trim()
  );
  const myPurchases = purchases.filter(
    p => p.requestedBy && p.requestedBy.toLowerCase().trim() === user.name.toLowerCase().trim()
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none dark:bg-tc-accent" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-1 shadow-lg">
                <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-14 h-14 text-slate-300" />
                  )}
                </div>
              </div>
              <span
                className={`absolute -bottom-1 -right-1 p-1.5 rounded-full text-white shadow-md border-2 border-slate-900 ${
                  isSupervisor ? 'bg-purple-600' : 'bg-emerald-600'
                }`}
                title={`Perfil: ${user.role}`}
              >
                {isSupervisor ? <ShieldCheck className="w-4 h-4" /> : <BadgeCheck className="w-4 h-4" />}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isSupervisor
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isSupervisor ? <Shield className="w-3.5 h-3.5" /> : <UserCircle className="w-3.5 h-3.5" />}
                  <span>Perfil {user.role}</span>
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Matrícula: {user.registrationNumber || 'BTP-3042'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {user.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>{user.email}</span>
                <span className="text-slate-600">•</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Turno Habitual: {user.shiftTurn || '07-13'}</span>
              </p>
            </div>
          </div>

          {/* Quick Role Switch Buttons for Testing Permissions */}
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md space-y-2">
            <span className="text-[11px] font-black uppercase text-slate-400 block text-center tracking-wider">
              Alternar Perfil para Teste
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch('Operador')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  isOperator
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <BadgeCheck className="w-4 h-4" />
                <span>Operador</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRoleSwitch('Supervisor')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSupervisor
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Supervisor</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-tc-good-soft/50 border border-emerald-300 dark:border-tc-good-line text-emerald-800 dark:text-tc-good font-bold text-xs flex items-center gap-2 shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Informações do perfil atualizadas com sucesso!</span>
        </div>
      )}

      {/* Permissions & Rules Matrix Card (Critical User Requirement) */}
      <M3Card className="p-5 sm:p-6 space-y-4 border-2 border-blue-200 dark:border-tc-accent-line/60 bg-gradient-to-br from-white to-blue-50/30 dark:from-tc-ink-1 dark:to-tc-ink-2/90">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-tc-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs dark:bg-tc-accent dark:text-tc-bg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Direitos e Permissões de Acesso por Perfil
              </h3>
              <p className="text-xs text-slate-500 dark:text-tc-ink-3 font-medium">
                Regras vigentes para Operadores e Supervisores no BTP SmartTools AI
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
              isSupervisor
                ? 'bg-purple-100 dark:bg-tc-accent-soft text-purple-800 dark:text-tc-accent border border-purple-300 dark:border-tc-accent-line'
                : 'bg-emerald-100 dark:bg-tc-good-soft text-emerald-800 dark:text-tc-good border border-emerald-300 dark:border-tc-good-line'
            }`}
          >
            <span>Seu perfil ativo: <strong>{user.role}</strong></span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Perfil Usuário Operador */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-3 ${
              isOperator
                ? 'bg-emerald-50/80 dark:bg-tc-good-soft/30 border-emerald-400 dark:border-tc-good-line shadow-md ring-1 ring-emerald-400/50'
                : 'bg-slate-50 dark:bg-tc-surface-1/60 border-slate-200 dark:border-tc-border/80 opacity-90'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-tc-good" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Perfil Operador
                </h4>
              </div>
              {isOperator && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white dark:bg-tc-good dark:text-tc-bg">
                  Seu Perfil Atual
                </span>
              )}
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-tc-ink-2">
              <li className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Visualizar Tudo:</strong> Pode visualizar <strong>todos os dados</strong> lançados por outras pessoas no sistema (navios, turnos, histórico, ferramentas, compras e relatórios).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Inserir e Editar os Seus:</strong> Consegue cadastrar novos lançamentos e <strong>alterar somente os registros criados por você mesmo</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Bloqueio de Terceiros:</strong> <strong>Não pode alterar nem excluir</strong> lançamentos ou solicitações criadas por outros operadores.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Exclusão Restrita:</strong> Operador não possui permissão para apagar registros cadastrados no sistema.
                </span>
              </li>
            </ul>
          </div>

          {/* Card: Perfil Supervisor */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-3 ${
              isSupervisor
                ? 'bg-purple-50/80 dark:bg-tc-accent-soft/30 border-purple-400 dark:border-tc-accent-line shadow-md ring-1 ring-purple-400/50'
                : 'bg-slate-50 dark:bg-tc-surface-1/60 border-slate-200 dark:border-tc-border/80 opacity-90'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-tc-accent" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Perfil Supervisor
                </h4>
              </div>
              {isSupervisor && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-600 text-white dark:bg-tc-accent dark:text-tc-bg">
                  Seu Perfil Atual
                </span>
              )}
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-tc-ink-2">
              <li className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Visualização Total:</strong> Acesso completo a todos os módulos, visores de berços, histórico e auditorias da IA.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Edit3 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Gestão Ampla:</strong> Pode <strong>inserir, editar e alterar</strong> qualquer dado no sistema (seus ou de qualquer operador).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Permissão de Exclusão:</strong> Exclusividade para <strong>excluir registros</strong> e limpar pendências se necessário.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aprovações:</strong> Autorização para aprovar solicitações de compras, ajustes manuais de estoque e configurações avançadas.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </M3Card>

      {/* User Information & Form Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Data Form */}
        <M3Card className="lg:col-span-2 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-tc-border pb-3">
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Dados Cadastrais do Usuário
              </h3>
            </div>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer dark:bg-tc-accent dark:text-tc-bg dark:hover:opacity-90"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Dados</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-tc-surface-3 text-slate-700 dark:text-tc-ink-2 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                  required
                />
              </div>

              {/* Matrícula BTP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  Matrícula BTP
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.registrationNumber}
                  onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="Ex: BTP-3042"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                  required
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  Telefone / Ramal
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(13) 99781-4200"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                />
              </div>

              {/* Perfil de Acesso */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                >
                  <option value="Operador">Operador (Acesso padrão operacional)</option>
                  <option value="Supervisor">Supervisor (Acesso total de gestão)</option>
                </select>
              </div>

              {/* Turno Habitual */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1">
                  Turno Habitual de Trabalho
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.shiftTurn}
                  onChange={e => setFormData({ ...formData, shiftTurn: e.target.value as ShiftTurn })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-2 text-xs font-extrabold text-slate-900 dark:text-white disabled:opacity-75 disabled:bg-slate-100 dark:disabled:bg-tc-surface-1/80"
                >
                  <option value="07-13">Turno 1º (07:00 às 13:00)</option>
                  <option value="13-19">Turno 2º (13:00 às 19:00)</option>
                  <option value="19-01">Turno 3º (19:00 às 01:00)</option>
                  <option value="01-07">Turno 4º (01:00 às 07:00)</option>
                </select>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer dark:bg-tc-good dark:text-tc-bg dark:hover:opacity-90"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações do Perfil</span>
                </button>
              </div>
            )}
          </form>
        </M3Card>

        {/* Right Column: User Activity & Stats */}
        <M3Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-tc-border pb-3">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Histórico do Seu Perfil
            </h3>
          </div>

          <div className="space-y-3">
            {/* Stat 1: Lançamentos de Turno */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-tc-surface-1/80 border border-slate-200 dark:border-tc-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Lançamentos de Turno / Berço
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {myUpdates.length} registros
                </span>
              </div>
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-tc-accent-soft text-blue-600 dark:text-tc-accent font-bold">
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Stat 2: Chamados de Manutenção */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-tc-surface-1/80 border border-slate-200 dark:border-tc-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Manutenções sob sua Autoria
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {myMaintenances.length} itens
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-tc-warning-soft text-amber-600 dark:text-tc-warning font-bold">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            {/* Stat 3: Pedidos de Compras */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-tc-surface-1/80 border border-slate-200 dark:border-tc-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                  Solicitações de Compras
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {myPurchases.length} pedidos
                </span>
              </div>
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-tc-accent-soft text-purple-600 dark:text-tc-accent font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-tc-accent-soft/40 border border-blue-200 dark:border-tc-accent-line text-[11px] text-blue-800 dark:text-tc-accent font-medium space-y-1">
            <span className="font-bold block flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Garantia de Integridade BTP:</span>
            </span>
            <p>
              Qualquer lançamento feito com seu perfil fica assinado digitalmente com seu nome e matrícula BTP nos registros auditáveis.
            </p>
          </div>
        </M3Card>
      </div>
    </div>
  );
};
