import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface TipoParada {
    id: string;
    codigo: string;
    nome: string;
    categoria: string;
    cor: string;
    icone: string;
    ativo: boolean;
}

const CATEGORIAS = [
    { value: 'SETUP', label: 'Setup' },
    { value: 'MANUTENCAO', label: 'Manutenção' },
    { value: 'PLANEJADA', label: 'Planejada' },
    { value: 'NAO_PLANEJADA', label: 'Não Planejada' },
    { value: 'OUTROS', label: 'Outros' },
];

const ICONS = [
    'warning', 'build', 'schedule', 'power_off', 'settings', 'person_off',
    'inventory_2', 'sync_problem', 'cleaning_services', 'gpp_bad', 'coffee', 'help_center',
    'engineering', 'handyman', 'bolt', 'timer'
];

const AdminTiposParada: React.FC = () => {
    const [items, setItems] = useState<TipoParada[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<TipoParada | null>(null);
    const [form, setForm] = useState({ codigo: '', nome: '', categoria: 'OUTROS', cor: '#6B7280', icone: 'warning' });

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from('tipos_parada').select('*').order('codigo');
        if (data) setItems(data);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        if (!form.codigo || !form.nome) {
            alert('Preencha o código e o nome');
            return;
        }

        let error;
        if (editing) {
            const result = await supabase.from('tipos_parada').update({
                codigo: form.codigo,
                nome: form.nome,
                categoria: form.categoria,
                cor: form.cor,
                icone: form.icone
            }).eq('id', editing.id);
            error = result.error;
        } else {
            const result = await supabase.from('tipos_parada').insert({
                codigo: form.codigo,
                nome: form.nome,
                categoria: form.categoria,
                cor: form.cor,
                icone: form.icone,
                ativo: true
            });
            error = result.error;
        }

        if (error) {
            console.error('Erro ao salvar tipo de parada:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return;
        }

        setIsModalOpen(false);
        setEditing(null);
        setForm({ codigo: '', nome: '', categoria: 'OUTROS', cor: '#6B7280', icone: 'warning' });
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir este tipo de parada?')) {
            await supabase.from('tipos_parada').delete().eq('id', id);
            fetchData();
        }
    };

    const openEdit = (item: TipoParada) => {
        setEditing(item);
        setForm({
            codigo: item.codigo,
            nome: item.nome,
            categoria: item.categoria,
            cor: item.cor,
            icone: item.icone || 'warning' // Default fallback
        });
        setIsModalOpen(true);
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white uppercase font-display">Tipos de Parada</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Cadastre os motivos de parada das máquinas.</p>
                </div>
                <button onClick={() => { setEditing(null); setForm({ codigo: '', nome: '', categoria: 'OUTROS', cor: '#6B7280', icone: 'warning' }); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all">
                    <span className="material-icons-outlined text-lg">add</span>Novo Tipo
                </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#15181e]/50 border border-border-dark rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-8 text-gray-500">
                            <span className="material-icons-outlined animate-spin mr-2">sync</span>Carregando...
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-gray-500 col-span-full text-center py-8 italic">Nenhum tipo cadastrado.</p>
                    ) : (
                        items.map(item => (
                            <div key={item.id} className="bg-surface-dark border border-border-dark rounded-xl p-4 hover:border-primary/30 transition-all group">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors" style={{ backgroundColor: item.cor + '20', borderColor: item.cor + '40' }}>
                                            <span className="material-icons-outlined text-2xl" style={{ color: item.cor }}>{item.icone || 'warning'}</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{item.nome}</p>
                                            <p className="text-xs text-gray-500 font-mono">{item.codigo}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(item)} className="text-gray-500 hover:text-primary p-1.5 rounded hover:bg-white/5"><span className="material-icons-outlined text-base">edit</span></button>
                                        <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-danger p-1.5 rounded hover:bg-white/5"><span className="material-icons-outlined text-base">delete</span></button>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider" style={{ backgroundColor: item.cor + '20', color: item.cor }}>
                                        {CATEGORIAS.find(c => c.value === item.categoria)?.label || item.categoria}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-surface-dark rounded-xl border border-border-dark p-6 animate-fade-in flex flex-col max-h-[90vh]">
                        <h3 className="text-white text-xl font-bold mb-6">{editing ? 'Editar' : 'Novo'} Tipo de Parada</h3>

                        <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4 flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Código</label>
                                    <input className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="PAR-001" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome</label>
                                    <input className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Setup de Máquina" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Categoria</label>
                                    <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                                        {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Cor</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" className="w-10 h-10 rounded cursor-pointer border-0 p-0" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} />
                                        <span className="text-xs text-gray-500 font-mono">{form.cor}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Ícone</label>
                                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 bg-[#0b0c10] p-3 rounded-lg border border-border-dark">
                                    {ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setForm({ ...form, icone: icon })}
                                            className={`aspect-square flex items-center justify-center rounded-lg transition-all duration-200 ${form.icone === icon
                                                ? 'bg-primary text-white shadow-glow transform scale-110 ring-2 ring-primary/50'
                                                : 'text-gray-500 hover:bg-white/5 hover:text-white hover:scale-105'
                                                }`}
                                            title={icon}
                                        >
                                            <span className="material-icons-outlined text-2xl">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3 pt-4 border-t border-border-dark">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] hover:bg-[#252831] border border-border-dark text-white text-sm font-bold rounded-lg transition-all">Cancelar</button>
                            <button onClick={handleSave} className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTiposParada;
