import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  Shield,
  Bell,
  X,
  AlertTriangle,
  ShoppingBag,
  Wrench,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
  ExternalLink,
  KeyRound,
  Lock,
  Mail,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getFirebaseErrorMessage } from '../../services/authService';
import { useApp } from '../../context/AppContext';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const {
    user,
    logout,
    config,
    toggleTheme,
    tools,
    purchases,
    maintenances,
    readNotificationIds,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearReadNotifications,
    changePassword,
    sendPasswordReset,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'purchase' | 'maint'>('all');
  const popupRef = useRef<HTMLDivElement>(null);

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Construct dynamic list of system notifications
  const allNotifications = [
    // Low / Critical Stock Alerts
    ...tools
      .filter(t => t.available <= t.minStock)
      .map(t => {
        const isCritical = t.available <= Math.ceil(t.minStock / 2);
        return {
          id: `stock-${t.id}`,
          type: 'stock' as const,
          title: isCritical ? `Estoque Crítico: ${t.name}` : `Estoque Baixo: ${t.name}`,
          message: `Disponível: ${t.available} un • Mínimo necessário: ${t.minStock} un`,
          severity: isCritical ? ('critical' as const) : ('warning' as const),
          badgeText: `${t.available}/${t.minStock} un`,
          date: 'Alerta de Estoque',
        };
      }),

    // Pending Purchases Alerts
    ...purchases
      .filter(p => p.status === 'Solicitado')
      .map(p => ({
        id: `purchase-${p.id}`,
        type: 'purchase' as const,
        title: `Compra Solicitada: ${p.toolName}`,
        message: `Qtd: ${p.quantity} un • Urgência: ${p.urgency} • Solicitante: ${p.requestedBy}`,
        severity: p.urgency === 'Alta' ? ('critical' as const) : ('info' as const),
        badgeText: `Urgência ${p.urgency}`,
        date: p.date,
      })),

    // Active Maintenances Alerts
    ...maintenances
      .filter(m => m.status === 'Em manutenção')
      .map(m => ({
        id: `maint-${m.id}`,
        type: 'maint' as const,
        title: `Em Manutenção: ${m.toolName}`,
        message: `${m.quantity} un em reparo na ${m.responsible} (${m.reason})`,
        severity: 'warning' as const,
        badgeText: `${m.quantity} un em reparo`,
        date: m.date,
      })),
  ];

  // Filter out read notifications for unread badge count
  const unreadNotifications = allNotifications.filter(n => !readNotificationIds.includes(n.id));
  const unreadCount = unreadNotifications.length;

  // Filter items based on active tab in popup
  const filteredNotifications = allNotifications.filter(n => {
    if (filterType === 'stock') return n.type === 'stock';
    if (filterType === 'purchase') return n.type === 'purchase';
    if (filterType === 'maint') return n.type === 'maint';
    return true;
  });

  const handleClearAll = () => {
    markAllNotificationsAsRead(allNotifications.map(n => n.id));
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-tc-bg/95 backdrop-blur-md border-b border-slate-200 dark:border-tc-border transition-colors">
      <div className="flex items-center justify-between px-4 lg:px-8 py-3">
        {/* Left Side Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-600 dark:text-tc-ink-2 hover:bg-slate-100 dark:hover:bg-tc-surface-2 transition-colors lg:hidden cursor-pointer"
            aria-label="Abrir Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-semibold text-slate-500 dark:text-tc-ink-3">
              {config.companyName}
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-tc-ink-1 flex items-center gap-2">
              BTP SmartTools AI
              <span className="text-[10px] bg-blue-100 dark:bg-tc-accent-soft text-blue-700 dark:text-tc-accent font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-tc-border font-mono-tc">
                Operações Portuárias
              </span>
            </span>
          </div>
        </div>

        {/* Right Side User & Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-tc-ink-2 hover:bg-slate-100 dark:hover:bg-tc-surface-2 transition-colors cursor-pointer"
            title={config.themeMode === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          >
            {config.themeMode === 'light' ? (
              <Moon className="w-5 h-5 text-slate-600" />
            ) : (
              <Sun className="w-5 h-5 text-tc-warning" />
            )}
          </button>

          {/* Interactive Notifications Indicator & Pop-up */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 rounded-xl relative transition-all cursor-pointer ${
                showNotifications
                  ? 'bg-blue-50 dark:bg-tc-accent-soft text-blue-600 dark:text-tc-accent'
                  : 'text-slate-600 dark:text-tc-ink-2 hover:bg-slate-100 dark:hover:bg-tc-surface-2'
              }`}
              title="Notificações e Alertas Operacionais"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-600 dark:bg-tc-critical text-white text-[10px] font-black rounded-full px-1 flex items-center justify-center border-2 border-white dark:border-tc-bg shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* NOTIFICATION POPUP MODAL (CENTERED ON VIEWPORT VIA PORTAL) */}
            {showNotifications && createPortal(
              <div
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                onClick={() => setShowNotifications(false)}
              >
                <div
                  ref={popupRef}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-lg bg-white dark:bg-tc-surface-1 border border-slate-200 dark:border-tc-border rounded-3xl shadow-2xl overflow-hidden animate-scale-in max-h-[85vh] my-auto flex flex-col"
                >
                  {/* Popup Header */}
                <div className="p-4 bg-slate-900 text-white dark:bg-tc-bg flex items-center justify-between border-b border-slate-800 dark:border-tc-border">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-600/30 dark:bg-tc-accent-soft text-blue-400 dark:text-tc-accent border border-blue-500/30 dark:border-tc-border">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                        <span>Central de Alertas</span>
                        {unreadCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 dark:bg-tc-critical-soft dark:text-tc-critical text-white font-black font-mono-tc">
                            {unreadCount} pendente{unreadCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 dark:bg-tc-good-soft text-emerald-300 dark:text-tc-good font-extrabold border border-emerald-500/30 dark:border-tc-good-line">
                            Tudo lido
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-tc-ink-3">
                        Notificações de estoque, compras e manutenção
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-tc-surface-2 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Filter Tabs & Quick Action Bar */}
                <div className="p-3 bg-slate-50 dark:bg-tc-surface-2 border-b border-slate-200 dark:border-tc-border flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        filterType === 'all'
                          ? 'bg-blue-600 dark:bg-tc-accent dark:text-tc-bg text-white shadow-xs'
                          : 'text-slate-600 dark:text-tc-ink-2 hover:bg-slate-200 dark:hover:bg-tc-surface-3'
                      }`}
                    >
                      Todas ({allNotifications.length})
                    </button>
                    <button
                      onClick={() => setFilterType('stock')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        filterType === 'stock'
                          ? 'bg-blue-600 dark:bg-tc-accent dark:text-tc-bg text-white shadow-xs'
                          : 'text-slate-600 dark:text-tc-ink-2 hover:bg-slate-200 dark:hover:bg-tc-surface-3'
                      }`}
                    >
                      Estoque
                    </button>
                    <button
                      onClick={() => setFilterType('purchase')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                        filterType === 'purchase'
                          ? 'bg-blue-600 dark:bg-tc-accent dark:text-tc-bg text-white shadow-xs'
                          : 'text-slate-600 dark:text-tc-ink-2 hover:bg-slate-200 dark:hover:bg-tc-surface-3'
                      }`}
                    >
                      Compras
                    </button>
                  </div>

                  {/* Zerar Notificações Button */}
                  {unreadCount > 0 ? (
                    <button
                      onClick={handleClearAll}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-tc-good dark:hover:opacity-90 dark:text-tc-bg text-white text-[11px] font-extrabold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                      title="Zerar o contador e marcar todas as notificações como lidas"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Zerar ({unreadCount})</span>
                    </button>
                  ) : (
                    readNotificationIds.length > 0 && (
                      <button
                        onClick={clearReadNotifications}
                        className="px-2 py-1 text-slate-500 hover:text-slate-700 dark:text-tc-ink-3 dark:hover:text-tc-ink-1 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Restaurar notificações anteriores"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    )
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-tc-border-soft p-2 space-y-1">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-8 text-center px-4 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-tc-good-soft text-emerald-600 dark:text-tc-good flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="font-extrabold text-xs text-slate-800 dark:text-tc-ink-1">
                        Nenhum alerta pendente nesta categoria
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-tc-ink-3">
                        Tudo operando em conformidade na BTP SmartTools AI
                      </p>
                    </div>
                  ) : (
                    filteredNotifications.map(item => {
                      const isRead = readNotificationIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl transition-all flex items-start gap-3 ${
                            isRead
                              ? 'opacity-60 bg-slate-50/50 dark:bg-tc-surface-1/40'
                              : 'bg-white dark:bg-tc-surface-2 border border-slate-200/70 dark:border-tc-border shadow-xs'
                          }`}
                        >
                          {/* Icon by type */}
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              item.type === 'stock'
                                ? item.severity === 'critical'
                                  ? 'bg-red-100 text-red-600 dark:bg-tc-critical-soft dark:text-tc-critical'
                                  : 'bg-amber-100 text-amber-600 dark:bg-tc-warning-soft dark:text-tc-warning'
                                : item.type === 'purchase'
                                ? 'bg-purple-100 text-purple-600 dark:bg-tc-accent-soft dark:text-tc-accent'
                                : 'bg-blue-100 text-blue-600 dark:bg-tc-accent-soft dark:text-tc-accent'
                            }`}
                          >
                            {item.type === 'stock' && <AlertTriangle className="w-4 h-4" />}
                            {item.type === 'purchase' && <ShoppingBag className="w-4 h-4" />}
                            {item.type === 'maint' && <Wrench className="w-4 h-4" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h5 className="font-extrabold text-xs text-slate-900 dark:text-tc-ink-1 leading-tight">
                                {item.title}
                              </h5>
                              <span className="text-[9px] font-bold text-slate-400 dark:text-tc-ink-3 shrink-0 font-mono-tc">
                                {item.date}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-tc-ink-2 mt-0.5 leading-snug">
                              {item.message}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-tc-surface-3 text-slate-700 dark:text-tc-ink-2 border border-slate-200 dark:border-tc-border font-mono-tc">
                                {item.badgeText}
                              </span>

                              {/* Item actions */}
                              {!isRead ? (
                                <button
                                  onClick={() => markNotificationAsRead(item.id)}
                                  className="text-[10px] font-bold text-blue-600 dark:text-tc-accent hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Marcar como lida</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 dark:text-tc-good font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Lida</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Popup Footer */}
                <div className="p-3 bg-slate-100 dark:bg-tc-bg border-t border-slate-200 dark:border-tc-border flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-tc-ink-3 font-medium font-mono-tc">
                    Total: {allNotifications.length} alertas monitorados
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] font-extrabold text-emerald-600 dark:text-tc-good hover:underline cursor-pointer"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
          </div>

          {/* User Profile Summary */}
          {user && (
            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-tc-border">
              <img
                src={
                  user.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
                }
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-blue-600 dark:border-tc-accent shadow-xs shrink-0"
              />
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-bold text-slate-800 dark:text-tc-ink-1 truncate max-w-[140px]">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-tc-ink-3 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-600 dark:text-tc-accent" />
                  {user.role} ({user.registrationNumber})
                </span>
              </div>

              {/* Change Password Button */}
              <button
                onClick={() => {
                  setNewPassword('');
                  setConfirmPassword('');
                  setPwdError('');
                  setPwdSuccess('');
                  setShowPasswordModal(true);
                }}
                className="p-2 text-slate-500 dark:text-tc-ink-3 hover:text-amber-500 dark:hover:text-tc-warning hover:bg-amber-50 dark:hover:bg-tc-warning-soft rounded-xl transition-colors cursor-pointer"
                title="Alterar Senha (Firebase)"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="p-2 text-slate-500 dark:text-tc-ink-3 hover:text-red-600 dark:hover:text-tc-critical hover:bg-red-50 dark:hover:bg-tc-critical-soft rounded-xl transition-colors cursor-pointer"
                title="Sair do Sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-tc-surface-1 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-tc-border shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 dark:text-tc-ink-3 hover:text-slate-600 dark:hover:text-tc-ink-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-tc-warning-soft text-amber-600 dark:text-tc-warning flex items-center justify-center mb-3">
              <KeyRound className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 dark:text-tc-ink-1 mb-1">
              Alterar Senha de Acesso
            </h3>
            <p className="text-xs text-slate-500 dark:text-tc-ink-3 mb-4">
              Defina sua nova senha diretamente no banco de dados do Firebase.
            </p>

            {pwdError && (
              <div className="mb-3 p-3 bg-red-50 text-red-800 dark:bg-tc-critical-soft dark:text-tc-critical text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-tc-critical" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-3 p-3.5 bg-emerald-50 dark:bg-tc-good-soft text-emerald-800 dark:text-tc-good text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-tc-good" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPwdError('');
                setPwdSuccess('');

                if (newPassword.length < 6) {
                  setPwdError('A nova senha deve ter no mínimo 6 caracteres.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPwdError('A confirmação de senha não confere.');
                  return;
                }

                setPwdLoading(true);
                try {
                  await changePassword(newPassword);
                  setPwdSuccess('Senha alterada com sucesso!');
                  setTimeout(() => {
                    setShowPasswordModal(false);
                    setPwdSuccess('');
                  }, 2000);
                } catch (err: any) {
                  setPwdError(getFirebaseErrorMessage(err));
                } finally {
                  setPwdLoading(false);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-tc-ink-2 mb-1 uppercase">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-tc-ink-3 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1 text-xs focus:ring-2 focus:ring-amber-500 dark:focus:ring-tc-warning focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-tc-ink-2 mb-1 uppercase">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-tc-ink-3 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-2 text-slate-900 dark:text-tc-ink-1 text-xs focus:ring-2 focus:ring-amber-500 dark:focus:ring-tc-warning focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user?.email) return;
                    setPwdLoading(true);
                    setPwdError('');
                    setPwdSuccess('');
                    try {
                      await sendPasswordReset(user.email);
                      setPwdSuccess(`Link de troca enviado para ${user.email}`);
                    } catch (err: any) {
                      setPwdError(getFirebaseErrorMessage(err));
                    } finally {
                      setPwdLoading(false);
                    }
                  }}
                  className="text-[11px] font-bold text-blue-600 dark:text-tc-accent hover:underline cursor-pointer"
                >
                  Enviar e-mail de redefinição
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-tc-ink-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="px-4 py-2 text-xs font-extrabold text-slate-950 dark:text-tc-bg bg-amber-500 dark:bg-tc-warning hover:bg-amber-600 dark:hover:opacity-90 rounded-xl cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {pwdLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Salvar Senha</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

