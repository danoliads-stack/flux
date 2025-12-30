
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { MachineStatus, Permission } from '../types';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell
} from 'recharts';

interface ChecklistEvent {
    id: string;
    checklist_nome: string;
    status: 'ok' | 'problema' | 'nao_realizado';
    observacao?: string;
    created_at: string;
    operator_name?: string;
    machine_name?: string;
    machine_id: string;
}

const QualityDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [checklistEvents, setChecklistEvents] = useState<ChecklistEvent[]>([]);
    const [machines, setMachines] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);

    // Filters
    const [selectedMachine, setSelectedMachine] = useState<string>('all');
    const [selectedOperator, setSelectedOperator] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchInitialData();
        fetchChecklistHistory();
    }, [selectedPeriod, selectedMachine, selectedOperator, selectedStatus]);

    const fetchInitialData = async () => {
        const { data: maqData } = await supabase.from('maquinas').select('id, nome, codigo');
        const { data: opData } = await supabase.from('operadores').select('id, nome');
        if (maqData) setMachines(maqData);
        if (opData) setOperators(opData);
    };

    const fetchChecklistHistory = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('checklist_eventos')
                .select('*, checklists(nome), operadores(nome), maquinas(nome)')
                .order('created_at', { ascending: false });

            // Apply time filter
            const now = new Date();
            let startDate = new Date();
            if (selectedPeriod === 'day') startDate.setHours(0, 0, 0, 0);
            else if (selectedPeriod === 'week') startDate.setDate(now.getDate() - 7);
            else if (selectedPeriod === 'month') startDate.setMonth(now.getMonth() - 1);

            query = query.gte('created_at', startDate.toISOString());

            if (selectedMachine !== 'all') query = query.eq('maquina_id', selectedMachine);
            if (selectedOperator !== 'all') query = query.eq('operador_id', selectedOperator);
            if (selectedStatus !== 'all') query = query.eq('status', selectedStatus);

            const { data, error } = await query;

            if (data) {
                setChecklistEvents(data.map((c: any) => ({
                    id: c.id,
                    checklist_nome: c.checklists?.nome || 'Unknown',
                    status: c.status,
                    observacao: c.observacao,
                    created_at: c.created_at,
                    operator_name: c.operadores?.nome || 'Unknown Operator',
                    machine_name: c.maquinas?.nome || 'Unknown Machine',
                    machine_id: c.maquina_id
                })));
            }
        } catch (error) {
            console.error('[QualityDashboard] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = useMemo(() => {
        return checklistEvents.filter(e =>
            e.checklist_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.operator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.observacao?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [checklistEvents, searchTerm]);

    // Chart Data: Success Rate Trends
    const chartData = useMemo(() => {
        const groups: Record<string, { date: string; ok: number; total: number }> = {};

        [...checklistEvents].reverse().forEach(event => {
            const dateStr = new Date(event.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!groups[dateStr]) groups[dateStr] = { date: dateStr, ok: 0, total: 0 };
            groups[dateStr].total++;
            if (event.status === 'ok') groups[dateStr].ok++;
        });

        return Object.values(groups).map(g => ({
            name: g.date,
            taxa: Math.round((g.ok / g.total) * 100),
            total: g.total
        }));
    }, [checklistEvents]);

    // Problem analysis by machine
    const machineAnalysis = useMemo(() => {
        const analysis: Record<string, { name: string; problems: number; total: number }> = {};

        checklistEvents.forEach(e => {
            if (!analysis[e.machine_id]) analysis[e.machine_id] = { name: e.machine_name || 'Desconhecida', problems: 0, total: 0 };
            analysis[e.machine_id].total++;
            if (e.status === 'problema') analysis[e.machine_id].problems++;
        });

        return Object.values(analysis)
            .sort((a, b) => b.problems - a.problems)
            .slice(0, 5);
    }, [checklistEvents]);

    return (
        <div className="flex flex-col h-full bg-[#0b0c10] text-gray-100 overflow-y-auto custom-scrollbar p-4 md:p-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-tight flex items-center gap-3">
                        <span className="material-icons-outlined text-primary text-4xl">verified_user</span>
                        Monitoramento de Qualidade
                    </h1>
                    <p className="text-gray-400 mt-1">Gestão e rastreabilidade de checklists industriais</p>
                </div>

                <div className="flex gap-2">
                    <div className="flex bg-[#15181e] rounded-lg p-1 border border-border-dark">
                        <button
                            onClick={() => setSelectedPeriod('day')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${selectedPeriod === 'day' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >Hoje</button>
                        <button
                            onClick={() => setSelectedPeriod('week')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${selectedPeriod === 'week' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >Semana</button>
                        <button
                            onClick={() => setSelectedPeriod('month')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${selectedPeriod === 'month' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >Mês</button>
                    </div>
                    <button onClick={fetchChecklistHistory} className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors">
                        <span className="material-icons-outlined">refresh</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-[#15181e] border border-border-dark rounded-xl p-6 h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="material-icons-outlined text-primary">trending_up</span>
                            Taxa de Conformidade (%)
                        </h3>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3342" vertical={false} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#15181e', border: '1px solid #2d3342', borderRadius: '8px' }}
                                itemStyle={{ color: '#0ea5e9' }}
                            />
                            <Line type="monotone" dataKey="taxa" stroke="#0ea5e9" strokeWidth={3} dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Machine Problem Rank */}
                <div className="bg-[#15181e] border border-border-dark rounded-xl p-6 h-[300px] flex flex-col">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="material-icons-outlined text-danger">report_problem</span>
                        Maiores Incidências
                    </h3>
                    <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                        {machineAnalysis.length > 0 ? machineAnalysis.map((m, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between text-xs mb-1.5 opacity-80">
                                    <span className="font-bold text-white">{m.name}</span>
                                    <span className="text-danger font-mono">{m.problems} problemas</span>
                                </div>
                                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-danger h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${(m.problems / m.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                <span className="material-icons-outlined text-4xl mb-2">check_circle</span>
                                <p className="text-xs uppercase font-bold">Tudo Certo</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content & Filters */}
            <div className="bg-[#15181e] border border-border-dark rounded-xl overflow-hidden flex flex-col min-h-[500px]">

                {/* Advanced Filters Toolbar */}
                <div className="p-4 bg-[#1a1d24] border-b border-border-dark flex flex-col lg:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por OP, operador, máquina ou observação..."
                            className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <select
                            value={selectedMachine}
                            onChange={(e) => setSelectedMachine(e.target.value)}
                            className="bg-[#0b0c10] border border-border-dark rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                            <option value="all">Todas as Máquinas</option>
                            {machines.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>

                        <select
                            value={selectedOperator}
                            onChange={(e) => setSelectedOperator(e.target.value)}
                            className="bg-[#0b0c10] border border-border-dark rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                            <option value="all">Todos Operadores</option>
                            {operators.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </select>

                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="bg-[#0b0c10] border border-border-dark rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                            <option value="all">Todos Status</option>
                            <option value="ok">Conforme (OK)</option>
                            <option value="problema">Não Conforme</option>
                            <option value="nao_realizado">Não Realizado</option>
                        </select>
                    </div>
                </div>

                {/* Table View */}
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-border-dark text-[10px] text-gray-500 uppercase font-bold tracking-widest bg-black/20">
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Máquina</th>
                                <th className="px-6 py-4">Operador</th>
                                <th className="px-6 py-4">Checklist</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Observação</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-icons-outlined animate-spin">sync</span>
                                            <span className="text-xs uppercase font-bold tracking-widest">Sincronizando Histórico...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-600 italic">
                                        Nenhum registro encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredEvents.map((event) => (
                                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-white font-mono">{new Date(event.created_at).toLocaleString('pt-BR')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                                                    <span className="material-icons-outlined text-primary text-xs">precision_manufacturing</span>
                                                </div>
                                                <span className="text-sm font-bold text-white">{event.machine_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-300">{event.operator_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-white font-medium">{event.checklist_nome}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${event.status === 'ok' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                    event.status === 'problema' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                        'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                                }`}>
                                                {event.status === 'ok' ? 'CONFORME' : event.status === 'problema' ? 'NÃO CONFORME' : 'NÃO REALIZADO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-[300px]">
                                            <div className="text-xs text-text-sub-dark italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                                {event.observacao || '--'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-1 px-3 text-[10px] font-bold uppercase bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded border border-white/10 transition-all">
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Count */}
                <div className="px-6 py-3 bg-[#1a1d24] border-t border-border-dark flex justify-between items-center">
                    <span className="text-xs text-gray-500">Exibindo {filteredEvents.length} registros</span>
                    <div className="flex gap-2">
                        <button className="p-1 px-2 bg-black/20 text-gray-600 rounded cursor-not-allowed"><span className="material-icons-outlined text-sm">chevron_left</span></button>
                        <button className="p-1 px-2 bg-black/20 text-gray-600 rounded cursor-not-allowed"><span className="material-icons-outlined text-sm">chevron_right</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityDashboard;
