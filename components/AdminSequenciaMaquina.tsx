import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface OP {
    id: string;
    codigo: string;
    quantidade_meta: number;
    maquina_id: string | null;
    posicao_sequencia: number | null;
    status: string;
    prioridade?: 'ALTA' | 'NORMAL' | 'BAIXA';
    cliente?: string;
    modelo?: string;
    nome_produto?: string;
}

interface Maquina {
    id: string;
    nome: string;
    codigo: string;
}

interface AdminSequenciaMaquinaProps {
    onNavigateToOPs?: () => void;
}

const AdminSequenciaMaquina: React.FC<AdminSequenciaMaquinaProps> = ({ onNavigateToOPs }) => {
    const [maquinas, setMaquinas] = useState<Maquina[]>([]);
    const [ops, setOps] = useState<OP[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: maqData } = await supabase.from('maquinas').select('id, nome, codigo');
        const { data: opsData } = await supabase.from('ordens_producao')
            .select('*')
            .neq('status', 'FINALIZADA')
            .order('posicao_sequencia', { ascending: true });

        if (maqData) {
            setMaquinas(maqData);
            // Auto-select first machine if none selected
            if (!selectedMachine && maqData.length > 0) {
                setSelectedMachine(maqData[0].id);
            }
        }
        if (opsData) setOps(opsData);
        setLoading(false);
    };

    // Get OPs for the selected machine
    const getMachineOps = () => {
        return ops
            .filter(op => op.maquina_id === selectedMachine)
            .sort((a, b) => (a.posicao_sequencia || 0) - (b.posicao_sequencia || 0));
    };

    // Get available OPs (not assigned to any machine)
    const getAvailableOps = () => {
        return ops
            .filter(op => {
                const isAvailable = !op.maquina_id; // Handles null and undefined
                const matchesSearch = searchTerm === '' ||
                    op.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    op.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    op.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
                return isAvailable && matchesSearch;
            })
            .sort((a, b) => {
                // Sort by priority (ALTA first)
                const prioOrder = { 'ALTA': 0, 'NORMAL': 1, 'BAIXA': 2 };
                return (prioOrder[a.prioridade || 'NORMAL'] || 1) - (prioOrder[b.prioridade || 'NORMAL'] || 1);
            });
    };

    // Get count of OPs per machine
    const getOpCountForMachine = (machineId: string) => {
        return ops.filter(op => op.maquina_id === machineId).length;
    };

    // Add OP to selected machine
    const handleAddToMachine = (opId: string) => {
        if (!selectedMachine) return;
        const machineOps = getMachineOps();
        setOps(prev => prev.map(op => {
            if (op.id === opId) {
                return { ...op, maquina_id: selectedMachine, posicao_sequencia: machineOps.length + 1 };
            }
            return op;
        }));
        setHasChanges(true);
    };

    // Remove OP from machine
    const handleRemoveFromMachine = (opId: string) => {
        setOps(prev => prev.map(op => {
            if (op.id === opId) {
                return { ...op, maquina_id: null, posicao_sequencia: null };
            }
            return op;
        }));
        setHasChanges(true);
    };

    // Move OP up in sequence
    const handleMoveUp = (opId: string) => {
        const machineOps = getMachineOps();
        const index = machineOps.findIndex(o => o.id === opId);
        if (index <= 0) return;

        const currentOp = machineOps[index];
        const prevOp = machineOps[index - 1];

        setOps(prev => prev.map(op => {
            if (op.id === currentOp.id) return { ...op, posicao_sequencia: index };
            if (op.id === prevOp.id) return { ...op, posicao_sequencia: index + 1 };
            return op;
        }));
        setHasChanges(true);
    };

    // Move OP down in sequence
    const handleMoveDown = (opId: string) => {
        const machineOps = getMachineOps();
        const index = machineOps.findIndex(o => o.id === opId);
        if (index >= machineOps.length - 1) return;

        const currentOp = machineOps[index];
        const nextOp = machineOps[index + 1];

        setOps(prev => prev.map(op => {
            if (op.id === currentOp.id) return { ...op, posicao_sequencia: index + 2 };
            if (op.id === nextOp.id) return { ...op, posicao_sequencia: index + 1 };
            return op;
        }));
        setHasChanges(true);
    };

    // Save all changes
    const handleSave = async () => {
        setSaving(true);
        try {
            // Update OPs with machine assignments
            for (const op of ops) {
                await supabase.from('ordens_producao')
                    .update({
                        maquina_id: op.maquina_id,
                        posicao_sequencia: op.posicao_sequencia
                    })
                    .eq('id', op.id);
            }
            setHasChanges(false);
            alert('✅ Sequência salva com sucesso!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('❌ Erro ao salvar. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const getPriorityStyle = (prioridade?: string) => {
        switch (prioridade) {
            case 'ALTA': return { bg: 'bg-red-500', text: 'text-white', label: '🔴 URGENTE' };
            case 'BAIXA': return { bg: 'bg-gray-600', text: 'text-gray-200', label: '⚪ Baixa' };
            default: return { bg: 'bg-amber-500', text: 'text-white', label: '🟡 Normal' };
        }
    };

    const selectedMachineData = maquinas.find(m => m.id === selectedMachine);
    const machineOps = getMachineOps();
    const availableOps = getAvailableOps();

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center text-gray-400">
                <span className="material-icons-outlined animate-spin text-3xl mr-3">sync</span>
                <span className="text-lg">Carregando dados...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0b0c10]">
            {/* Header */}
            <div className="p-6 border-b border-border-dark bg-[#0b0c10]">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase flex items-center gap-3">
                            <span className="material-icons-outlined text-primary text-3xl">reorder</span>
                            Sequência de Produção
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Defina a ordem das OPs para cada máquina. Arraste ou use os botões para organizar.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {onNavigateToOPs && (
                            <button
                                onClick={onNavigateToOPs}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-gray-300 hover:text-white text-sm font-bold rounded-lg transition-all hover:bg-[#252831]"
                            >
                                <span className="material-icons-outlined text-lg">assignment</span>
                                Gerenciar OPs
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold rounded-lg shadow-lg transition-all ${hasChanges
                                ? 'bg-secondary hover:bg-secondary/90 animate-pulse'
                                : 'bg-gray-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <span className="material-icons-outlined text-lg">save</span>
                            {saving ? 'Salvando...' : hasChanges ? 'Salvar Alterações' : 'Sem Alterações'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - Two Panels */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Available OPs */}
                <div className="w-96 border-r border-border-dark flex flex-col bg-[#0b0c10]">
                    <div className="p-4 border-b border-border-dark bg-[#15181e]">
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
                            <span className="material-icons-outlined text-gray-500">inventory_2</span>
                            OPs Disponíveis
                            <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-mono">
                                {availableOps.length}
                            </span>
                        </h3>
                        <div className="relative">
                            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Buscar por código, cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-[#0b0c10] border border-border-dark rounded-lg text-sm text-white focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {availableOps.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <span className="material-icons-outlined text-4xl mb-2 block opacity-50">inbox</span>
                                <p className="text-sm">Nenhuma OP disponível</p>
                                <p className="text-xs mt-1 opacity-70">Todas as OPs já foram atribuídas</p>
                            </div>
                        ) : (
                            availableOps.map(op => {
                                const prio = getPriorityStyle(op.prioridade);
                                return (
                                    <div
                                        key={op.id}
                                        className="bg-[#15181e] border border-border-dark rounded-lg p-3 hover:border-primary/50 transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-mono text-sm font-bold">{op.codigo}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${prio.bg} ${prio.text}`}>
                                                        {prio.label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    {op.cliente || op.modelo || 'Sem descrição'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-primary font-bold">
                                                {op.quantidade_meta?.toLocaleString()} un
                                            </span>
                                            <button
                                                onClick={() => handleAddToMachine(op.id)}
                                                disabled={!selectedMachine}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 text-secondary text-xs font-bold rounded-lg border border-secondary/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <span className="material-icons-outlined text-sm">add</span>
                                                Adicionar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel - Machine Sequence */}
                <div className="flex-1 flex flex-col bg-[#0b0c10]">
                    {/* Machine Selector */}
                    <div className="p-4 border-b border-border-dark bg-[#15181e]">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                            Selecione a Máquina
                        </label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <button
                                    onClick={() => setIsMachineDropdownOpen(!isMachineDropdownOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-[#0b0c10] border border-border-dark rounded-xl text-white text-base font-bold focus:ring-2 focus:ring-primary transition-all hover:bg-[#15181e]"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons-outlined text-primary">precision_manufacturing</span>
                                        {selectedMachineData ? (
                                            <span>{selectedMachineData.nome} <span className="text-gray-500 font-normal text-sm ml-1">({selectedMachineData.codigo})</span></span>
                                        ) : (
                                            <span className="text-gray-400">Selecione a Máquina</span>
                                        )}
                                    </div>
                                    <span className={`material-icons-outlined transition-transform duration-300 ${isMachineDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                </button>

                                {isMachineDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#15181e] border border-border-dark rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                            {maquinas.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setSelectedMachine(m.id);
                                                        setIsMachineDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#252831] transition-colors border-b border-border-dark/50 last:border-0 ${selectedMachine === m.id ? 'bg-primary/10 text-primary' : 'text-gray-300'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`material-icons-outlined ${selectedMachine === m.id ? 'text-primary' : 'text-gray-500'}`}>precision_manufacturing</span>
                                                        <div className="text-left">
                                                            <div className="font-bold">{m.nome}</div>
                                                            <div className="text-[10px] opacity-70 font-mono">{m.codigo}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-bold px-2 py-1 bg-black/20 rounded-lg">
                                                        {getOpCountForMachine(m.id)} OPs
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Overlay to close dropdown when clicking outside */}
                            {isMachineDropdownOpen && (
                                <div className="fixed inset-0 z-40" onClick={() => setIsMachineDropdownOpen(false)}></div>
                            )}
                        </div>
                        {selectedMachineData && (
                            <div className="mt-3 flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <span className="material-icons-outlined text-lg text-primary">precision_manufacturing</span>
                                    <span className="font-bold text-white">{selectedMachineData.nome}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                    <span className="material-icons-outlined text-sm">tag</span>
                                    <span className="font-mono text-xs">{selectedMachineData.codigo}</span>
                                </div>
                                <div className="ml-auto flex items-center gap-1 text-primary font-bold">
                                    <span className="material-icons-outlined text-sm">assignment</span>
                                    {machineOps.length} OPs na fila
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sequence List */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {machineOps.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <div className="w-20 h-20 rounded-full bg-[#15181e] border-2 border-dashed border-border-dark flex items-center justify-center mb-4">
                                    <span className="material-icons-outlined text-4xl opacity-50">add_task</span>
                                </div>
                                <p className="text-lg font-bold mb-1">Nenhuma OP na fila</p>
                                <p className="text-sm opacity-70 text-center max-w-xs">
                                    Selecione OPs da lista à esquerda e clique em "Adicionar" para criar a sequência de produção.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {machineOps.map((op, index) => {
                                    const prio = getPriorityStyle(op.prioridade);
                                    const isFirst = index === 0;
                                    const isLast = index === machineOps.length - 1;

                                    return (
                                        <div
                                            key={op.id}
                                            className={`bg-[#15181e] border-2 rounded-xl p-4 transition-all ${isFirst ? 'border-primary shadow-lg shadow-primary/20' : 'border-border-dark hover:border-gray-600'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Position Number */}
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${isFirst
                                                    ? 'bg-primary text-white'
                                                    : 'bg-gray-800 text-gray-400'
                                                    }`}>
                                                    {index + 1}º
                                                </div>

                                                {/* OP Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-white font-mono text-base font-bold">{op.codigo}</span>
                                                        {isFirst && (
                                                            <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                                                                ▶ Próxima
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${prio.bg} ${prio.text}`}>
                                                            {prio.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {op.cliente || op.modelo || 'Sem descrição'}
                                                    </p>
                                                    <p className="text-sm text-primary font-bold mt-1">
                                                        Meta: {op.quantidade_meta?.toLocaleString()} unidades
                                                    </p>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => handleMoveUp(op.id)}
                                                        disabled={isFirst}
                                                        className="w-10 h-10 rounded-lg bg-[#0b0c10] border border-border-dark text-gray-400 hover:text-white hover:border-gray-500 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Mover para cima"
                                                    >
                                                        <span className="material-icons-outlined">arrow_upward</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveDown(op.id)}
                                                        disabled={isLast}
                                                        className="w-10 h-10 rounded-lg bg-[#0b0c10] border border-border-dark text-gray-400 hover:text-white hover:border-gray-500 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Mover para baixo"
                                                    >
                                                        <span className="material-icons-outlined">arrow_downward</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveFromMachine(op.id)}
                                                        className="w-10 h-10 rounded-lg bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 flex items-center justify-center transition-all"
                                                        title="Remover da fila"
                                                    >
                                                        <span className="material-icons-outlined">close</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Quick Stats */}
                    {machineOps.length > 0 && (
                        <div className="p-4 border-t border-border-dark bg-[#15181e]">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <span className="material-icons-outlined text-lg">pending_actions</span>
                                        <span>{machineOps.length} OPs na fila</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-primary">
                                        <span className="material-icons-outlined text-lg">inventory</span>
                                        <span className="font-bold">
                                            {machineOps.reduce((sum, op) => sum + (op.quantidade_meta || 0), 0).toLocaleString()} peças total
                                        </span>
                                    </div>
                                </div>
                                {hasChanges && (
                                    <span className="text-amber-400 text-xs font-bold animate-pulse flex items-center gap-1">
                                        <span className="material-icons-outlined text-sm">warning</span>
                                        Há alterações não salvas
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSequenciaMaquina;
