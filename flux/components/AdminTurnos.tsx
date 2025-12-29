import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Turno {
    id: string;
    nome: string;
    hora_inicio: string;
    hora_fim: string;
    ativo: boolean;
    created_at: string;
}

const AdminTurnos: React.FC = () => {
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTurno, setEditingTurno] = useState<Turno | null>(null);
    const [newTurno, setNewTurno] = useState({ nome: '', hora_inicio: '06:00', hora_fim: '14:00' });

    const fetchTurnos = async () => {
        setLoading(true);
        const { data } = await supabase.from('turnos').select('*').order('hora_inicio');
        if (data) setTurnos(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchTurnos();
    }, []);

    const handleAddTurno = async () => {
        if (!newTurno.nome.trim() || !newTurno.hora_inicio || !newTurno.hora_fim) return;
        await supabase.from('turnos').insert({
            nome: newTurno.nome.trim(),
            hora_inicio: newTurno.hora_inicio,
            hora_fim: newTurno.hora_fim,
            ativo: true
        });
        setIsAddModalOpen(false);
        setNewTurno({ nome: '', hora_inicio: '06:00', hora_fim: '14:00' });
        fetchTurnos();
    };

    const handleEditTurno = async () => {
        if (!editingTurno) return;
        await supabase.from('turnos').update({
            nome: editingTurno.nome.trim(),
            hora_inicio: editingTurno.hora_inicio,
            hora_fim: editingTurno.hora_fim,
            ativo: editingTurno.ativo
        }).eq('id', editingTurno.id);
        setIsEditModalOpen(false);
        setEditingTurno(null);
        fetchTurnos();
    };

    const handleToggleAtivo = async (turno: Turno) => {
        await supabase.from('turnos').update({ ativo: !turno.ativo }).eq('id', turno.id);
        fetchTurnos();
    };

    const handleDeleteTurno = async (id: string, nome: string) => {
        if (confirm(`Deseja realmente excluir o turno "${nome}"?`)) {
            await supabase.from('turnos').delete().eq('id', id);
            fetchTurnos();
        }
    };

    const openEditModal = (turno: Turno) => {
        setEditingTurno({ ...turno });
        setIsEditModalOpen(true);
    };

    const formatTime = (time: string) => {
        return time.substring(0, 5); // Show only HH:MM
    };

    const calculateDuration = (inicio: string, fim: string) => {
        const [hI, mI] = inicio.split(':').map(Number);
        const [hF, mF] = fim.split(':').map(Number);
        let totalMinutes = (hF * 60 + mF) - (hI * 60 + mI);
        if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
    };

    return (
        <div className="p-4 md:p-8 flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-display uppercase">Turnos</h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">Defina os horários de cada turno de trabalho.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                >
                    <span className="material-icons-outlined text-lg">add</span>
                    Novo Turno
                </button>
            </div>

            {/* Shifts Cards */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <span className="material-icons-outlined animate-spin text-4xl mr-3">sync</span>
                    Carregando turnos...
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {turnos.map((turno) => (
                            <div
                                key={turno.id}
                                className={`bg-[#15181e] border border-border-dark rounded-xl p-5 transition-all ${!turno.ativo ? 'opacity-50' : ''}`}
                            >
                                {/* Header Row */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${turno.ativo ? 'bg-primary/10 border border-primary/20' : 'bg-gray-800 border border-gray-700'}`}>
                                            <span className={`material-icons-outlined ${turno.ativo ? 'text-primary' : 'text-gray-500'}`}>schedule</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{turno.nome}</h3>
                                            <span className={`text-xs font-bold uppercase ${turno.ativo ? 'text-secondary' : 'text-gray-500'}`}>
                                                {turno.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleToggleAtivo(turno)}
                                            className={`p-2 rounded-lg transition-all ${turno.ativo ? 'text-secondary hover:bg-secondary/10' : 'text-gray-500 hover:bg-gray-800'}`}
                                            title={turno.ativo ? 'Desativar' : 'Ativar'}
                                        >
                                            <span className="material-icons-outlined text-lg">{turno.ativo ? 'toggle_on' : 'toggle_off'}</span>
                                        </button>
                                        <button
                                            onClick={() => openEditModal(turno)}
                                            className="text-gray-500 hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-all"
                                            title="Editar"
                                        >
                                            <span className="material-icons-outlined text-lg">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTurno(turno.id, turno.nome)}
                                            className="text-gray-500 hover:text-danger p-2 rounded-lg hover:bg-danger/10 transition-all"
                                            title="Excluir"
                                        >
                                            <span className="material-icons-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Time Display */}
                                <div className="bg-[#0b0c10] rounded-lg p-4 border border-border-dark">
                                    <div className="flex items-center justify-between">
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Início</p>
                                            <p className="text-2xl font-bold text-white font-mono">{formatTime(turno.hora_inicio)}</p>
                                        </div>
                                        <div className="flex flex-col items-center px-4">
                                            <span className="material-icons-outlined text-gray-600">arrow_forward</span>
                                            <p className="text-xs text-gray-500 mt-1">{calculateDuration(turno.hora_inicio, turno.hora_fim)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Fim</p>
                                            <p className="text-2xl font-bold text-white font-mono">{formatTime(turno.hora_fim)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {turnos.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <span className="material-icons-outlined text-5xl mb-4">schedule</span>
                                <p>Nenhum turno cadastrado.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Novo Turno</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome do Turno</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={newTurno.nome}
                                    onChange={(e) => setNewTurno({ ...newTurno, nome: e.target.value })}
                                    placeholder="Ex: Turno A, Manhã, Noturno..."
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hora Início</label>
                                    <input
                                        type="time"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newTurno.hora_inicio}
                                        onChange={(e) => setNewTurno({ ...newTurno, hora_inicio: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hora Fim</label>
                                    <input
                                        type="time"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={newTurno.hora_fim}
                                        onChange={(e) => setNewTurno({ ...newTurno, hora_fim: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleAddTurno} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editingTurno && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsEditModalOpen(false); setEditingTurno(null); }}></div>
                    <div className="relative w-full max-w-md bg-surface-dark rounded-xl border border-border-dark p-6 md:p-8 animate-fade-in">
                        <h3 className="text-white text-xl font-bold mb-6">Editar Turno</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome do Turno</label>
                                <input
                                    className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                    value={editingTurno.nome}
                                    onChange={(e) => setEditingTurno({ ...editingTurno, nome: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hora Início</label>
                                    <input
                                        type="time"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingTurno.hora_inicio.substring(0, 5)}
                                        onChange={(e) => setEditingTurno({ ...editingTurno, hora_inicio: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hora Fim</label>
                                    <input
                                        type="time"
                                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary"
                                        value={editingTurno.hora_fim.substring(0, 5)}
                                        onChange={(e) => setEditingTurno({ ...editingTurno, hora_fim: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setEditingTurno({ ...editingTurno, ativo: !editingTurno.ativo })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${editingTurno.ativo ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                >
                                    <span className="material-icons-outlined text-lg">{editingTurno.ativo ? 'toggle_on' : 'toggle_off'}</span>
                                    <span className="text-sm font-bold">{editingTurno.ativo ? 'Ativo' : 'Inativo'}</span>
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={() => { setIsEditModalOpen(false); setEditingTurno(null); }} className="flex-1 px-4 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg">Cancelar</button>
                            <button onClick={handleEditTurno} className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTurnos;
