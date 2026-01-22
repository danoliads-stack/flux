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

    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-dark/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-50"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <span className="material-icons-outlined text-primary text-4xl drop-shadow-glow">Auto_awesome</span>
                        Insights IA <span className="text-primary/80">Flux</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-text-sub-dark text-sm font-medium">Inteligência Operacional e Melhoria Contínua</p>
                        <button
                            onClick={() => setShowExplanation(!showExplanation)}
                            className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors border border-primary/20"
                        >
                            <span className="material-icons-outlined text-xs">help_outline</span>
                            Como funciona?
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <select
                        value={selectedMachine}
                        onChange={(e) => setSelectedMachine(e.target.value)}
                        className="bg-black/40 backdrop-blur-md border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/50 outline-none transition-all hover:bg-black/60"
                    >
                        <option value="all">Todas as Máquinas</option>
                        {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                    </select>

                    <div className="flex bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/10">
                        {(['today', 'yesterday', '7d', '30d'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 text-xs font-black rounded-lg transition-all duration-300 ${period === p
                                    ? 'bg-primary text-white shadow-glow translate-y-[-1px]'
                                    : 'text-text-sub-dark hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {p === 'today' ? 'Hoje' : p === 'yesterday' ? 'Ontem' : p === '7d' ? '7D' : '30D'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Explanation Section (Hidden by default) */}
            {showExplanation && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up bg-primary/5 border border-primary/20 p-6 rounded-3xl backdrop-blur-sm">
                    <div className="space-y-2">
                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="material-icons-outlined text-primary">psychology</span>
                        </div>
                        <h4 className="text-white font-bold text-sm">Heurísticas Determinísticas</h4>
                        <p className="text-text-sub-dark text-xs leading-relaxed">
                            Nossa "IA" analisa padrões através de regras matemáticas precisas. Se um comportamento se repete X vezes, uma sugestão Kaizen é gerada automaticamente baseada em dados históricos.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="material-icons-outlined text-secondary">fact_check</span>
                        </div>
                        <h4 className="text-white font-bold text-sm">Cruzamento de Dados</h4>
                        <p className="text-text-sub-dark text-xs leading-relaxed">
                            Cruzamos Checklists, Paradas e Diário de Bordo para entender se um problema é mecânico (Manutenção), processual (Padronização) ou humano (Treinamento).
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="w-10 h-10 bg-warning/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="material-icons-outlined text-warning">speed</span>
                        </div>
                        <h4 className="text-white font-bold text-sm">Foco em OEE</h4>
                        <p className="text-text-sub-dark text-xs leading-relaxed">
                            O algoritmo prioriza alertas que impactam diretamente a Disponibilidade e Qualidade, as duas maiores alavancas para o OEE industrial.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-surface-dark/40 backdrop-blur-md rounded-3xl border border-white/10">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="material-icons-outlined text-primary animate-pulse text-xl">auto_fix_high</span>
                        </div>
                    </div>
                    <p className="text-text-sub-dark mt-6 font-medium tracking-wide">Refinando heurísticas e gerando recomendações...</p>
                </div>
            ) : insights.length === 0 ? (
                <div className="text-center py-24 bg-surface-dark/40 backdrop-blur-md rounded-3xl border border-white/10">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-icons-outlined text-4xl text-text-sub-dark/30">analytics</span>
                    </div>
                    <p className="text-text-sub-dark font-medium text-lg">Sem dados suficientes para análise neste período.</p>
                    <button onClick={() => setPeriod('7d')} className="text-primary text-sm mt-4 hover:underline font-bold">Tentar um período maior</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {insights.map((insight) => {
                        const report = kaizenReports[insight.machineId];

                        return (
                            <div
                                key={insight.machineId}
                                className={`bg-surface-dark/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl relative group transition-all duration-500 hover:translate-y-[-4px] hover:shadow-primary/5 ${insight.risk === 'VERMELHO' ? 'hover:bg-danger/5' :
                                    insight.risk === 'AMARELO' ? 'hover:bg-warning/5' :
                                        'hover:bg-secondary/5'
                                    }`}
                            >
                                {/* Risk Indicator Top Bar */}
                                <div className={`absolute top-0 left-8 right-8 h-1 rounded-b-full opacity-60 ${insight.risk === 'VERMELHO' ? 'bg-danger' :
                                    insight.risk === 'AMARELO' ? 'bg-warning' :
                                        'bg-secondary'
                                    }`}></div>

                                <div className="p-8">
                                    <div className="flex flex-col lg:flex-row gap-10">
                                        {/* Left Column: Summary & KPIs */}
                                        <div className="lg:w-1/3 space-y-8">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{insight.machineName}</h2>
                                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black mt-3 border ${insight.risk === 'VERMELHO' ? 'bg-danger/10 text-danger border-danger/20' :
                                                        insight.risk === 'AMARELO' ? 'bg-warning/10 text-warning border-warning/20' :
                                                            'bg-secondary/10 text-secondary border-secondary/20'
                                                        }`}>
                                                        <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                                                        STATUS: RISCO {insight.risk}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleExportText(insight.machineId)}
                                                    className="p-3 bg-white/5 hover:bg-primary text-text-sub-dark hover:text-white rounded-2xl transition-all border border-white/5 hover:border-primary shadow-lg group/btn"
                                                    title="Copiar Relatório IA"
                                                >
                                                    <span className="material-icons-outlined group-hover/btn:scale-110 transition-transform">share</span>
                                                </button>
                                            </div>

                                            <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 relative group/quote shadow-inner">
                                                <span className="material-icons-outlined absolute -top-3 -left-2 text-primary/40 text-4xl select-none">format_quote</span>
                                                <p className="text-base text-white/90 leading-relaxed font-medium italic relative z-10">
                                                    {insight.summary}
                                                </p>
                                                <div className="mt-4 flex items-center gap-2 text-[10px] text-primary font-bold uppercase tracking-widest opacity-60">
                                                    <span className="w-8 h-[1px] bg-primary/30"></span>
                                                    Análise Heurística v1.2
                                                </div>
                                            </div>

                                            {/* Advanced Stats Grid */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/stat">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-icons-outlined text-xs text-secondary">task_alt</span>
                                                        <p className="text-[10px] text-text-sub-dark font-black uppercase tracking-widest">Aderência</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-white group-hover/stat:text-secondary transition-colors">
                                                        {((insight.metrics.checklists_ok / (insight.metrics.total_checklists || 1)) * 100).toFixed(0)}%
                                                    </p>
                                                    <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                                        <div
                                                            className="h-full bg-secondary transition-all duration-1000"
                                                            style={{ width: `${(insight.metrics.checklists_ok / (insight.metrics.total_checklists || 1)) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/stat">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-icons-outlined text-xs text-danger">report_problem</span>
                                                        <p className="text-[10px] text-text-sub-dark font-black uppercase tracking-widest">Anomalias</p>
                                                    </div>
                                                    <p className={`text-2xl font-black transition-colors ${insight.metrics.checklists_problema > 0 ? 'text-danger group-hover/stat:text-danger' : 'text-white'}`}>
                                                        {insight.metrics.checklists_problema}
                                                    </p>
                                                    <p className="text-[10px] text-text-sub-dark mt-1 font-bold">Eventos Críticos</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: AI Engine Results */}
                                        <div className="lg:w-2/3 flex flex-col xl:flex-row gap-8">
                                            {/* Kaizen & Alerts Container */}
                                            <div className="flex-1 space-y-8">
                                                {report?.alertas.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center">
                                                                <span className="material-icons-outlined text-danger text-sm">priority_high</span>
                                                            </div>
                                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ações Imediatas Requeridas</h3>
                                                        </div>
                                                        {report.alertas.map((alerta, idx) => (
                                                            <div key={idx} className="bg-gradient-to-br from-danger/20 to-danger/5 border border-danger/30 p-5 rounded-2xl relative overflow-hidden group/alert">
                                                                <div className="absolute top-0 right-0 w-32 h-32 bg-danger/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover/alert:scale-150 transition-transform"></div>
                                                                <p className="text-sm font-black text-danger flex items-center gap-2 relative z-10">
                                                                    <span className="w-2 h-2 bg-danger rounded-full animate-ping"></span>
                                                                    {alerta.titulo}
                                                                </p>
                                                                <p className="text-xs text-white/80 mt-2 leading-relaxed relative z-10 font-medium">"{alerta.justificativa}"</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="space-y-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                                                            <span className="material-icons-outlined text-primary text-sm">auto_graph</span>
                                                        </div>
                                                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Plano de Melhoria (Kaizen)</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {report?.sugestoes.slice(0, 4).map((sug, idx) => (
                                                            <div key={idx} className="bg-white/[0.03] border border-white/10 p-5 rounded-2xl hover:bg-white/[0.08] transition-all duration-300 group/k">
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${getSeverityColor(sug.severidade).replace('bg-', 'bg-opacity-20 bg-')}`}>
                                                                        {sug.categoria}
                                                                    </span>
                                                                    <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                                                    <span className="text-[9px] text-text-sub-dark font-bold uppercase">{sug.severidade}</span>
                                                                </div>

                                                                <h4 className="text-sm font-black text-white mb-2 leading-tight group-hover/k:text-primary transition-colors">{sug.titulo}</h4>
                                                                <p className="text-xs text-text-sub-dark mb-5 leading-relaxed italic line-clamp-2">"{sug.justificativa}"</p>

                                                                <div className="bg-black/40 border border-primary/20 p-4 rounded-xl group-hover/k:border-primary/40 transition-colors">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="material-icons-outlined text-primary text-[14px]">bolt</span>
                                                                        <p className="text-[10px] font-black text-primary uppercase tracking-tighter">Ação Corretiva</p>
                                                                    </div>
                                                                    <p className="text-xs text-white/90 leading-tight font-medium">{sug.acaoRecomendada}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* New Feature: Operator Performance Matrix */}
                                            <div className="xl:w-72 space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                                                        <span className="material-icons-outlined text-white/60 text-sm">radar</span>
                                                    </div>
                                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Matriz Humana</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {report?.dificuldades.map((diff, idx) => (
                                                        <div key={idx} className="bg-black/20 border border-white/5 p-4 rounded-2xl relative overflow-hidden hover:border-white/20 transition-all group/op">
                                                            <div className="flex items-center gap-3 mb-4">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-xs font-black text-white border border-white/10 group-hover/op:border-primary/50 transition-all">
                                                                    {diff.operadorNome.charAt(0)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-black text-white truncate">{diff.operadorNome}</p>
                                                                    <p className="text-[9px] text-text-sub-dark font-bold uppercase">{diff.nivel === 'ALTA' ? 'Requer Atenção' : diff.nivel === 'MEDIA' ? 'Monitorar' : 'Estável'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="text-text-sub-dark font-bold">Assiduidade</span>
                                                                    <span className={`${diff.metricas.taxa_nao_realizado > 0 ? 'text-danger font-black' : 'text-secondary font-black'}`}>
                                                                        {((1 - diff.metricas.taxa_nao_realizado) * 100).toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-1000 ${diff.nivel === 'ALTA' ? 'bg-danger' : 'bg-secondary'}`}
                                                                        style={{ width: `${(1 - diff.metricas.taxa_nao_realizado) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {report?.dificuldades.length === 0 && (
                                                        <div className="text-center py-10 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                                            <p className="text-xs text-text-sub-dark font-medium italic">Matriz em processamento...</p>
                                                        </div>
                                                    )}
                                                </div>
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
