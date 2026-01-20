
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
    operator_id?: string;
}

interface OpSummary {
    op_id: string;
    op_codigo: string;
    quantidade_produzida: number;
    quantidade_refugo: number;
    tempo_rodando_seg: number;
    tempo_setup_seg: number;
    tempo_parado_seg: number;
}

const Reports: React.FC = () => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string>('');
    const [periodType, setPeriodType] = useState<'day' | 'month' | 'year'>('day');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Data States
    const [operatorLogs, setOperatorLogs] = useState<OperatorLog[]>([]);
    const [opSummaries, setOpSummaries] = useState<OpSummary[]>([]);
    const [topStops, setTopStops] = useState<Array<[string, number]>>([]);
    const [stats, setStats] = useState({
        availability: 0,
        quality: 0,
        performance: 0,
        oee: 0,
        totalProduction: 0,
        totalScrap: 0,
        totalSetupSeconds: 0,
        totalProductionSeconds: 0,
        totalStopSeconds: 0
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

    const formatSeconds = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
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

            // 1. Fetch Production/Stops via snapshots and views
            const { data: summary } = await supabase
                .from('op_summary')
                .select('op_id, quantidade_produzida, quantidade_refugo, tempo_parado_seg, tempo_setup_seg, tempo_rodando_seg, ordens_producao(codigo)')
                .eq('machine_id', selectedMachine);

            const totalProduction = (summary || []).reduce((sum, s: any) => sum + (s.quantidade_produzida || 0), 0);
            const totalScrap = (summary || []).reduce((sum, s: any) => sum + (s.quantidade_refugo || 0), 0);
            const totalStopSeconds = (summary || []).reduce((sum, s: any) => sum + (s.tempo_parado_seg || 0), 0);
            const totalSetupSeconds = (summary || []).reduce((sum, s: any) => sum + (s.tempo_setup_seg || 0), 0);
            const totalProductionSeconds = (summary || []).reduce((sum, s: any) => sum + (s.tempo_rodando_seg || 0), 0);
            const totalStopTime = Math.floor(totalStopSeconds / 60); // minutos

            const { data: stopsByReason } = await supabase
                .from('vw_op_stop_by_reason')
                .select('tipo_parada_id, tempo_parado_seg')
                .eq('machine_id', selectedMachine);

            const { data: stopTypes } = await supabase
                .from('tipos_parada')
                .select('id, nome');

            const stopTypeMap = new Map<string, string>();
            (stopTypes || []).forEach((t: any) => stopTypeMap.set(t.id, t.nome));

            const stopsByType: Record<string, number> = {};
            if (stopsByReason) {
                stopsByReason.forEach((s: any) => {
                    const key = stopTypeMap.get(s.tipo_parada_id) || s.tipo_parada_id || 'Outros';
                    stopsByType[key] = (stopsByType[key] || 0) + Math.floor((s.tempo_parado_seg || 0) / 60);
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

            // Performance: aproximação simples usando throughput por minuto (base 1 un/min se não houver meta)
            const operatingMinutes = Math.max(0, periodMinutes - totalStopTime);
            const throughputPerMinute = operatingMinutes > 0 ? totalProduction / operatingMinutes : 0;
            const performance = Math.min(100, throughputPerMinute * 100);

            const oee = (availability / 100) * (quality / 100) * (performance / 100) * 100;

            setStats({
                availability,
                quality,
                performance,
                oee,
                totalProduction,
                totalScrap,
                totalSetupSeconds,
                totalProductionSeconds,
                totalStopSeconds
            });

            // Set stops for display (sorted by duration)
            const sortedStops = Object.entries(stopsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);
            setTopStops(sortedStops);

            const mappedSummaries: OpSummary[] = (summary || []).map((s: any) => ({
                op_id: s.op_id,
                op_codigo: s.ordens_producao?.codigo || 'OP',
                quantidade_produzida: s.quantidade_produzida || 0,
                quantidade_refugo: s.quantidade_refugo || 0,
                tempo_rodando_seg: s.tempo_rodando_seg || 0,
                tempo_setup_seg: s.tempo_setup_seg || 0,
                tempo_parado_seg: s.tempo_parado_seg || 0
            }));

            setOpSummaries(mappedSummaries);

            // 2. Sessões de operadores no período (usa op_operator_sessions alinhado à troca de operador)
            const { data: sessionLogs } = await supabase
                .from('op_operator_sessions')
                .select('operator_id, started_at, ended_at, operadores(nome), turnos(nome), ordens_producao!inner(maquina_id)')
                .eq('ordens_producao.maquina_id', selectedMachine)
                .gte('started_at', startISO)
                .lte('started_at', endISO)
                .order('started_at', { ascending: false });

            const mappedSessions: OperatorLog[] = (sessionLogs || []).map((s: any) => ({
                operator_id: s.operator_id,
                operator_name: s.operadores?.nome || 'Operador',
                shift: s.turnos?.nome || 'N/A',
                login_time: s.started_at,
                logout_time: s.ended_at || undefined
            }));

            setOperatorLogs(mappedSessions);

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
                        Relatórios de Produção
                    </h1>
                    <p className="text-gray-400 mt-1">Métricas de produção e desempenho por OP</p>
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
                <div className={`bg-[#15181e] border border-border-dark rounded-xl p-5 transition-all group ${stats.oee < 0 ? 'hover:border-red-500/30' : 'hover:border-primary/30'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">OEE Global</span>
                        <span className={`material-icons-outlined opacity-50 group-hover:opacity-100 transition-opacity ${stats.oee < 0 ? 'text-red-500' : 'text-primary'}`}>donut_large</span>
                    </div>
                    <div className={`text-3xl font-bold ${stats.oee < 0 ? 'text-red-500' : 'text-white'}`}>{stats.oee.toFixed(1)}%</div>
                    <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className={`${stats.oee < 0 ? 'bg-red-500' : 'bg-primary'} h-full rounded-full`} style={{ width: `${Math.max(0, stats.oee)}%` }}></div>
                    </div>
                </div>

                <div className={`bg-[#15181e] border border-border-dark rounded-xl p-5 transition-all group ${stats.availability < 0 ? 'hover:border-red-500/30' : 'hover:border-green-500/30'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Disponibilidade</span>
                        <span className={`material-icons-outlined opacity-50 group-hover:opacity-100 transition-opacity ${stats.availability < 0 ? 'text-red-500' : 'text-green-500'}`}>timer</span>
                    </div>
                    <div className={`text-3xl font-bold ${stats.availability < 0 ? 'text-red-500' : 'text-white'}`}>{stats.availability.toFixed(1)}%</div>
                    <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className={`${stats.availability < 0 ? 'bg-red-500' : 'bg-green-500'} h-full rounded-full`} style={{ width: `${Math.max(0, stats.availability)}%` }}></div>
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
                    <div className="text-xs text-red-400 mt-2 font-mono">
                        {stats.totalProduction > 0
                            ? `${((stats.totalScrap / stats.totalProduction) * 100).toFixed(2)}% de perda`
                            : '0.00% de perda'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

                {/* Left Column: OP Summary */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#15181e] border border-border-dark rounded-xl overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-border-dark bg-[#1a1d24] flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-outlined text-gray-400">summarize</span>
                                Resumo de OPs
                            </h3>
                            <span className="text-xs text-gray-500 uppercase font-bold bg-black/30 px-2 py-1 rounded">Totais por OP</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[500px]">
                            {loading ? (
                                <div className="text-center py-10 text-gray-500">
                                    <span className="material-icons-outlined animate-spin text-2xl mb-2">sync</span>
                                    <p>Carregando dados...</p>
                                </div>
                            ) : opSummaries.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-lg">
                                    Nenhuma OP encontrada para esta máquina.
                                </div>
                            ) : (
                                opSummaries.map((op) => (
                                    <div key={op.op_id} className="bg-[#0b0c10] border border-border-dark rounded-lg p-4 hover:border-gray-600 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-white text-sm">{op.op_codigo}</h4>
                                                <div className="text-xs text-gray-500 mt-1">Tempo total: {formatSeconds(op.tempo_setup_seg + op.tempo_rodando_seg + op.tempo_parado_seg)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-400 uppercase font-bold">Produzido</div>
                                                <div className="text-sm font-mono text-white">{op.quantidade_produzida} un</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 text-xs text-gray-400">
                                            <div>
                                                <div className="uppercase font-bold text-[10px]">Setup</div>
                                                <div className="font-mono text-white">{formatSeconds(op.tempo_setup_seg)}</div>
                                            </div>
                                            <div>
                                                <div className="uppercase font-bold text-[10px]">Produção</div>
                                                <div className="font-mono text-white">{formatSeconds(op.tempo_rodando_seg)}</div>
                                            </div>
                                            <div>
                                                <div className="uppercase font-bold text-[10px]">Parada</div>
                                                <div className="font-mono text-white">{formatSeconds(op.tempo_parado_seg)}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                            <span>Refugo: <span className="text-red-400 font-mono">{op.quantidade_refugo} un</span></span>
                                            <span>Eficiência: <span className="text-green-400 font-mono">{op.quantidade_produzida > 0 ? (((op.quantidade_produzida) / (op.quantidade_produzida + op.quantidade_refugo)) * 100).toFixed(1) : '0.0'}%</span></span>
                                        </div>
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
                                            <div className="text-[10px] text-gray-600 font-mono">
                                                {new Date(op.login_time).toLocaleString('pt-BR')} {' '}
                                                {op.logout_time ? `- ${new Date(op.logout_time).toLocaleString('pt-BR')}` : '(aberta)'}
                                            </div>
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






