
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

// Componente de Cronômetro para cada máquina
const StatusTimer: React.FC<{ statusChangeAt?: string; status: string }> = ({ statusChangeAt, status }) => {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!statusChangeAt || status === 'AVAILABLE' || status === 'IDLE') {
      setElapsed('00:00:00');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const start = new Date(statusChangeAt).getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));

      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [statusChangeAt, status]);

  if (!statusChangeAt || status === 'AVAILABLE' || status === 'IDLE') return null;

  return (
    <div className="mt-1.5 bg-white/5 px-2 py-0.5 rounded w-fit border border-white/5">
      <span className="text-[12px] font-mono font-bold text-white/40 tabular-nums tracking-wider animate-pulse-slow">
        {elapsed}
      </span>
    </div>
  );
};


const SupervisionDashboard: React.FC<SupervisionDashboardProps> = ({ machines }) => {
  const [currentTurno, setCurrentTurno] = useState<Turno | null>(null);
  const [turnoStartTime, setTurnoStartTime] = useState<Date | null>(null);
  const [opsFinalizadas, setOpsFinalizadas] = useState(0);
  const [totalProduzido, setTotalProduzido] = useState(0);
  const [scrapData, setScrapData] = useState<ScrapData[]>([]);
  const [operatorProduction, setOperatorProduction] = useState<OperatorProduction[]>([]);
  const [machineProductionMap, setMachineProductionMap] = useState<Map<string, number>>(new Map());

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

      const machineMap = new Map<string, number>();
      producaoData.forEach(r => {
        const mId = r.maquina_id;
        if (mId) {
          const current = machineMap.get(mId) || 0;
          machineMap.set(mId, current + (r.quantidade_boa || 0));
        }
      });
      setMachineProductionMap(machineMap);
    } else {
      setTotalProduzido(0);
      setScrapData([]);
      setOperatorProduction([]);
      setMachineProductionMap(new Map());
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
      stopped: machines.filter(m => m.status_atual === MachineStatus.STOPPED).length,
      maintenance: machines.filter(m => m.status_atual === MachineStatus.MAINTENANCE).length,
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
          { label: 'Em Manutenção', val: stats.maintenance, icon: 'engineering', color: 'text-orange-500', progress: (stats.maintenance / machines.length) * 100 },
          { label: 'OPs em Andamento', val: machines.filter(m => m.op_atual_id).length, icon: 'play_circle', color: 'text-primary' },
          { label: 'Total Produzido', val: totalProduzido, icon: 'inventory_2', color: 'text-blue-400' },
          { label: 'OPs Finalizadas', val: opsFinalizadas, icon: 'check_circle', color: 'text-secondary' },
          { label: 'Alertas Ativos', val: stats.stopped + stats.maintenance, icon: 'notifications_active', color: 'text-danger', alerts: (stats.stopped + stats.maintenance) > 0 }
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
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-widest">Manutenção</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {machines
              .sort((a, b) => {
                const priority = (status: string | undefined) => {
                  switch (status) {
                    case 'RUNNING': case 'IN_USE': return 0;
                    case 'SETUP': return 1;
                    case 'STOPPED': return 2;
                    case 'MAINTENANCE': return 3;
                    case 'SUSPENDED': return 4;
                    default: return 4;
                  }
                };
                return priority(a.status_atual) - priority(b.status_atual);
              })
              .map((m) => {
                // Map DB status to UI logic
                const isActive = m.status_atual === MachineStatus.RUNNING || m.status_atual === MachineStatus.IN_USE;
                const isStopped = m.status_atual === MachineStatus.STOPPED;
                const isMaintenance = m.status_atual === MachineStatus.MAINTENANCE;
                const isSetup = m.status_atual === MachineStatus.SETUP;
                const isSuspended = m.status_atual === MachineStatus.SUSPENDED;

                // Safe value access - Priority to live calculated map if exists
                const machineLiveProd = machineProductionMap.get(m.id);
                const productionCount = machineLiveProd !== undefined ? machineLiveProd : (m.realized ?? 0);
                const oeeValue = m.oee ?? 0;

                // ✅ FIX: Show OP code or status - if op_atual_id exists but codigo is missing, show ID prefix
                const currentOp = m.ordens_producao?.codigo ||
                  (m.op_atual_id ? `OP-${m.op_atual_id.substring(0, 8)}...` : '--');


                return (
                  <div key={m.id} className={`bg-surface-dark rounded-xl border-l-[6px] p-5 hover:shadow-glow transition-all cursor-pointer group flex flex-col justify-between h-full ${isActive ? 'border-l-secondary shadow-secondary/5' :
                    isStopped ? 'border-l-danger shadow-danger/5' :
                      isMaintenance ? 'border-l-orange-500 shadow-orange-500/5' :
                        isSetup ? 'border-l-warning shadow-warning/5' :
                          isSuspended ? 'border-l-orange-500 shadow-orange-500/5' : 'border-l-text-sub-dark'
                    }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-white mb-2 leading-tight text-left">{m.nome}</h3>
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isActive ? 'text-secondary' :
                            isStopped ? 'text-danger' :
                              isMaintenance ? 'text-orange-500' :
                                isSetup ? 'text-warning' :
                                  isSuspended ? 'text-orange-500' : 'text-text-sub-dark'
                            }`}>
                            <span className="material-icons-outlined text-base">{
                              isActive ? 'play_arrow' :
                                isStopped ? 'error' :
                                  isMaintenance ? 'engineering' :
                                    isSetup ? 'settings' :
                                      isSuspended ? 'pause_circle' : 'check_circle'
                            }</span> {translateStatus(m.status_atual)}
                          </span>
                          <StatusTimer statusChangeAt={m.status_change_at} status={m.status_atual} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white tabular-nums bg-white/5 px-2 py-1 rounded shadow-inner border border-white/5">
                          {oeeValue.toFixed(0)}% OEE
                        </div>
                      </div>
                    </div>

                    {isStopped && (
                      <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4">
                        <p className="text-[10px] text-danger font-bold uppercase tracking-wider mb-1">Motivo da Parada:</p>
                        <p className="text-sm text-white font-medium">{m.stopReason || 'Aguardando justificativa...'}</p>
                      </div>
                    )}

                    <div className="space-y-4 mb-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 shadow-sm">
                            {(m.operadores as any)?.nome?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-bold text-white">{(m.operadores as any)?.nome || 'Sem Operador'}</span>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-text-sub-dark uppercase tracking-widest font-bold opacity-60">Produção Turno</span>
                          <span className="text-primary font-mono font-bold text-sm">
                            {operatorProduction.find(op => op.operatorId === m.operador_atual_id)?.totalProduced || 0} un
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5">
                        <div className="flex justify-between text-[11px] mb-2 font-bold uppercase tracking-wider text-text-sub-dark">
                          <span>OP: {currentOp}</span>
                          <span className="text-white font-mono">{productionCount} un</span>
                        </div>
                        <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full transition-all duration-1000 ease-out ${isActive ? 'bg-secondary' : 'bg-surface-dark-highlight'}`} style={{ width: '60%' }}></div>
                        </div>
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
