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
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Escala BTP', path: '/escala', icon: Calendar },
    { label: 'Atracação/Saída Navios', path: '/atracacao-saida', icon: Navigation, badge: 'API' },
    { label: 'Planejamento Split', path: '/planejamento-split', icon: PictureAsPdf },
    { label: 'Guia de Navios', path: '/navios', icon: Ship, badge: ships ? `${ships.length}` : '97' },
    { label: 'Ferramentas Operacionais', path: '/ferramentas', icon: Wrench, badge: lowStock > 0 ? lowStock : null },
    { label: 'Manutenção', path: '/manutencao', icon: Cog },
    { label: 'Solicitação de Compras', path: '/compras', icon: ShoppingCart },
    { label: 'Supervisor IA', path: '/supervisor-ia', icon: Bot, isAi: true },
    { label: 'Relatorios', path: '/relatorios', icon: FileText },
    { label: 'Histórico', path: '/historico', icon: History },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
    { label: 'Perfil', path: '/perfil', icon: UserCircle },
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

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding Section - SAP Fiori / BTP Style */}
        <div className="p-5 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md font-bold text-lg">
              <Container className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight leading-none text-white">
                BTP <span className="font-light text-blue-400">SmartTools AI</span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-1 font-medium truncate max-w-[170px]">
                {config.systemSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
          <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
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
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      item.isAi ? 'text-amber-400' : ''
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                    {item.badge}
                  </span>
                )}
                {item.isAi && !item.badge && (
                  <span className="bg-gradient-to-r from-amber-500 to-purple-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow-xs">
                    Gemini
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Info / Terminal Status */}
        <div className="p-4 border-t border-slate-800/90 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-[11px] overflow-hidden">
              <p className="font-bold text-slate-200 truncate">{config.terminalName}</p>
              <p className="text-slate-500 text-[10px]">Controle v2.6</p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={config.themeMode === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
          >
            {config.themeMode === 'light' ? (
              <Moon className="w-4 h-4 text-purple-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
