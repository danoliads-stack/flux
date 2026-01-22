import { InsightMetrics } from './insightsService';

export type Severity = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
export type Category = 'TREINAMENTO' | 'PADRONIZACAO' | 'MANUTENCAO' | 'QUALIDADE' | 'PROCESSO' | 'DADOS';

export interface Evidence {
    tipo: string;
    id: string;
    created_at: string;
}

export interface KaizenSuggestion {
    titulo: string;
    severidade: Severity;
    categoria: Category;
    justificativa: string;
    evidencias: Evidence[];
    acaoRecomendada: string;
}

export interface OperatorDifficulty {
    operadorId: string;
    operadorNome: string;
    nivel: 'ALTA' | 'MEDIA' | 'BAIXA';
    metricas: {
        taxa_nao_realizado: number;
        taxa_problema: number;
        paradas_count: number;
        diario_count: number;
    };
}

export interface KaizenReport {
    dificuldades: OperatorDifficulty[];
    sugestoes: KaizenSuggestion[];
    alertas: KaizenSuggestion[];
}

export const computeDifficulties = (
    checklists: any[],
    paradas: any[],
    diario: any[],
    operadoresMap: Record<string, string>
): OperatorDifficulty[] => {
    const opData: Record<string, any> = {};

    // Group by operator
    checklists.forEach(c => {
        const id = c.operador_id || 'unidentified';
        if (!opData[id]) opData[id] = { checklists: [], paradas: 0, diario: 0 };
        opData[id].checklists.push(c);
    });

    paradas.forEach(p => {
        const id = p.operador_id || 'unidentified';
        if (opData[id]) opData[id].paradas++;
    });

    diario.forEach(d => {
        const id = d.operador_id || 'unidentified';
        if (opData[id]) opData[id].diario++;
    });

    return Object.entries(opData).map(([id, data]) => {
        const total = data.checklists.length;
        const naoRealizado = data.checklists.filter((c: any) => c.status === 'NAO_REALIZADO' || c.status === 'nao_realizado').length;
        const problema = data.checklists.filter((c: any) => c.status === 'problema').length;

        const taxaNaoRealizado = total > 0 ? naoRealizado / total : 0;
        const taxaProblema = total > 0 ? problema / total : 0;

        let nivel: 'ALTA' | 'MEDIA' | 'BAIXA' = 'BAIXA';

        if (naoRealizado >= 2 || taxaNaoRealizado >= 0.20 || (taxaProblema >= 0.30 && total >= 6)) {
            nivel = 'ALTA';
        } else if (naoRealizado === 1 || (taxaProblema >= 0.15 && total >= 6)) {
            nivel = 'MEDIA';
        }

        return {
            operadorId: id,
            operadorNome: id === 'unidentified' ? 'Operador não identificado' : (operadoresMap[id] || id),
            nivel,
            metricas: {
                taxa_nao_realizado: taxaNaoRealizado,
                taxa_problema: taxaProblema,
                paradas_count: data.paradas,
                diario_count: data.diario
            }
        };
    });
};

