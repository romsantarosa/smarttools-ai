import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Cog,
  ShoppingCart,
  Bot,
  FileText,
  History,
  Settings,
  UserCircle,
  X,
  Container,
  Sun,
  Moon,
  Ship,
  Calendar,
  Navigation,
  Info,
  BookOpenText,
  Users,
} from 'lucide-react';
import PictureAsPdf from '@mui/icons-material/PictureAsPdf';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { config, getLowStockCount, toggleTheme, ships } = useApp();
  const lowStock = getLowStockCount();

  const menuItems = [
    { label: 'Painel Operacional', path: '/', icon: LayoutDashboard },
    { label: 'Escala BTP', path: '/escala', icon: Calendar },
    { label: 'Colaboradores', path: '/colaboradores', icon: Users },
    { label: 'Programação BTP', path: '/programacao-btp', icon: Ship },
    { label: 'Atracação/Saída Navios', path: '/atracacao-saida', icon: Navigation, badge: 'API', badgeTone: 'info' as const },
    { label: 'Planejamento Split', path: '/planejamento-split', icon: PictureAsPdf },
    { label: 'Guia de Navios', path: '/navios', icon: Ship, badge: ships.length > 0 ? `${ships.length}` : null, badgeTone: 'info' as const },
    { label: 'Ferramentas Operacionais', path: '/ferramentas', icon: Wrench, badge: lowStock > 0 ? lowStock : null, badgeTone: 'warning' as const },
    { label: 'Manutenção', path: '/manutencao', icon: Cog },
    { label: 'Solicitação de Compras', path: '/compras', icon: ShoppingCart },
    { label: 'Supervisor IA', path: '/supervisor-ia', icon: Bot, isAi: true },
    { label: 'Relatorios', path: '/relatorios', icon: FileText },
    { label: 'Histórico', path: '/historico', icon: History },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
    { label: 'Perfil', path: '/perfil', icon: UserCircle },
    { label: 'Sobre', path: '/sobre', icon: Info },
    { label: 'Documentação', path: '/documentacao', icon: BookOpenText },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer — Torre de Controle */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-tc-bg text-tc-ink-1 flex flex-col border-r border-tc-border transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding Section */}
        <div className="p-5 border-b border-tc-border-soft flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tc-accent-soft flex items-center justify-center text-tc-accent shadow-md font-bold text-lg">
              <Container className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight leading-none text-tc-ink-1">
                BTP <span className="font-light text-tc-accent">SmartTools AI</span>
              </h1>
              <p className="text-[11px] text-tc-ink-3 mt-1 font-medium truncate max-w-[170px] font-mono-tc">
                {config.systemSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-tc-ink-3 hover:text-tc-ink-1 p-1 rounded-lg"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
          <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-tc-ink-3 uppercase">
            Menu Operacional
          </div>
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group border-l-2 ${
                    isActive
                      ? 'bg-tc-accent-soft text-tc-ink-1 border-l-tc-accent'
                      : 'text-tc-ink-2 border-l-transparent hover:bg-white/[0.03] hover:text-tc-ink-1'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      item.isAi ? 'text-tc-accent' : ''
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono-tc ${
                      item.badgeTone === 'warning'
                        ? 'bg-tc-warning-soft text-tc-warning'
                        : 'bg-tc-surface-3 text-tc-ink-2'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.isAi && !item.badge && (
                  <span className="bg-tc-accent-soft text-tc-accent text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                    IA
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Info / Terminal Status */}
        <div className="p-4 border-t border-tc-border-soft bg-black/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tc-good shadow-[0_0_0_3px_var(--color-tc-good-soft)] animate-pulse shrink-0" />
            <div className="text-[11px] overflow-hidden">
              <p className="font-bold text-tc-ink-1 truncate">{config.terminalName}</p>
              <p className="text-tc-ink-3 text-[10px] font-mono-tc">Controle v2.6</p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-tc-surface-2 hover:bg-tc-surface-3 text-tc-ink-2 hover:text-tc-ink-1 border border-tc-border transition-colors cursor-pointer"
            title={config.themeMode === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
          >
            {config.themeMode === 'light' ? (
              <Moon className="w-4 h-4 text-tc-accent" />
            ) : (
              <Sun className="w-4 h-4 text-tc-warning" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
