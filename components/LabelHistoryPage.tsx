import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../src/lib/supabase-client';
import { Etiqueta, ChecklistLabelData, PalletLabelData, ChecklistSnapshot } from '../types';

const LabelHistoryPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [label, setLabel] = useState<Etiqueta | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLabel = async () => {
            if (!id) {
                setError('ID da etiqueta não fornecido');
                setLoading(false);
                return;
            }

            // Try to find by ID or by qr_code_data
            let query = supabase
                .from('etiquetas')
                .select(`
          *,
          ordens_producao(codigo, nome_produto),
          maquinas(nome, codigo),
          operadores(nome, matricula),
          setores(nome)
        `);

            // Simple UUID regex check
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            if (isUUID) {
                // If it looks like a UUID, search either column just in case
                query = query.or(`id.eq.${id},qr_code_data.eq.${id}`);
            } else {
                // If not a UUID, exact match on qr_code_data only
                query = query.eq('qr_code_data', id);
            }

            const { data, error: fetchError } = await query.maybeSingle();

            if (fetchError) {
                console.error('Error fetching label:', fetchError);
                setError('Erro ao buscar etiqueta');
            } else if (!data) {
                setError('Etiqueta não encontrada');
            } else {
                setLabel(data as Etiqueta);
            }

            setLoading(false);
        };

        fetchLabel();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-icons animate-spin text-4xl text-primary">sync</span>
                    <p className="text-text-sub-dark">Carregando etiqueta...</p>
                </div>
            </div>
        );
    }

    if (error || !label) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
                <div className="bg-surface-dark rounded-2xl border border-border-dark p-8 text-center max-w-md">
                    <span className="material-icons text-5xl text-danger mb-4">error_outline</span>
                    <h1 className="text-white text-xl font-bold mb-2">Etiqueta não encontrada</h1>
                    <p className="text-text-sub-dark text-sm mb-6">{error || 'A etiqueta solicitada não existe no sistema.'}</p>
                    <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary-hover transition-all">
                        <span className="material-icons">home</span>
                        Voltar ao início
                    </Link>
                </div>
            </div>
        );
    }

    const isChecklist = label.tipo_etiqueta === 'CHECKLIST';
    const dados = label.dados_manualmente_preenchidos;
    const checklistData = isChecklist ? dados as ChecklistLabelData : null;
    const palletData = !isChecklist ? dados as PalletLabelData : null;
    const checklistSnapshot = label.checklist_snapshot as ChecklistSnapshot[] | null;

    return (
        <div className="min-h-screen bg-background-dark text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link to="/" className="flex items-center gap-2 text-text-sub-dark hover:text-white transition-colors">
                        <span className="material-icons">arrow_back</span>
                        <span className="text-sm font-bold">Voltar</span>
                    </Link>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isChecklist ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                        {isChecklist ? 'Checklist' : 'Pallet'}
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden">

                    {/* Title Section */}
                    <div className={`p-6 border-b border-border-dark ${isChecklist ? 'bg-blue-500/5' : 'bg-orange-500/5'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isChecklist ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                }`}>
                                <span className="material-icons-outlined text-3xl">
                                    {isChecklist ? 'fact_check' : 'inventory_2'}
                                </span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black">
                                    Etiqueta #{label.numero_etiqueta}
                                </h1>
                                <p className="text-text-sub-dark text-sm">
                                    {isChecklist ? 'Etiqueta de Checklist (Caixa)' : 'Etiqueta de Pallet (Processo)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Left Column: Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-text-sub-dark text-xs font-black uppercase tracking-widest mb-3">
                                Informações da Produção
                            </h3>

                            <div className="bg-background-dark rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold">Ordem de Produção</span>
                                    <span className="font-black text-lg text-primary font-mono">
                                        {label.ordens_producao?.codigo || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold">Produto</span>
                                    <span className="font-bold text-sm">
                                        {label.ordens_producao?.nome_produto || 'N/A'}
                                    </span>
                                </div>
                                <div className="border-t border-border-dark my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold">Máquina</span>
                                    <span className="font-bold">{label.maquinas?.nome || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold">Setor</span>
                                    <span className="font-bold">{label.setores?.nome || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold">Operador</span>
                                    <span className="font-bold">
                                        {label.operadores?.nome || 'N/A'}
                                        {label.operadores?.matricula && (
                                            <span className="text-text-sub-dark text-xs ml-1">({label.operadores.matricula})</span>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Timestamp */}
                            <div className="bg-background-dark rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons text-text-sub-dark">schedule</span>
                                    <div>
                                        <span className="text-text-sub-dark text-xs uppercase font-bold block">Data/Hora do Disparo</span>
                                        <span className="font-bold">
                                            {new Date(label.created_at).toLocaleDateString('pt-BR')} às {' '}
                                            {new Date(label.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Manual Data */}
                        <div className="space-y-4">
                            <h3 className="text-text-sub-dark text-xs font-black uppercase tracking-widest mb-3">
                                Dados Manuais Preenchidos
                            </h3>

                            {isChecklist && checklistData && (
                                <div className={`rounded-xl p-6 border-2 border-blue-500/30 bg-blue-500/5`}>
                                    <span className="text-blue-400 text-xs uppercase font-black tracking-widest block mb-2">
                                        Quantidade Analisada
                                    </span>
                                    <span className="text-5xl font-black text-white">
                                        {checklistData.quantidade_analisada}
                                    </span>
                                </div>
                            )}

                            {!isChecklist && palletData && (
                                <div className="rounded-xl p-6 border-2 border-orange-500/30 bg-orange-500/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-400 text-xs uppercase font-black tracking-widest">Lote</span>
                                        <span className="font-black text-xl font-mono">{palletData.lote}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-black/20 rounded-lg p-3">
                                            <span className="text-text-sub-dark text-[10px] uppercase font-bold block mb-1">Qtd/Caixa</span>
                                            <span className="text-2xl font-black">{palletData.quantidade_por_caixa}</span>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-3">
                                            <span className="text-text-sub-dark text-[10px] uppercase font-bold block mb-1">Caixas</span>
                                            <span className="text-2xl font-black">{palletData.quantidade_caixas}</span>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-3">
                                            <span className="text-text-sub-dark text-[10px] uppercase font-bold block mb-1">Total</span>
                                            <span className="text-2xl font-black text-orange-400">{palletData.quantidade_total}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* QR Code */}
                            <div className="bg-background-dark rounded-xl p-4 flex items-center gap-4">
                                <div className="bg-white p-2 rounded-lg">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(label.qr_code_data)}`}
                                        alt="QR Code"
                                        className="w-16 h-16"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-text-sub-dark text-xs uppercase font-bold block mb-1">Código de Rastreio</span>
                                    <span className="text-xs font-mono text-text-sub-dark break-all">{label.qr_code_data}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checklist Snapshot Section */}
                    {isChecklist && checklistSnapshot && checklistSnapshot.length > 0 && (
                        <div className="p-6 border-t border-border-dark">
                            <h3 className="text-text-sub-dark text-xs font-black uppercase tracking-widest mb-4">
                                Status dos Checklists no Momento da Emissão
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {checklistSnapshot.map((snapshot, index) => (
                                    <div key={index} className="bg-background-dark rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <span className="text-white font-bold block">{snapshot.checklist_nome}</span>
                                            <span className="text-text-sub-dark text-xs">
                                                {new Date(snapshot.ultimo_evento_at).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${snapshot.status === 'ok' ? 'bg-green-500/20 text-green-400' :
                                            snapshot.status === 'NAO_REALIZADO' ? 'bg-red-500/20 text-red-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {snapshot.status === 'ok' ? 'OK' :
                                                snapshot.status === 'NAO_REALIZADO' ? 'Não Realizado' :
                                                    snapshot.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="p-4 bg-background-dark/50 border-t border-border-dark text-center">
                        <p className="text-text-sub-dark text-xs">
                            Etiqueta ID: <span className="font-mono">{label.id}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabelHistoryPage;
