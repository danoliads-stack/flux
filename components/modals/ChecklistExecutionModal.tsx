
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { ChecklistItem } from '../../types';

interface ChecklistExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    checklistId: string;
    opId?: string;
    operadorId: string;
    maquinaId: string;
    setorId: string;
    sessionId?: string | null;
    onSuccess?: () => void;
}

const ChecklistExecutionModal: React.FC<ChecklistExecutionModalProps> = ({
    isOpen,
    onClose,
    checklistId,
    opId,
    operadorId,
    maquinaId,
    setorId,
    sessionId,
    onSuccess
}) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [checklistNome, setChecklistNome] = useState('');
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [photos, setPhotos] = useState<Record<string, File>>({});
    const [globalComment, setGlobalComment] = useState('');
    const [globalPhoto, setGlobalPhoto] = useState<File | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && checklistId) fetchChecklistData();
        else {
            setAnswers({});
            setComments({});
            setPhotos({});
        }
    }, [isOpen, checklistId]);

    const fetchChecklistData = async () => {
        setLoading(true);
        try {
            const { data: modelo, error: modeloError } = await supabase
                .from('checklists')
                .select('nome')
                .eq('id', checklistId)
                .single();

            if (modeloError) throw modeloError;
            setChecklistNome(modelo.nome);

            const { data: itemsData, error: itemsError } = await supabase
                .from('checklist_items')
                .select('*')
                .eq('checklist_id', checklistId)
                .eq('ativo', true)
                .order('ordem');

            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Initialize answers
            const initialAnswers: Record<string, any> = {};
            itemsData?.forEach(item => {
                if (item.tipo_resposta === 'CHECKBOX') initialAnswers[item.id] = null;
                if (item.tipo_resposta === 'TEXTO') initialAnswers[item.id] = '';
                if (item.tipo_resposta === 'NUMERO') initialAnswers[item.id] = '';
            });
            setAnswers(initialAnswers);
        } catch (err) {
            console.error(err);
            alert('Erro ao carregar checklist');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Validação de itens obrigatórios
        for (const item of items) {
            if (item.obrigatorio) {
                const answer = answers[item.id];
                const hasPhoto = !!photos[item.id];

                // Check if answer exists (null/undefined/empty string are invalid for required)
                if (answer === null || answer === undefined || answer === '') {
                    alert(`O item "${item.descricao}" é obrigatório.`);
                    return;
                }

                // Check photo if it's a photo type item
                if (item.tipo_resposta === 'FOTO' && !hasPhoto) {
                    alert(`A foto para o item "${item.descricao}" é obrigatória.`);
                    return;
                }
            }
        }

        setSubmitting(true);
        let eventId: string | null = null;

        try {
            const isUUID = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

            // PASSO 1 - Criar evento via RPC (timestamp vem do banco)
            const { data: eventData, error: eventError } = await supabase.rpc('mes_insert_checklist', {
                p_checklist_id: checklistId,
                p_op_id: isUUID(opId) ? opId : null,
                p_maquina_id: isUUID(maquinaId) ? maquinaId : null,
                p_setor_id: isUUID(setorId) ? setorId : null,
                p_status: Object.values(answers).some(v => v === false || v === 'NAO') ? 'problema' : 'ok',
                p_observacao: globalComment || null,
                p_session_id: sessionId || null
            });

            if (eventError) throw eventError;
            eventId = eventData.id;

            // PASSO 1.5 — Upload de foto GLOBAL (do problema)
            if (globalPhoto) {
                const ext = globalPhoto.name.split('.').pop() || 'jpg';
                const path = `${eventId}/global_evidence.${ext}`;
                await supabase.storage.from('checklist-photos').upload(path, globalPhoto, { upsert: true });
                const { data: urlData } = supabase.storage.from('checklist-photos').getPublicUrl(path);

                await supabase.from('checklist_eventos').update({
                    foto_url: urlData.publicUrl
                }).eq('id', eventId);
            }

            // PASSO 2 — Processar cada item
            await Promise.all(items.map(async (item) => {
                let resposta: string;
                const currentAnswer = answers[item.id];

                // a) Normalizar resposta
                if (item.tipo_resposta === 'CHECKBOX') {
                    if (currentAnswer === true) resposta = 'SIM';
                    else if (currentAnswer === false) resposta = 'NAO';
                    else if (currentAnswer === 'NA') resposta = 'NA';
                    else throw new Error(`Item sem resposta Válida: ${item.descricao}`);
                } else if (item.tipo_resposta === 'FOTO') {
                    resposta = '[FOTO ENVIADA]';
                } else {
                    resposta = String(currentAnswer ?? '');
                }

                // b) Upload de foto (se existir)
                if (photos[item.id]) {
                    const file = photos[item.id];
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `${eventId}/${item.id}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                        .from('checklist-photos')
                        .upload(path, file, { upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabase.storage.from('checklist-photos').getPublicUrl(path);

                    // Save photo reference - only using columns that exist
                    const { error: photoError } = await supabase.from('checklist_fotos').insert({
                        checklist_evento_id: eventId,
                        url_foto: urlData.publicUrl
                    });

                    if (photoError) throw photoError;
                }

                // c) Salvar resposta
                const { error: respError } = await supabase.from('checklist_respostas').insert({
                    evento_id: eventId,
                    item_id: item.id,
                    resposta,
                    observacao: comments[item.id] || null
                });

                if (respError) throw respError;
            }));

            // alert('Checklist salvo com sucesso!');
            // if (onSuccess) onSuccess();
            // onClose();
            setSuccess(true);
            setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
            }, 1500);

        } catch (error: any) {
            console.error('Checklist Error:', error);

            // PASSO 3 — Rollback (Deletar evento se criado)
            if (eventId) {
                console.log('Rolling back event:', eventId);
                await supabase.from('checklist_eventos').delete().eq('id', eventId);
            }

            alert('Erro ao salvar checklist: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl border border-border-dark flex flex-col max-h-[90vh] animate-fade-in shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-border-dark bg-surface-dark-highlight rounded-t-xl flex justify-between items-center">
                    <div>
                        <h3 className="text-white text-xl font-bold uppercase tracking-wide flex items-center gap-2">
                            <span className="material-icons-outlined text-primary">fact_check</span>
                            {loading ? 'Carregando...' : checklistNome}
                        </h3>
                        <p className="text-xs text-text-sub-dark mt-1">Preencha todos os itens solicitados.</p>
                    </div>
                    <button onClick={onClose} className="text-text-sub-dark hover:text-white transition-colors">
                        <span className="material-icons-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-background-dark">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <span className="material-icons-outlined animate-spin text-3xl text-primary">sync</span>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div key={item.id} className="p-4 bg-surface-dark-highlight/50 rounded-lg border border-border-dark/50">
                                <div className="flex items-start gap-3 mb-3">
                                    <span className="flex items-center justify-center w-6 h-6 rounded bg-primary/20 text-primary text-xs font-bold font-mono">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <label className="text-white font-medium block">
                                            {item.descricao}
                                            {item.obrigatorio && <span className="text-danger ml-1">*</span>}
                                        </label>
                                    </div>
                                </div>

                                <div className="pl-9 space-y-4">
                                    {/* Input Types */}
                                    {item.tipo_resposta === 'CHECKBOX' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setAnswers(prev => ({ ...prev, [item.id]: true }))}
                                                className={`flex-1 py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-1 text-sm font-bold ${answers[item.id] === true ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-background-dark border-border-dark text-text-sub-dark hover:border-text-sub-dark'}`}
                                            >
                                                <span className="material-icons-outlined text-sm">check_circle</span>
                                                Sim
                                            </button>
                                            <button
                                                onClick={() => setAnswers(prev => ({ ...prev, [item.id]: false }))}
                                                className={`flex-1 py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-1 text-sm font-bold ${answers[item.id] === false ? 'bg-danger/20 border-danger text-danger' : 'bg-background-dark border-border-dark text-text-sub-dark hover:border-text-sub-dark'}`}
                                            >
                                                <span className="material-icons-outlined text-sm">cancel</span>
                                                Não
                                            </button>
                                            <button
                                                onClick={() => setAnswers(prev => ({ ...prev, [item.id]: 'NA' }))}
                                                className={`flex-1 py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-1 text-sm font-bold ${answers[item.id] === 'NA' ? 'bg-white/20 border-white text-white' : 'bg-background-dark border-border-dark text-text-sub-dark hover:border-text-sub-dark'}`}
                                            >
                                                <span className="material-icons-outlined text-sm">block</span>
                                                N/A
                                            </button>
                                        </div>
                                    )}

                                    {item.tipo_resposta === 'TEXTO' && (
                                        <input
                                            type="text"
                                            className="w-full bg-background-dark border border-border-dark rounded-lg py-2 px-4 text-white focus:ring-1 focus:ring-primary transition-all text-sm"
                                            placeholder="Digite sua resposta..."
                                            value={answers[item.id] || ''}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                    )}

                                    {item.tipo_resposta === 'NUMERO' && (
                                        <input
                                            type="number"
                                            className="w-full bg-background-dark border border-border-dark rounded-lg py-2 px-4 text-white focus:ring-1 focus:ring-primary transition-all font-mono text-sm"
                                            placeholder="0.00"
                                            value={answers[item.id] || ''}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                    )}

                                    {/* Additional Evidence: Photo and Comment for EVERY item */}
                                    <div className="flex flex-col gap-3 mt-2 pt-3 border-t border-border-dark/30">
                                        <div className="flex items-center gap-3">
                                            {/* Photo Button */}
                                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed transition-all cursor-pointer text-[11px] font-bold ${photos[item.id] ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-background-dark border-border-dark text-text-sub-dark hover:text-primary hover:border-primary/50'}`}>
                                                <span className="material-icons-outlined text-base">
                                                    {photos[item.id] ? 'check_circle' : 'add_a_photo'}
                                                </span>
                                                {photos[item.id] ? 'Foto Anexada' : 'Adicionar Foto'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            setPhotos(prev => ({ ...prev, [item.id]: e.target.files![0] }));
                                                        }
                                                    }}
                                                />
                                            </label>

                                            <input
                                                type="text"
                                                className="flex-1 bg-transparent border-b border-border-dark/50 py-1 px-2 text-[11px] text-text-sub-dark focus:text-white focus:border-primary focus:outline-none transition-all"
                                                placeholder="Observação / Descrição do problema..."
                                                value={comments[item.id] || ''}
                                                onChange={(e) => setComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Global Evidence Section */}
                    {!loading && (
                        <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                            <h4 className="text-white font-bold flex items-center gap-2">
                                <span className="material-icons-outlined text-primary">report_problem</span>
                                Evidência Geral do Problema (Opcional)
                            </h4>

                            <textarea
                                className="w-full bg-background-dark border border-border-dark rounded-lg py-3 px-4 text-white focus:ring-1 focus:ring-primary transition-all text-sm resize-none"
                                rows={3}
                                placeholder="Descreva observações gerais ou detalhes sobre falhas encontradas..."
                                value={globalComment}
                                onChange={(e) => setGlobalComment(e.target.value)}
                            />

                            <div className="flex items-center gap-4">
                                <label className={`flex flex-1 items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-all cursor-pointer text-sm font-bold ${globalPhoto ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-background-dark border-border-dark text-text-sub-dark hover:text-primary hover:border-primary/50'}`}>
                                    <span className="material-icons-outlined">
                                        {globalPhoto ? 'check_circle' : 'add_a_photo'}
                                    </span>
                                    {globalPhoto ? `Foto Selecionada: ${globalPhoto.name}` : 'Capturar Foto do Problema'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setGlobalPhoto(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </label>
                                {globalPhoto && (
                                    <button
                                        onClick={() => setGlobalPhoto(null)}
                                        className="p-3 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                    >
                                        <span className="material-icons-outlined">delete</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-dark bg-surface-dark-highlight rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-background-dark border border-border-dark text-white font-bold rounded-lg hover:bg-surface-dark-highlight transition-all text-sm"
                        disabled={submitting}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || loading}
                        className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-glow transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <span className="material-icons-outlined animate-spin text-lg">sync</span>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <span className="material-icons-outlined text-lg">save</span>
                                Finalizar Checklist
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Success Overlay */}
            {success && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-surface-dark/95 backdrop-blur-sm rounded-xl animate-fade-in">
                    <div className="flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6 animate-bounce">
                            <span className="material-icons-outlined text-6xl text-green-500">check_circle</span>
                        </div>
                        <h3 className="text-3xl font-display font-bold text-white mb-2">Checklist Realizado!</h3>
                        <p className="text-text-sub-dark">Registro salvo com sucesso.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChecklistExecutionModal;
