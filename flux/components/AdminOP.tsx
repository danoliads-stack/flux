import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

interface OrdemProducao {
    id: string;
    codigo: string;  // NU da OP
    nome_produto: string;
    prioridade: string;
    quantidade_meta: number;
    ciclo_estimado: string;
    material: string;
    status: string;
    data_emissao: string;
    data_entrega: string;
    cliente: string;
    modelo: string;
    numero_interno: string;
    created_at: string;
}

const STATUS_OPTIONS = [
    { value: 'PENDENTE', label: 'Pendente', color: 'bg-gray-500' },
    { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'bg-primary' },
    { value: 'SUSPENSA', label: 'Suspensa', color: 'bg-warning' },
    { value: 'FINALIZADA', label: 'Finalizada', color: 'bg-secondary' },
];

const PRIORIDADE_OPTIONS = [
    { value: 'BAIXA', label: 'Baixa', color: 'text-gray-400' },
    { value: 'NORMAL', label: 'Normal', color: 'text-white' },
    { value: 'ALTA', label: 'Alta', color: 'text-warning' },
];

const AdminOP: React.FC = () => {
    const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);
    const [importError, setImportError] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingOP, setEditingOP] = useState<OrdemProducao | null>(null);
    const [newOP, setNewOP] = useState({
        codigo: '',
        nome_produto: '',
        prioridade: 'NORMAL',
        quantidade_meta: 0,
        ciclo_estimado: '',
        material: '',
        status: 'PENDENTE',
        data_emissao: new Date().toISOString().split('T')[0],
        data_entrega: '',
        cliente: '',
        modelo: '',
        numero_interno: ''
    });

    const fetchOrdens = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('ordens_producao')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setOrdens(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrdens();
    }, []);

    const resetNewOP = () => {
        setNewOP({
            codigo: '',
            nome_produto: '',
            prioridade: 'NORMAL',
            quantidade_meta: 0,
            ciclo_estimado: '',
            material: '',
            status: 'PENDENTE',
            data_emissao: new Date().toISOString().split('T')[0],
            data_entrega: '',
            cliente: '',
            modelo: '',
            numero_interno: ''
        });
    };

    // CSV Parser
    const parseCSV = (text: string) => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/[\r]/g, ''));
        const rows = [];

        const normalizeValue = (val: string) => {
            if (!val) return '';
            return val.trim().toUpperCase().replace(/\s+/g, '_');
        };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';').map(v => v.trim().replace(/[\r]/g, ''));
            if (values.length < 2) continue;

            const row: any = {};
            headers.forEach((h, idx) => {
                const val = values[idx];
                // Map common header names to our fields
                if (h.includes('nu') || h.includes('codigo') || h.includes('op')) row.codigo = val;
                else if (h.includes('cliente')) row.cliente = val;
                else if (h.includes('modelo') || h.includes('produto')) row.modelo = val;
                else if (h.includes('interno')) row.numero_interno = val;
                else if (h.includes('qtd') || h.includes('quantidade')) row.quantidade_meta = parseInt(val) || 0;
                else if (h.includes('emissao')) row.data_emissao = val;
                else if (h.includes('entrega')) row.data_entrega = val;
                else if (h.includes('ciclo')) row.ciclo_estimado = val;
                else if (h.includes('prioridade')) {
                    const normPrior = normalizeValue(val);
                    // Map URGENTE to ALTA if URGENTE is not in DB constraint
                    row.prioridade = normPrior === 'URGENTE' ? 'ALTA' : (normPrior || 'NORMAL');
                }
                else if (h.includes('status')) row.status = normalizeValue(val);
            });

            if (row.codigo) rows.push(row);
        }
        return rows;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportError('');
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const parsed = parseCSV(text);
            if (parsed.length === 0) {
                setImportError('Nenhuma OP válida encontrada no arquivo. Verifique o formato.');
            } else {
                setImportData(parsed);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleImportOPs = async () => {
        if (importData.length === 0) return;
        setImporting(true);
        setImportError('');

        try {
            const toInsert = importData.map(row => {
                // Ensure values match DB constraints
                let status = (row.status || 'PENDENTE').toUpperCase().replace(/\s+/g, '_');
                if (!['PENDENTE', 'EM_ANDAMENTO', 'SUSPENSA', 'FINALIZADA'].includes(status)) {
                    status = 'PENDENTE';
                }

                let prioridade = (row.prioridade || 'NORMAL').toUpperCase().replace(/\s+/g, '_');
                if (prioridade === 'URGENTE') prioridade = 'ALTA'; // Map URGENTE to ALTA for DB
                if (!['ALTA', 'NORMAL', 'BAIXA'].includes(prioridade)) {
                    prioridade = 'NORMAL';
                }

                return {
                    codigo: row.codigo,
                    nome_produto: row.modelo || row.codigo,
                    modelo: row.modelo || '',
                    cliente: row.cliente || '',
                    numero_interno: row.numero_interno || '',
                    quantidade_meta: parseInt(row.quantidade_meta) || 1,
                    data_emissao: row.data_emissao || new Date().toISOString().split('T')[0],
                    data_entrega: row.data_entrega || null,
                    ciclo_estimado: row.ciclo_estimado || '',
                    prioridade,
                    status
                };
            });

            console.log('Importing OPs:', toInsert);

            const { data, error } = await supabase.from('ordens_producao').insert(toInsert).select();

            if (error) {
                console.error('Import error:', error);
                setImportError(`Erro ao importar: ${error.message}`);
                setImporting(false);
                return;
            }

            console.log('Imported successfully:', data);
            setImporting(false);
            setIsImportModalOpen(false);
            setImportData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchOrdens();
        } catch (err: any) {
            console.error('Exception:', err);
            setImportError(`Erro: ${err.message}`);
            setImporting(false);
        }
    };

    const handleAddOP = async () => {
        if (!newOP.codigo.trim() || newOP.quantidade_meta <= 0) return;
        await supabase.from('ordens_producao').insert({
            codigo: newOP.codigo,
            nome_produto: newOP.nome_produto || newOP.modelo,
            prioridade: newOP.prioridade,
            quantidade_meta: Number(newOP.quantidade_meta),
            ciclo_estimado: newOP.ciclo_estimado,
            material: newOP.material,
            status: newOP.status,
            data_emissao: newOP.data_emissao,
            data_entrega: newOP.data_entrega || null,
            cliente: newOP.cliente,
            modelo: newOP.modelo,
            numero_interno: newOP.numero_interno
        });
        setIsAddModalOpen(false);
        resetNewOP();
        fetchOrdens();
    };

    const handleEditOP = async () => {
        if (!editingOP) return;
        await supabase.from('ordens_producao').update({
            codigo: editingOP.codigo,
            nome_produto: editingOP.nome_produto || editingOP.modelo,
            prioridade: editingOP.prioridade,
            quantidade_meta: editingOP.quantidade_meta,
            ciclo_estimado: editingOP.ciclo_estimado,
            material: editingOP.material,
            status: editingOP.status,
            data_emissao: editingOP.data_emissao,
            data_entrega: editingOP.data_entrega || null,
            cliente: editingOP.cliente,
            modelo: editingOP.modelo,
            numero_interno: editingOP.numero_interno
        }).eq('id', editingOP.id);
        setIsEditModalOpen(false);
        setEditingOP(null);
        fetchOrdens();
    };

    const handleDeleteOP = async (id: string, codigo: string) => {
        if (confirm(`Deseja realmente excluir a OP "${codigo}"?`)) {
            await supabase.from('ordens_producao').delete().eq('id', id);
            fetchOrdens();
        }
    };

    const openEditModal = (op: OrdemProducao) => {
        setEditingOP({ ...op });
        setIsEditModalOpen(true);
    };

    const filteredOrdens = ordens.filter(op => {
        const matchesSearch = op.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            op.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            op.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = !filterStatus || op.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusInfo = (status: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    const getPrioridadeInfo = (prioridade: string) => PRIORIDADE_OPTIONS.find(p => p.value === prioridade) || PRIORIDADE_OPTIONS[1];

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase">Ordens de Produção</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Gerencie as ordens de produção da fábrica.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1c23] hover:bg-[#252831] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                    >
                        <span className="material-icons-outlined text-lg">upload_file</span>
                        Importar CSV
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                    >
                        <span className="material-icons-outlined text-lg">add</span>
                        Nova OP
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#15181e] p-4 rounded-xl border border-border-dark flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                    <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        placeholder="Buscar por NU, cliente ou modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary min-w-[180px]"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">Todos os Status</option>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando ordens...
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-[#15181e]/50 border border-border-dark rounded-xl">
                    <table className="w-full text-left min-w-[1100px]">
                        <thead>
                            <tr className="bg-[#1a1c23]/50 text-[10px] uppercase font-bold text-gray-500 border-b border-border-dark tracking-widest">
                                <th className="px-4 py-4">NU da OP</th>
                                <th className="px-4 py-4">Cliente</th>
                                <th className="px-4 py-4">Modelo</th>
                                <th className="px-4 py-4">Nº Interno</th>
                                <th className="px-4 py-4">Qtd</th>
                                <th className="px-4 py-4">Emissão</th>
                                <th className="px-4 py-4">Entrega</th>
                                <th className="px-4 py-4">Prioridade</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark text-sm">
                            {filteredOrdens.length === 0 ? (
                                <tr><td colSpan={10} className="px-6 py-10 text-center text-gray-500 italic">Nenhuma ordem de produção encontrada.</td></tr>
                            ) : filteredOrdens.map((op) => {
                                const statusInfo = getStatusInfo(op.status);
                                const prioridadeInfo = getPrioridadeInfo(op.prioridade);
                                return (
                                    <tr key={op.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                    <span className="material-icons-outlined text-primary text-sm">assignment</span>
                                                </div>
                                                <span className="font-bold text-white font-mono text-xs">{op.codigo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-white text-xs">{op.cliente || '--'}</td>
                                        <td className="px-4 py-4 text-gray-300 text-xs">{op.modelo || op.nome_produto || '--'}</td>
                                        <td className="px-4 py-4 font-mono text-gray-400 text-xs">{op.numero_interno || '--'}</td>
                                        <td className="px-4 py-4 font-mono text-gray-300 text-xs">{op.quantidade_meta?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-gray-400 text-xs">{formatDate(op.data_emissao)}</td>
                                        <td className="px-4 py-4 text-gray-400 text-xs">{formatDate(op.data_entrega)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold uppercase ${prioridadeInfo.color}`}>{prioridadeInfo.label}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${statusInfo.color}`}></span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">{statusInfo.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(op)}
                                                    className="text-gray-500 hover:text-primary p-1 rounded hover:bg-primary/10"
                                                    title="Editar"
                                                >
                                                    <span className="material-icons-outlined text-base">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOP(op.id, op.codigo)}
                                                    className="text-gray-500 hover:text-danger p-1 rounded hover:bg-danger/10"
                                                    title="Excluir"
                                                >
                                                    <span className="material-icons-outlined text-base">delete</span>
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
                    <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-white text-xl font-bold mb-6">Nova Ordem de Produção</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">NU da OP *</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.codigo}
                                        onChange={(e) => setNewOP({ ...newOP, codigo: e.target.value })}
                                        placeholder="OP-001"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Data Emissão</label>
                                    <input
                                        type="date"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.data_emissao}
                                        onChange={(e) => setNewOP({ ...newOP, data_emissao: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Data Entrega</label>
                                    <input
                                        type="date"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.data_entrega}
                                        onChange={(e) => setNewOP({ ...newOP, data_entrega: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Cliente</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newOP.cliente}
                                    onChange={(e) => setNewOP({ ...newOP, cliente: e.target.value })}
                                    placeholder="Nome do cliente"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Modelo</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.modelo}
                                        onChange={(e) => setNewOP({ ...newOP, modelo: e.target.value })}
                                        placeholder="Ex: Eixo Dianteiro 42mm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Número Interno</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.numero_interno}
                                        onChange={(e) => setNewOP({ ...newOP, numero_interno: e.target.value })}
                                        placeholder="Código interno"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Quantidade *</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.quantidade_meta || ''}
                                        onChange={(e) => setNewOP({ ...newOP, quantidade_meta: parseInt(e.target.value) || 0 })}
                                        placeholder="1000"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Ciclo Estimado</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.ciclo_estimado}
                                        onChange={(e) => setNewOP({ ...newOP, ciclo_estimado: e.target.value })}
                                        placeholder="45s"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Prioridade</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.prioridade}
                                        onChange={(e) => setNewOP({ ...newOP, prioridade: e.target.value })}
                                    >
                                        {PRIORIDADE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Status</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newOP.status}
                                        onChange={(e) => setNewOP({ ...newOP, status: e.target.value })}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleAddOP} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Criar OP</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingOP && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingOP(null); }}></div>
                    <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-white text-xl font-bold mb-6">Editar OP: {editingOP.codigo}</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">NU da OP</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.codigo}
                                        onChange={(e) => setEditingOP({ ...editingOP, codigo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Data Emissão</label>
                                    <input
                                        type="date"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.data_emissao || ''}
                                        onChange={(e) => setEditingOP({ ...editingOP, data_emissao: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Data Entrega</label>
                                    <input
                                        type="date"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.data_entrega || ''}
                                        onChange={(e) => setEditingOP({ ...editingOP, data_entrega: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Cliente</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingOP.cliente || ''}
                                    onChange={(e) => setEditingOP({ ...editingOP, cliente: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Modelo</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.modelo || ''}
                                        onChange={(e) => setEditingOP({ ...editingOP, modelo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Número Interno</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.numero_interno || ''}
                                        onChange={(e) => setEditingOP({ ...editingOP, numero_interno: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Quantidade</label>
                                    <input
                                        type="number"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.quantidade_meta}
                                        onChange={(e) => setEditingOP({ ...editingOP, quantidade_meta: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Ciclo Estimado</label>
                                    <input
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.ciclo_estimado || ''}
                                        onChange={(e) => setEditingOP({ ...editingOP, ciclo_estimado: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Prioridade</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.prioridade}
                                        onChange={(e) => setEditingOP({ ...editingOP, prioridade: e.target.value })}
                                    >
                                        {PRIORIDADE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Status</label>
                                    <select
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingOP.status}
                                        onChange={(e) => setEditingOP({ ...editingOP, status: e.target.value })}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setIsEditModalOpen(false); setEditingOP(null); }} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleEditOP} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsImportModalOpen(false); setImportData([]); setImportError(''); }}></div>
                    <div className="relative w-full max-w-3xl bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-white text-xl font-bold mb-2">Importar OPs via CSV</h3>
                        <p className="text-gray-500 text-sm mb-6">Carregue um arquivo CSV com várias ordens de produção de uma vez.</p>

                        {/* Format Instructions */}
                        <div className="bg-[#0b0c10] border border-border-dark rounded-lg p-4 mb-6">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Formato esperado (separador: ponto e vírgula)</p>
                            <code className="text-xs text-primary block mb-2">
                                NU_OP;Cliente;Modelo;Numero_Interno;Quantidade;Data_Emissao;Data_Entrega;Ciclo;Prioridade;Status
                            </code>
                            <code className="text-xs text-gray-500 block">
                                OP-001;Cliente ABC;Eixo 42mm;INT-001;1000;2025-01-15;2025-02-10;45s;NORMAL;PENDENTE
                            </code>
                        </div>

                        {/* File Input */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Selecionar Arquivo</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt"
                                onChange={handleFileUpload}
                                className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-3 px-4 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-bold file:cursor-pointer"
                            />
                        </div>

                        {/* Error Message */}
                        {importError && (
                            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4 text-danger text-sm">
                                {importError}
                            </div>
                        )}

                        {/* Preview Table */}
                        {importData.length > 0 && (
                            <div className="mb-6">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{importData.length} OPs prontas para importar</p>
                                <div className="max-h-64 overflow-auto bg-[#0b0c10] border border-border-dark rounded-lg">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#1a1c23]/50 text-gray-500 uppercase sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2">NU</th>
                                                <th className="px-3 py-2">Cliente</th>
                                                <th className="px-3 py-2">Modelo</th>
                                                <th className="px-3 py-2">Qtd</th>
                                                <th className="px-3 py-2">Prioridade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-dark">
                                            {importData.slice(0, 10).map((row, i) => (
                                                <tr key={i} className="text-gray-300">
                                                    <td className="px-3 py-2 font-mono text-white">{row.codigo}</td>
                                                    <td className="px-3 py-2">{row.cliente || '--'}</td>
                                                    <td className="px-3 py-2">{row.modelo || '--'}</td>
                                                    <td className="px-3 py-2">{row.quantidade_meta || 0}</td>
                                                    <td className="px-3 py-2">{row.prioridade || 'NORMAL'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {importData.length > 10 && (
                                        <p className="text-center text-gray-500 text-xs py-2">...e mais {importData.length - 10} OPs</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportData([]); setImportError(''); }}
                                className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportOPs}
                                disabled={importData.length === 0 || importing}
                                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? 'Importando...' : `Importar ${importData.length} OPs`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOP;