export const generateKaizen = (
    metrics: InsightMetrics,
    checklists: any[],
    paradas: any[],
    diario: any[],
    difficulties: OperatorDifficulty[]
): KaizenReport => {
    const sugestoes: KaizenSuggestion[] = [];
    const alertas: KaizenSuggestion[] = [];

    // 1. Check Adherence (NAO_REALIZADO)
    if (metrics.checklists_nao_realizado >= 2) {
        const evidence = checklists
            .filter(c => c.status === 'NAO_REALIZADO' || c.status === 'nao_realizado')
            .map(c => ({ tipo: 'Checklist Não Realizado', id: c.id, created_at: c.created_at }));

        const sug: KaizenSuggestion = {
            titulo: 'Reforçar Disciplina e Autocontrole',
            severidade: 'ALTA',
            categoria: 'PADRONIZACAO',
            justificativa: `Foram identificados ${metrics.checklists_nao_realizado} esquecimentos de checklist. A falta de registro impede a rastreabilidade real do processo.`,
            evidencias: evidence,
            acaoRecomendada: 'Realizar um "Diálogo Diário de Segurança e Qualidade" focado na importância do registro em tempo real para evitar perdas de informação.'
        };
        sugestoes.push(sug);
        if (metrics.checklists_nao_realizado >= 3) alertas.push({ ...sug, severidade: 'CRITICA', titulo: 'ALERTA: Quebra de Padrão Operacional' });
    }

    // 2. Recurrent Problems
    const problemCounts: Record<string, { count: number; ids: string[]; dates: string[] }> = {};
    checklists.filter(c => c.status === 'problema').forEach(c => {
        const key = c.checklists?.nome || 'Item Indefinido';
        if (!problemCounts[key]) problemCounts[key] = { count: 0, ids: [], dates: [] };
        problemCounts[key].count++;
        problemCounts[key].ids.push(c.id);
        problemCounts[key].dates.push(c.created_at);
    });

    Object.entries(problemCounts).forEach(([item, data]) => {
        if (data.count >= 3) {
            const sug: KaizenSuggestion = {
                titulo: `Eliminar Causa Raiz de Falha: ${item}`,
                severidade: data.count >= 5 ? 'CRITICA' : 'ALTA',
                categoria: 'QUALIDADE',
                justificativa: `O item "${item}" falhou ${data.count} vezes. Isso indica uma instabilidade crônica no setup ou componente.`,
                evidencias: data.ids.map((id, i) => ({ tipo: 'Falha Recorrente', id, created_at: data.dates[i] })),
                acaoRecomendada: 'Aplicar a metodologia dos "5 Porquês". Verificar se há desgaste prematuro de peças ou variação na matéria-prima.'
            };
            sugestoes.push(sug);
            if (data.count >= 5) alertas.push(sug);
        }
    });

    // 3. Repeated Stops
    const stopCounts: Record<string, { count: number; ids: string[]; dates: string[] }> = {};
    paradas.forEach(p => {
        const key = p.motivo || 'Motivo não informado';
        if (!stopCounts[key]) stopCounts[key] = { count: 0, ids: [], dates: [] };
        stopCounts[key].count++;
        stopCounts[key].ids.push(p.id);
        stopCounts[key].dates.push(p.created_at);
    });

    Object.entries(stopCounts).forEach(([motivo, data]) => {
        if (data.count >= 2) {
            sugestoes.push({
                titulo: `Otimizar Disponibilidade: ${motivo}`,
                severidade: 'ALTA',
                categoria: 'MANUTENCAO',
                justificativa: `A máquina parou ${data.count} vezes pelo mesmo motivo (${motivo}). Isso impacta diretamente o OEE.`,
                evidencias: data.ids.map((id, i) => ({ tipo: 'Parada Recorrente', id, created_at: data.dates[i] })),
                acaoRecomendada: 'Avaliar a necessidade de uma intervenção técnica preventiva. O custo da parada recorrente supera o custo do reparo planejado.'
            });
        }
    });

    // 4. Diary Overload
    if (diario.length >= 10) {
        sugestoes.push({
            titulo: 'Simplificar Registros Operacionais',
            severidade: 'MEDIA',
            categoria: 'TREINAMENTO',
            justificativa: `Volume alto de registros manuais (${diario.length}). Isso consome tempo produtivo do operador.`,
            evidencias: diario.slice(0, 5).map(d => ({ tipo: 'Evento Diário', id: d.id, created_at: d.created_at })),
            acaoRecomendada: 'Verificar se existem novos tipos de ocorrências que poderiam ser automatizados ou transformados em botões rápidos no painel.'
        });
    }

    // 5. Operator Identification Issue
    const unidentified = difficulties.find(d => d.operadorId === 'unidentified');
    if (unidentified && unidentified.metricas.taxa_nao_realizado > 0) {
        sugestoes.push({
            titulo: 'Garantir Rastreabilidade de Pessoas',
            severidade: 'MEDIA',
            categoria: 'DADOS',
            justificativa: 'Existem falhas de processo que não podem ser atribuídas a um responsável para feedback.',
            evidencias: unidentified.metricas.taxa_nao_realizado > 0 ? [{ tipo: 'Falha de Identificação', id: 'SISTEMA', created_at: new Date().toISOString() }] : [],
            acaoRecomendada: 'Auditarem o uso de crachás/logins no terminal e garantir que nenhum operador inicie o turno sem se identificar.'
        });
    }

    return {
        dificuldades: difficulties.sort((a, b) => {
            const rank = { ALTA: 3, MEDIA: 2, BAIXA: 1 };
            return rank[b.nivel] - rank[a.nivel];
        }),
        sugestoes: sugestoes.sort((a, b) => {
            const rank = { CRITICA: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };
            return rank[b.severidade] - rank[a.severidade];
        }),
        alertas
    };
};
