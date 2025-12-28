import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface TipoRefugo {
    id: string;
    codigo: string;
    nome: string;
    descricao: string;
    gravidade: string;
    ativo: boolean;
}

const GRAVIDADES = [
    { value: 'BAIXA', label: 'Baixa', color: 'text-gray-400' },
    { value: 'MEDIA', label: 'Média', color: 'text-warning' },
    { value: 'ALTA', label: 'Alta', color: 'text-orange-500' },
    { value: 'CRITICA', label: 'Crítica', color: 'text-danger' },
];

const AdminTiposRefugo: React.FC = () => {
    const [items, setItems] = useState<TipoRefugo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<TipoRefugo | null>(null);
    const [form, setForm] = useState({ codigo: '', nome: '', descricao: '', gravidade: 'MEDIA' });

    const fetchData = async () => {
        setLoading(true);
        const { data } = await supabase.from('tipos_refugo').select('*').order('codigo');
        if (data) setItems(data);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        if (!form.codigo || !form.nome) return;
        if (editing) {
            await supabase.from('tipos_refugo').update(form).eq('id', editing.id);
        } else {
            await supabase.from('tipos_refugo').insert({ ...form, ativo: true });
        }
        setIsModalOpen(false);
        setEditing(null);
        setForm({ codigo: '', nome: '', descricao: '', gravidade: 'MEDIA' });
        fetchData();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir este tipo de refugo?')) {
            await supabase.from('tipos_refugo').delete().eq('id', id);
            fetchData();
        }
    };

    const openEdit = (item: TipoRefugo) => {
        setEditing(item);
        setForm({ codigo: item.codigo, nome: item.nome, descricao: item.descricao || '', gravidade: item.gravidade });
        setIsModalOpen(true);
    };

    const getGravidadeInfo = (g: string) => GRAVIDADES.find(x => x.value === g) || GRAVIDADES[1];

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight font-display uppercase">Tipos de Refugo</h2>
                    <p className="text-sm text-gray-500 mt-1">Cadastre os tipos de defeito/refugo de peças.</p>
                </div>
                <button onClick={() => { setEditing(null); setForm({ codigo: '', nome: '', descricao: '', gravidade: 'MEDIA' }); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">
                    <span className="material-icons-outlined text-lg">add</span>Novo Tipo
                </button>
            </div>

            <div className="flex-1 overflow-auto bg-[#15181e]/50 border border-border-dark rounded-xl">
                <table className="w-full text-left">
                    <thead className="bg-[#1a1c23]/50 text-[10px] uppercase font-bold text-gray-500 border-b border-border-dark tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Código</th>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4">Gravidade</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark text-sm">
                        {loading ? <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Carregando...</td></tr> :
                            items.length === 0 ? <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">Nenhum tipo cadastrado.</td></tr> :
                                items.map(item => {
                                    const grav = getGravidadeInfo(item.gravidade);
                                    return (
                                        <tr key={item.id} className="hover:bg-white/[0.02] group">
                                            <td className="px-6 py-4 font-mono text-primary">{item.codigo}</td>
                                            <td className="px-6 py-4 text-white font-bold">{item.nome}</td>
                                            <td className="px-6 py-4 text-gray-400">{item.descricao || '--'}</td>
                                            <td className="px-6 py-4"><span className={`font-bold uppercase text-xs ${grav.color}`}>{grav.label}</span></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEdit(item)} className="text-gray-500 hover:text-primary p-1"><span className="material-icons-outlined text-base">edit</span></button>
                                                    <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-danger p-1"><span className="material-icons-outlined text-base">delete</span></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">{editing ? 'Editar' : 'Novo'} Tipo de Refugo</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Código</label>
                                    <input className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="REF-001" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Gravidade</label>
                                    <select className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white" value={form.gravidade} onChange={e => setForm({ ...form, gravidade: e.target.value })}>
                                        {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome</label>
                                <input className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Dimensional Fora" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Descrição</label>
                                <textarea className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white resize-none" rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do defeito..." />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleSave} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTiposRefugo;
