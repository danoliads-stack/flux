import React, { useState, useEffect } from 'react';
import { UserRole, Permission } from '../types';
import { supabase } from '../supabase';
import { useNavigate, useLocation, Link, NavLink } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
  userRole: UserRole;
  userPermissions: Permission[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger';
  time: string;
  read: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, userPermissions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch notifications (machine alerts/stops)
  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: paradas } = await supabase
        .from('paradas')
        .select('id, motivo, created_at, maquinas(nome)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (paradas) {
        const notifs: Notification[] = paradas.map(p => ({
          id: p.id,
          title: 'Parada Registrada',
          message: `${(p.maquinas as any)?.nome || 'Máquina'}: ${p.motivo || 'Sem motivo'}`,
          type: 'warning' as const,
          time: new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          read: false
        }));
        setNotifications(notifs);
      }
    };
    fetchNotifications();
  }, [showNotifications]);

  const navItems = [
    {
      id: '/supervisao',
      icon: 'analytics',
      label: 'Supervisor',
      permission: Permission.VIEW_SUPERVISOR_DASHBOARD
    },
    {
      id: '/relatorios',
      icon: 'assessment',
      label: 'Relatórios',
      permission: Permission.VIEW_SUPERVISOR_DASHBOARD
    },
    {
      id: '/admin/insights',
      icon: 'psychology',
      label: 'Insights IA',
      permission: Permission.VIEW_SUPERVISOR_DASHBOARD
    },
    {
      id: '/administracao',
      icon: 'manage_accounts',
      label: 'Admin',
      permission: Permission.VIEW_ADMIN_DASHBOARD
    },
    {
      id: '/qualidade',
      icon: 'verified_user',
      label: 'Qualidade',
      permission: Permission.VIEW_QUALITY_DASHBOARD
    },
    {
      id: '/maquinas',
      icon: 'settings_remote',
      label: 'Operador',
      permission: Permission.VIEW_OPERATOR_DASHBOARD
    }
  ];

  const visibleNavItems = navItems.filter(item => userPermissions.includes(item.permission));

  return (
    <>
      <aside className="w-16 md:w-20 bg-surface-dark border-r border-border-dark flex flex-col items-center py-6 z-20 shrink-0">
        <div className="mb-8 px-2">
          <img
            src="/assets/logo-square.png"
            alt="FLUX Icon"
            className="w-8 h-auto object-contain drop-shadow-glow"
          />
        </div>

        <nav className="flex-1 w-full flex flex-col items-center gap-6">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.id);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={item.label}
                className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all ${isActive
                  ? 'bg-primary text-white shadow-glow'
                  : 'text-text-sub-dark hover:bg-surface-dark-highlight hover:text-primary'
                  }`}
              >
                <span className="material-icons-outlined">{item.icon}</span>
              </button>
            );
          })}

          {visibleNavItems.length > 0 && <div className="h-px w-8 bg-border-dark my-2"></div>}

          <button
            onClick={() => setShowNotifications(true)}
            title="Notificações"
            className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl text-text-sub-dark hover:bg-surface-dark-highlight hover:text-primary transition-colors"
          >
            <span className="material-icons-outlined">notifications</span>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full animate-pulse"></span>
            )}
          </button>
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          <button
            onClick={() => setShowSettings(true)}
            title="Configurações"
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl text-text-sub-dark hover:bg-surface-dark-highlight hover:text-primary transition-colors"
          >
            <span className="material-icons-outlined">settings</span>
          </button>
          <button
            onClick={() => {
              onLogout();
              navigate('/login');
            }}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl text-danger hover:bg-danger/10 transition-colors"
          >
            <span className="material-icons-outlined">logout</span>
          </button>
        </div>
      </aside>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
          <div className="relative ml-auto w-full max-w-sm bg-surface-dark border-l border-border-dark h-full overflow-hidden animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-border-dark">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">notifications</span>
                Notificações
              </h2>
              <button onClick={() => setShowNotifications(false)} className="text-text-sub-dark hover:text-white">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto h-[calc(100%-60px)] space-y-3">
              {notifications.length > 0 ? notifications.map(notif => (
                <div key={notif.id} className={`p-3 rounded-lg border ${notif.type === 'danger' ? 'bg-danger/10 border-danger/20' :
                  notif.type === 'warning' ? 'bg-warning/10 border-warning/20' :
                    'bg-primary/10 border-primary/20'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{notif.title}</p>
                      <p className="text-xs text-text-sub-dark mt-1">{notif.message}</p>
                    </div>
                    <span className="text-[10px] text-text-sub-dark font-mono">{notif.time}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center text-text-sub-dark py-8">
                  <span className="material-icons-outlined text-4xl mb-2 block opacity-50">notifications_off</span>
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">settings</span>
                Configurações
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-text-sub-dark hover:text-white">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Theme */}
              <div className="p-4 bg-background-dark rounded-lg border border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Tema Escuro</p>
                    <p className="text-xs text-text-sub-dark">Interface em modo escuro</p>
                  </div>
                  <div className="w-10 h-6 bg-primary rounded-full flex items-center justify-end px-0.5">
                    <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="p-4 bg-background-dark rounded-lg border border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Notificações Sonoras</p>
                    <p className="text-xs text-text-sub-dark">Alertas sonoros para paradas</p>
                  </div>
                  <div className="w-10 h-6 bg-surface-dark-highlight rounded-full flex items-center px-0.5">
                    <div className="w-5 h-5 bg-text-sub-dark rounded-full shadow"></div>
                  </div>
                </div>
              </div>

              {/* Auto-refresh */}
              <div className="p-4 bg-background-dark rounded-lg border border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Atualização Automática</p>
                    <p className="text-xs text-text-sub-dark">Atualizar dados a cada 30s</p>
                  </div>
                  <div className="w-10 h-6 bg-primary rounded-full flex items-center justify-end px-0.5">
                    <div className="w-5 h-5 bg-white rounded-full shadow"></div>
                  </div>
                </div>
              </div>

              {/* Version */}
              <div className="text-center pt-4 border-t border-border-dark">
                <p className="text-xs text-text-sub-dark">FLUX INSIGHT v1.0.0</p>
                <p className="text-[10px] text-text-sub-dark mt-1">© 2024 FLUX Industrial</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
