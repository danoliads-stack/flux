import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Tipos de permissões disponíveis no sistema
const PERMISSOES_DISPONIVEIS = [
    { id: 'VIEW_OPERATOR_DASHBOARD', nome: 'Painel Operador', descricao: 'Visualizar dashboard do operador', icon: 'precision_manufacturing' },
    { id: 'VIEW_SUPERVISOR_DASHBOARD', nome: 'Painel Supervisor', descricao: 'Visualizar dashboard de supervisão', icon: 'monitoring' },
    { id: 'VIEW_ADMIN_DASHBOARD', nome: 'Painel Admin', descricao: 'Visualizar dashboard administrativo', icon: 'admin_panel_settings' },
    { id: 'MANAGE_MACHINE_SETUP', nome: 'Gerenciar Setup', descricao: 'Realizar setup de máquinas', icon: 'build' },
    { id: 'MANAGE_USERS', nome: 'Gerenciar Usuários', descricao: 'Criar, editar e excluir usuários', icon: 'people' },
    { id: 'MANAGE_ROLES', nome: 'Gerenciar Perfis', descricao: 'Criar, editar e excluir perfis', icon: 'shield' },
    { id: 'VIEW_REPORTS', nome: 'Visualizar Relatórios', descricao: 'Acessar relatórios e análises', icon: 'analytics' },
    { id: 'MANAGE_OPS', nome: 'Gerenciar OPs', descricao: 'Criar, editar e excluir ordens de produção', icon: 'assignment' },
    { id: 'MANAGE_MACHINES', nome: 'Gerenciar Máquinas', descricao: 'Configurar máquinas e setores', icon: 'factory' },
    { id: 'MANAGE_CHECKLISTS', nome: 'Gerenciar Checklists', descricao: 'Criar e editar checklists', icon: 'checklist' },
];

interface Perfil {
    id: string;
    nome: string;
    descricao: string;
    permissoes: string[];
    ativo: boolean;
    created_at: string;
}

