import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../src/lib/supabase-client';
import { fetchMachineInsights, MachineInsight } from '../src/services/insightsService';
import { computeDifficulties, generateKaizen, KaizenReport, KaizenSuggestion, OperatorDifficulty } from '../src/services/kaizenService';
import { MachineData } from '../types';

const AdminInsights: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [machines, setMachines] = useState<MachineData[]>([]);
    const [operadores, setOperadores] = useState<Record<string, string>>({});
    const [insights, setInsights] = useState<MachineInsight[]>([]);
    const [kaizenReports, setKaizenReports] = useState<Record<string, KaizenReport>>({});
    const [selectedMachine, setSelectedMachine] = useState<string>('all');
    const [period, setPeriod] = useState<'today' | 'yesterday' | '7d' | '30d' | 'custom'>('today');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [expandedMachine, setExpandedMachine] = useState<string | null>(null);

    // Date generators
    const dateRange = useMemo(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case '7d':
                start.setDate(now.getDate() - 7);
                break;
            case '30d':
                start.setDate(now.getDate() - 30);
                break;
            case 'custom':
                if (customDates.start) start = new Date(customDates.start);
                if (customDates.end) end = new Date(customDates.end);
                break;
        }
        return { start: start.toISOString(), end: end.toISOString() };
    }, [period, customDates]);

    // Initial fetch: Machines & Operators
    useEffect(() => {
        const fetchData = async () => {
            const [mRes, opRes] = await Promise.all([
                supabase.from('maquinas').select('*').eq('ativo', true).order('nome'),
                supabase.from('operadores').select('id, nome')
            ]);

            if (mRes.data) setMachines(mRes.data);
            if (opRes.data) {
                const opMap: Record<string, string> = {};
                opRes.data.forEach(op => opMap[op.id] = op.nome);
                setOperadores(opMap);
            }
        };
        fetchData();
    }, []);

    // Fetch Insights & Kaizen when filters change
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Basic Insights (Stage 1)
                const insightsData = await fetchMachineInsights(
                    dateRange.start,
                    dateRange.end,
                    selectedMachine === 'all' ? undefined : selectedMachine
                );
                setInsights(insightsData);

                // 2. Fetch Raw Data for Kaizen (Stage 2)
                const [checklists, paradas, diario] = await Promise.all([
                    supabase.from('checklist_eventos').select('*, checklists(nome)').gte('created_at', dateRange.start).lte('created_at', dateRange.end).limit(2000),
                    supabase.from('paradas').select('*').gte('created_at', dateRange.start).lte('created_at', dateRange.end).limit(1000),
                    supabase.from('diario_bordo_eventos').select('*').gte('created_at', dateRange.start).lte('created_at', dateRange.end).limit(500)
                ]);

                const reports: Record<string, KaizenReport> = {};

                insightsData.forEach(insight => {
                    const mChecklists = checklists.data?.filter(c => c.maquina_id === insight.machineId) || [];
                    const mParadas = paradas.data?.filter(p => p.maquina_id === insight.machineId) || [];
                    const mDiario = diario.data?.filter(d => d.maquina_id === insight.machineId) || [];

                    const difficulties = computeDifficulties(mChecklists, mParadas, mDiario, operadores);
                    reports[insight.machineId] = generateKaizen(insight.metrics, mChecklists, mParadas, mDiario, difficulties);
                });

                setKaizenReports(reports);
            } catch (error) {
                console.error('Error loading analytics:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [dateRange, selectedMachine, operadores]);

    const handleExportText = (machineId: string) => {
        const insight = insights.find(i => i.machineId === machineId);
        const report = kaizenReports[machineId];
        if (!insight || !report) return;

        let text = `=== RELATÓRIO DE INSIGHTS IA - ${insight.machineName.toUpperCase()} ===\n\n`;
        text += insight.summary + "\n\n";

        if (report.alertas.length > 0) {
            text += "--- ALERTAS CRÍTICOS ---\n";
            report.alertas.forEach(a => text += `[!] ${a.titulo} - ${a.justificativa}\n`);
            text += "\n";
        }

        text += "--- SUGESTÕES KAIZEN ---\n";
        report.sugestoes.slice(0, 5).forEach(s => {
            text += `• [${s.categoria}] ${s.titulo}\n  Justificativa: ${s.justificativa}\n  Ação: ${s.acaoRecomendada}\n\n`;
        });

        text += "--- DIFICULDADE DE OPERADORES ---\n";
        report.dificuldades.filter(d => d.nivel !== 'BAIXA').forEach(d => {
            text += `• ${d.operadorNome}: Dificuldade ${d.nivel}\n`;
        });

        navigator.clipboard.writeText(text);
        alert('Relatório copiado para a área de transferência!');
    };

    const getSeverityColor = (sev: string) => {
        switch (sev) {
            case 'CRITICA': return 'text-danger bg-danger/10 border-danger/20';
            case 'ALTA': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'MEDIA': return 'text-warning bg-warning/10 border-warning/20';
            default: return 'text-text-sub-dark bg-white/5 border-white/10';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-dark p-6 rounded-2xl border border-border-dark shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="material-icons-outlined text-primary text-3xl">Auto_awesome</span>
                        Insights IA do Supervisor
                    </h1>
                    <p className="text-text-sub-dark text-sm mt-1">Inteligência Operacional e Melhoria Contínua (Kaizen)</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedMachine}
                        onChange={(e) => setSelectedMachine(e.target.value)}
                        className="bg-background-dark border border-border-dark text-white text-sm rounded-lg px-3 py-2 focus:ring-primary outline-none"
                    >
                        <option value="all">Todas as Máquinas</option>
                        {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                    </select>

                    <div className="flex bg-background-dark p-1 rounded-lg border border-border-dark">
                        {(['today', 'yesterday', '7d', '30d'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${period === p ? 'bg-primary text-white shadow-glow' : 'text-text-sub-dark hover:text-white'
                                    }`}
                            >
                                {p === 'today' ? 'Hoje' : p === 'yesterday' ? 'Ontem' : p === '7d' ? '7 Dias' : '30 Dias'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-surface-dark rounded-2xl border border-border-dark">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                    <p className="text-text-sub-dark">Analisando dados e gerando recomendações...</p>
                </div>
            ) : insights.length === 0 ? (
                <div className="text-center py-20 bg-surface-dark rounded-2xl border border-border-dark">
                    <span className="material-icons-outlined text-6xl text-text-sub-dark/30 mb-4">analytics</span>
                    <p className="text-text-sub-dark">Dados insuficientes para análise no período.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {insights.map((insight) => {
                        const report = kaizenReports[insight.machineId];
                        const isExpanded = expandedMachine === insight.machineId;

                        return (
                            <div
                                key={insight.machineId}
                                className={`bg-surface-dark rounded-2xl border-l-4 p-6 shadow-xl transition-all ${insight.risk === 'VERMELHO' ? 'border-l-danger' :
                                        insight.risk === 'AMARELO' ? 'border-l-warning' :
                                            'border-l-secondary'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row gap-8">
                                    {/* Left Column: Summary & KPIs */}
                                    <div className="lg:w-1/3 space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{insight.machineName}</h2>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-2 ${insight.risk === 'VERMELHO' ? 'bg-danger/10 text-danger' :
                                                        insight.risk === 'AMARELO' ? 'bg-warning/10 text-warning' :
                                                            'bg-secondary/10 text-secondary'
                                                    }`}>
                                                    <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                                                    RISCO {insight.risk}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleExportText(insight.machineId)}
                                                className="p-2 bg-white/5 hover:bg-white/10 text-text-sub-dark hover:text-white rounded-lg transition-colors border border-white/5"
                                                title="Exportar Relatório"
                                            >
                                                <span className="material-icons-outlined">content_copy</span>
                                            </button>
                                        </div>

                                        <div className="bg-background-dark/50 p-4 rounded-xl border border-white/5 relative group">
                                            <p className="text-sm text-text-main-dark leading-relaxed whitespace-pre-line font-medium italic">
                                                "{insight.summary}"
                                            </p>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-icons-outlined text-primary text-xs">auto_fix_high</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-background-dark/30 p-3 rounded-xl border border-white/5">
                                                <p className="text-[10px] text-text-sub-dark font-bold uppercase tracking-wider mb-1">Checklists OK</p>
                                                <p className="text-xl font-bold text-white">{insight.metrics.checklists_ok}/{insight.metrics.total_checklists}</p>
                                            </div>
                                            <div className="bg-background-dark/30 p-3 rounded-xl border border-white/5">
                                                <p className="text-[10px] text-text-sub-dark font-bold uppercase tracking-wider mb-1">Alertas/Falhas</p>
                                                <p className={`text-xl font-bold ${insight.metrics.checklists_problema + insight.metrics.checklists_nao_realizado > 0 ? 'text-danger' : 'text-white'}`}>
                                                    {insight.metrics.checklists_problema + insight.metrics.checklists_nao_realizado}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Column: Alerts & Kaizen */}
                                    <div className="lg:w-2/3 flex flex-col md:flex-row gap-6">
                                        {/* Alerts & Suggestions */}
                                        <div className="flex-1 space-y-6">
                                            {report?.alertas.length > 0 && (
                                                <div className="space-y-3">
                                                    <h3 className="text-xs font-bold text-danger flex items-center gap-2 uppercase tracking-widest">
                                                        <span className="material-icons-outlined text-sm">notification_important</span>
                                                        Alertas Críticos
                                                    </h3>
                                                    {report.alertas.map((alerta, idx) => (
                                                        <div key={idx} className="bg-danger/10 border border-danger/20 p-3 rounded-xl animate-pulse">
                                                            <p className="text-sm font-bold text-danger">{alerta.titulo}</p>
                                                            <p className="text-xs text-danger/80 mt-1">{alerta.justificativa}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                <h3 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                                                    <span className="material-icons-outlined text-sm">trending_up</span>
                                                    Sugestões Kaizen (Melhoria)
                                                </h3>
                                                {report?.sugestoes.slice(0, 3).map((sug, idx) => (
                                                    <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/[0.07] transition-colors group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${getSeverityColor(sug.severidade)}`}>
                                                                {sug.severidade} | {sug.categoria}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-bold text-white mb-1">{sug.titulo}</p>
                                                        <p className="text-xs text-text-sub-dark mb-3 line-clamp-2 italic">"{sug.justificativa}"</p>
                                                        <div className="bg-primary/10 border border-primary/20 p-2 rounded-lg">
                                                            <p className="text-[10px] font-bold text-primary uppercase mb-1 flex items-center gap-1">
                                                                <span className="material-icons-outlined text-[12px]">rocket_launch</span>
                                                                Ação Recomendada
                                                            </p>
                                                            <p className="text-xs text-white/90 leading-tight">{sug.acaoRecomendada}</p>
                                                        </div>

                                                        {/* Evidence Popover/List if available */}
                                                        {sug.evidencias.length > 0 && (
                                                            <div className="mt-3 flex gap-2 flex-wrap">
                                                                {sug.evidencias.slice(0, 2).map((ev, ei) => (
                                                                    <span key={ei} className="text-[9px] font-mono text-text-sub-dark bg-black/40 px-1.5 py-0.5 rounded">
                                                                        ID: {ev.id.substring(0, 6)}...
                                                                    </span>
                                                                ))}
                                                                {sug.evidencias.length > 2 && <span className="text-[9px] text-text-sub-dark">+{sug.evidencias.length - 2} evidências</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Right Column: Operator Difficulty */}
                                        <div className="md:w-64 space-y-4">
                                            <h3 className="text-xs font-bold text-white/60 flex items-center gap-2 uppercase tracking-widest">
                                                <span className="material-icons-outlined text-sm">groups</span>
                                                Perfil de Operadores
                                            </h3>
                                            <div className="space-y-3">
                                                {report?.dificuldades.map((diff, idx) => (
                                                    <div key={idx} className="bg-background-dark/40 border border-white/5 p-3 rounded-xl">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <p className="text-xs font-bold text-white truncate w-32">{diff.operadorNome}</p>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${diff.nivel === 'ALTA' ? 'bg-danger/20 text-danger' :
                                                                    diff.nivel === 'MEDIA' ? 'bg-warning/20 text-warning' :
                                                                        'bg-secondary/20 text-secondary'
                                                                }`}>
                                                                {diff.nivel}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="text-[10px]">
                                                                <p className="text-text-sub-dark">T. N. Realiz.</p>
                                                                <p className={`font-mono ${diff.metricas.taxa_nao_realizado > 0 ? 'text-danger' : 'text-text-sub-dark'}`}>
                                                                    {(diff.metricas.taxa_nao_realizado * 100).toFixed(0)}%
                                                                </p>
                                                            </div>
                                                            <div className="text-[10px]">
                                                                <p className="text-text-sub-dark">T. Prob.</p>
                                                                <p className="font-mono text-text-sub-dark">{(diff.metricas.taxa_problema * 100).toFixed(0)}%</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {report?.dificuldades.length === 0 && (
                                                    <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                                                        <p className="text-[10px] text-text-sub-dark">Sem dados de operadores</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminInsights;
