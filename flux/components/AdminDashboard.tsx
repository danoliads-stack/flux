
import React, { useState, useEffect } from 'react';
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
import { AdminOPsGerais, AdminERPConnector, AdminAPIKeys, AdminCLPSensores, AdminUsuarios, AdminPerfisPermissoes, AdminLogsAuditoria } from './AdminPlaceholders';
import ExecutiveDashboard from './ExecutiveDashboard';

type AdminPage = 'overview' | 'operadores' | 'setores' | 'turnos' | 'maquinas' | 'ordens' | 'ops_gerais' | 'sequencia' | 'tipos_parada' | 'tipos_refugo' | 'checklists' | 'erp' | 'api_keys' | 'clp_sensores' | 'usuarios' | 'perfis' | 'logs';

const AdminDashboard: React.FC = () => {
  const { user: currentUser, logout } = useAuth();
  const [activePage, setActivePage] = useState<AdminPage>('overview');
  const [operators, setOperators] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<any>(null);
  const [newOp, setNewOp] = useState({ nome: '', matricula: '', pin: '', setor_id: '', turno_id: '', avatar: '' });

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

    await supabase.from('operadores').insert({
      nome: newOp.nome,
      matricula: newOp.matricula,
      pin: newOp.pin,
      setor_id: newOp.setor_id,
      turno_id: newOp.turno_id || null,
      avatar: newOp.nome.substring(0, 2).toUpperCase(),
      ativo: true
    });

    setIsAddModalOpen(false);
    setNewOp({ nome: '', matricula: '', pin: '', setor_id: '', turno_id: '', avatar: '' });
    fetchData();
  };

  const handleDeleteOperator = async (id: string) => {
    if (confirm('Deseja realmente excluir este operador?')) {
      await supabase.from('operadores').delete().eq('id', id);
      fetchData();
    }
  };

  const openEditModal = (op: any) => {
    setEditingOp({ ...op });
    setIsEditModalOpen(true);
  };

  const handleEditOperator = async () => {
    if (!editingOp || !editingOp.nome || !editingOp.matricula) return;
    await supabase.from('operadores').update({
      nome: editingOp.nome,
      matricula: editingOp.matricula,
      pin: editingOp.pin,
      setor_id: editingOp.setor_id || null,
      turno_id: editingOp.turno_id || null,
      ativo: editingOp.ativo
    }).eq('id', editingOp.id);
    setIsEditModalOpen(false);
    setEditingOp(null);
    fetchData();
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
      <aside className="w-64 border-r border-border-dark flex flex-col shrink-0 overflow-y-auto bg-[#0b0c10]">
        <div className="p-6">
          <div className="mb-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
              <span className="material-icons-outlined text-2xl text-primary">admin_panel_settings</span>
            </div>
            <div className="h-px w-full bg-border-dark mb-4"></div>
            <span className="text-white font-bold text-xs uppercase tracking-widest opacity-60">Administration</span>
          </div>

          <div className="space-y-8">
            {/* Overview Section */}
            <section>
              <nav className="space-y-1">
                <NavItem icon="dashboard" label="Visão Geral" active={activePage === 'overview'} onClick={() => setActivePage('overview')} />
              </nav>
            </section>

            {/* Category: Cadastros */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Cadastros</h3>
              <nav className="space-y-1">
                <NavItem icon="people" label="Operadores" active={activePage === 'operadores'} onClick={() => setActivePage('operadores')} />
                <NavItem icon="grid_view" label="Setores" active={activePage === 'setores'} onClick={() => setActivePage('setores')} />
                <NavItem icon="schedule" label="Turnos" active={activePage === 'turnos'} onClick={() => setActivePage('turnos')} />
                <NavItem icon="precision_manufacturing" label="Máquinas" active={activePage === 'maquinas'} onClick={() => setActivePage('maquinas')} />
                <NavItem icon="assignment" label="Ordens de Produção" active={activePage === 'ordens'} onClick={() => setActivePage('ordens')} />
              </nav>
            </section>

            {/* Category: Produção */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Produção</h3>
              <nav className="space-y-1">
                <NavItem icon="list_alt" label="OPs Gerais" active={activePage === 'ops_gerais'} onClick={() => setActivePage('ops_gerais')} />
                <NavItem icon="reorder" label="Sequência por Máquina" active={activePage === 'sequencia'} onClick={() => setActivePage('sequencia')} />
              </nav>
            </section>

            {/* Category: Qualidade */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Qualidade</h3>
              <nav className="space-y-1">
                <NavItem icon="warning_amber" label="Tipos de Parada" active={activePage === 'tipos_parada'} onClick={() => setActivePage('tipos_parada')} />
                <NavItem icon="cancel" label="Tipos de Refugo" active={activePage === 'tipos_refugo'} onClick={() => setActivePage('tipos_refugo')} />
                <NavItem icon="fact_check" label="Checklists" active={activePage === 'checklists'} onClick={() => setActivePage('checklists')} />
              </nav>
            </section>

            {/* Category: Integrações */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Integrações</h3>
              <nav className="space-y-1">
                <NavItem icon="settings_input_component" label="ERP Connector" active={activePage === 'erp'} onClick={() => setActivePage('erp')} />
                <NavItem icon="key" label="API Keys" active={activePage === 'api_keys'} onClick={() => setActivePage('api_keys')} />
                <NavItem icon="sensors" label="CLP / Sensores" active={activePage === 'clp_sensores'} onClick={() => setActivePage('clp_sensores')} />
              </nav>
            </section>

            {/* Category: Sistema */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Sistema</h3>
              <nav className="space-y-1">
                <NavItem icon="account_circle" label="Usuários" active={activePage === 'usuarios'} onClick={() => setActivePage('usuarios')} />
                <NavItem icon="lock_person" label="Perfis e Permissões" active={activePage === 'perfis'} onClick={() => setActivePage('perfis')} />
                <NavItem icon="history_edu" label="Logs e Auditoria" active={activePage === 'logs'} onClick={() => setActivePage('logs')} />
              </nav>
            </section>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="mt-auto p-4 border-t border-border-dark flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border-dark">
              <img src={currentUser?.avatar || 'https://picsum.photos/seed/admin/40/40'} alt="profile" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">{currentUser?.name}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{currentUser?.role} • Produção</p>
            </div>
          </div>
          <button onClick={logout} className="text-gray-500 hover:text-white transition-colors">
            <span className="material-icons-outlined">logout</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col bg-[#0b0c10]">
        {/* Top Breadcrumb & Actions Header */}
        <header className="h-16 border-b border-border-dark flex items-center justify-between px-8">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Cadastros</span>
            <span className="material-icons-outlined text-sm text-gray-600">chevron_right</span>
            <span className="text-white font-medium capitalize">{activePage}</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg group-focus-within:text-primary">search</span>
              <input
                className="bg-surface-dark border border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary w-80 transition-all"
                placeholder="Buscar no sistema..."
              />
            </div>
            <div className="flex items-center gap-4 text-gray-500">
              <button className="relative hover:text-white transition-colors">
                <span className="material-icons-outlined">notifications</span>
                <span className="absolute top-0 right-0 w-2 h-2 bg-danger rounded-full border-2 border-[#0b0c10]"></span>
              </button>
              <button className="hover:text-white transition-colors">
                <span className="material-icons-outlined">help_outline</span>
              </button>
            </div>
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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight font-display uppercase">Operadores</h2>
                <p className="text-sm text-gray-500 mt-1">Gerencie os operadores do sistema, suas atribuições e status de acesso.</p>
              </div>
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

            {/* Filter Bar */}
            <div className="bg-[#15181e] p-4 rounded-xl border border-border-dark flex gap-4 mb-6">
              <div className="relative flex-1">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                <input
                  className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                  placeholder="Filtrar por nome ou matrícula..."
                />
              </div>
              <div className="w-64">
                <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-3 text-sm text-white focus:ring-1 focus:ring-primary">
                  <option>Todos os Setores</option>
                  <option>Usinagem</option>
                  <option>Montagem</option>
                </select>
              </div>
              <div className="w-48">
                <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-3 text-sm text-white focus:ring-1 focus:ring-primary">
                  <option>Status</option>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
              <button className="px-3 bg-[#0b0c10] border border-border-dark rounded-lg hover:bg-[#1a1c23] text-gray-500 transition-all">
                <span className="material-icons-outlined">filter_alt_off</span>
              </button>
            </div>

            {/* Table Container */}
            <div className="bg-[#15181e]/50 border border-border-dark rounded-xl flex-1 flex flex-col overflow-hidden">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#1a1c23]/30 text-[10px] uppercase font-bold text-gray-500 border-b border-border-dark tracking-[0.1em]">
                      <th className="px-8 py-5">Operador</th>
                      <th className="px-6 py-5">Matrícula</th>
                      <th className="px-6 py-5">Setor</th>
                      <th className="px-6 py-5">Turno</th>
                      <th className="px-6 py-5">Máquina Padrão</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark text-sm">
                    {loading ? (
                      <tr><td colSpan={7} className="px-8 py-10 text-center text-text-sub-dark italic">Carregando operadores...</td></tr>
                    ) : operators.map((op, i) => (
                      <tr key={op.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold bg-primary`}>
                              {op.avatar}
                            </div>
                            <div>
                              <p className="font-bold text-white text-base">{op.nome}</p>
                              <p className="text-xs text-gray-500">{op.matricula}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-mono text-gray-400">{op.matricula}</td>
                        <td className="px-6 py-6">
                          <span className="px-3 py-1 bg-[#0b0c10] border border-border-dark text-gray-400 text-[11px] font-bold uppercase rounded">
                            {getSectorName(op.setor_id)}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="leading-relaxed text-gray-400">
                            {getTurnoName(op.turno_id)}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-gray-400">--</td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${op.ativo ? 'bg-secondary' : 'bg-gray-600'}`}></span>
                            <span className={`text-xs font-bold ${op.ativo ? 'text-secondary' : 'text-gray-600'}`}>{op.ativo ? 'Ativo' : 'Inativo'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(op)} className="text-gray-500 hover:text-primary p-1 rounded hover:bg-primary/10"><span className="material-icons-outlined text-lg">edit</span></button>
                            <button
                              onClick={() => handleDeleteOperator(op.id)}
                              className="text-gray-500 hover:text-danger p-1 rounded hover:bg-danger/10"
                            >
                              <span className="material-icons-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-8 py-6 border-t border-border-dark flex items-center justify-between">
                <p className="text-sm text-gray-500">Mostrando <span className="text-white font-bold">1 a 5</span> de {operators.length} resultados</p>
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-lg border border-border-dark flex items-center justify-center text-gray-600 hover:text-white hover:border-gray-500 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <span className="material-icons-outlined">chevron_left</span>
                  </button>
                  <button className="w-10 h-10 rounded-lg border border-border-dark flex items-center justify-center text-gray-600 hover:text-white hover:border-gray-500 transition-all">
                    <span className="material-icons-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

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
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${active ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      }`}
  >
    <span className={`material-icons-outlined text-lg ${active ? 'text-primary' : 'text-gray-600 group-hover:text-gray-400'}`}>{icon}</span>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

export default AdminDashboard;

