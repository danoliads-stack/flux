
import React from 'react';
import { UserPerspective, AppUser } from '../types';

interface HeaderProps {
  perspective: UserPerspective;
  onLogout: () => void;
  user: AppUser;
}

const Header: React.FC<HeaderProps> = ({ perspective, user }) => {
  const getTitle = () => {
    switch (perspective) {
      case 'OPERATOR': return 'Painel do Operador';
      case 'SUPERVISOR': return 'Supervisão Operacional';
      case 'ADMIN': return 'Administração de Sistema';
      default: return 'Flux Insight';
    }
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

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/20 border border-green-500/30">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-green-500 uppercase tracking-tighter">SISTEMA ONLINE</span>
        </div>

        <div className="flex items-center gap-3 border-l border-border-dark pl-6">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold leading-tight uppercase text-white">{user.name}</div>
            <div className="text-[10px] text-text-sub-dark uppercase tracking-widest font-bold">{user.role} • {user.sector}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-glow border border-white/10 overflow-hidden">
            {user.avatar === 'JD' ? <img src="https://picsum.photos/seed/jd/40/40" alt="JD" /> : user.avatar}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
