import React, { useState, useEffect } from 'react';
import { UserRole, Permission } from '../types';
import { supabase } from '../supabase';
import { useNavigate, useLocation, Link, NavLink } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
  userRole: UserRole;
  userPermissions: Permission[];
  sectorId?: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger';
  time: string;
  read: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, userPermissions, sectorId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sectorMachineIds, setSectorMachineIds] = useState<string[] | null>(null);

  const fetchNotifications = async () => {
    const sinceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const paradasQuery = supabase
      .from('paradas')
      .select('id, motivo, data_inicio, data_fim, created_at, maquinas!inner(nome, setor_id)')
      .is('data_fim', null)
      .gte('data_inicio', sinceDate)
      .order('data_inicio', { ascending: false })
      .limit(10);

    const chamadosQuery = supabase
      .from('chamados_manutencao')
      .select('id, descricao, prioridade, status, data_abertura, maquinas!inner(nome, setor_id)')
      .in('status', ['ABERTO', 'EM_ANDAMENTO'])
      .gte('data_abertura', sinceDate)
      .order('data_abertura', { ascending: false })
      .limit(10);

    if (sectorId) {
      paradasQuery.eq('maquinas.setor_id', sectorId);
      chamadosQuery.eq('maquinas.setor_id', sectorId);
    }

    const [{ data: paradas }, { data: chamados }] = await Promise.all([
      paradasQuery,
      chamadosQuery
    ]);

    type NotificationWithSort = Notification & { sortTime: number };

    const stopNotifs: NotificationWithSort[] = (paradas || []).map(p => {
      const startedAt = p.data_inicio || p.created_at;
      const minutesOpen = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
        : 0;
      const type: Notification['type'] = minutesOpen >= 10 ? 'danger' : 'warning';
      const message = ((p.maquinas as any)?.nome || 'Máquina') +
        ': ' + (p.motivo || 'Sem motivo') +
        ' (aberta há ' + minutesOpen + ' min)';

      return {
        id: `stop-${p.id}`,
        title: 'Parada Ativa',
        message,
        type,
        time: startedAt
          ? new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        read: false,
        sortTime: startedAt ? new Date(startedAt).getTime() : 0
      };
    });

    const maintNotifs: NotificationWithSort[] = (chamados || []).map(c => {
      const startedAt = c.data_abertura;
      const minutesOpen = startedAt
        ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
        : 0;
      const priority = (c.prioridade || '').toUpperCase();
      const type: Notification['type'] =
        priority === 'CRITICA' || minutesOpen >= 30 ? 'danger' : 'warning';
      const message = ((c.maquinas as any)?.nome || 'Máquina') +
        ': ' + (c.descricao || 'Sem descrição') +
        ' (aberta há ' + minutesOpen + ' min)';

      return {
        id: `maint-${c.id}`,
        title: 'Manutencao Aberta',
        message,
        type,
        time: startedAt
          ? new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        read: false,
        sortTime: startedAt ? new Date(startedAt).getTime() : 0
      };
    });

    const combined = [...stopNotifs, ...maintNotifs]
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 10)
      .map(({ sortTime, ...n }) => n);

    setNotifications(combined);
  };

  useEffect(() => {
    let isMounted = true;

    const loadSectorMachines = async () => {
      if (!sectorId) {
        setSectorMachineIds(null);
        return;
      }
      const { data } = await supabase
        .from('maquinas')
        .select('id')
        .eq('setor_id', sectorId);

      if (isMounted) {
        setSectorMachineIds((data || []).map(m => m.id));
      }
    };

    loadSectorMachines();

    return () => {
      isMounted = false;
    };
  }, [sectorId]);

  useEffect(() => {
    fetchNotifications();

    if (sectorId && (!sectorMachineIds || sectorMachineIds.length === 0)) {
      return;
    }

    const filter = sectorMachineIds && sectorMachineIds.length > 0
      ? `maquina_id=in.(${sectorMachineIds.join(',')})`
      : undefined;

    const channel = supabase
      .channel('sidebar-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paradas', filter }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados_manutencao', filter }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sectorId, sectorMachineIds ? sectorMachineIds.join(',') : '']);

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications]);

  const navItems = [
    {
      id: '/supervisao',
      icon: 'analytics',
      label: 'Supervisor',
      permission: Permission.VIEW_SUPERVISOR_DASHBOARD
    },
    {
      id: '/relatorios/producao',
      icon: 'assessment',
      label: 'Produção',
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
            title="Notificacoes"
            className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl text-text-sub-dark hover:bg-surface-dark-highlight hover:text-primary transition-colors"
          >
            <span className="material-icons-outlined">
              {notifications.length > 0 ? 'notifications_active' : 'notifications'}
            </span>
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center shadow">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
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
                <p className="text-[10px] text-text-sub-dark mt-1">(c) 2024 FLUX Industrial</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;



