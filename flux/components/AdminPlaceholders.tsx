import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// OPs Gerais - Dashboard consolidado de todas as OPs
export const AdminOPsGerais: React.FC = () => {
    const [ordens, setOrdens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pendente: 0, andamento: 0, finalizada: 0 });

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('ordens_producao').select('*').order('created_at', { ascending: false });
            if (data) {
                setOrdens(data);
                setStats({
                    total: data.length,
                    pendente: data.filter(o => o.status === 'PENDENTE').length,
                    andamento: data.filter(o => o.status === 'EM_ANDAMENTO').length,
                    finalizada: data.filter(o => o.status === 'FINALIZADA').length,
                });
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white uppercase font-display">OPs Gerais</h2>
                <p className="text-sm text-gray-500 mt-1">Visão consolidada de todas as ordens de produção.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total OPs</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Pendentes</p>
                    <p className="text-3xl font-bold text-gray-400 mt-1">{stats.pendente}</p>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Em Andamento</p>
                    <p className="text-3xl font-bold text-primary mt-1">{stats.andamento}</p>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Finalizadas</p>
                    <p className="text-3xl font-bold text-secondary mt-1">{stats.finalizada}</p>
                </div>
            </div>

            {/* Recent OPs */}
            <div className="flex-1 overflow-auto bg-surface-dark border border-border-dark rounded-xl">
                <div className="p-4 border-b border-border-dark">
                    <h3 className="text-white font-bold">Últimas OPs Atualizadas</h3>
                </div>
                <div className="divide-y divide-border-dark">
                    {loading ? <p className="p-4 text-gray-500">Carregando...</p> :
                        ordens.slice(0, 10).map(op => (
                            <div key={op.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <span className="material-icons-outlined text-primary">assignment</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold">{op.codigo}</p>
                                        <p className="text-xs text-gray-500">{op.cliente || op.modelo || '--'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${op.status === 'PENDENTE' ? 'bg-gray-500/20 text-gray-400' : op.status === 'EM_ANDAMENTO' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'}`}>
                                        {op.status?.replace('_', ' ')}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">{op.quantidade_meta?.toLocaleString()} un</p>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

// Checklists - Gerenciar checklists de qualidade por setor
export const AdminChecklists: React.FC = () => {
    interface Checklist {
        id: string;
        nome: string;
        descricao: string | null;
        tipo: string;
        setor_id: string | null;
        intervalo_minutos: number;
        quantidade_itens: number;
        prioridade: string;
        obrigatorio: boolean;
        ativo: boolean;
        created_at: string;
        setores?: { nome: string } | null;
    }

    interface Setor {
        id: string;
        nome: string;
    }

    const TIPO_OPTIONS = [
        { value: 'GERAL', label: 'Geral', color: 'bg-gray-500' },
        { value: 'SETUP', label: 'Setup', color: 'bg-warning' },
        { value: 'QUALIDADE', label: 'Qualidade', color: 'bg-primary' },
        { value: 'MANUTENCAO', label: 'Manutenção', color: 'bg-orange-500' },
        { value: 'SEGURANCA', label: 'Segurança', color: 'bg-danger' },
    ];

    const PRIORIDADE_OPTIONS = [
        { value: 'BAIXA', label: 'Baixa', color: 'text-gray-400' },
        { value: 'MEDIA', label: 'Média', color: 'text-primary' },
        { value: 'ALTA', label: 'Alta', color: 'text-warning' },
        { value: 'CRITICA', label: 'Crítica', color: 'text-danger' },
    ];

    const TIPO_RESPOSTA_OPTIONS = [
        { value: 'CHECKBOX', label: 'Checkbox (Sim/Não)', icon: 'check_box' },
        { value: 'TEXTO', label: 'Texto', icon: 'notes' },
        { value: 'NUMERO', label: 'Número', icon: 'pin' },
        { value: 'FOTO', label: 'Foto', icon: 'photo_camera' },
    ];

    interface ChecklistItem {
        id: string;
        checklist_id: string;
        descricao: string;
        tipo_resposta: string;
        ordem: number;
        obrigatorio: boolean;
        ativo: boolean;
        created_at: string;
    }

    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [setores, setSetores] = useState<Setor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSetor, setFilterSetor] = useState<string>('');
    const [filterTipo, setFilterTipo] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
    const [newChecklist, setNewChecklist] = useState({
        nome: '',
        descricao: '',
        tipo: 'GERAL',
        setor_id: '',
        intervalo_minutos: 60,
        quantidade_itens: 0,
        prioridade: 'MEDIA',
        obrigatorio: false,
        ativo: true
    });

    // Estados para gerenciamento de itens
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [newItem, setNewItem] = useState({ descricao: '', tipo_resposta: 'CHECKBOX', ordem: 0, obrigatorio: true, ativo: true });
    const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

    const fetchData = async () => {
        setLoading(true);
        const { data: checkData } = await supabase
            .from('checklists')
            .select('*, setores(nome)')
            .order('nome');
        const { data: setData } = await supabase.from('setores').select('id, nome').order('nome');

        if (checkData) setChecklists(checkData);
        if (setData) setSetores(setData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddChecklist = async () => {
        if (!newChecklist.nome.trim()) return;
        await supabase.from('checklists').insert({
            nome: newChecklist.nome.trim(),
            descricao: newChecklist.descricao.trim() || null,
            tipo: newChecklist.tipo,
            setor_id: newChecklist.setor_id || null,
            intervalo_minutos: newChecklist.intervalo_minutos,
            quantidade_itens: newChecklist.quantidade_itens,
            prioridade: newChecklist.prioridade,
            obrigatorio: newChecklist.obrigatorio,
            ativo: newChecklist.ativo
        });
        setIsAddModalOpen(false);
        setNewChecklist({
            nome: '', descricao: '', tipo: 'GERAL', setor_id: '',
            intervalo_minutos: 60, quantidade_itens: 0, prioridade: 'MEDIA',
            obrigatorio: false, ativo: true
        });
        fetchData();
    };

    const handleEditChecklist = async () => {
        if (!editingChecklist) return;
        await supabase.from('checklists').update({
            nome: editingChecklist.nome.trim(),
            descricao: editingChecklist.descricao?.trim() || null,
            tipo: editingChecklist.tipo,
            setor_id: editingChecklist.setor_id || null,
            intervalo_minutos: editingChecklist.intervalo_minutos,
            quantidade_itens: editingChecklist.quantidade_itens,
            prioridade: editingChecklist.prioridade,
            obrigatorio: editingChecklist.obrigatorio,
            ativo: editingChecklist.ativo
        }).eq('id', editingChecklist.id);
        setIsEditModalOpen(false);
        setEditingChecklist(null);
        fetchData();
    };

    const handleDeleteChecklist = async (id: string, nome: string) => {
        if (confirm(`Deseja realmente excluir o checklist "${nome}"?`)) {
            await supabase.from('checklists').delete().eq('id', id);
            fetchData();
        }
    };

    const openEditModal = (ck: Checklist) => {
        setEditingChecklist({ ...ck });
        setIsEditModalOpen(true);
    };

    const filteredChecklists = checklists.filter(ck => {
        const matchesSearch = ck.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSetor = !filterSetor || ck.setor_id === filterSetor;
        const matchesTipo = !filterTipo || ck.tipo === filterTipo;
        return matchesSearch && matchesSetor && matchesTipo;
    });

    const getTipoInfo = (tipo: string) => TIPO_OPTIONS.find(t => t.value === tipo) || TIPO_OPTIONS[0];
    const getPrioridadeInfo = (prioridade: string) => PRIORIDADE_OPTIONS.find(p => p.value === prioridade) || PRIORIDADE_OPTIONS[1];
    const getTipoRespostaInfo = (tipo: string) => TIPO_RESPOSTA_OPTIONS.find(t => t.value === tipo) || TIPO_RESPOSTA_OPTIONS[0];

    // Funções para gerenciamento de itens
    const openItemsModal = async (ck: Checklist) => {
        setSelectedChecklist(ck);
        setIsItemsModalOpen(true);
        await fetchChecklistItems(ck.id);
    };

    const fetchChecklistItems = async (checklistId: string) => {
        setLoadingItems(true);
        const { data } = await supabase
            .from('checklist_items')
            .select('*')
            .eq('checklist_id', checklistId)
            .order('ordem', { ascending: true });
        if (data) setChecklistItems(data);
        setLoadingItems(false);
    };

    const handleAddItem = async () => {
        if (!selectedChecklist || !newItem.descricao.trim()) return;
        const nextOrder = checklistItems.length > 0 ? Math.max(...checklistItems.map(i => i.ordem)) + 1 : 1;
        await supabase.from('checklist_items').insert({
            checklist_id: selectedChecklist.id,
            descricao: newItem.descricao.trim(),
            tipo_resposta: newItem.tipo_resposta,
            ordem: nextOrder,
            obrigatorio: newItem.obrigatorio,
            ativo: newItem.ativo
        });
        setNewItem({ descricao: '', tipo_resposta: 'CHECKBOX', ordem: 0, obrigatorio: true, ativo: true });
        await fetchChecklistItems(selectedChecklist.id);
        fetchData();
    };

    const handleUpdateItem = async () => {
        if (!editingItem) return;
        await supabase.from('checklist_items').update({
            descricao: editingItem.descricao.trim(),
            tipo_resposta: editingItem.tipo_resposta,
            ordem: editingItem.ordem,
            obrigatorio: editingItem.obrigatorio,
            ativo: editingItem.ativo
        }).eq('id', editingItem.id);
        setEditingItem(null);
        if (selectedChecklist) await fetchChecklistItems(selectedChecklist.id);
        fetchData();
    };

    const handleDeleteItem = async (id: string, descricao: string) => {
        if (!confirm(`Excluir item "${descricao}"?`)) return;
        await supabase.from('checklist_items').delete().eq('id', id);
        if (selectedChecklist) await fetchChecklistItems(selectedChecklist.id);
        fetchData();
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white uppercase font-display">Checklists</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Gerencie checklists de qualidade e operação por setor.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                    <span className="material-icons-outlined text-lg">add</span>
                    Novo Checklist
                </button>
            </div>

            {/* Filters */}
            <div className="bg-[#15181e] p-4 rounded-xl border border-border-dark flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                    <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        placeholder="Buscar por nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary min-w-[150px]"
                    value={filterSetor}
                    onChange={(e) => setFilterSetor(e.target.value)}
                >
                    <option value="">Todos os Setores</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <select
                    className="bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary min-w-[130px]"
                    value={filterTipo}
                    onChange={(e) => setFilterTipo(e.target.value)}
                >
                    <option value="">Todos os Tipos</option>
                    {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando checklists...
                </div>
            ) : filteredChecklists.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <span className="material-icons-outlined text-6xl mb-4">fact_check</span>
                    <p>Nenhum checklist encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
                    {filteredChecklists.map(ck => {
                        const tipoInfo = getTipoInfo(ck.tipo);
                        const prioridadeInfo = getPrioridadeInfo(ck.prioridade);
                        return (
                            <div key={ck.id} className="bg-surface-dark border border-border-dark rounded-xl p-4 hover:border-primary/30 transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <span className="material-icons-outlined text-primary">fact_check</span>
                                        </div>
                                        <div>
                                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${tipoInfo.color} text-white`}>
                                                {tipoInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${ck.ativo ? 'bg-secondary/20 text-secondary' : 'bg-gray-600/20 text-gray-500'}`}>
                                        {ck.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>

                                <h3 className="text-white font-bold mb-1">{ck.nome}</h3>
                                {ck.descricao && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{ck.descricao}</p>}

                                {/* Setor Badge */}
                                <div className="mb-3">
                                    {ck.setores?.nome ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#0b0c10] border border-border-dark text-gray-400 text-xs font-bold uppercase rounded">
                                            <span className="material-icons-outlined text-xs">grid_view</span>
                                            {ck.setores.nome}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600 italic text-xs">Sem setor vinculado</span>
                                    )}
                                </div>

                                {/* Info Row */}
                                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                    <span className="flex items-center gap-1">
                                        <span className="material-icons-outlined text-sm">schedule</span>
                                        {ck.intervalo_minutos} min
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-icons-outlined text-sm">checklist</span>
                                        {ck.quantidade_itens} itens
                                    </span>
                                    <span className={`flex items-center gap-1 font-bold ${prioridadeInfo.color}`}>
                                        {prioridadeInfo.label}
                                    </span>
                                </div>

                                {ck.obrigatorio && (
                                    <div className="mb-3">
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-danger/20 text-danger font-bold uppercase">
                                            Obrigatório
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-dark opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openItemsModal(ck)}
                                        className="text-gray-500 hover:text-secondary p-1.5 rounded hover:bg-secondary/10"
                                        title="Gerenciar Itens"
                                    >
                                        <span className="material-icons-outlined text-lg">playlist_add</span>
                                    </button>
                                    <button
                                        onClick={() => openEditModal(ck)}
                                        className="text-gray-500 hover:text-primary p-1.5 rounded hover:bg-primary/10"
                                        title="Editar"
                                    >
                                        <span className="material-icons-outlined text-lg">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteChecklist(ck.id, ck.nome)}
                                        className="text-gray-500 hover:text-danger p-1.5 rounded hover:bg-danger/10"
                                        title="Excluir"
                                    >
                                        <span className="material-icons-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-white text-xl font-bold mb-6">Novo Checklist</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome *</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newChecklist.nome}
                                    onChange={(e) => setNewChecklist({ ...newChecklist, nome: e.target.value })}
                                    placeholder="Ex: Checklist de Setup CNC"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Descrição</label>
                                <textarea
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary resize-none"
                                    rows={2}
                                    value={newChecklist.descricao}
                                    onChange={(e) => setNewChecklist({ ...newChecklist, descricao: e.target.value })}
                                    placeholder="Descrição opcional..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Tipo</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.tipo}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, tipo: e.target.value })}
                                    >
                                        {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.setor_id}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, setor_id: e.target.value })}
                                    >
                                        <option value="">Sem setor</option>
                                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.intervalo_minutos}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, intervalo_minutos: parseInt(e.target.value) || 0 })}
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Qtd. Itens</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.quantidade_itens}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, quantidade_itens: parseInt(e.target.value) || 0 })}
                                        min={0}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Prioridade</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newChecklist.prioridade}
                                    onChange={(e) => setNewChecklist({ ...newChecklist, prioridade: e.target.value })}
                                >
                                    {PRIORIDADE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newChecklist.obrigatorio}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, obrigatorio: e.target.checked })}
                                        className="w-4 h-4 rounded border-border-dark bg-[#0b0c10] text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-400">Obrigatório</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newChecklist.ativo}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, ativo: e.target.checked })}
                                        className="w-4 h-4 rounded border-border-dark bg-[#0b0c10] text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-400">Ativo</span>
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleAddChecklist} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingChecklist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingChecklist(null); }}></div>
                    <div className="relative w-full max-w-lg bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-white text-xl font-bold mb-6">Editar Checklist</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome *</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingChecklist.nome}
                                    onChange={(e) => setEditingChecklist({ ...editingChecklist, nome: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Descrição</label>
                                <textarea
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary resize-none"
                                    rows={2}
                                    value={editingChecklist.descricao || ''}
                                    onChange={(e) => setEditingChecklist({ ...editingChecklist, descricao: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Tipo</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.tipo}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, tipo: e.target.value })}
                                    >
                                        {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.setor_id || ''}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, setor_id: e.target.value || null })}
                                    >
                                        <option value="">Sem setor</option>
                                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.intervalo_minutos}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, intervalo_minutos: parseInt(e.target.value) || 0 })}
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Qtd. Itens</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.quantidade_itens}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, quantidade_itens: parseInt(e.target.value) || 0 })}
                                        min={0}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Prioridade</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingChecklist.prioridade}
                                    onChange={(e) => setEditingChecklist({ ...editingChecklist, prioridade: e.target.value })}
                                >
                                    {PRIORIDADE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editingChecklist.obrigatorio}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, obrigatorio: e.target.checked })}
                                        className="w-4 h-4 rounded border-border-dark bg-[#0b0c10] text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-400">Obrigatório</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editingChecklist.ativo}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, ativo: e.target.checked })}
                                        className="w-4 h-4 rounded border-border-dark bg-[#0b0c10] text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-400">Ativo</span>
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setIsEditModalOpen(false); setEditingChecklist(null); }} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleEditChecklist} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Items Modal */}
            {isItemsModalOpen && selectedChecklist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsItemsModalOpen(false); setSelectedChecklist(null); setEditingItem(null); }}></div>
                    <div className="relative w-full max-w-3xl bg-surface-dark rounded-xl border border-border-dark animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-border-dark flex items-center justify-between">
                            <div>
                                <h3 className="text-white text-xl font-bold">Itens do Checklist</h3>
                                <p className="text-sm text-gray-500">{selectedChecklist.nome}</p>
                            </div>
                            <button onClick={() => { setIsItemsModalOpen(false); setSelectedChecklist(null); setEditingItem(null); }} className="text-gray-500 hover:text-white p-2">
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>

                        {/* Add Item Form */}
                        <div className="p-4 bg-[#0b0c10] border-b border-border-dark">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    className="flex-1 bg-surface-dark border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    placeholder="Descrição do item (ex: Verificar nível de óleo)"
                                    value={newItem.descricao}
                                    onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                />
                                <select
                                    className="bg-surface-dark border border-border-dark rounded-lg py-2.5 px-3 text-sm text-white min-w-[140px]"
                                    value={newItem.tipo_resposta}
                                    onChange={(e) => setNewItem({ ...newItem, tipo_resposta: e.target.value })}
                                >
                                    {TIPO_RESPOSTA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <label className="flex items-center gap-2 text-sm text-gray-400 whitespace-nowrap">
                                    <input type="checkbox" checked={newItem.obrigatorio} onChange={(e) => setNewItem({ ...newItem, obrigatorio: e.target.checked })} className="w-4 h-4 rounded" />
                                    Obrig.
                                </label>
                                <button onClick={handleAddItem} className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg whitespace-nowrap">
                                    <span className="material-icons-outlined text-base align-middle mr-1">add</span>Adicionar
                                </button>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingItems ? (
                                <div className="flex items-center justify-center py-10 text-gray-500">
                                    <span className="material-icons-outlined animate-spin text-2xl mr-2">sync</span>
                                    Carregando itens...
                                </div>
                            ) : checklistItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                                    <span className="material-icons-outlined text-5xl mb-3">playlist_add</span>
                                    <p>Nenhum item cadastrado.</p>
                                    <p className="text-xs">Adicione itens usando o formulário acima.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {checklistItems.map((item, idx) => {
                                        const tipoInfo = getTipoRespostaInfo(item.tipo_resposta);
                                        const isEditing = editingItem?.id === item.id;

                                        return (
                                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isEditing ? 'bg-primary/10 border-primary/30' : 'bg-[#0b0c10] border-border-dark hover:border-primary/20'}`}>
                                                <span className="text-xs text-gray-600 font-mono w-6">{idx + 1}</span>

                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            className="flex-1 bg-surface-dark border border-border-dark rounded py-1.5 px-3 text-sm text-white"
                                                            value={editingItem.descricao}
                                                            onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })}
                                                            autoFocus
                                                        />
                                                        <select
                                                            className="bg-surface-dark border border-border-dark rounded py-1.5 px-2 text-xs text-white"
                                                            value={editingItem.tipo_resposta}
                                                            onChange={(e) => setEditingItem({ ...editingItem, tipo_resposta: e.target.value })}
                                                        >
                                                            {TIPO_RESPOSTA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                        <label className="flex items-center gap-1 text-xs text-gray-400">
                                                            <input type="checkbox" checked={editingItem.obrigatorio} onChange={(e) => setEditingItem({ ...editingItem, obrigatorio: e.target.checked })} className="w-3 h-3" />
                                                            Obrig.
                                                        </label>
                                                        <label className="flex items-center gap-1 text-xs text-gray-400">
                                                            <input type="checkbox" checked={editingItem.ativo} onChange={(e) => setEditingItem({ ...editingItem, ativo: e.target.checked })} className="w-3 h-3" />
                                                            Ativo
                                                        </label>
                                                        <button onClick={handleUpdateItem} className="text-secondary hover:text-secondary/80 p-1" title="Salvar">
                                                            <span className="material-icons-outlined text-lg">check</span>
                                                        </button>
                                                        <button onClick={() => setEditingItem(null)} className="text-gray-500 hover:text-white p-1" title="Cancelar">
                                                            <span className="material-icons-outlined text-lg">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1">
                                                            <p className={`text-sm ${item.ativo ? 'text-white' : 'text-gray-500 line-through'}`}>{item.descricao}</p>
                                                        </div>
                                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                                            <span className="material-icons-outlined text-sm">{tipoInfo.icon}</span>
                                                            {tipoInfo.label.split(' ')[0]}
                                                        </span>
                                                        {item.obrigatorio && <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/20 text-danger font-bold">OBRIG</span>}
                                                        {!item.ativo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-600/20 text-gray-500 font-bold">INATIVO</span>}
                                                        <button onClick={() => setEditingItem({ ...item })} className="text-gray-500 hover:text-primary p-1" title="Editar">
                                                            <span className="material-icons-outlined text-base">edit</span>
                                                        </button>
                                                        <button onClick={() => handleDeleteItem(item.id, item.descricao)} className="text-gray-500 hover:text-danger p-1" title="Excluir">
                                                            <span className="material-icons-outlined text-base">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border-dark bg-[#0b0c10] flex justify-between items-center">
                            <span className="text-xs text-gray-500">{checklistItems.length} {checklistItems.length === 1 ? 'item' : 'itens'}</span>
                            <button onClick={() => { setIsItemsModalOpen(false); setSelectedChecklist(null); setEditingItem(null); }} className="px-4 py-2 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ERP Connector - Configuração de integração ERP
export const AdminERPConnector: React.FC = () => {
    const [connected, setConnected] = useState(false);

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white uppercase font-display">ERP Connector</h2>
                <p className="text-sm text-gray-500 mt-1">Configure a integração com seu sistema ERP.</p>
            </div>

            <div className="max-w-2xl">
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-[#0b0c10] flex items-center justify-center">
                                <span className="material-icons-outlined text-2xl text-gray-500">settings_input_component</span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Status da Conexão</h3>
                                <p className="text-xs text-gray-500">Sincronização de dados ERP</p>
                            </div>
                        </div>
                        <span className={`flex items-center gap-2 text-sm font-bold ${connected ? 'text-secondary' : 'text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-secondary' : 'bg-gray-600'}`}></span>
                            {connected ? 'Conectado' : 'Desconectado'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">URL do ERP</label>
                            <input className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white" placeholder="https://erp.empresa.com/api" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Token de Autenticação</label>
                            <input type="password" className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white" placeholder="••••••••••••••••" />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                        <button className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg">Testar Conexão</button>
                        <button className="px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// API Keys - Gerenciar chaves de API
export const AdminAPIKeys: React.FC = () => {
    const [keys, setKeys] = useState([
        { id: '1', nome: 'Produção', key: 'sk_prod_****...4f2a', criado: '2025-01-15', ultimo_uso: '2025-12-25' },
        { id: '2', nome: 'Desenvolvimento', key: 'sk_dev_****...8b1c', criado: '2025-02-20', ultimo_uso: '2025-12-20' },
    ]);

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white uppercase font-display">API Keys</h2>
                    <p className="text-sm text-gray-500 mt-1">Gerencie chaves de API para integrações externas.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">
                    <span className="material-icons-outlined text-lg">add</span>Nova Chave
                </button>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#1a1c23] text-[10px] uppercase text-gray-500 tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Chave</th>
                            <th className="px-6 py-4">Criado em</th>
                            <th className="px-6 py-4">Último Uso</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark text-sm">
                        {keys.map(k => (
                            <tr key={k.id} className="hover:bg-white/[0.02]">
                                <td className="px-6 py-4 text-white font-bold">{k.nome}</td>
                                <td className="px-6 py-4 font-mono text-gray-400">{k.key}</td>
                                <td className="px-6 py-4 text-gray-400">{k.criado}</td>
                                <td className="px-6 py-4 text-gray-400">{k.ultimo_uso}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-gray-500 hover:text-danger p-1"><span className="material-icons-outlined text-base">delete</span></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// CLP / Sensores - Configurar CLPs e sensores IoT
export const AdminCLPSensores: React.FC = () => {
    const [dispositivos, setDispositivos] = useState([
        { id: '1', nome: 'CLP Torno 01', tipo: 'CLP', ip: '192.168.1.100', status: 'online' },
        { id: '2', nome: 'Sensor Temp. Fresa', tipo: 'SENSOR', ip: '192.168.1.101', status: 'online' },
        { id: '3', nome: 'CLP Centro Usinagem', tipo: 'CLP', ip: '192.168.1.102', status: 'offline' },
    ]);

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white uppercase font-display">CLP / Sensores</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure conexões com CLPs e sensores IoT.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">
                    <span className="material-icons-outlined text-lg">add</span>Novo Dispositivo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dispositivos.map(d => (
                    <div key={d.id} className="bg-surface-dark border border-border-dark rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="material-icons-outlined text-primary">{d.tipo === 'CLP' ? 'memory' : 'sensors'}</span>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-bold ${d.status === 'online' ? 'text-secondary' : 'text-danger'}`}>
                                <span className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-secondary' : 'bg-danger'}`}></span>
                                {d.status}
                            </span>
                        </div>
                        <h3 className="text-white font-bold">{d.nome}</h3>
                        <p className="text-xs text-gray-500 mb-2">{d.tipo}</p>
                        <p className="text-xs font-mono text-gray-400">{d.ip}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Usuários Admin
export const AdminUsuarios: React.FC = () => {
    const [usuarios, setUsuarios] = useState([
        { id: '1', nome: 'Admin Principal', email: 'admin@flux.com', role: 'ADMIN', ativo: true },
        { id: '2', nome: 'Supervisor Produção', email: 'supervisor@flux.com', role: 'SUPERVISOR', ativo: true },
        { id: '3', nome: 'Analista Qualidade', email: 'qualidade@flux.com', role: 'ANALISTA', ativo: false },
    ]);

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white uppercase font-display">Usuários</h2>
                    <p className="text-sm text-gray-500 mt-1">Gerencie usuários administradores do sistema.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">
                    <span className="material-icons-outlined text-lg">person_add</span>Novo Usuário
                </button>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#1a1c23] text-[10px] uppercase text-gray-500 tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Perfil</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark text-sm">
                        {usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-white/[0.02]">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                            {u.nome.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-white font-bold">{u.nome}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-400">{u.email}</td>
                                <td className="px-6 py-4"><span className="text-xs font-bold uppercase text-primary">{u.role}</span></td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold ${u.ativo ? 'text-secondary' : 'text-gray-500'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-gray-500 hover:text-primary p-1"><span className="material-icons-outlined text-base">edit</span></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Perfis e Permissões
export const AdminPerfisPermissoes: React.FC = () => {
    const perfis = [
        { id: '1', nome: 'Administrador', descricao: 'Acesso total ao sistema', usuarios: 2, permissoes: ['criar', 'editar', 'excluir', 'visualizar'] },
        { id: '2', nome: 'Supervisor', descricao: 'Gerenciar produção e operadores', usuarios: 5, permissoes: ['criar', 'editar', 'visualizar'] },
        { id: '3', nome: 'Analista', descricao: 'Relatórios e visualização', usuarios: 8, permissoes: ['visualizar'] },
    ];

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white uppercase font-display">Perfis e Permissões</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure perfis de acesso e permissões.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">
                    <span className="material-icons-outlined text-lg">add</span>Novo Perfil
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {perfis.map(p => (
                    <div key={p.id} className="bg-surface-dark border border-border-dark rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="material-icons-outlined text-primary">shield</span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{p.nome}</h3>
                                <p className="text-xs text-gray-500">{p.usuarios} usuários</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{p.descricao}</p>
                        <div className="flex flex-wrap gap-1">
                            {p.permissoes.map(perm => (
                                <span key={perm} className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary uppercase font-bold">{perm}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Logs e Auditoria
export const AdminLogsAuditoria: React.FC = () => {
    const [logs, setLogs] = useState([
        { id: '1', acao: 'LOGIN', usuario: 'admin@flux.com', descricao: 'Login realizado com sucesso', data: '2025-12-25 18:10:00', tipo: 'info' },
        { id: '2', acao: 'CREATE', usuario: 'admin@flux.com', descricao: 'Nova OP criada: OP-150', data: '2025-12-25 18:08:00', tipo: 'success' },
        { id: '3', acao: 'UPDATE', usuario: 'supervisor@flux.com', descricao: 'Operador atualizado: João Silva', data: '2025-12-25 17:55:00', tipo: 'info' },
        { id: '4', acao: 'DELETE', usuario: 'admin@flux.com', descricao: 'OP excluída: OP-089', data: '2025-12-25 17:40:00', tipo: 'warning' },
        { id: '5', acao: 'ERROR', usuario: 'sistema', descricao: 'Falha na sincronização ERP', data: '2025-12-25 17:30:00', tipo: 'error' },
    ]);

    const getTypeColor = (tipo: string) => {
        switch (tipo) {
            case 'success': return 'text-secondary';
            case 'warning': return 'text-warning';
            case 'error': return 'text-danger';
            default: return 'text-primary';
        }
    };

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white uppercase font-display">Logs e Auditoria</h2>
                <p className="text-sm text-gray-500 mt-1">Histórico de ações e eventos do sistema.</p>
            </div>

            <div className="flex-1 overflow-auto bg-surface-dark border border-border-dark rounded-xl">
                <table className="w-full text-left">
                    <thead className="bg-[#1a1c23] text-[10px] uppercase text-gray-500 tracking-widest sticky top-0">
                        <tr>
                            <th className="px-6 py-4">Data/Hora</th>
                            <th className="px-6 py-4">Ação</th>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Descrição</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark text-sm">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-white/[0.02]">
                                <td className="px-6 py-4 text-gray-400 font-mono text-xs">{log.data}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold uppercase ${getTypeColor(log.tipo)}`}>{log.acao}</span>
                                </td>
                                <td className="px-6 py-4 text-gray-400">{log.usuario}</td>
                                <td className="px-6 py-4 text-white">{log.descricao}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default { AdminOPsGerais, AdminChecklists, AdminERPConnector, AdminAPIKeys, AdminCLPSensores, AdminUsuarios, AdminPerfisPermissoes, AdminLogsAuditoria };
