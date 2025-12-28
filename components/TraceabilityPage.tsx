
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LoteRastreabilidade, ProductionOrder, MachineData, ChecklistEvento, DiarioBordoEvento } from '../types';

interface TraceabilityPageProps {
    loteId: string;
}

const TraceabilityPage: React.FC<TraceabilityPageProps> = ({ loteId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        lote: LoteRastreabilidade | null;
        op: ProductionOrder | null;
        machine: MachineData | null;
        operators: any[];
        productions: any[];
        stops: any[];
        checklists: ChecklistEvento[];
        logbook: DiarioBordoEvento[];
    }>({
        lote: null,
        op: null,
        machine: null,
        operators: [],
        productions: [],
        stops: [],
        checklists: [],
        logbook: []
    });

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);

            // 1. Fetch Lote
            const { data: lote } = await supabase.from('lotes_rastreabilidade').select('*').eq('id', loteId).single();
            if (!lote) {
                setLoading(false);
                return;
            }

            // 2. Fetch OP and Machine
            const { data: op } = await supabase.from('ordens_producao').select('*').eq('id', lote.op_id).single();
            const { data: machine } = await supabase.from('maquinas').select('*').eq('id', lote.maquina_id).single();

            // 3. Fetch History (using machine/OP context)
            const { data: operators } = await supabase
                .from('op_operadores')
                .select('*, operadores(nome)')
                .eq('op_id', lote.op_id);

            const { data: productions } = await supabase
                .from('registros_producao')
                .select('*')
                .eq('op_id', lote.op_id);

            const { data: stops } = await supabase
                .from('paradas')
                .select('*, operadores(nome)')
                .eq('op_id', lote.op_id);

            const { data: checklists } = await supabase
                .from('checklist_eventos')
                .select('*')
                .eq('op_id', lote.op_id);

            const { data: logbook } = await supabase
                .from('diario_bordo_eventos')
                .select('*')
                .eq('op_id', lote.op_id);

            setData({
                lote,
                op,
                machine,
                operators: operators || [],
                productions: productions || [],
                stops: stops || [],
                checklists: checklists || [],
                logbook: logbook || []
            });
            setLoading(false);
        };

        fetchAllData();
    }, [loteId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-display font-bold tracking-widest text-sm uppercase opacity-50">Consultando Rastreabilidade...</p>
                </div>
            </div>
        );
    }

    if (!data.lote) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center text-white">
                <div className="text-center p-8 bg-surface-dark border border-border-dark rounded-2xl max-w-md">
                    <span className="material-icons text-danger text-6xl mb-4">error_outline</span>
                    <h2 className="text-2xl font-bold mb-2">Lote não encontrado</h2>
                    <p className="text-text-sub-dark">O QR Code escaneado não corresponde a um registro válido de rastreabilidade ou o lote ainda está sendo processado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-dark text-white p-4 md:p-8 animate-fade-in pb-20">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow">
                            <span className="material-icons text-primary text-4xl">qr_code_2</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight uppercase">Rastreabilidade</h1>
                                <span className="bg-secondary/10 text-secondary text-xs font-black uppercase px-2 py-1 rounded border border-secondary/20 tracking-widest">Ativa</span>
                            </div>
                            <p className="text-text-sub-dark mt-1">Lote: <span className="text-white font-mono">{loteId}</span></p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-text-sub-dark uppercase tracking-widest mb-1">Data de Liberação</div>
                        <p className="text-xl font-mono text-white">{new Date(data.lote.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                {/* Global Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-surface-dark p-6 rounded-2xl border border-border-dark flex flex-col justify-between">
                        <span className="text-[10px] font-black text-text-sub-dark uppercase tracking-widest mb-4">Ordem de Produção</span>
                        <p className="text-2xl font-black text-white">{data.op?.codigo}</p>
                        <p className="text-xs text-text-sub-dark mt-1">{data.op?.nome_produto}</p>
                    </div>
                    <div className="bg-surface-dark p-6 rounded-2xl border border-border-dark flex flex-col justify-between">
                        <span className="text-[10px] font-black text-text-sub-dark uppercase tracking-widest mb-4">Máquina</span>
                        <p className="text-2xl font-black text-white">{data.machine?.nome}</p>
                        <p className="text-xs text-text-sub-dark mt-1">ID: {data.machine?.codigo}</p>
                    </div>
                    <div className="bg-surface-dark p-6 rounded-2xl border border-border-dark flex flex-col justify-between">
                        <span className="text-[10px] font-black text-text-sub-dark uppercase tracking-widest mb-4">Quantidade Liberada</span>
                        <p className="text-2xl font-black text-secondary">{data.lote.quantidade_liberada} <span className="text-xs font-normal">un</span></p>
                        <p className="text-xs text-text-sub-dark mt-1">Meta Original: {data.op?.quantidade_meta}</p>
                    </div>
                    <div className="bg-surface-dark p-6 rounded-2xl border border-border-dark flex flex-col justify-between">
                        <span className="text-[10px] font-black text-text-sub-dark uppercase tracking-widest mb-4">Acurácia Qualidade</span>
                        <p className="text-2xl font-black text-danger">{(100 - (data.checklists.filter(c => c.status === 'problema').length / (data.checklists.length || 1)) * 100).toFixed(0)}%</p>
                        <p className="text-xs text-text-sub-dark mt-1">{data.checklists.length} verificações</p>
                    </div>
                </div>

                {/* History Tabs Content Rendering (Simplified for brevity as requested "SEM ALTERAR UI" and the goal is functional audit) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Timeline: Production & Stops */}
                    <div className="lg:col-span-2 space-y-6">
                        <h3 className="text-xl font-display font-black tracking-tight uppercase flex items-center gap-2 border-l-4 border-primary pl-4">
                            Histórico Operacional
                        </h3>

                        <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-surface-dark-highlight text-text-sub-dark uppercase text-[10px] font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Evento</th>
                                            <th className="px-6 py-4">Detalhes</th>
                                            <th className="px-6 py-4">Hora</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-dark">
                                        {data.productions.map((p, i) => (
                                            <tr key={i} className="hover:bg-surface-dark-highlight">
                                                <td className="px-6 py-4 font-bold text-secondary">Produção Registrada</td>
                                                <td className="px-6 py-4">Bom: {p.quantidade_boa} | Refugo: {p.quantidade_refugo}</td>
                                                <td className="px-6 py-4 text-text-sub-dark font-mono">{new Date(p.created_at).toLocaleTimeString()}</td>
                                            </tr>
                                        ))}
                                        {data.stops.map((s, i) => (
                                            <tr key={i} className="hover:bg-surface-dark-highlight">
                                                <td className="px-6 py-4 font-bold text-danger font-display">Parada de Máquina</td>
                                                <td className="px-6 py-4">{s.motivo} <br /><span className="text-[10px] opacity-50 uppercase">Operador: {s.operadores?.nome}</span></td>
                                                <td className="px-6 py-4 text-text-sub-dark font-mono">{new Date(s.created_at).toLocaleTimeString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <h3 className="text-xl font-display font-black tracking-tight uppercase flex items-center gap-2 border-l-4 border-warning pl-4 mt-8">
                            Atividades de Qualidade
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.checklists.map((c, i) => (
                                <div key={i} className="bg-surface-dark border border-border-dark p-4 rounded-xl flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.status === 'ok' ? 'bg-secondary/10 text-secondary' : 'bg-danger/10 text-danger'}`}>
                                        <span className="material-icons">{c.status === 'ok' ? 'verified_user' : 'warning_amber'}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-tight">{c.tipo_acionamento}: {c.referencia_acionamento}</p>
                                        <p className="text-xs text-text-sub-dark">{c.observacao || 'Sem observações'}</p>
                                    </div>
                                </div>
                            ))}
                            {data.checklists.length === 0 && <p className="text-text-sub-dark italic p-4">Nenhum checklist registrado.</p>}
                        </div>
                    </div>

                    {/* Sidebar Info: Operators & Logbook */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-display font-black tracking-tight uppercase flex items-center gap-2 border-l-4 border-secondary pl-4">
                            Equipe Envolvida
                        </h3>
                        <div className="space-y-3">
                            {data.operators.map((op_rel, i) => (
                                <div key={i} className="bg-surface-dark-highlight p-4 rounded-xl border border-border-dark">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-black">{op_rel.operadores?.nome?.[0]}</div>
                                        <p className="font-bold text-sm tracking-tight">{op_rel.operadores?.nome}</p>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-text-sub-dark border-t border-border-dark pt-2">
                                        <span>INÍCIO: {new Date(op_rel.inicio).toLocaleTimeString()}</span>
                                        <span>{op_rel.fim ? `FIM: ${new Date(op_rel.fim).toLocaleTimeString()}` : 'ATIVO'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <h3 className="text-xl font-display font-black tracking-tight uppercase flex items-center gap-2 border-l-4 border-primary pl-4 mt-8">
                            Diário de Bordo
                        </h3>
                        <div className="space-y-3">
                            {data.logbook.map((log, i) => (
                                <div key={i} className="bg-background-dark p-4 rounded-xl border-l-2 border-primary">
                                    <p className="text-xs text-white leading-relaxed">{log.descricao}</p>
                                    <p className="text-[9px] text-text-sub-dark mt-2 font-mono">{new Date(log.created_at).toLocaleString()}</p>
                                </div>
                            ))}
                            {data.logbook.length === 0 && <p className="text-text-sub-dark italic">Nenhuma ocorrência registrada.</p>}
                        </div>
                    </div>

                </div>

                {/* Footer Audit Message */}
                <div className="pt-8 border-t border-border-dark text-center text-text-sub-dark">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Flux Vision Traceability Engine v1.0 • Registro Auditável em Supabase-DB</p>
                </div>
            </div>
        </div>
    );
};

export default TraceabilityPage;
