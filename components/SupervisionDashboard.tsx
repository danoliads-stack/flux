
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MachineStatus, MachineData } from '../types';
import { supabase } from '../supabase';

interface SupervisionDashboardProps {
  machines: MachineData[];
}

interface Turno {
  id: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
}

interface ScrapData {
  opCode: string;
  machineName: string;
  scrapRate: number;
  scrapQty: number;
}

interface OperatorProduction {
  operatorId: string;
  operatorName: string;
  totalProduced: number;
}

// Tradução de status para português
const translateStatus = (status: string | undefined): string => {
  const translations: Record<string, string> = {
    'RUNNING': 'Produzindo',
    'IN_USE': 'Em Uso',
    'STOPPED': 'Parada',
    'MAINTENANCE': 'Manutenção',
    'SETUP': 'Setup',
    'SUSPENDED': 'Suspensa',
    'AVAILABLE': 'Disponível',
    'IDLE': 'Ociosa'
  };
  return translations[status || ''] || status || 'Desconhecido';
};

// Calcular tempo desde última atualização
const getTimeSince = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return `${hours}h${mins > 0 ? `${mins}min` : ''}`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};


const SupervisionDashboard: React.FC<SupervisionDashboardProps> = ({ machines }) => {
  const [currentTurno, setCurrentTurno] = useState<Turno | null>(null);
  const [turnoStartTime, setTurnoStartTime] = useState<Date | null>(null);
  const [opsFinalizadas, setOpsFinalizadas] = useState(0);
  const [totalProduzido, setTotalProduzido] = useState(0);
  const [scrapData, setScrapData] = useState<ScrapData[]>([]);
  const [operatorProduction, setOperatorProduction] = useState<OperatorProduction[]>([]);

  // Find current turno based on current time
  useEffect(() => {
    const findCurrentTurno = async () => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      const { data: turnos } = await supabase
        .from('turnos')
        .select('*')
        .eq('ativo', true)
        .order('hora_inicio');

      if (turnos && turnos.length > 0) {
        const activeTurno = turnos.find(t => {
          const inicio = t.hora_inicio.substring(0, 5);
          const fim = t.hora_fim.substring(0, 5);
          if (inicio > fim) {
            return currentTime >= inicio || currentTime < fim;
          }
          return currentTime >= inicio && currentTime < fim;
        });

        if (activeTurno) {
          setCurrentTurno(activeTurno);
          const [h, m] = activeTurno.hora_inicio.split(':').map(Number);
          const turnoStart = new Date();
          turnoStart.setHours(h, m, 0, 0);
          const inicioStr = activeTurno.hora_inicio.substring(0, 5);
          const fimStr = activeTurno.hora_fim.substring(0, 5);
          if (inicioStr > fimStr && currentTime < inicioStr) {
            turnoStart.setDate(turnoStart.getDate() - 1);
          }
          setTurnoStartTime(turnoStart);
        }
      }
    };
    findCurrentTurno();
  }, []);

  // Fetch shift data when turno is identified
  const fetchShiftData = useCallback(async () => {
    if (!turnoStartTime) return;
    const turnoStartISO = turnoStartTime.toISOString();

    const { count: finishedCount } = await supabase
      .from('ordens_producao')
      .select('id', { count: 'exact' })
      .eq('status', 'FINALIZADA')
      .gte('data_fim', turnoStartISO);
    setOpsFinalizadas(finishedCount || 0);

    const { data: producaoData } = await supabase
      .from('registros_producao')
      .select('quantidade_boa, quantidade_refugo, operador_id, op_id, maquina_id, ordens_producao(codigo), maquinas(nome), operadores(nome)')
      .gte('created_at', turnoStartISO);

    if (producaoData && producaoData.length > 0) {
      const totalBoas = producaoData.reduce((acc, r) => acc + (r.quantidade_boa || 0), 0);
      setTotalProduzido(totalBoas);

      const scrapMap = new Map<string, { opCode: string; machineName: string; scrapQty: number; goodQty: number }>();
      producaoData.forEach(r => {
        const op = r.ordens_producao as any;
        const maq = r.maquinas as any;
        const key = `${op?.codigo || 'N/A'}-${maq?.nome || 'N/A'}`;
        const existing = scrapMap.get(key) || { opCode: op?.codigo || 'N/A', machineName: maq?.nome || 'N/A', scrapQty: 0, goodQty: 0 };
        existing.scrapQty += r.quantidade_refugo || 0;
        existing.goodQty += r.quantidade_boa || 0;
        scrapMap.set(key, existing);
      });

      const scrapResult: ScrapData[] = Array.from(scrapMap.values())
        .map(s => ({ opCode: s.opCode, machineName: s.machineName, scrapQty: s.scrapQty, scrapRate: s.goodQty + s.scrapQty > 0 ? (s.scrapQty / (s.goodQty + s.scrapQty)) * 100 : 0 }))
        .filter(s => s.scrapQty > 0)
        .sort((a, b) => b.scrapRate - a.scrapRate)
        .slice(0, 3);
      setScrapData(scrapResult);

      const operadorMap = new Map<string, { name: string; total: number }>();
      producaoData.forEach(r => {
        const op = r.operadores as any;
        const opId = r.operador_id;
        if (opId) {
          const existing = operadorMap.get(opId) || { name: op?.nome || 'Operador', total: 0 };
          existing.total += r.quantidade_boa || 0;
          operadorMap.set(opId, existing);
        }
      });

      const operatorResult: OperatorProduction[] = Array.from(operadorMap.entries())
        .map(([id, data]) => ({ operatorId: id, operatorName: data.name, totalProduced: data.total }))
        .sort((a, b) => b.totalProduced - a.totalProduced)
        .slice(0, 5);
      setOperatorProduction(operatorResult);
    } else {
      setTotalProduzido(0);
      setScrapData([]);
      setOperatorProduction([]);
    }
  }, [turnoStartTime]);

  useEffect(() => {
    fetchShiftData();
    const channel = supabase
      .channel('shift-production-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao' }, () => fetchShiftData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_producao' }, () => fetchShiftData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchShiftData]);

  const stats = useMemo(() => {
    return {
      running: machines.filter(m => m.status_atual === MachineStatus.RUNNING || m.status_atual === MachineStatus.IN_USE).length,
      stopped: machines.filter(m => m.status_atual === MachineStatus.STOPPED || m.status_atual === MachineStatus.MAINTENANCE).length,
      totalOee: (machines.reduce((acc, m) => acc + (m.oee || 0), 0) / (machines.length || 1)).toFixed(1)
    };
  }, [machines]);


  return (
    <div className="p-6 md:p-10 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display font-bold tracking-tight text-white uppercase">Status Geral do Turno</h2>
          {currentTurno && (
            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
              {currentTurno.nome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-sub-dark uppercase tracking-widest font-bold">OEE Global:</span>
          <span className="text-xl font-display font-bold text-secondary">{stats.totalOee}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Máquinas Rodando', val: stats.running, icon: 'settings_motion_mode', color: 'text-secondary', progress: (stats.running / machines.length) * 100 },
          { label: 'Máquinas Paradas', val: stats.stopped, icon: 'warning', color: 'text-danger', progress: (stats.stopped / machines.length) * 100 },
          { label: 'OPs em Andamento', val: machines.filter(m => m.op_atual_id).length, icon: 'play_circle', color: 'text-primary' },
          { label: 'Total Produzido', val: totalProduzido, icon: 'inventory_2', color: 'text-blue-400' },
          { label: 'OPs Finalizadas', val: opsFinalizadas, icon: 'check_circle', color: 'text-secondary' },
          { label: 'Alertas Ativos', val: stats.stopped > 0 ? stats.stopped : 0, icon: 'notifications_active', color: 'text-orange-500', alerts: stats.stopped > 0 }
        ].map((kpi, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-xl p-5 border border-border-dark bg-surface-dark shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className={`material-symbols-outlined text-5xl ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <p className="text-text-sub-dark text-[10px] font-bold uppercase tracking-widest">{kpi.label}</p>
            <p className="text-3xl font-bold text-white transition-all duration-300">{kpi.val}</p>
            {kpi.progress !== undefined && (
              <div className="h-1 w-full bg-background-dark mt-2 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${kpi.color.replace('text-', 'bg-')}`} style={{ width: `${kpi.progress}%` }}></div>
              </div>
            )}
            {kpi.alerts && (
              <div className="flex gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Mapa Operacional (Live)</h2>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-secondary/10 text-secondary border border-secondary/20 uppercase tracking-widest">Rodando</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20 uppercase tracking-widest">Setup</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-danger/10 text-danger border border-danger/20 uppercase tracking-widest">Parado</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {machines
              .sort((a, b) => {
                const priority = (status: string | undefined) => {
                  switch (status) {
                    case 'RUNNING': case 'IN_USE': return 0;
                    case 'SETUP': return 1;
                    case 'STOPPED': case 'MAINTENANCE': return 2;
                    case 'SUSPENDED': return 3;
                    default: return 4;
                  }
                };
                return priority(a.status_atual) - priority(b.status_atual);
              })
              .map((m) => {
                // Map DB status to UI logic
                const isActive = m.status_atual === MachineStatus.RUNNING || m.status_atual === MachineStatus.IN_USE;
                const isStopped = m.status_atual === MachineStatus.STOPPED || m.status_atual === MachineStatus.MAINTENANCE;
                const isSetup = m.status_atual === MachineStatus.SETUP;
                const isSuspended = m.status_atual === MachineStatus.SUSPENDED;

                // Safe value access
                const productionCount = m.realized ?? 0;
                const oeeValue = m.oee ?? 0;
                const currentOp = m.ordens_producao?.codigo || (m.op_atual_id ? 'Carregando...' : '--');

                return (
                  <div key={m.id} className={`bg-surface-dark rounded-lg border border-l-4 p-3 hover:shadow-glow transition-all cursor-pointer group ${isActive ? 'border-l-secondary' :
                    isStopped ? 'border-l-danger border-danger/20' :
                      isSetup ? 'border-l-warning' :
                        isSuspended ? 'border-l-orange-500' : 'border-l-text-sub-dark'
                    }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{m.nome}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-secondary' :
                            isStopped ? 'text-danger' :
                              isSetup ? 'text-warning' :
                                isSuspended ? 'text-orange-500' : 'text-text-sub-dark'
                            }`}>
                            <span className="material-icons-outlined text-[10px]">{
                              isActive ? 'settings_motion_mode' :
                                isStopped ? 'warning' :
                                  isSetup ? 'build' :
                                    isSuspended ? 'pause_circle' : 'check_circle'
                            }</span> {translateStatus(m.status_atual)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-white tabular-nums bg-white/5 px-1.5 py-0.5 rounded">
                          {oeeValue.toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {isStopped && (
                      <div className="bg-danger/5 border border-danger/10 rounded p-1.5 mb-2">
                        <p className="text-[9px] text-danger font-bold uppercase">Motivo:</p>
                        <p className="text-[10px] text-white truncate">{m.stopReason || 'Aguardando justificativa...'}</p>
                      </div>
                    )}

                    <div className="space-y-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border border-primary/20">
                            {(m.operadores as any)?.nome?.charAt(0) || '?'}
                          </div>
                          <span className="text-[10px] font-bold text-white truncate">{(m.operadores as any)?.nome || 'Sem Operador'}</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-text-sub-dark uppercase tracking-tight font-medium">Prod. Turno</span>
                          <span className="text-primary font-mono font-bold">
                            {operatorProduction.find(op => op.operatorId === m.operador_atual_id)?.totalProduced || 0} un
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between text-[9px] mb-1">
                          <span className="text-text-sub-dark uppercase font-medium">OP: {currentOp}</span>
                          <span className="text-white font-bold">{productionCount} un</span>
                        </div>
                        <div className="h-1 w-full bg-background-dark rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-700 ${isActive ? 'bg-secondary' : 'bg-surface-dark-highlight'}`} style={{ width: '60%' }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border-dark pt-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.operadores?.nome ? (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-white border border-border-dark shrink-0">
                            {m.operadores.nome.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-surface-dark-highlight flex items-center justify-center text-[8px] shrink-0">--</div>
                        )}
                        <span className="text-[10px] text-text-sub-dark truncate">{m.operadores?.nome || 'S/ Op'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="w-full xl:w-[320px] shrink-0 space-y-6">
          <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Performance do Turno</h2>

          <div className="bg-surface-dark rounded-xl border border-border-dark p-6 h-full">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-icons-outlined text-primary">groups</span>
              Produção p/ Operador
            </h3>
            <div className="space-y-6">
              {operatorProduction.length > 0 ? operatorProduction.map((op, i) => {
                const maxProduced = operatorProduction[0]?.totalProduced || 1;
                return (
                  <div key={op.operatorId} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-surface-dark-highlight border border-border-dark flex items-center justify-center text-xs font-bold text-white group-hover:border-primary/50 transition-colors">
                      {op.operatorName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-white group-hover:text-primary transition-colors">{op.operatorName}</span>
                        <span className="text-primary tabular-nums font-mono">{op.totalProduced} un</span>
                      </div>
                      <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${Math.min(100, (op.totalProduced / maxProduced) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center text-text-sub-dark text-xs py-8 border border-dashed border-border-dark rounded-lg">
                  <span className="material-icons-outlined text-3xl mb-2 block opacity-30">person_off</span>
                  Nenhuma produção registrada neste turno
                </div>
              )}
            </div>
            {operatorProduction.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border-dark">
                <p className="text-[10px] text-text-sub-dark uppercase tracking-widest font-bold mb-1">Média por Operador</p>
                <p className="text-xl font-display font-bold text-white">
                  {(operatorProduction.reduce((acc, curr) => acc + curr.totalProduced, 0) / operatorProduction.length).toFixed(0)} <span className="text-xs text-text-sub-dark font-sans font-normal">un/turno</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisionDashboard;
