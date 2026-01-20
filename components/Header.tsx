
import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppUser } from '../types';

interface HeaderProps {
  onLogout: () => void;
  user: AppUser | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  operatorSessionElapsed?: string | null;
}

const Header: React.FC<HeaderProps> = ({ user, theme, onToggleTheme, operatorSessionElapsed }) => {
  const location = useLocation();

  const getTitle = () => {
    if (location.pathname.startsWith('/maquinas/')) return 'Painel do Operador';
    if (location.pathname === '/maquinas') return 'Flux Insight';
    if (location.pathname.startsWith('/supervisao')) return 'Supervisão Operacional';
    if (location.pathname.startsWith('/administracao')) return 'Administração de Sistema';
    if (location.pathname.startsWith('/relatorios')) return 'Relatórios de Produção';
    return 'Flux Insight';
  };

  return (
    <header className="h-16 border-b border-border-dark bg-surface-dark flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-4">
        <img
          src="/assets/logo-horizontal.png"
          alt="FLUX Logo"
          className="h-8 w-auto object-contain"
          style={{ padding: '2px' }}
        />
        <div className="w-px h-8 bg-border-dark hidden sm:block mx-2"></div>
        <div className="flex flex-col">
          <h1 className="text-lg md:text-xl font-display font-bold uppercase tracking-wide leading-tight text-white">{getTitle()}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/20 border border-green-500/30">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-green-500 uppercase tracking-tighter">SISTEMA ONLINE</span>
        </div>

        <div className="flex items-center gap-3 border-l border-border-dark pl-6">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold leading-tight uppercase text-white">{user?.name || 'Usuário'}</div>
            <div className="text-[10px] text-text-sub-dark uppercase tracking-widest font-bold">{user?.role || 'GUEST'} • {user?.sector || 'N/A'}</div>
            {user?.role === 'OPERATOR' && operatorSessionElapsed && (
              <div className="text-[10px] text-text-sub-dark uppercase tracking-widest font-bold">
                Tempo no posto: {operatorSessionElapsed}
              </div>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-glow border border-white/10 overflow-hidden">
            {user?.avatar?.startsWith('http') ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (user?.avatar || user?.name?.charAt(0) || '?')}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
