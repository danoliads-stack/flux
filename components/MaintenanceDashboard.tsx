import React, { useState, useEffect } from 'react';
import { MachineData, MachineStatus } from '../types';
import { supabase } from '../src/lib/supabase-client';

interface MaintenanceDashboardProps {
    machines: MachineData[];
}

interface MaintenanceInfo {
    machineId: string;
    description: string;
    startTime: string;
    operatorName?: string;
    priority?: string;
    status?: string;
    chamadoId?: string;
    opId?: string;
    opCodigo?: string;
}

// Helper for relative time (avoids date-fns dependency)
const getTimeSince = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `Há ${Math.floor(interval)} anos`;
    interval = seconds / 2592000;
    if (interval > 1) return `Há ${Math.floor(interval)} meses`;
    interval = seconds / 86400;
    if (interval > 1) return `Há ${Math.floor(interval)} dias`;
    interval = seconds / 3600;
    if (interval > 1) return `Há ${Math.floor(interval)} h`;
    interval = seconds / 60;
    if (interval > 1) return `Há ${Math.floor(interval)} min`;
    return 'Há instantes';
};

const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({ machines }) => {
    const [maintenanceInfos, setMaintenanceInfos] = useState<MaintenanceInfo[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch active maintenance details from chamados_manutencao table
    useEffect(() => {
        const fetchMaintenanceDetails = async () => {
            // Buscar chamados de manutenção ABERTOS (nova tabela separada)
            const { data: chamados, error } = await supabase
                .from('chamados_manutencao')
                .select(`
                    id,
                    maquina_id,
                    op_id,
                    descricao,
                    prioridade,
                    status,
                    data_abertura,
                    operadores (nome),
                    ordens_producao (codigo)
                `)
                .in('status', ['ABERTO', 'EM_ANDAMENTO'])
                .order('data_abertura', { ascending: false });

            if (error) {
                console.error('Erro ao buscar chamados:', error);
                setMaintenanceInfos([]);
                return;
            }

            if (!chamados || chamados.length === 0) {
                setMaintenanceInfos([]);
                return;
            }

            const infos: MaintenanceInfo[] = chamados.map(c => ({
                machineId: c.maquina_id,
                description: c.descricao,
                startTime: c.data_abertura,
                operatorName: (c.operadores as any)?.nome || 'Operador',
                priority: c.prioridade,
                status: c.status,
                chamadoId: c.id,
                opId: c.op_id,
                opCodigo: (c.ordens_producao as any)?.codigo
            }));

            setMaintenanceInfos(infos);
        };

        fetchMaintenanceDetails();
        // Poll every 10s
        const interval = setInterval(fetchMaintenanceDetails, 10000);
        return () => clearInterval(interval);

    }, [machines]);

    const getMaintenanceInfo = (machineId: string) => maintenanceInfos.find(i => i.machineId === machineId);

    return (
        <div className="min-h-screen bg-background-dark p-6">
            <div className="flex justify-between items-center mb-8 border-b border-border-dark pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="material-icons-outlined text-orange-500 text-4xl">engineering</span>
                        Painel de Manutenção
                    </h1>
                    <p className="text-text-sub-dark mt-1">Monitoramento em tempo real de solicitações</p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-bold text-white font-mono">{currentTime.toLocaleTimeString('pt-BR')}</div>
                    <div className="text-orange-500 font-bold uppercase text-sm tracking-wider">
                        {maintenanceInfos.length} {maintenanceInfos.length === 1 ? 'Chamado Ativo' : 'Chamados Ativos'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {machines.map(machine => {
                    const maintenanceInfo = getMaintenanceInfo(machine.id);
                    const isMaintenance = !!maintenanceInfo;

                    // Visual style: Fade out good machines, highlight maintenance ones
                    const opacityClass = isMaintenance ? 'opacity-100 scale-105 shadow-2xl shadow-orange-900/50 z-10' : 'opacity-40 grayscale scale-95';

                    return (
                        <div
                            key={machine.id}
                            className={`bg-surface-dark rounded-xl border-2 transition-all duration-500 relative overflow-hidden flex flex-col h-80 ${isMaintenance ? 'border-orange-500 animate-pulse-border' : 'border-border-dark opacity-60'}`}
                        >
                            {/* Header */}
                            <div className={`p-4 flex justify-between items-start ${isMaintenance ? 'bg-orange-500/10' : 'bg-surface-dark-highlight'}`}>
                                <div>
                                    <h2 className="text-xl font-bold text-white uppercase">{machine.nome}</h2>
                                    <p className="text-xs text-text-sub-dark">{machine.setores?.nome || 'Setor'}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isMaintenance ? 'bg-orange-500 text-black' : 'bg-green-500/20 text-green-500'}`}>
                                    {isMaintenance ? 'EM MANUTENÇÃO' : machine.status}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col justify-center items-center text-center">
                                {isMaintenance ? (
                                    <>
                                        <span className="material-icons-outlined text-5xl text-orange-500 mb-4 animate-bounce">build_circle</span>
                                        <div className="w-full bg-background-dark/50 p-3 rounded-lg border border-orange-500/30">
                                            <p className="text-xs text-orange-400 font-bold uppercase mb-1">Motivo do Chamado</p>
                                            <p className="text-white font-medium line-clamp-3 leading-snug">"{maintenanceInfo.description}"</p>
                                        </div>
                                    </>
                                ) : (
                                    <span className="material-icons-outlined text-6xl text-gray-700">check_circle</span>
                                )}
                            </div>

                            {/* Footer */}
                            {isMaintenance && (
                                <div className="p-4 bg-orange-500/20 border-t border-orange-500/30 text-xs space-y-2">
                                    {/* Linha 1: OP e Tempo */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-300 font-bold">
                                            {maintenanceInfo.opCodigo ? `OP: ${maintenanceInfo.opCodigo}` : 'Sem OP'}
                                        </span>
                                        <span className="text-orange-400">{getTimeSince(maintenanceInfo.startTime)}</span>
                                    </div>
                                    {/* Linha 2: Operador e Prioridade */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-white font-bold uppercase">
                                            <span className="material-icons-outlined text-xs mr-1 align-middle">person</span>
                                            {maintenanceInfo.operatorName || 'Operador'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${maintenanceInfo.priority === 'ALTA' ? 'bg-red-500 text-white' :
                                                maintenanceInfo.priority === 'BAIXA' ? 'bg-gray-500 text-white' :
                                                    'bg-orange-500 text-black'
                                            }`}>
                                            {maintenanceInfo.priority || 'NORMAL'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MaintenanceDashboard;