interface Usuario {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

const AdminPerfisPermissoes: React.FC = () => {
    const [perfis, setPerfis] = useState<Perfil[]>([]);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
    const [newPerfil, setNewPerfil] = useState({
        nome: '',
        descricao: '',
        permissoes: [] as string[],
        ativo: true
    });

    // Perfis padrão do sistema (não podem ser excluídos)
    const PERFIS_PADRAO: Perfil[] = [
        {
            id: 'admin',
            nome: 'Administrador',
            descricao: 'Acesso total ao sistema com todas as permissões',
            permissoes: PERMISSOES_DISPONIVEIS.map(p => p.id),
            ativo: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'supervisor',
            nome: 'Supervisor',
            descricao: 'Gerenciar produção, operadores e visualizar relatórios',
            permissoes: ['VIEW_SUPERVISOR_DASHBOARD', 'VIEW_OPERATOR_DASHBOARD', 'MANAGE_OPS', 'VIEW_REPORTS', 'MANAGE_MACHINE_SETUP'],
            ativo: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'operator',
            nome: 'Operador',
            descricao: 'Acesso ao painel de produção e registro de atividades',
            permissoes: ['VIEW_OPERATOR_DASHBOARD', 'MANAGE_MACHINE_SETUP'],
            ativo: true,
            created_at: new Date().toISOString()
        }
    ];

    const fetchData = async () => {
        setLoading(true);

        // Buscar perfis customizados do banco (se existir tabela)
        const { data: perfisDB, error: perfisError } = await supabase
            .from('perfis')
            .select('*')
            .order('nome');

        // Buscar usuários
        const { data: usuariosDB } = await supabase
            .from('profiles')
            .select('id, full_name, email, role');

        if (usuariosDB) setUsuarios(usuariosDB);

        // Combinar perfis padrão com customizados
        if (perfisDB && !perfisError) {
            setPerfis([...PERFIS_PADRAO, ...perfisDB]);
        } else {
            // Se não existir tabela, usa apenas perfis padrão
            setPerfis(PERFIS_PADRAO);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getUsuariosPorPerfil = (perfilId: string) => {
        const roleMap: Record<string, string> = {
            'admin': 'ADMIN',
            'supervisor': 'SUPERVISOR',
            'operator': 'OPERATOR'
        };
        const role = roleMap[perfilId] || perfilId.toUpperCase();
        return usuarios.filter(u => u.role === role);
    };

    const handleAddPerfil = async () => {
        if (!newPerfil.nome.trim()) return;

        const { error } = await supabase
            .from('perfis')
            .insert({
                nome: newPerfil.nome.trim(),
                descricao: newPerfil.descricao.trim(),
                permissoes: newPerfil.permissoes,
                ativo: newPerfil.ativo
            });

        if (error) {
            // Se a tabela não existir, criar
            if (error.code === '42P01') {
                alert('Tabela de perfis não existe. Entre em contato com o administrador do sistema.');
            } else {
                alert('Erro ao criar perfil: ' + error.message);
            }
            return;
        }

        setIsAddModalOpen(false);
        setNewPerfil({ nome: '', descricao: '', permissoes: [], ativo: true });
        fetchData();
    };

    const handleEditPerfil = async () => {
        if (!editingPerfil) return;

        // Perfis padrão não podem ser editados
        if (['admin', 'supervisor', 'operator'].includes(editingPerfil.id)) {
            alert('Perfis padrão do sistema não podem ser modificados.');
            return;
        }

        const { error } = await supabase
            .from('perfis')
            .update({
                nome: editingPerfil.nome.trim(),
                descricao: editingPerfil.descricao.trim(),
                permissoes: editingPerfil.permissoes,
                ativo: editingPerfil.ativo
            })
            .eq('id', editingPerfil.id);

        if (error) {
            alert('Erro ao atualizar perfil: ' + error.message);
            return;
        }

        setIsEditModalOpen(false);
        setEditingPerfil(null);
        fetchData();
    };

    const handleDeletePerfil = async (perfil: Perfil) => {
        // Perfis padrão não podem ser excluídos
        if (['admin', 'supervisor', 'operator'].includes(perfil.id)) {
            alert('Perfis padrão do sistema não podem ser excluídos.');
            return;
        }

        const usuariosPerfil = getUsuariosPorPerfil(perfil.id);
        if (usuariosPerfil.length > 0) {
            alert(`Este perfil possui ${usuariosPerfil.length} usuário(s) vinculado(s). Remova os usuários antes de excluir.`);
            return;
        }

        if (confirm(`Deseja realmente excluir o perfil "${perfil.nome}"?`)) {
            const { error } = await supabase
                .from('perfis')
                .delete()
                .eq('id', perfil.id);

            if (error) {
                alert('Erro ao excluir perfil: ' + error.message);
                return;
            }

            fetchData();
        }
    };

    const togglePermissao = (permId: string, isNew: boolean = false) => {
        if (isNew) {
            setNewPerfil(prev => ({
                ...prev,
                permissoes: prev.permissoes.includes(permId)
                    ? prev.permissoes.filter(p => p !== permId)
                    : [...prev.permissoes, permId]
            }));
        } else if (editingPerfil) {
            setEditingPerfil(prev => prev ? ({
                ...prev,
                permissoes: prev.permissoes.includes(permId)
                    ? prev.permissoes.filter(p => p !== permId)
                    : [...prev.permissoes, permId]
            }) : null);
        }
    };

    const openEditModal = (perfil: Perfil) => {
        setEditingPerfil({ ...perfil });
        setIsEditModalOpen(true);
    };

    const isPadraoProfile = (id: string) => ['admin', 'supervisor', 'operator'].includes(id);

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase">Perfis e Permissões</h2>
                    <p className="text-xs md:text-sm text-text-sub-dark mt-1">Configure perfis de acesso e gerencie permissões do sistema.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                    <span className="material-icons-outlined text-lg">add</span>
                    Novo Perfil
                </button>
            </div>

            {/* Perfis Grid */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-text-sub-dark">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando perfis...
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                        {perfis.map(perfil => {
                            const usuariosPerfil = getUsuariosPorPerfil(perfil.id);
                            const isPadrao = isPadraoProfile(perfil.id);
                            const isSelected = selectedPerfil?.id === perfil.id;

                            return (
                                <div
                                    key={perfil.id}
                                    onClick={() => setSelectedPerfil(isSelected ? null : perfil)}
                                    className={`bg-surface-dark border rounded-xl p-5 cursor-pointer transition-all hover:border-primary/50 ${isSelected ? 'border-primary ring-1 ring-primary' : 'border-border-dark'
                                        }`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPadrao ? 'bg-primary/20' : 'bg-secondary/20'
                                                }`}>
                                                <span className={`material-icons-outlined text-2xl ${isPadrao ? 'text-primary' : 'text-secondary'
                                                    }`}>
                                                    {isPadrao ? 'verified_user' : 'shield'}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{perfil.nome}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {isPadrao && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase">
                                                            Sistema
                                                        </span>
                                                    )}
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${perfil.ativo ? 'bg-secondary/20 text-secondary' : 'bg-gray-600/20 text-gray-500'
                                                        }`}>
                                                        {perfil.ativo ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {!isPadrao && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(perfil); }}
                                                    className="text-text-sub-dark hover:text-primary p-1.5 rounded-lg hover:bg-primary/10 transition-all"
                                                    title="Editar"
                                                >
                                                    <span className="material-icons-outlined text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePerfil(perfil); }}
                                                    className="text-text-sub-dark hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-all"
                                                    title="Excluir"
                                                >
                                                    <span className="material-icons-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Descrição */}
                                    <p className="text-sm text-text-sub-dark mb-4 line-clamp-2">{perfil.descricao}</p>

                                    {/* Stats */}
                                    <div className="flex gap-3 mb-4">
                                        <div className="flex-1 bg-background-dark rounded-lg p-2 text-center border border-border-dark">
                                            <p className="text-xl font-bold text-white">{usuariosPerfil.length}</p>
                                            <p className="text-[10px] text-text-sub-dark font-bold uppercase">Usuários</p>
                                        </div>
                                        <div className="flex-1 bg-background-dark rounded-lg p-2 text-center border border-border-dark">
                                            <p className="text-xl font-bold text-white">{perfil.permissoes.length}</p>
                                            <p className="text-[10px] text-text-sub-dark font-bold uppercase">Permissões</p>
                                        </div>
                                    </div>

                                    {/* Permissões Preview */}
                                    <div className="flex flex-wrap gap-1">
                                        {perfil.permissoes.slice(0, 4).map(permId => {
                                            const perm = PERMISSOES_DISPONIVEIS.find(p => p.id === permId);
                                            return perm ? (
                                                <span
                                                    key={permId}
                                                    className="text-[9px] px-2 py-0.5 rounded bg-border-dark text-text-sub-dark font-bold uppercase flex items-center gap-1"
                                                >
                                                    <span className="material-icons-outlined text-xs">{perm.icon}</span>
                                                    {perm.nome.split(' ')[0]}
                                                </span>
                                            ) : null;
                                        })}
                                        {perfil.permissoes.length > 4 && (
                                            <span className="text-[9px] px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                                                +{perfil.permissoes.length - 4}
                                            </span>
                                        )}
                                    </div>

                                    {/* Expanded Content */}
                                    {isSelected && (
                                        <div className="mt-4 pt-4 border-t border-border-dark animate-fade-in">
                                            <h4 className="text-xs font-bold text-text-sub-dark uppercase tracking-widest mb-3">
                                                Todas as Permissões
                                            </h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {perfil.permissoes.map(permId => {
                                                    const perm = PERMISSOES_DISPONIVEIS.find(p => p.id === permId);
                                                    return perm ? (
                                                        <div
                                                            key={permId}
                                                            className="flex items-center gap-2 p-2 bg-background-dark rounded-lg border border-border-dark"
                                                        >
                                                            <span className="material-icons-outlined text-primary text-lg">{perm.icon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-white font-medium truncate">{perm.nome}</p>
                                                                <p className="text-[10px] text-text-sub-dark truncate">{perm.descricao}</p>
                                                            </div>
                                                            <span className="material-icons-outlined text-secondary text-lg">check_circle</span>
                                                        </div>
                                                    ) : null;
                                                })}
                                            </div>

                                            {/* Usuários vinculados */}
                                            {usuariosPerfil.length > 0 && (
                                                <>
                                                    <h4 className="text-xs font-bold text-text-sub-dark uppercase tracking-widest mb-3 mt-4">
                                                        Usuários Vinculados ({usuariosPerfil.length})
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {usuariosPerfil.map(user => (
                                                            <div
                                                                key={user.id}
                                                                className="flex items-center gap-2 p-2 bg-background-dark rounded-lg border border-border-dark"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                                    {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-white font-medium truncate">{user.full_name}</p>
                                                                    <p className="text-[10px] text-text-sub-dark truncate">{user.email}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl border border-border-dark animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-border-dark flex items-center justify-between">
                            <div>
                                <h3 className="text-white text-xl font-bold">Novo Perfil</h3>
                                <p className="text-sm text-text-sub-dark mt-1">Configure as permissões do novo perfil.</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-text-sub-dark hover:text-white p-2">
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Nome e Descrição */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Nome do Perfil *</label>
                                    <input
                                        className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newPerfil.nome}
                                        onChange={(e) => setNewPerfil({ ...newPerfil, nome: e.target.value })}
                                        placeholder="Ex: Analista de Qualidade"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Status</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newPerfil.ativo}
                                            onChange={(e) => setNewPerfil({ ...newPerfil, ativo: e.target.checked })}
                                            className="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm text-white">Perfil ativo</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Descrição</label>
                                <textarea
                                    className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary resize-none"
                                    rows={2}
                                    value={newPerfil.descricao}
                                    onChange={(e) => setNewPerfil({ ...newPerfil, descricao: e.target.value })}
                                    placeholder="Breve descrição das responsabilidades deste perfil..."
                                />
                            </div>

                            {/* Permissões */}
                            <div>
                                <label className="text-xs font-bold text-text-sub-dark uppercase block mb-3">
                                    Permissões ({newPerfil.permissoes.length} selecionadas)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {PERMISSOES_DISPONIVEIS.map(perm => {
                                        const isChecked = newPerfil.permissoes.includes(perm.id);
                                        return (
                                            <div
                                                key={perm.id}
                                                onClick={() => togglePermissao(perm.id, true)}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked
                                                        ? 'bg-primary/10 border-primary/30'
                                                        : 'bg-background-dark border-border-dark hover:border-primary/20'
                                                    }`}
                                            >
                                                <span className={`material-icons-outlined text-xl ${isChecked ? 'text-primary' : 'text-text-sub-dark'}`}>
                                                    {perm.icon}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${isChecked ? 'text-white' : 'text-text-sub-dark'}`}>{perm.nome}</p>
                                                    <p className="text-[10px] text-text-sub-dark truncate">{perm.descricao}</p>
                                                </div>
                                                <span className={`material-icons-outlined text-lg ${isChecked ? 'text-primary' : 'text-border-dark'}`}>
                                                    {isChecked ? 'check_circle' : 'radio_button_unchecked'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-border-dark flex gap-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 px-4 py-2.5 bg-surface-dark-highlight border border-border-dark text-white text-sm font-bold rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddPerfil}
                                disabled={!newPerfil.nome.trim()}
                                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Criar Perfil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingPerfil && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingPerfil(null); }}></div>
                    <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl border border-border-dark animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-border-dark flex items-center justify-between">
                            <div>
                                <h3 className="text-white text-xl font-bold">Editar Perfil</h3>
                                <p className="text-sm text-text-sub-dark mt-1">Modifique as configurações do perfil.</p>
                            </div>
                            <button onClick={() => { setIsEditModalOpen(false); setEditingPerfil(null); }} className="text-text-sub-dark hover:text-white p-2">
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Nome e Descrição */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Nome do Perfil *</label>
                                    <input
                                        className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingPerfil.nome}
                                        onChange={(e) => setEditingPerfil({ ...editingPerfil, nome: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Status</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingPerfil.ativo}
                                            onChange={(e) => setEditingPerfil({ ...editingPerfil, ativo: e.target.checked })}
                                            className="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm text-white">Perfil ativo</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-sub-dark uppercase block mb-2">Descrição</label>
                                <textarea
                                    className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary resize-none"
                                    rows={2}
                                    value={editingPerfil.descricao}
                                    onChange={(e) => setEditingPerfil({ ...editingPerfil, descricao: e.target.value })}
                                />
                            </div>

                            {/* Permissões */}
                            <div>
                                <label className="text-xs font-bold text-text-sub-dark uppercase block mb-3">
                                    Permissões ({editingPerfil.permissoes.length} selecionadas)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {PERMISSOES_DISPONIVEIS.map(perm => {
                                        const isChecked = editingPerfil.permissoes.includes(perm.id);
                                        return (
                                            <div
                                                key={perm.id}
                                                onClick={() => togglePermissao(perm.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked
                                                        ? 'bg-primary/10 border-primary/30'
                                                        : 'bg-background-dark border-border-dark hover:border-primary/20'
                                                    }`}
                                            >
                                                <span className={`material-icons-outlined text-xl ${isChecked ? 'text-primary' : 'text-text-sub-dark'}`}>
                                                    {perm.icon}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${isChecked ? 'text-white' : 'text-text-sub-dark'}`}>{perm.nome}</p>
                                                    <p className="text-[10px] text-text-sub-dark truncate">{perm.descricao}</p>
                                                </div>
                                                <span className={`material-icons-outlined text-lg ${isChecked ? 'text-primary' : 'text-border-dark'}`}>
                                                    {isChecked ? 'check_circle' : 'radio_button_unchecked'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-border-dark flex gap-3">
                            <button
                                onClick={() => { setIsEditModalOpen(false); setEditingPerfil(null); }}
                                className="flex-1 px-4 py-2.5 bg-surface-dark-highlight border border-border-dark text-white text-sm font-bold rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditPerfil}
                                disabled={!editingPerfil.nome.trim()}
                                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPerfisPermissoes;
