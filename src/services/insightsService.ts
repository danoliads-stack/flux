import { supabase } from '../lib/supabase-client';
import { MachineStatus, ChecklistEvento, DiarioBordoEvento } from '../../types';

export interface InsightMetrics {
    total_checklists: number;
    checklists_ok: number;
    checklists_problema: number;
    checklists_nao_realizado: number;
    total_paradas: number;
    total_diario_eventos: number;
}

export interface MachineInsight {
    machineId: string;
    machineName: string;
    risk: 'VERDE' | 'AMARELO' | 'VERMELHO';
    summary: string;
    metrics: InsightMetrics;
    topIssues: { item: string; count: number }[];
    lastEvents: { timestamp: string; type: string; detail: string }[];
}

export const fetchMachineInsights = async (
    startDate: string,
    endDate: string,
    machineId?: string
): Promise<MachineInsight[]> => {
    // 1. Fetch Machines
    let machineQuery = supabase.from('maquinas').select('id, nome');
    if (machineId) {
        machineQuery = machineQuery.eq('id', machineId);
    }
    const { data: machines } = await machineQuery;

    if (!machines) return [];

    // 2. Fetch Data in parallel for all machines in the period
    const [checklists, paradas, diarioEvents] = await Promise.all([
        supabase
            .from('checklist_eventos')
            .select('*, checklists(nome)')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .limit(1000),
        supabase
            .from('paradas')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .limit(1000),
        // Fallback detection for diary table
        fetchDiaryEvents(startDate, endDate)
    ]);

    const insights: MachineInsight[] = machines.map(m => {
        const mChecklists = checklists.data?.filter(c => c.maquina_id === m.id) || [];
        const mParadas = paradas.data?.filter(p => p.maquina_id === m.id) || [];
        const mDiario = diarioEvents.filter(d => d.maquina_id === m.id);

        const metrics: InsightMetrics = {
            total_checklists: mChecklists.length,
            checklists_ok: mChecklists.filter(c => c.status === 'ok').length,
            checklists_problema: mChecklists.filter(c => c.status === 'problema').length,
            checklists_nao_realizado: mChecklists.filter(c => c.status === 'NAO_REALIZADO' || c.status === 'nao_realizado').length,
            total_paradas: mParadas.length,
            total_diario_eventos: mDiario.length
        };

        const risk = computeRisk(metrics);

        // Top issues from checklists (using checklist name as proxy for item since checklist_respostas might be complex)
        const problemChecklists = mChecklists.filter(c => c.status === 'problema');
        const issueCounts: Record<string, number> = {};
        problemChecklists.forEach(c => {
            const name = (c as any).checklists?.nome || 'Checklist Indefinido';
            issueCounts[name] = (issueCounts[name] || 0) + 1;
        });
        const topIssues = Object.entries(issueCounts)
            .map(([item, count]) => ({ item, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Last events
        const allEvents = [
            ...mChecklists.map(c => ({ timestamp: c.created_at, type: 'Checklist', detail: (c as any).checklists?.nome || 'Checklist' })),
            ...mParadas.map(p => ({ timestamp: p.created_at, type: 'Parada', detail: p.motivo || 'Parada registrada' })),
            ...mDiario.map(d => ({ timestamp: d.created_at, type: 'Diário', detail: d.descricao }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const lastEvents = allEvents.slice(0, 3);

        const summary = buildSummary(metrics, topIssues, lastEvents, startDate, endDate);

        return {
            machineId: m.id,
            machineName: m.nome,
            risk,
            summary,
            metrics,
            topIssues,
            lastEvents
        };
    });

    return insights;
};

const fetchDiaryEvents = async (startDate: string, endDate: string): Promise<any[]> => {
    // Try diario_bordo_eventos first
    const { data: data1 } = await supabase
        .from('diario_bordo_eventos')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(500);

    if (data1) return data1;

    // Fallback to diario_de_maquina_eventos
    const { data: data2 } = await supabase
        .from('diario_de_maquina_eventos')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(500);

    return data2 || [];
};

export const computeRisk = (metrics: InsightMetrics): 'VERDE' | 'AMARELO' | 'VERMELHO' => {
    const { total_checklists, checklists_problema, checklists_nao_realizado, total_paradas } = metrics;

    const problemRate = total_checklists > 0 ? checklists_problema / total_checklists : 0;

    // RED
    if (
        checklists_nao_realizado >= 2 ||
        (problemRate >= 0.25 && total_checklists >= 4) ||
        total_paradas >= 3
    ) {
        return 'VERMELHO';
    }

    // YELLOW
    if (
        checklists_nao_realizado === 1 ||
        (problemRate >= 0.10 && total_checklists >= 4) ||
        total_paradas === 2
    ) {
        return 'AMARELO';
    }

    return 'VERDE';
};

export const buildSummary = (
    metrics: InsightMetrics,
    topIssues: { item: string; count: number }[],
    lastEvents: { timestamp: string; type: string; detail: string }[],
    startDate: string,
    endDate: string
): string => {
    const { checklists_ok, checklists_problema, checklists_nao_realizado, total_paradas } = metrics;

    const periodLabel = `${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`;

    let summary = `Período: ${periodLabel}\n`;
    summary += `Checklists: OK=${checklists_ok} | Problema=${checklists_problema} | Não realizado=${checklists_nao_realizado}\n`;
    summary += `Paradas: ${total_paradas}\n`;

    if (topIssues.length > 0) {
        summary += `Pontos de atenção: ${topIssues.map(i => i.item).join(', ')}\n`;
    } else {
        summary += `Pontos de atenção: Nenhum problema recorrente detectado.\n`;
    }

    if (lastEvents.length > 0) {
        const last = lastEvents[0];
        summary += `Último registro: ${new Date(last.timestamp).toLocaleString('pt-BR')} (${last.type})\n`;
    }

    // Recommendations
    if (checklists_nao_realizado > 0) {
        summary += `Recomendação: Reforçar com a equipe a obrigatoriedade dos checklists.`;
    } else if (checklists_problema > 0) {
        summary += `Recomendação: Programar revisão preventiva nos itens com problemas recorrentes.`;
    } else if (total_paradas > 2) {
        summary += `Recomendação: Investigar causas raiz do alto volume de paradas no período.`;
    } else {
        summary += `Recomendação: Manter o padrão de operação atual.`;
    }

    return summary;
};
