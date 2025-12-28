
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Machine {
    id: string;
    nome: string;
    codigo: string;
}

interface OperatorLog {
    operator_name: string;
    login_time: string;
    logout_time?: string;
    shift?: string;
}

interface ChecklistEvent {
    id: string;
    checklist_nome: string;
    status: 'ok' | 'problema' | 'nao_realizado';
    observacao?: string;
    created_at: string;
    operator_name?: string;
    photos?: string[]; // Assuming we store photo URLs somewhere or mocked for now
}

const Reports: React.FC = () => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string>('');
    const [periodType, setPeriodType] = useState<'day' | 'month' | 'year'>('day');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Data States
    const [checklistEvents, setChecklistEvents] = useState<ChecklistEvent[]>([]);
    const [operatorLogs, setOperatorLogs] = useState<OperatorLog[]>([]);
    const [stats, setStats] = useState({
        availability: 0,
        quality: 0,
        performance: 0,
        oee: 0,
        totalProduction: 0,
        totalScrap: 0
    });

    useEffect(() => {
        fetchMachines();
    }, []);

    useEffect(() => {
        if (selectedMachine) {
            fetchReportData();
        }
    }, [selectedMachine, periodType, selectedDate]);

    const fetchMachines = async () => {
        const { data } = await supabase.from('maquinas').select('id, nome, codigo');
        if (data) {
            setMachines(data);
            if (data.length > 0) setSelectedMachine(data[0].id);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        // Placeholder fetching logic - will implement specific queries based on period
        // Ideally this would be complex consolidated queries, implementing basics first.

        // 1. Fetch Checklists
        // Note: This relies on joins existing or direct fetching. Simplified for MVP.
        const { data: checklists } = await supabase
            .from('checklist_eventos')
            .select('*, checklists(nome), operadores(nome)')
            .eq('maquina_id', selectedMachine)
            .order('created_at', { ascending: false })
            .limit(50); // Need to apply date filter

        if (checklists) {
            setChecklistEvents(checklists.map((c: any) => ({
                id: c.id,
                checklist_nome: c.checklists?.nome || 'Unknown',
                status: c.status,
                observacao: c.observacao,
                created_at: c.created_at,
                operator_name: c.operadores?.nome || 'Unknown Operator'
            })));
        }

        // Mock Stats for demonstration until proper aggregation is ready
        setStats({
            availability: 85 + Math.random() * 10,
            quality: 98 + Math.random() * 2,
            performance: 92 + Math.random() * 5,
            oee: 82 + Math.random() * 5,
            totalProduction: Math.floor(1200 + Math.random() * 500),
            totalScrap: Math.floor(20 + Math.random() * 30)
        });

        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#0b0c10] text-gray-100 overflow-y-auto custom-scrollbar p-6">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="material-icons-outlined text-primary text-4xl">analytics</span>
                        Relatórios Detalhados
                    </h1>
                    <p className="text-gray-400 mt-1">Histórico operacional e análise de performance</p>
                </div>

                <div className="flex items-center gap-3 bg-[#15181e] p-2 rounded-xl border border-border-dark">
                    {/* Machine Select */}
                    <select
                        value={selectedMachine}
                        onChange={(e) => setSelectedMachine(e.target.value)}
                        className="bg-[#0b0c10] border border-border-dark rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary min-w-[200px]"
                    >
                        {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.nome} - {m.codigo}</option>
                        ))}
                    </select>

                    <div className="h-8 w-px bg-border-dark mx-2"></div>

                    {/* Period Type */}
                    <div className="flex bg-[#0b0c10] rounded-lg p-1 border border-border-dark">
                        <button
                            onClick={() => setPeriodType('day')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${periodType === 'day' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Dia
                        </button>
                        <button
                            onClick={() => setPeriodType('month')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${periodType === 'month' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Mês
                        </button>
                        <button
                            onClick={() => setPeriodType('year')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${periodType === 'year' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Ano
                        </button>
                    </div>

                    {/* Date Picker */}
                    <input
                        type={periodType === 'day' ? 'date' : periodType === 'month' ? 'month' : 'number'}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-[#0b0c10] border border-border-dark rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary w-[150px]"
                    />

                    <button onClick={fetchReportData} className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors">
                        <span className="material-icons-outlined">refresh</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#15181e] border border-border-dark rounded-xl p-5 hover:border-primary/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">OEE Global</span>
                        <span className="material-icons-outlined text-primary opacity-50 group-hover:opacity-100 transition-opacity">donut_large</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.oee.toFixed(1)}%</div>
                    <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${stats.oee}%` }}></div>
                    </div>
                </div>

                <div className="bg-[#15181e] border border-border-dark rounded-xl p-5 hover:border-green-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Disponibilidade</span>
                        <span className="material-icons-outlined text-green-500 opacity-50 group-hover:opacity-100 transition-opacity">timer</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.availability.toFixed(1)}%</div>
                    <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full rounded-full" style={{ width: `${stats.availability}%` }}></div>
                    </div>
                </div>

                <div className="bg-[#15181e] border border-border-dark rounded-xl p-5 hover:border-blue-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Produção Total</span>
                        <span className="material-icons-outlined text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity">inventory_2</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.totalProduction.toLocaleString()} un</div>
                    <div className="text-xs text-blue-400 mt-2 font-mono">Meta: {(stats.totalProduction * 1.1).toFixed(0)} un</div>
                </div>

                <div className="bg-[#15181e] border border-border-dark rounded-xl p-5 hover:border-red-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Refugo</span>
                        <span className="material-icons-outlined text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">delete_forever</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.totalScrap.toLocaleString()} un</div>
                    <div className="text-xs text-red-400 mt-2 font-mono">{(stats.totalScrap / stats.totalProduction * 100).toFixed(2)}% de perda</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

                {/* Left Column: Checklist History */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#15181e] border border-border-dark rounded-xl overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-border-dark bg-[#1a1d24] flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-outlined text-gray-400">playlist_add_check</span>
                                Histórico de Checklists
                            </h3>
                            <span className="text-xs text-gray-500 uppercase font-bold bg-black/30 px-2 py-1 rounded">Últimos Lançamentos</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[500px]">
                            {loading ? (
                                <div className="text-center py-10 text-gray-500">
                                    <span className="material-icons-outlined animate-spin text-2xl mb-2">sync</span>
                                    <p>Carregando dados...</p>
                                </div>
                            ) : checklistEvents.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-lg">
                                    Nenhum checklist encontrado para este período.
                                </div>
                            ) : (
                                checklistEvents.map(event => (
                                    <div key={event.id} className="bg-[#0b0c10] border border-border-dark rounded-lg p-4 hover:border-gray-600 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-white text-sm">{event.checklist_nome}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <span className="material-icons-outlined text-[10px]">person</span>
                                                        {event.operator_name}
                                                    </span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500 font-mono">
                                                        {new Date(event.created_at).toLocaleString('pt-BR')}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${event.status === 'ok' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                    event.status === 'problema' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                        'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                                }`}>
                                                {event.status === 'ok' ? 'OK' : event.status === 'problema' ? 'Problema' : 'Não Realizado'}
                                            </span>
                                        </div>

                                        {(event.observacao || event.status === 'problema') && (
                                            <div className="bg-[#15181e] p-3 rounded border border-white/5 mt-2">
                                                {event.observacao && (
                                                    <p className="text-sm text-gray-300 italic mb-2">"{event.observacao}"</p>
                                                )}
                                                {/* Mock Photos */}
                                                {event.status === 'problema' && (
                                                    <div className="flex gap-2 mt-2">
                                                        <div className="w-16 h-16 bg-gray-800 rounded border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
                                                            <span className="material-icons-outlined text-gray-500 text-lg">image</span>
                                                        </div>
                                                        <div className="w-16 h-16 bg-gray-800 rounded border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
                                                            <span className="material-icons-outlined text-gray-500 text-lg">image</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Operators & Events */}
                <div className="space-y-6">
                    <div className="bg-[#15181e] border border-border-dark rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-border-dark bg-[#1a1d24]">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-outlined text-gray-400">group</span>
                                Operadores no Período
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            {/* Mock Operator List */}
                            <div className="flex items-center gap-3 p-3 bg-[#0b0c10] rounded-lg border border-border-dark">
                                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                                    JS
                                </div>
                                <div>
                                    <div className="font-bold text-white text-sm">João Silva</div>
                                    <div className="text-xs text-gray-500">Turno Manhã • 06:00 - 14:00</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-[#0b0c10] rounded-lg border border-border-dark">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold">
                                    MC
                                </div>
                                <div>
                                    <div className="font-bold text-white text-sm">Maria Costa</div>
                                    <div className="text-xs text-gray-500">Turno Tarde • 14:00 - 22:00</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#15181e] border border-border-dark rounded-xl overflow-hidden flex-1">
                        <div className="p-4 border-b border-border-dark bg-[#1a1d24]">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-outlined text-gray-400">donut_small</span>
                                Principais Paradas
                            </h3>
                        </div>
                        <div className="p-4">
                            {/* Mock Stop chart/list */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-gray-400">Manutenção Mecânica</span>
                                    <span className="text-white font-mono">45min</span>
                                </div>
                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                    <div className="bg-red-500 h-full w-[60%]"></div>
                                </div>

                                <div className="flex items-center justify-between text-xs mb-1 pt-2">
                                    <span className="text-gray-400">Falta de Material</span>
                                    <span className="text-white font-mono">20min</span>
                                </div>
                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full w-[30%]"></div>
                                </div>

                                <div className="flex items-center justify-between text-xs mb-1 pt-2">
                                    <span className="text-gray-400">Setup / Ajuste</span>
                                    <span className="text-white font-mono">15min</span>
                                </div>
                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                    <div className="bg-yellow-500 h-full w-[20%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
