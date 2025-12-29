import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { realtimeManager, createMachineUpdate } from '../src/utils/realtimeManager';

interface Setor {
    id: string;
    nome: string;
}

interface Maquina {
    id: string;
    nome: string;
    codigo: string;
    setor_id: string | null;
    status_atual: string;
    created_at: string;
    setores?: { nome: string } | null;
}

const STATUS_OPTIONS = [
    { value: 'AVAILABLE', label: 'Disponível', color: 'bg-primary' },
    { value: 'RUNNING', label: 'Produzindo', color: 'bg-secondary' },
    { value: 'SETUP', label: 'Setup', color: 'bg-warning' },
    { value: 'STOPPED', label: 'Parada', color: 'bg-danger' },
    { value: 'MAINTENANCE', label: 'Manutenção', color: 'bg-orange-500' },
];

const AdminMaquinas: React.FC = () => {
    const [maquinas, setMaquinas] = useState<Maquina[]>([]);
    const [setores, setSetores] = useState<Setor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSetor, setFilterSetor] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);
    const [newMaquina, setNewMaquina] = useState({ nome: '', codigo: '', setor_id: '', status_atual: 'AVAILABLE' });

    const fetchData = async () => {
        setLoading(true);
        const { data: maqData } = await supabase
            .from('maquinas')
            .select('*, setores(nome)')
            .order('nome');
        const { data: setData } = await supabase.from('setores').select('id, nome').order('nome');

        if (maqData) setMaquinas(maqData);
        if (setData) setSetores(setData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddMaquina = async () => {
        if (!newMaquina.nome.trim() || !newMaquina.codigo.trim()) return;
        await supabase.from('maquinas').insert({
            nome: newMaquina.nome.trim(),
            codigo: newMaquina.codigo.trim(),
            setor_id: newMaquina.setor_id || null,
            status_atual: newMaquina.status_atual
        });
        setIsAddModalOpen(false);
        setNewMaquina({ nome: '', codigo: '', setor_id: '', status_atual: 'AVAILABLE' });
        fetchData();
    };

    const handleEditMaquina = async () => {
        if (!editingMaquina) return;

        const { error } = await supabase.from('maquinas').update({
            nome: editingMaquina.nome.trim(),
            codigo: editingMaquina.codigo.trim(),
            setor_id: editingMaquina.setor_id || null,
            status_atual: editingMaquina.status_atual
        }).eq('id', editingMaquina.id);

        if (!error) {
            // Broadcast mudança para outras abas
            await realtimeManager.broadcastMachineUpdate(
                createMachineUpdate(
                    editingMaquina.id,
                    editingMaquina.status_atual
                )
            );
        }

        setIsEditModalOpen(false);
        setEditingMaquina(null);
        fetchData();
    };

    const handleDeleteMaquina = async (id: string, nome: string) => {
        if (confirm(`Deseja realmente excluir a máquina "${nome}"?`)) {
            await supabase.from('maquinas').delete().eq('id', id);
            fetchData();
        }
    };

    const openEditModal = (maq: Maquina) => {
        setEditingMaquina({ ...maq });
        setIsEditModalOpen(true);
    };

    const filteredMaquinas = maquinas.filter(m => {
        const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.codigo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSetor = !filterSetor || m.setor_id === filterSetor;
        return matchesSearch && matchesSetor;
    });

    const getStatusInfo = (status: string) => {
        return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase">Máquinas</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Cadastre e gerencie as máquinas da fábrica.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                    <span className="material-icons-outlined text-lg">add</span>
                    Nova Máquina
                </button>
            </div>

            {/* Filters */}
            <div className="bg-[#15181e] p-4 rounded-xl border border-border-dark flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                    <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        placeholder="Buscar por nome ou código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary min-w-[180px]"
                    value={filterSetor}
                    onChange={(e) => setFilterSetor(e.target.value)}
                >
                    <option value="">Todos os Setores</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando máquinas...
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-[#15181e]/50 border border-border-dark rounded-xl">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="bg-[#1a1c23]/50 text-[10px] uppercase font-bold text-gray-500 border-b border-border-dark tracking-widest">
                                <th className="px-4 md:px-6 py-4">Máquina</th>
                                <th className="px-4 md:px-6 py-4">Código</th>
                                <th className="px-4 md:px-6 py-4">Setor</th>
                                <th className="px-4 md:px-6 py-4">Status</th>
                                <th className="px-4 md:px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark text-sm">
                            {filteredMaquinas.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500 italic">Nenhuma máquina encontrada.</td></tr>
                            ) : filteredMaquinas.map((maq) => {
                                const statusInfo = getStatusInfo(maq.status_atual);
                                return (
                                    <tr key={maq.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                    <span className="material-icons-outlined text-primary">precision_manufacturing</span>
                                                </div>
                                                <span className="font-bold text-white">{maq.nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 font-mono text-gray-400">{maq.codigo}</td>
                                        <td className="px-4 md:px-6 py-4">
                                            {maq.setores?.nome ? (
                                                <span className="px-2 py-1 bg-[#0b0c10] border border-border-dark text-gray-400 text-xs font-bold uppercase rounded">
                                                    {maq.setores.nome}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 italic text-xs">Sem setor</span>
                                            )}
                                        </td>
                                        <td className="px-4 md:px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${statusInfo.color}`}></span>
                                                <span className="text-xs font-bold text-gray-400 uppercase">{statusInfo.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(maq)}
                                                    className="text-gray-500 hover:text-primary p-1.5 rounded hover:bg-primary/10"
                                                    title="Editar"
                                                >
                                                    <span className="material-icons-outlined text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteMaquina(maq.id, maq.nome)}
                                                    className="text-gray-500 hover:text-danger p-1.5 rounded hover:bg-danger/10"
                                                    title="Excluir"
                                                >
                                                    <span className="material-icons-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Nova Máquina</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newMaquina.nome}
                                    onChange={(e) => setNewMaquina({ ...newMaquina, nome: e.target.value })}
                                    placeholder="Ex: CNC-01, Torno-02..."
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Código</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newMaquina.codigo}
                                    onChange={(e) => setNewMaquina({ ...newMaquina, codigo: e.target.value })}
                                    placeholder="Ex: 883-A"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor (Opcional)</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newMaquina.setor_id}
                                    onChange={(e) => setNewMaquina({ ...newMaquina, setor_id: e.target.value })}
                                >
                                    <option value="">Sem setor</option>
                                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Status Inicial</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newMaquina.status_atual}
                                    onChange={(e) => setNewMaquina({ ...newMaquina, status_atual: e.target.value })}
                                >
                                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleAddMaquina} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingMaquina && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingMaquina(null); }}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Editar Máquina</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingMaquina.nome}
                                    onChange={(e) => setEditingMaquina({ ...editingMaquina, nome: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Código</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingMaquina.codigo}
                                    onChange={(e) => setEditingMaquina({ ...editingMaquina, codigo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Setor</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingMaquina.setor_id || ''}
                                    onChange={(e) => setEditingMaquina({ ...editingMaquina, setor_id: e.target.value || null })}
                                >
                                    <option value="">Sem setor</option>
                                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Status</label>
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingMaquina.status_atual}
                                    onChange={(e) => setEditingMaquina({ ...editingMaquina, status_atual: e.target.value })}
                                >
                                    {STATUS_OPTIONS.map(s => (
                                        <option
                                            key={s.value}
                                            value={s.value}
                                            disabled={(s.value === 'RUNNING' || s.value === 'SETUP' || s.value === 'STOPPED') && editingMaquina.status_atual === 'AVAILABLE'}
                                        >
                                            {s.label} {(s.value === 'RUNNING' || s.value === 'SETUP' || s.value === 'STOPPED') && editingMaquina.status_atual === 'AVAILABLE' ? '(Use Painel de Operador)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setIsEditModalOpen(false); setEditingMaquina(null); }} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleEditMaquina} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMaquinas;
