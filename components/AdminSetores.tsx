import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Setor {
    id: string;
    nome: string;
    created_at: string;
}

interface Operador {
    id: string;
    nome: string;
    matricula: string;
    avatar: string;
    ativo: boolean;
}

interface Maquina {
    id: string;
    nome: string;
    codigo: string;
    status_atual: string;
    setor_id: string | null;
}

interface SetorWithDetails extends Setor {
    operadores: Operador[];
    maquinas: Maquina[];
}

const AdminSetores: React.FC = () => {
    const [setores, setSetores] = useState<SetorWithDetails[]>([]);
    const [allMachines, setAllMachines] = useState<Maquina[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSetor, setExpandedSetor] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isLinkMachineModalOpen, setIsLinkMachineModalOpen] = useState(false);
    const [editingSetor, setEditingSetor] = useState<{ id: string; nome: string } | null>(null);
    const [linkingSetorId, setLinkingSetorId] = useState<string | null>(null);
    const [newSetorNome, setNewSetorNome] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);

        const { data: setoresData } = await supabase
            .from('setores')
            .select('*')
            .order('nome');

        const { data: allMachinesData } = await supabase
            .from('maquinas')
            .select('id, nome, codigo, status_atual, setor_id');

        if (allMachinesData) setAllMachines(allMachinesData);

        if (setoresData) {
            const setoresWithDetails: SetorWithDetails[] = await Promise.all(
                setoresData.map(async (setor) => {
                    const { data: operadores } = await supabase
                        .from('operadores')
                        .select('id, nome, matricula, avatar, ativo')
                        .eq('setor_id', setor.id);

                    const { data: maquinas } = await supabase
                        .from('maquinas')
                        .select('id, nome, codigo, status_atual, setor_id')
                        .eq('setor_id', setor.id);

                    return {
                        ...setor,
                        operadores: operadores || [],
                        maquinas: maquinas || [],
                    };
                })
            );

            setSetores(setoresWithDetails);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddSetor = async () => {
        if (!newSetorNome.trim()) return;
        await supabase.from('setores').insert({ nome: newSetorNome.trim() });
        setIsAddModalOpen(false);
        setNewSetorNome('');
        fetchData();
    };

    const handleDeleteSetor = async (id: string, nome: string, opCount: number, maqCount: number) => {
        const hasLinks = opCount > 0 || maqCount > 0;

        const message = hasLinks
            ? `O setor "${nome}" possui ${opCount} operador(es) e ${maqCount} máquina(s) vinculados.\n\nDeseja DESVINCULAR todos e EXCLUIR o setor?`
            : `Deseja realmente excluir o setor "${nome}"?`;

        if (confirm(message)) {
            if (hasLinks) {
                // Desvincular operadores e máquinas
                await supabase.from('operadores').update({ setor_id: null }).eq('setor_id', id);
                await supabase.from('maquinas').update({ setor_id: null }).eq('setor_id', id);
            }
            // Excluir setor
            const { error } = await supabase.from('setores').delete().eq('id', id);
            if (error) {
                alert('Erro ao excluir setor: ' + error.message);
            }
            fetchData();
        }
    };

    const openEditModal = (setor: SetorWithDetails) => {
        setEditingSetor({ id: setor.id, nome: setor.nome });
        setIsEditModalOpen(true);
    };

    const handleEditSetor = async () => {
        if (!editingSetor || !editingSetor.nome.trim()) return;
        await supabase.from('setores').update({ nome: editingSetor.nome.trim() }).eq('id', editingSetor.id);
        setIsEditModalOpen(false);
        setEditingSetor(null);
        fetchData();
    };

    const openLinkMachineModal = (setorId: string) => {
        setLinkingSetorId(setorId);
        setSelectedMachineId('');
        setIsLinkMachineModalOpen(true);
    };

    const handleLinkMachine = async () => {
        if (!linkingSetorId || !selectedMachineId) return;
        await supabase.from('maquinas').update({ setor_id: linkingSetorId }).eq('id', selectedMachineId);
        setIsLinkMachineModalOpen(false);
        setLinkingSetorId(null);
        setSelectedMachineId('');
        fetchData();
    };

    const handleUnlinkMachine = async (machineId: string) => {
        if (confirm('Deseja desvincular esta máquina do setor?')) {
            await supabase.from('maquinas').update({ setor_id: null }).eq('id', machineId);
            fetchData();
        }
    };

    const getAvailableMachines = () => {
        return allMachines.filter(m => !m.setor_id);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'bg-secondary';
            case 'SETUP': return 'bg-warning';
            case 'STOPPED': return 'bg-danger';
            case 'AVAILABLE': return 'bg-primary';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase">Setores</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Gerencie os setores e vincule máquinas.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                    <span className="material-icons-outlined text-lg">add</span>
                    Novo Setor
                </button>
            </div>

            {/* Sectors List */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando setores...
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                    {setores.map((setor) => {
                        const isExpanded = expandedSetor === setor.id;
                        return (
                            <div
                                key={setor.id}
                                className={`bg-[#15181e] border border-border-dark rounded-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary' : ''}`}
                            >
                                {/* Sector Header */}
                                <div
                                    className="p-4 md:p-6 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setExpandedSetor(isExpanded ? null : setor.id)}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                <span className="material-icons-outlined text-primary text-xl md:text-2xl">grid_view</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-lg md:text-xl font-bold text-white truncate">{setor.nome}</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {setor.operadores.length} op. • {setor.maquinas.length} máq.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditModal(setor); }}
                                                className="text-gray-500 hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-all"
                                                title="Editar"
                                            >
                                                <span className="material-icons-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSetor(setor.id, setor.nome, setor.operadores.length, setor.maquinas.length); }}
                                                className="text-gray-500 hover:text-danger p-2 rounded-lg hover:bg-danger/10 transition-all"
                                                title="Excluir"
                                            >
                                                <span className="material-icons-outlined text-lg">delete</span>
                                            </button>
                                            <span className={`material-icons-outlined text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="flex gap-3 mt-4">
                                        <div className="flex-1 bg-[#0b0c10] rounded-lg p-2 md:p-3 border border-border-dark text-center">
                                            <p className="text-xl md:text-2xl font-bold text-white">{setor.operadores.length}</p>
                                            <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase">Operadores</p>
                                        </div>
                                        <div className="flex-1 bg-[#0b0c10] rounded-lg p-2 md:p-3 border border-border-dark text-center">
                                            <p className="text-xl md:text-2xl font-bold text-white">{setor.maquinas.length}</p>
                                            <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase">Máquinas</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-border-dark animate-fade-in">
                                        {/* Operators */}
                                        <div className="p-4 md:p-6 border-b border-border-dark">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <span className="material-icons-outlined text-sm">people</span>
                                                Operadores ({setor.operadores.length})
                                            </h4>
                                            {setor.operadores.length === 0 ? (
                                                <p className="text-gray-600 text-sm italic">Nenhum operador vinculado.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {setor.operadores.map((op) => (
                                                        <div key={op.id} className="flex items-center gap-2 p-2 bg-[#0b0c10] rounded-lg border border-border-dark">
                                                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                {op.avatar || op.nome.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-white text-sm font-medium truncate">{op.nome}</p>
                                                                <p className="text-gray-500 text-xs truncate">{op.matricula}</p>
                                                            </div>
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${op.ativo ? 'bg-secondary' : 'bg-gray-600'}`}></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Machines */}
                                        <div className="p-4 md:p-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                    <span className="material-icons-outlined text-sm">precision_manufacturing</span>
                                                    Máquinas ({setor.maquinas.length})
                                                </h4>
                                                <button
                                                    onClick={() => openLinkMachineModal(setor.id)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                >
                                                    <span className="material-icons-outlined text-sm">add_link</span>
                                                    Vincular
                                                </button>
                                            </div>
                                            {setor.maquinas.length === 0 ? (
                                                <p className="text-gray-600 text-sm italic">Nenhuma máquina vinculada.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {setor.maquinas.map((maq) => (
                                                        <div key={maq.id} className="flex items-center gap-2 p-2 bg-[#0b0c10] rounded-lg border border-border-dark group">
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(maq.status_atual)}`}></div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-white text-sm font-medium truncate">{maq.nome}</p>
                                                                <p className="text-gray-500 text-xs truncate">{maq.codigo}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnlinkMachine(maq.id)}
                                                                className="text-gray-600 hover:text-danger p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                                title="Desvincular"
                                                            >
                                                                <span className="material-icons-outlined text-sm">link_off</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Novo Setor</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome do Setor</label>
                            <input
                                className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                value={newSetorNome}
                                onChange={(e) => setNewSetorNome(e.target.value)}
                                placeholder="Ex: Usinagem, Montagem..."
                                autoFocus
                            />
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleAddSetor} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingSetor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingSetor(null); }}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Editar Setor</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome do Setor</label>
                            <input
                                className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                value={editingSetor.nome}
                                onChange={(e) => setEditingSetor({ ...editingSetor, nome: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setIsEditModalOpen(false); setEditingSetor(null); }} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleEditSetor} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Machine Modal */}
            {isLinkMachineModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLinkMachineModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Vincular Máquina</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Selecione uma Máquina</label>
                            {getAvailableMachines().length === 0 ? (
                                <p className="text-gray-500 text-sm italic py-4">Todas as máquinas já estão vinculadas a setores.</p>
                            ) : (
                                <select
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={selectedMachineId}
                                    onChange={(e) => setSelectedMachineId(e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    {getAvailableMachines().map(m => (
                                        <option key={m.id} value={m.id}>{m.nome} ({m.codigo})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsLinkMachineModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button
                                onClick={handleLinkMachine}
                                disabled={!selectedMachineId}
                                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Vincular
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSetores;
