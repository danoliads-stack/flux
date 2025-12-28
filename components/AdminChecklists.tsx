
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ChecklistTemplate, Setor, ChecklistItem } from '../types';

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

const AdminChecklists: React.FC = () => {
    const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
    const [setores, setSetores] = useState<Setor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSetor, setFilterSetor] = useState<string>('');
    const [filterTipo, setFilterTipo] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<ChecklistTemplate | null>(null);
    const [newChecklist, setNewChecklist] = useState({
        nome: '',
        descricao: '',
        tipo: 'GERAL',
        setor_id: '',
        intervalo_minutos: 15,
        intervalo_etiqueta_minutos: 60,
        quantidade_itens: 0,
        prioridade: 'MEDIA',
        obrigatorio: false,
        ativo: true
    });

    // Estados para gerenciamento de itens
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistTemplate | null>(null);
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

        let validSetorId = newChecklist.setor_id;
        if (!validSetorId || validSetorId === '') validSetorId = null as any;

        const { error } = await supabase.from('checklists').insert({
            nome: newChecklist.nome.trim(),
            descricao: newChecklist.descricao.trim() || null,
            tipo: newChecklist.tipo,
            setor_id: validSetorId,
            intervalo_minutos: newChecklist.intervalo_minutos,
            intervalo_etiqueta_minutos: newChecklist.intervalo_etiqueta_minutos,
            prioridade: newChecklist.prioridade,
            obrigatorio: newChecklist.obrigatorio,
            ativo: newChecklist.ativo
        });

        if (error) {
            console.error(error);
            alert('Erro ao criar checklist: ' + error.message);
            return;
        }

        setIsAddModalOpen(false);
        setNewChecklist({
            nome: '', descricao: '', tipo: 'GERAL', setor_id: '',
            intervalo_minutos: 15, intervalo_etiqueta_minutos: 60, prioridade: 'MEDIA',
            obrigatorio: false, ativo: true
        });
        fetchData();
    };

    const handleEditChecklist = async () => {
        if (!editingChecklist) return;

        let validSetorId = editingChecklist.setor_id;
        if (!validSetorId || validSetorId === '') validSetorId = null;

        await supabase.from('checklists').update({
            nome: editingChecklist.nome.trim(),
            descricao: editingChecklist.descricao?.trim() || null,
            tipo: editingChecklist.tipo,
            setor_id: validSetorId,
            intervalo_minutos: editingChecklist.intervalo_minutos,
            intervalo_etiqueta_minutos: editingChecklist.intervalo_etiqueta_minutos,
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

    const openEditModal = (ck: ChecklistTemplate) => {
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
    const openItemsModal = async (ck: ChecklistTemplate) => {
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
        fetchData(); // Atualiza contador de itens na lista principal
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
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden h-full">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 custom-scrollbar">
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
                                    {/* Made clickable directly to help user find the action */}
                                    <button
                                        onClick={() => openItemsModal(ck)}
                                        className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer group/item"
                                        title="Gerenciar Itens"
                                    >
                                        <span className="material-icons-outlined text-sm group-hover/item:text-primary">checklist</span>
                                        Itens
                                    </button>
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

                                {/* Actions - Always visible now for better mobile/UX support */}
                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-dark">
                                    <button
                                        onClick={() => openItemsModal(ck)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all text-xs font-bold"
                                        title="Gerenciar Itens"
                                    >
                                        <span className="material-icons-outlined text-base">playlist_add</span>
                                        Itens
                                    </button>
                                    <div className="h-4 w-[1px] bg-border-dark mx-1"></div>
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
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo Checklist (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.intervalo_minutos}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, intervalo_minutos: parseInt(e.target.value) || 0 })}
                                        min={1}
                                        placeholder="15"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo Etiqueta (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newChecklist.intervalo_etiqueta_minutos}
                                        onChange={(e) => setNewChecklist({ ...newChecklist, intervalo_etiqueta_minutos: parseInt(e.target.value) || 0 })}
                                        min={1}
                                        placeholder="60"
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
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo Checklist (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.intervalo_minutos}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, intervalo_minutos: parseInt(e.target.value) || 0 })}
                                        min={1}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Intervalo Etiqueta (min)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingChecklist.intervalo_etiqueta_minutos || 60}
                                        onChange={(e) => setEditingChecklist({ ...editingChecklist, intervalo_etiqueta_minutos: parseInt(e.target.value) || 0 })}
                                        min={1}
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
                    <div className="relative w-full max-w-3xl bg-surface-dark rounded-xl border border-border-dark animate-fade-in max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-border-dark flex items-center justify-between bg-[#15181e]">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-outlined text-primary text-2xl">playlist_add_check</span>
                                    <h3 className="text-white text-xl font-bold">Itens do Checklist</h3>
                                </div>
                                <p className="text-sm text-gray-500 mt-1 ml-9">{selectedChecklist.nome}</p>
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
                                    autoFocus
                                />
                                <div className="flex gap-3">
                                    <select
                                        className="bg-surface-dark border border-border-dark rounded-lg py-2.5 px-3 text-sm text-white min-w-[140px] focus:ring-1 focus:ring-primary"
                                        value={newItem.tipo_resposta}
                                        onChange={(e) => setNewItem({ ...newItem, tipo_resposta: e.target.value })}
                                    >
                                        {TIPO_RESPOSTA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <label className="flex items-center gap-2 text-sm text-gray-400 whitespace-nowrap bg-surface-dark border border-border-dark rounded-lg px-3 cursor-pointer hover:bg-white/5 transition-colors">
                                        <input type="checkbox" checked={newItem.obrigatorio} onChange={(e) => setNewItem({ ...newItem, obrigatorio: e.target.checked })} className="w-4 h-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary" />
                                        Obrig.
                                    </label>
                                    <button onClick={handleAddItem} className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg whitespace-nowrap shadow-glow transition-all flex items-center gap-2">
                                        <span className="material-icons-outlined text-lg">add</span>
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#111318]">
                            {loadingItems ? (
                                <div className="flex items-center justify-center py-10 text-gray-500">
                                    <span className="material-icons-outlined animate-spin text-2xl mr-2">sync</span>
                                    Carregando itens...
                                </div>
                            ) : checklistItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-500 opacity-50">
                                    <span className="material-icons-outlined text-6xl mb-4">playlist_add</span>
                                    <p className="font-bold text-lg">Nenhum item cadastrado</p>
                                    <p className="text-xs mt-1">Utilize o formulário acima para adicionar itens</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {checklistItems.map((item, idx) => {
                                        const tipoInfo = getTipoRespostaInfo(item.tipo_resposta);
                                        const isEditing = editingItem?.id === item.id;

                                        return (
                                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all group ${isEditing ? 'bg-primary/10 border-primary/30' : 'bg-[#0b0c10] border-border-dark hover:border-primary/20'}`}>
                                                <span className="text-xs text-gray-600 font-mono w-8 text-center font-bold bg-[#1a1c23] py-1 rounded">{item.ordem}</span>

                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            className="flex-1 bg-surface-dark border border-border-dark rounded py-1.5 px-3 text-sm text-white focus:ring-1 focus:ring-primary"
                                                            value={editingItem.descricao}
                                                            onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })}
                                                            autoFocus
                                                        />
                                                        <select
                                                            className="bg-surface-dark border border-border-dark rounded py-1.5 px-2 text-xs text-white focus:ring-1 focus:ring-primary"
                                                            value={editingItem.tipo_resposta}
                                                            onChange={(e) => setEditingItem({ ...editingItem, tipo_resposta: e.target.value })}
                                                        >
                                                            {TIPO_RESPOSTA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                                                            <input type="checkbox" checked={editingItem.obrigatorio} onChange={(e) => setEditingItem({ ...editingItem, obrigatorio: e.target.checked })} className="w-3 h-3 rounded bg-transparent border-gray-600 text-primary" />
                                                            Obrig.
                                                        </label>
                                                        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                                                            <input type="checkbox" checked={editingItem.ativo} onChange={(e) => setEditingItem({ ...editingItem, ativo: e.target.checked })} className="w-3 h-3 rounded bg-transparent border-gray-600 text-primary" />
                                                            Ativo
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={handleUpdateItem} className="w-7 h-7 flex items-center justify-center rounded bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors" title="Salvar">
                                                                <span className="material-icons-outlined text-base">check</span>
                                                            </button>
                                                            <button onClick={() => setEditingItem(null)} className="w-7 h-7 flex items-center justify-center rounded bg-gray-700/30 text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors" title="Cancelar">
                                                                <span className="material-icons-outlined text-base">close</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1">
                                                            <p className={`text-sm ${item.ativo ? 'text-white' : 'text-gray-500 line-through'}`}>{item.descricao}</p>
                                                        </div>
                                                        <span className="flex items-center gap-1 text-xs text-gray-500 bg-[#1a1c23] px-2 py-1 rounded border border-border-dark">
                                                            <span className="material-icons-outlined text-sm">{tipoInfo.icon}</span>
                                                            {tipoInfo.label.split(' ')[0]}
                                                        </span>
                                                        {item.obrigatorio && <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20 font-bold uppercase tracking-wide">Obrigatório</span>}
                                                        {!item.ativo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-600/20 text-gray-500 font-bold uppercase tracking-wide">Inativo</span>}

                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => setEditingItem({ ...item })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/10 text-gray-500 hover:text-primary transition-colors" title="Editar">
                                                                <span className="material-icons-outlined text-base">edit</span>
                                                            </button>
                                                            <button onClick={() => handleDeleteItem(item.id, item.descricao)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger/10 text-gray-500 hover:text-danger transition-colors" title="Excluir">
                                                                <span className="material-icons-outlined text-base">delete</span>
                                                            </button>
                                                        </div>
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
                            <span className="text-xs text-gray-500 font-mono">Total: <strong className="text-white">{checklistItems.length}</strong> itens</span>
                            <button onClick={() => { setIsItemsModalOpen(false); setSelectedChecklist(null); setEditingItem(null); }} className="px-5 py-2 bg-[#1a1c23] hover:bg-[#252831] border border-border-dark text-white text-sm font-bold rounded-lg transition-all">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminChecklists;
