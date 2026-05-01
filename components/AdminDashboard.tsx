
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import AdminSetores from './AdminSetores';
import AdminMaquinas from './AdminMaquinas';
import AdminTurnos from './AdminTurnos';
import AdminOP from './AdminOP';
import AdminTiposParada from './AdminTiposParada';
import AdminTiposRefugo from './AdminTiposRefugo';
import AdminSequenciaMaquina from './AdminSequenciaMaquina';
import AdminChecklists from './AdminChecklists';
import AdminPerfisPermissoes from './AdminPerfisPermissoes';
import { AdminOPsGerais, AdminERPConnector, AdminAPIKeys, AdminCLPSensores, AdminLogsAuditoria } from './AdminPlaceholders';
import AdminUsuarios from './AdminUsuarios';
import ExecutiveDashboard from './ExecutiveDashboard';
import QualityDashboard from './QualityDashboard';

type AdminPage = 'overview' | 'operadores' | 'setores' | 'turnos' | 'maquinas' | 'ordens' | 'ops_gerais' | 'sequencia' | 'tipos_parada' | 'tipos_refugo' | 'checklists' | 'monitoramento_qualidade' | 'erp' | 'api_keys' | 'clp_sensores' | 'usuarios' | 'perfis' | 'logs';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const [activePage, setActivePage] = useState<AdminPage>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [operators, setOperators] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<any>(null);
  const [newOp, setNewOp] = useState({ nome: '', matricula: '', pin: '', setor_id: '', turno_id: '', avatar: '' });
  const [newOpAvatarFile, setNewOpAvatarFile] = useState<File | null>(null);
  const [editingOpAvatarFile, setEditingOpAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const uploadOperatorAvatar = async (file: File, operatorId: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `operators/${operatorId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error('[AdminDashboard] Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      return urlData.publicUrl + '?t=' + Date.now();
    } catch (err) {
      console.error('[AdminDashboard] Upload exception:', err);
      return null;
    }
  };

  const handleDownloadOperatorAvatar = async (avatarUrl: string, operatorName: string) => {
    try {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `avatar_${operatorName.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[AdminDashboard] Download error:', err);
      alert('Erro ao baixar a foto.');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: ops } = await supabase.from('operadores').select('*');
    const { data: sects } = await supabase.from('setores').select('*');
    const { data: turnosData } = await supabase.from('turnos').select('*').eq('ativo', true).order('hora_inicio');

    if (ops) setOperators(ops);
    if (sects) setSectors(sects);
    if (turnosData) setTurnos(turnosData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddOperator = async () => {
    if (!newOp.nome || !newOp.matricula || !newOp.setor_id) return;
    if (!newOp.pin || newOp.pin.length < 4) {
      alert('PIN deve ter pelo menos 4 dígitos.');
      return;
    }

    try {
      // ✅ Usa RPC dedicada que hasheia o PIN no servidor (bcrypt)
      // a coluna 'pin' nao existe mais (Fix Pack 2 - seguranca)
      const { data: newId, error: rpcError } = await supabase.rpc('mes_create_operator', {
        p_nome: newOp.nome,
        p_matricula: newOp.matricula,
        p_pin: newOp.pin,
        p_setor_id: newOp.setor_id,
        p_turno_id: newOp.turno_id || null,
        p_avatar: newOp.avatar || newOp.nome.substring(0, 2).toUpperCase()
      });

      if (rpcError) {
        console.error('[AdminDashboard] Create operator error:', rpcError);
        alert('Erro ao criar operador: ' + rpcError.message);
        return;
      }

      // Upload avatar se um arquivo foi selecionado
      if (newOpAvatarFile && newId) {
        setUploadingAvatar(true);
        const avatarUrl = await uploadOperatorAvatar(newOpAvatarFile, newId);
        if (avatarUrl) {
          await supabase.from('operadores').update({ avatar: avatarUrl }).eq('id', newId);
        }
        setUploadingAvatar(false);
      }

      setIsAddModalOpen(false);
      setNewOp({ nome: '', matricula: '', pin: '', setor_id: '', turno_id: '', avatar: '' });
      setNewOpAvatarFile(null);
      fetchData();
    } catch (err: any) {
      console.error('[AdminDashboard] Add operator error:', err);
      alert('Erro ao criar operador: ' + err.message);
    }
  };

  const handleDeleteOperator = async (id: string) => {
    if (confirm('Deseja realmente excluir este operador?')) {
      await supabase.from('operadores').delete().eq('id', id);
      fetchData();
    }
  };

  const openEditModal = (op: any) => {
    setEditingOp({ ...op });
    setEditingOpAvatarFile(null);
    setIsEditModalOpen(true);
  };

  const handleEditOperator = async () => {
    if (!editingOp || !editingOp.nome || !editingOp.matricula) return;

    try {
      let avatar = editingOp.avatar;

      // Upload new avatar if file is selected
      if (editingOpAvatarFile) {
        setUploadingAvatar(true);
        const uploadedUrl = await uploadOperatorAvatar(editingOpAvatarFile, editingOp.id);
        if (uploadedUrl) {
          avatar = uploadedUrl;
        }
        setUploadingAvatar(false);
      }

      // ✅ Update das colunas normais (sem PIN — PIN agora vai por RPC dedicada)
      const updateData: any = {
        nome: editingOp.nome,
        matricula: editingOp.matricula,
        setor_id: editingOp.setor_id || null,
        turno_id: editingOp.turno_id || null,
        avatar: avatar || editingOp.nome.substring(0, 2).toUpperCase(),
        ativo: editingOp.ativo
      };

      const { error: updateError } = await supabase
        .from('operadores').update(updateData).eq('id', editingOp.id);
      if (updateError) {
        alert('Erro ao atualizar operador: ' + updateError.message);
        return;
      }

      // Se houve troca de PIN, chama RPC dedicada que faz o hash bcrypt
      if (editingOp.pin && editingOp.pin.trim() !== '') {
        if (editingOp.pin.length < 4) {
          alert('PIN deve ter pelo menos 4 dígitos.');
          return;
        }
        const { error: pinError } = await supabase.rpc('mes_update_operator_pin', {
          p_operator_id: editingOp.id,
          p_new_pin: editingOp.pin
        });
        if (pinError) {
          alert('Operador atualizado, mas erro ao trocar o PIN: ' + pinError.message);
          return;
        }
      }

      setIsEditModalOpen(false);
      setEditingOp(null);
      setEditingOpAvatarFile(null);
      fetchData();
    } catch (err: any) {
      console.error('[AdminDashboard] Edit operator error:', err);
      alert('Erro ao atualizar operador: ' + err.message);
    }
  };

  const getSectorName = (id: string) => {
    return sectors.find(s => s.id === id)?.nome || 'N/A';
  };

  const getTurnoName = (id: string) => {
    if (!id) return '--';
    const turno = turnos.find(t => t.id === id);
    return turno ? turno.nome : '--';
  };

  return (
    <div className="flex h-full bg-[#0b0c10] text-gray-400 font-admin select-none">
      {/* Admin Sidebar Section */}
      <aside className={`${sidebarCollapsed ? 'w-14' : 'w-64'} transition-all duration-200 border-r border-border-dark flex flex-col shrink-0 overflow-y-auto overflow-x-hidden bg-[#0b0c10]`}>
        {/* Toggle + Logo */}
        <div className={`flex items-center border-b border-border-dark shrink-0 ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="material-icons-outlined text-sm text-primary">admin_panel_settings</span>
              </div>
              <span className="text-white font-bold text-xs uppercase tracking-widest opacity-60">Admin</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="text-gray-600 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span className="material-icons-outlined text-lg">
              {sidebarCollapsed ? 'menu' : 'menu_open'}
            </span>
          </button>
        </div>

        <div className={`${sidebarCollapsed ? 'py-3 px-1' : 'p-4'} flex-1`}>
          <div className="space-y-6">
            <nav className="space-y-1">
              <NavItem icon="dashboard" label="Visão Geral" active={activePage === 'overview'} onClick={() => setActivePage('overview')} collapsed={sidebarCollapsed} />
            </nav>

            <div>
              {!sidebarCollapsed && <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Cadastros</p>}
              <nav className="space-y-1">
                <NavItem icon="people" label="Operadores" active={activePage === 'operadores'} onClick={() => setActivePage('operadores')} collapsed={sidebarCollapsed} />
                <NavItem icon="grid_view" label="Setores" active={activePage === 'setores'} onClick={() => setActivePage('setores')} collapsed={sidebarCollapsed} />
                <NavItem icon="schedule" label="Turnos" active={activePage === 'turnos'} onClick={() => setActivePage('turnos')} collapsed={sidebarCollapsed} />
                <NavItem icon="precision_manufacturing" label="Máquinas" active={activePage === 'maquinas'} onClick={() => setActivePage('maquinas')} collapsed={sidebarCollapsed} />
                <NavItem icon="assignment" label="Ordens de Produção" active={activePage === 'ordens'} onClick={() => setActivePage('ordens')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Produção</p>}
              <nav className="space-y-1">
                <NavItem icon="list_alt" label="OPs Gerais" active={activePage === 'ops_gerais'} onClick={() => setActivePage('ops_gerais')} collapsed={sidebarCollapsed} />
                <NavItem icon="reorder" label="Sequência" active={activePage === 'sequencia'} onClick={() => setActivePage('sequencia')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Qualidade</p>}
              <nav className="space-y-1">
                <NavItem icon="warning_amber" label="Tipos de Parada" active={activePage === 'tipos_parada'} onClick={() => setActivePage('tipos_parada')} collapsed={sidebarCollapsed} />
                <NavItem icon="cancel" label="Tipos de Refugo" active={activePage === 'tipos_refugo'} onClick={() => setActivePage('tipos_refugo')} collapsed={sidebarCollapsed} />
                <NavItem icon="fact_check" label="Checklists" active={activePage === 'checklists'} onClick={() => setActivePage('checklists')} collapsed={sidebarCollapsed} />
                <NavItem icon="verified_user" label="Monit. Qualidade" active={activePage === 'monitoramento_qualidade'} onClick={() => setActivePage('monitoramento_qualidade')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Integrações</p>}
              <nav className="space-y-1">
                <NavItem icon="settings_input_component" label="ERP Connector" active={activePage === 'erp'} onClick={() => setActivePage('erp')} collapsed={sidebarCollapsed} />
                <NavItem icon="key" label="API Keys" active={activePage === 'api_keys'} onClick={() => setActivePage('api_keys')} collapsed={sidebarCollapsed} />
                <NavItem icon="sensors" label="CLP / Sensores" active={activePage === 'clp_sensores'} onClick={() => setActivePage('clp_sensores')} collapsed={sidebarCollapsed} />
              </nav>
            </div>

            <div>
              {!sidebarCollapsed && <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-2">Sistema</p>}
              <nav className="space-y-1">
                <NavItem icon="account_circle" label="Usuários" active={activePage === 'usuarios'} onClick={() => setActivePage('usuarios')} collapsed={sidebarCollapsed} />
                <NavItem icon="lock_person" label="Perfis e Permissões" active={activePage === 'perfis'} onClick={() => setActivePage('perfis')} collapsed={sidebarCollapsed} />
                <NavItem icon="history_edu" label="Logs e Auditoria" active={activePage === 'logs'} onClick={() => setActivePage('logs')} collapsed={sidebarCollapsed} />
              </nav>
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className={`border-t border-border-dark flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between p-3'}`}>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border-dark bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser?.avatar?.startsWith('http') ? (
              <img src={currentUser.avatar} alt="profile" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              currentUser?.avatar || currentUser?.name?.charAt(0) || '?'
            )}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">{currentUser?.name}</p>
                <p className="text-[9px] text-gray-500 uppercase">{currentUser?.role}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-colors ml-2">
                <span className="material-icons-outlined text-lg">logout</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col bg-[#0b0c10]">
        {/* Top Breadcrumb */}
        <header className="h-10 border-b border-border-dark flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Admin</span>
            <span className="material-icons-outlined text-xs text-gray-700" style={{fontSize:'12px'}}>chevron_right</span>
            <span className="text-gray-400 font-medium capitalize">{activePage}</span>
          </div>
        </header>

        {/* Page Content */}
        {activePage === 'overview' ? (
          <ExecutiveDashboard />
        ) : activePage === 'setores' ? (
          <AdminSetores />
        ) : activePage === 'maquinas' ? (
          <AdminMaquinas />
        ) : activePage === 'turnos' ? (
          <AdminTurnos />
        ) : activePage === 'ordens' ? (
          <AdminOP />
        ) : activePage === 'ops_gerais' ? (
          <AdminOPsGerais />
        ) : activePage === 'sequencia' ? (
          <AdminSequenciaMaquina onNavigateToOPs={() => setActivePage('ordens')} />
        ) : activePage === 'tipos_parada' ? (
          <AdminTiposParada />
        ) : activePage === 'tipos_refugo' ? (
          <AdminTiposRefugo />
        ) : activePage === 'checklists' ? (
          <AdminChecklists />
        ) : activePage === 'monitoramento_qualidade' ? (
          <QualityDashboard />
        ) : activePage === 'erp' ? (
          <AdminERPConnector />
        ) : activePage === 'api_keys' ? (
          <AdminAPIKeys />
        ) : activePage === 'clp_sensores' ? (
          <AdminCLPSensores />
        ) : activePage === 'usuarios' ? (
          <AdminUsuarios />
        ) : activePage === 'perfis' ? (
          <AdminPerfisPermissoes />
        ) : activePage === 'logs' ? (
          <AdminLogsAuditoria />
        ) : activePage === 'operadores' ? (
          <div className="p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header Title & Top Buttons */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight font-display uppercase">Operadores</h2>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c23] hover:bg-[#252831] border border-border-dark text-white text-sm font-bold rounded-lg transition-all">
                  <span className="material-icons-outlined text-lg">upload</span>
                  Importar
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                  <span className="material-icons-outlined text-lg">add</span>
                  Novo Operador
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-[#15181e] border border-border-dark rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total de Operadores</p>
                    <p className="text-2xl font-bold text-white mt-2">{operators.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="material-icons-outlined text-primary">people</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#15181e] border border-border-dark rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Ativos</p>
                    <p className="text-2xl font-bold text-white mt-2">{operators.filter(o => o.ativo).length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                    <span className="material-icons-outlined text-secondary">check_circle</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#15181e] border border-border-dark rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Inativos</p>
                    <p className="text-2xl font-bold text-white mt-2">{operators.filter(o => !o.ativo).length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="material-icons-outlined text-gray-500">cancel</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-[#15181e] p-3 rounded-xl border border-border-dark flex gap-3 mb-6">
              <div className="relative flex-1">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                <input
                  className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                  placeholder="Filtrar por nome ou matrícula..."
                />
              </div>
              <div className="w-64">
                <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2 px-3 text-sm text-white focus:ring-1 focus:ring-primary">
                  <option>Todos os Setores</option>
                  <option>Usinagem</option>
                  <option>Montagem</option>
                </select>
              </div>
              <div className="w-48">
                <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2 px-3 text-sm text-white focus:ring-1 focus:ring-primary">
                  <option>Status</option>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
              <button className="px-3 bg-[#0b0c10] border border-border-dark rounded-lg hover:bg-[#1a1c23] text-gray-500 transition-all">
                <span className="material-icons-outlined">filter_alt_off</span>
              </button>
            </div>

            {/* Operators Grid */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 italic text-sm">Carregando operadores...</div>
            ) : operators.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600">
                <span className="material-icons-outlined text-5xl">people_outline</span>
                <p className="text-sm">Nenhum operador cadastrado.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
                  {operators.map((op) => (
                    <div
                      key={op.id}
                      className={`bg-[#15181e] border rounded-xl p-5 flex flex-col items-center gap-3 transition-all hover:border-primary/40 ${
                        op.ativo ? 'border-border-dark' : 'border-border-dark opacity-60'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        {op.avatar?.startsWith('http') ? (
                          <img
                            src={op.avatar}
                            alt={op.nome}
                            className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold select-none">
                            {op.nome?.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#15181e] ${op.ativo ? 'bg-secondary' : 'bg-gray-600'}`}></span>
                      </div>

                      {/* Nome e matrícula */}
                      <div className="text-center min-w-0 w-full">
                        <p className="font-bold text-white text-sm leading-tight truncate">{op.nome}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{op.matricula}</p>
                      </div>

                      {/* Badges setor e turno */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <span className="text-[10px] text-center px-2 py-1 bg-[#0b0c10] border border-border-dark rounded text-gray-400 font-bold uppercase truncate">
                          {getSectorName(op.setor_id)}
                        </span>
                        {getTurnoName(op.turno_id) !== '--' && (
                          <span className="text-[10px] text-center px-2 py-1 bg-[#0b0c10] border border-border-dark rounded text-gray-500 truncate">
                            {getTurnoName(op.turno_id)}
                          </span>
                        )}
                      </div>

                      {/* Status + ações */}
                      <div className="flex items-center justify-between w-full mt-auto pt-2 border-t border-border-dark/50">
                        <span className={`text-[10px] font-bold uppercase ${op.ativo ? 'text-secondary' : 'text-gray-600'}`}>
                          {op.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(op)}
                            className="text-gray-600 hover:text-primary p-1 rounded hover:bg-primary/10 transition-colors"
                          >
                            <span className="material-icons-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteOperator(op.id)}
                            className="text-gray-600 hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors"
                          >
                            <span className="material-icons-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Operator Modal */}
            {isAddModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-8 animate-fade-in">
                  <h3 className="text-white text-xl font-bold mb-6">Novo Operador</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome Completo</label>
                      <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={newOp.nome}
                        onChange={(e) => setNewOp({ ...newOp, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Matrícula</label>
                      <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={newOp.matricula}
                        onChange={(e) => setNewOp({ ...newOp, matricula: e.target.value })}
                        placeholder="OP-XXXX"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">PIN (Acesso Operator)</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={newOp.pin}
                        onChange={(e) => setNewOp({ ...newOp, pin: e.target.value })}
                        placeholder="1234"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor</label>
                      <select
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={newOp.setor_id}
                        onChange={(e) => setNewOp({ ...newOp, setor_id: e.target.value })}
                      >
                        <option value="">Selecione um setor</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Turno</label>
                      <select
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={newOp.turno_id}
                        onChange={(e) => setNewOp({ ...newOp, turno_id: e.target.value })}
                      >
                        <option value="">Selecione um turno (opcional)</option>
                        {turnos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.hora_inicio?.substring(0, 5)} - {t.hora_fim?.substring(0, 5)})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Foto de Perfil (opcional)</label>
                      <div className="flex items-center gap-4">
                        {newOpAvatarFile ? (
                          <div className="relative">
                            <img
                              src={URL.createObjectURL(newOpAvatarFile)}
                              alt="Preview"
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                            />
                            <button
                              onClick={() => setNewOpAvatarFile(null)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white text-xs"
                            >
                              <span className="material-icons-outlined text-sm">close</span>
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-[#15181e] border-2 border-dashed border-border-dark flex items-center justify-center text-gray-500">
                            <span className="material-icons-outlined text-2xl">person</span>
                          </div>
                        )}
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-[#15181e] hover:bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg cursor-pointer transition-all">
                          <span className="material-icons-outlined text-lg">upload</span>
                          {newOpAvatarFile ? 'Trocar Foto' : 'Selecionar Foto'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setNewOpAvatarFile(file);
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2">Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB). Deixe vazio para usar iniciais.</p>
                    </div>
                  </div>
                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 px-5 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddOperator}
                      className="flex-1 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Operator Modal */}
            {isEditModalOpen && editingOp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingOp(null); }}></div>
                <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-8 animate-fade-in">
                  <h3 className="text-white text-xl font-bold mb-6">Editar Operador</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome Completo</label>
                      <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={editingOp.nome}
                        onChange={(e) => setEditingOp({ ...editingOp, nome: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Matrícula</label>
                      <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={editingOp.matricula}
                        onChange={(e) => setEditingOp({ ...editingOp, matricula: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={editingOp.pin || ''}
                        onChange={(e) => setEditingOp({ ...editingOp, pin: e.target.value })}
                        placeholder="Deixe em branco para manter"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor</label>
                      <select
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={editingOp.setor_id || ''}
                        onChange={(e) => setEditingOp({ ...editingOp, setor_id: e.target.value })}
                      >
                        <option value="">Selecione um setor</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Turno</label>
                      <select
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={editingOp.turno_id || ''}
                        onChange={(e) => setEditingOp({ ...editingOp, turno_id: e.target.value })}
                      >
                        <option value="">Selecione um turno</option>
                        {turnos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.hora_inicio?.substring(0, 5)} - {t.hora_fim?.substring(0, 5)})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Foto de Perfil</label>
                      <div className="flex items-center gap-4">
                        {editingOpAvatarFile ? (
                          <div className="relative">
                            <img
                              src={URL.createObjectURL(editingOpAvatarFile)}
                              alt="Preview"
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                            />
                            <button
                              onClick={() => setEditingOpAvatarFile(null)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white text-xs"
                            >
                              <span className="material-icons-outlined text-sm">close</span>
                            </button>
                          </div>
                        ) : editingOp.avatar?.startsWith('http') ? (
                          <div className="relative group">
                            <img
                              src={editingOp.avatar}
                              alt="Avatar atual"
                              className="w-16 h-16 rounded-full object-cover border-2 border-border-dark"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <button
                              onClick={() => handleDownloadOperatorAvatar(editingOp.avatar, editingOp.nome)}
                              className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Baixar foto"
                            >
                              <span className="material-icons-outlined text-white">download</span>
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold">
                            {editingOp.avatar || editingOp.nome?.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 px-4 py-2 bg-[#15181e] hover:bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg cursor-pointer transition-all">
                            <span className="material-icons-outlined text-lg">upload</span>
                            {editingOpAvatarFile || editingOp.avatar?.startsWith('http') ? 'Trocar Foto' : 'Selecionar Foto'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setEditingOpAvatarFile(file);
                              }}
                            />
                          </label>
                          {editingOp.avatar?.startsWith('http') && !editingOpAvatarFile && (
                            <button
                              onClick={() => handleDownloadOperatorAvatar(editingOp.avatar, editingOp.nome)}
                              className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 text-secondary text-sm font-bold rounded-lg transition-all"
                            >
                              <span className="material-icons-outlined text-lg">download</span>
                              Baixar Foto
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2">Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB)</p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => setEditingOp({ ...editingOp, ativo: !editingOp.ativo })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${editingOp.ativo ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                      >
                        <span className="material-icons-outlined text-lg">{editingOp.ativo ? 'toggle_on' : 'toggle_off'}</span>
                        <span className="text-sm font-bold">{editingOp.ativo ? 'Ativo' : 'Inativo'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={() => { setIsEditModalOpen(false); setEditingOp(null); }}
                      className="flex-1 px-5 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEditOperator}
                      className="flex-1 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center rounded-lg text-sm font-medium transition-all group ${
      collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
    } ${active ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
  >
    <span className={`material-icons-outlined text-lg shrink-0 ${active ? 'text-primary' : 'text-gray-600 group-hover:text-gray-400'}`}>{icon}</span>
    {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
  </button>
);

export default AdminDashboard;

