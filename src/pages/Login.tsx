import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Container,
  Shield,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  KeyRound,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  LogIn,
  RefreshCw,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getFirebaseErrorMessage } from '../services/authService';
import { DocumentationUpdateButton } from '../components/documentation/DocumentationUpdateButton';

// Official SVG Logos for Google and Facebook
const GoogleLogo: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.1 0-5.74-2.09-6.68-4.92H1.21v3.15C3.21 21.36 7.32 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.32 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.21C.44 8.1 0 9.99 0 12s.44 3.9 1.21 5.43l4.11-3.15z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.32 0 3.21 2.64 1.21 6.57l4.11 3.15c.94-2.83 3.58-4.97 6.68-4.97z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookLogo: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      fill="#1877F2"
    />
  </svg>
);

export const Login: React.FC = () => {
  const {
    isAuthenticated,
    login,
    loginWithEmail,
    loginWithGoogle,
    loginWithFacebook,
    registerUser,
    sendPasswordReset,
    config,
    toggleTheme,
  } = useApp();

  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role] = useState<'Supervisor' | 'Operador'>('Operador');
  // O papel de acesso não é mais escolhido pelo usuário no formulário: contas
  // novas sempre nascem como 'Operador', e contas existentes usam o papel
  // real salvo no Firestore (ver authService.ts). O valor aqui só serve como
  // fallback de exibição para os modos locais/offline (sem Firebase).

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password reset modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  // Handle standard login or register submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        // Attempt Firebase Auth Login
        try {
          await loginWithEmail(email, password, role);
          navigate('/');
        } catch (fbErr: any) {
          const msg = getFirebaseErrorMessage(fbErr);
          setErrorMsg(msg);
          setLoading(false);
          return;
        }
      } else {
        // Register User in Firebase Auth and Firestore DB
        if (!fullName.trim()) {
          setErrorMsg('Por favor, informe seu nome completo.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }

        await registerUser({
          email,
          password,
          name: fullName,
          role,
        });

        setSuccessMsg('Usuário e senha gerados e autenticados no banco de dados do Firebase!');
        navigate('/');
      }
    } catch (err: any) {
      setErrorMsg(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Google Social Login
  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setErrorMsg(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Facebook Social Login
  const handleFacebookLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await loginWithFacebook();
      navigate('/');
    } catch (err: any) {
      setErrorMsg(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Local access fallback for the installed environment
  const handleLocalLogin = (role: 'Supervisor' | 'Operador') => {
    const localEmail = role === 'Supervisor' ? 'supervisor@terminal.local' : 'operador@terminal.local';
    login(localEmail, role);
    navigate('/');
  };

  // Submit Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setResetMsg('');
    setResetError('');

    try {
      await sendPasswordReset(resetEmail);
      setResetMsg('E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.');
      setTimeout(() => {
        setForgotOpen(false);
        setResetMsg('');
      }, 3500);
    } catch (err: any) {
      setResetError(getFirebaseErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-tc-bg text-slate-800 dark:text-tc-ink-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-2xl bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border text-slate-700 dark:text-tc-ink-2 shadow-xs hover:scale-105 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
        >
          {config.themeMode === 'light' ? (
            <>
              <Moon className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          )}
        </button>
      </div>

      {/* Background Port Terminal Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 dark:bg-tc-accent/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 dark:bg-tc-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-tc-surface-2 border border-slate-200 dark:border-tc-border rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 animate-fade-in">
        {/* Terminal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 mb-3 dark:bg-tc-accent dark:text-tc-bg">
            <Container className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            BTP <span className="text-blue-600 font-light">SmartTools AI</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-tc-ink-3 mt-1 font-semibold">
            {config.systemSubtitle} • Autenticação Firebase
          </p>
        </div>

        {/* Tab Switcher: Login vs Cadastrar no Firebase */}
        <div className="flex bg-slate-100 dark:bg-tc-surface-1/80 p-1 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-tc-surface-2 text-blue-600 dark:text-tc-accent shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Entrar com Senha</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-tc-surface-2 text-blue-600 dark:text-tc-accent shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Usuário</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-red-50 dark:bg-tc-critical-soft/50 border border-red-200 dark:border-tc-critical-line text-red-700 dark:text-tc-critical text-xs rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-tc-critical" />
            <div className="flex-1 space-y-2">
              <div>{errorMsg}</div>
              <button
                type="button"
                onClick={() => handleLocalLogin('Supervisor')}
                className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all dark:bg-tc-accent dark:text-tc-bg dark:hover:opacity-90"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar como Supervisor (Modo Rápido / Local)</span>
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-tc-good-soft/50 border border-emerald-200 dark:border-tc-good-line text-emerald-800 dark:text-tc-good text-xs rounded-2xl flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-tc-good" />
            <div className="flex-1 font-semibold">{successMsg}</div>
          </div>
        )}

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name field (Register mode) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1.5 uppercase tracking-wider">
                Nome Completo
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition-all"
                />
              </div>
            </div>
          )}

          {/* Email / Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 mb-1.5 uppercase tracking-wider">
              Usuário / E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operador@empresa.com"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-tc-ink-2 uppercase tracking-wider">
                Senha
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetMsg('');
                    setResetError('');
                    setForgotOpen(true);
                  }}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Perfil de acesso: não é mais escolhido aqui. Contas novas nascem
              como Operador; promoção a Supervisor é feita separadamente
              (hoje, diretamente no Firestore/console; um painel de admin
              fica como próximo passo). */}
          {mode === 'register' && (
            <p className="text-[11px] text-slate-500 dark:text-tc-ink-3 bg-slate-50 dark:bg-tc-surface-1/60 rounded-xl px-3 py-2">
              Sua conta será criada com perfil <strong>Operador</strong>. Acesso de Supervisor precisa ser concedido por um administrador.
            </p>
          )}

          {/* Main Action Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 dark:bg-tc-accent dark:text-tc-bg dark:hover:opacity-90"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Autenticando no Firebase...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <span>Entrar com Firebase</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Gerar Usuário no Firebase</span>
                <UserPlus className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Social Login Options (Gmail & Facebook) */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-tc-border">
          <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider mb-3">
            Ou acesse logado pelas redes
          </p>

          <div className="space-y-2.5">
            {/* Gmail / Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-1 hover:bg-slate-50 dark:hover:bg-tc-surface-3 text-slate-800 dark:text-tc-ink-1 font-bold text-xs shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <GoogleLogo className="w-4 h-4" />
              <span>Entrar com Google / Gmail</span>
            </button>

            {/* Facebook Login */}
            <button
              type="button"
              onClick={handleFacebookLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-tc-border bg-white dark:bg-tc-surface-1 hover:bg-slate-50 dark:hover:bg-tc-surface-3 text-slate-800 dark:text-tc-ink-1 font-bold text-xs shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <FacebookLogo className="w-4 h-4" />
              <span>Entrar com Facebook</span>
            </button>
          </div>
        </div>

        {/* Local access helper */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-tc-border">
          <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider mb-2">
            Acesso Local da Instalação
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleLocalLogin('Supervisor')}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-tc-ink-1 bg-slate-100 dark:bg-tc-surface-1 hover:bg-slate-200 dark:hover:bg-tc-surface-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              Supervisor
            </button>
            <button
              onClick={() => handleLocalLogin('Operador')}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-tc-ink-1 bg-slate-100 dark:bg-tc-surface-1 hover:bg-slate-200 dark:hover:bg-tc-surface-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              Operador
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Sends Email via Firebase) */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-tc-surface-2 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-tc-border shadow-2xl relative">
            <button
              onClick={() => setForgotOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-tc-accent-soft text-blue-600 dark:text-tc-accent flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
              Esqueci Minha Senha
            </h3>
            <p className="text-xs text-slate-500 dark:text-tc-ink-3 mb-4">
              Informe seu e-mail cadastrado. Enviaremos um link direto do Firebase para redefinição segura de senha.
            </p>

            {resetError && (
              <div className="mb-3 p-3 bg-red-50 text-red-800 dark:bg-tc-critical-soft/50 dark:text-tc-critical text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetMsg ? (
              <div className="p-3.5 bg-emerald-50 dark:bg-tc-good-soft/50 text-emerald-800 dark:text-tc-good text-xs rounded-xl font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{resetMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-tc-ink-2 mb-1 uppercase">
                    Seu E-mail Cadastrado
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="seu.email@btp.com.br"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-tc-border bg-slate-50 dark:bg-tc-surface-1 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-tc-ink-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer flex items-center gap-1.5 disabled:opacity-50 dark:bg-tc-accent dark:text-tc-bg dark:hover:opacity-90"
                  >
                    {resetLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Enviar E-mail de Troca</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <DocumentationUpdateButton />
    </div>
  );
};
