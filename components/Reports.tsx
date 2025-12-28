
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
    const [topStops, setTopStops] = useState<Array<[string, number]>>([]);
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
        try {
            // Calculate date range based on period type
            const startDate = new Date(selectedDate);
            let endDate = new Date(selectedDate);

            if (periodType === 'day') {
                endDate.setHours(23, 59, 59, 999);
            } else if (periodType === 'month') {
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
            } else if (periodType === 'year') {
                endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
            }

            const startISO = startDate.toISOString();
            const endISO = endDate.toISOString();

            // 1. Fetch Checklists
            const { data: checklists } = await supabase
                .from('checklist_eventos')
                .select('*, checklists(nome), operadores(nome)')
                .eq('maquina_id', selectedMachine)
                .gte('created_at', startISO)
                .lte('created_at', endISO)
                .order('created_at', { ascending: false })
                .limit(50);

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

            // 2. Fetch Production Data for stats
            const { data: producao } = await supabase
                .from('registros_producao')
                .select('quantidade_boa, quantidade_refugo')
                .eq('maquina_id', selectedMachine)
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            let totalProduction = 0;
            let totalScrap = 0;
            if (producao) {
                totalProduction = producao.reduce((sum, r) => sum + (r.quantidade_boa || 0), 0);
                totalScrap = producao.reduce((sum, r) => sum + (r.quantidade_refugo || 0), 0);
            }

            // 3. Fetch Stops Data for availability calculation
            const { data: stops } = await supabase
                .from('paradas')
                .select('duracao_minutos, tipos_parada(nome)')
                .eq('maquina_id', selectedMachine)
                .gte('inicio', startISO)
                .lte('inicio', endISO);

            let totalStopTime = 0;
            const stopsByType: Record<string, number> = {};

            if (stops) {
                stops.forEach((stop: any) => {
                    const duration = stop.duracao_minutos || 0;
                    totalStopTime += duration;

                    const stopType = stop.tipos_parada?.nome || 'Outros';
                    stopsByType[stopType] = (stopsByType[stopType] || 0) + duration;
                });
            }

            // Calculate period in minutes
            const periodMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
            const availability = periodMinutes > 0
                ? ((periodMinutes - totalStopTime) / periodMinutes) * 100
                : 100;

            // Calculate quality (percentage of good production)
            const totalProduced = totalProduction + totalScrap;
            const quality = totalProduced > 0
                ? (totalProduction / totalProduced) * 100
                : 100;

            // Simplified performance calculation (can be enhanced with cycle time data)
            const performance = 92; // Placeholder - would need cycle time data

            const oee = (availability / 100) * (quality / 100) * (performance / 100) * 100;

            setStats({
                availability,
                quality,
                performance,
                oee,
                totalProduction,
                totalScrap
            });

            // Set stops for display (sorted by duration)
            const sortedStops = Object.entries(stopsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);
            setTopStops(sortedStops);

            // 4. Fetch Operators (using production records to identify active operators)
            const { data: productionWithOperators } = await supabase
                .from('registros_producao')
                .select('operador_id, operadores(nome, turno)')
                .eq('maquina_id', selectedMachine)
                .gte('created_at', startISO)
                .lte('created_at', endISO);

            const operatorMap = new Map<string, any>();
            if (productionWithOperators) {
                productionWithOperators.forEach((p: any) => {
                    if (p.operador_id && p.operadores) {
                        if (!operatorMap.has(p.operador_id)) {
                            operatorMap.set(p.operador_id, {
                                id: p.operador_id,
                                name: p.operadores.nome,
                                shift: p.operadores.turno || 'N/A'
                            });
                        }
                    }
                });
            }

            setOperatorLogs(Array.from(operatorMap.values()).map(op => ({
                operator_name: op.name,
                shift: op.shift,
                login_time: startISO,  // Simplified - would need login tracking
                logout_time: endISO
            })));

        } catch (error) {
            console.error('[Reports] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
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
                            {operatorLogs.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <span className="material-icons-outlined text-2xl mb-2 opacity-50">person_off</span>
                                    <p className="text-xs">Nenhum operador no período</p>
                                </div>
                            ) : (
                                operatorLogs.map((op, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-[#0b0c10] rounded-lg border border-border-dark">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                                            {op.operator_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm">{op.operator_name}</div>
                                            <div className="text-xs text-gray-500">{op.shift ? `Turno ${op.shift}` : 'Turno N/A'}</div>
                                        </div>
                                    </div>
                                ))
                            )}
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
                            {topStops.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <span className="material-icons-outlined text-2xl mb-2 opacity-50">check_circle</span>
                                    <p className="text-xs">Sem paradas no período</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {topStops.map(([type, duration], idx) => {
                                        const maxDuration = topStops[0][1];
                                        const percentage = (duration / maxDuration) * 100;
                                        const hours = Math.floor(duration / 60);
                                        const minutes = Math.round(duration % 60);
                                        const timeStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

                                        return (
                                            <div key={idx}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-gray-400">{type}</span>
                                                    <span className="text-white font-mono">{timeStr}</span>
                                                </div>
                                                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${idx === 0 ? 'bg-red-500' :
                                                                idx === 1 ? 'bg-orange-500' :
                                                                    idx === 2 ? 'bg-yellow-500' :
                                                                        'bg-blue-500'
                                                            }`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
