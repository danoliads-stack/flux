
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  averageOee: number; // NOVO: OEE médio do operador
}

// NOVO: Interface para itens do painel "Atenção Necessária"
interface AttentionItem {
  id: string;
  type: 'stopped' | 'low_oee' | 'no_operator';
  machineName: string;
  machineId: string;
  detail: string;
  severity: number; // 1 = mais crítico
  stoppedMinutes?: number;
}

// NOVO: Dados de refugo por máquina
interface MachineScrapData {
  machineId: string;
  scrapRate: number;
  scrapQty: number;
  goodQty: number;
}

interface ProductionHistoryItem {
  created_at: string;
  turno: string | null;
  quantidade_boa: number | null;
  quantidade_refugo: number | null;
  operadores?: { nome?: string | null } | null;
}

// Tipo para filtros de status
type StatusFilterType = 'RUNNING' | 'STOPPED' | 'MAINTENANCE' | 'SETUP' | null;

// FASE 2: Tipo para ordenação dos cards
type SortType = 'status' | 'oee' | 'stopTime' | 'alpha' | 'cell';

// FASE 2: Meta de produção por turno (para cálculo de desvios)
const SHIFT_PRODUCTION_GOAL = 100; // Unidades esperadas por operador no turno

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

// NOVO: Formatar minutos para exibição
const formatStopTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return `00:${m.toString().padStart(2, '0')}`;
};

const formatElapsedSeconds = (startedAt: string, nowMs: number): string => {
  const start = new Date(startedAt).getTime();
  const diff = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(diff / 3600).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const s = (diff % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatElapsedMs = (startMs: number, nowMs: number): string => {
  const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(diff / 3600).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const s = (diff % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// Componente de Cronômetro para cada máquina
const StatusTimer: React.FC<{ statusChangeAt?: string; status: string; operatorSessionStartedAt?: string | null }> = ({
  statusChangeAt,
  status,
  operatorSessionStartedAt
}) => {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    const statusStart = statusChangeAt ? new Date(statusChangeAt).getTime() : 0;
    const sessionStart = operatorSessionStartedAt ? new Date(operatorSessionStartedAt).getTime() : 0;
    const baseStart = (status === 'RUNNING' || status === 'IN_USE') && sessionStart
      ? Math.max(statusStart, sessionStart)
      : statusStart;

    if (!baseStart || status === 'AVAILABLE' || status === 'IDLE') {
      setElapsed('00:00:00');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - baseStart) / 1000));

      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [statusChangeAt, status, operatorSessionStartedAt]);

  const hasStart = !!(statusChangeAt || operatorSessionStartedAt);
  if (!hasStart || status === 'AVAILABLE' || status === 'IDLE') return null;

  return (
    <div className="mt-1.5 bg-white/5 px-2 py-0.5 rounded w-fit border border-white/5">
      <span className="text-[12px] font-mono font-bold text-white/40 tabular-nums tracking-wider animate-pulse-slow">
        {elapsed}
      </span>
    </div>
  );
};

// NOVO: Componente indicador LIVE
const LiveIndicator: React.FC<{ lastUpdate: Date }> = ({ lastUpdate }) => {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      setSecondsAgo(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-danger/20 border border-danger/30">
        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-[10px] font-bold text-danger uppercase tracking-widest">Live</span>
      </span>
      <span className="text-[10px] text-text-sub-dark font-mono">
        Atualizado há {secondsAgo}s
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
  const [machineSessionMap, setMachineSessionMap] = useState<Map<string, string>>(new Map());
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [oeeGlobal, setOeeGlobal] = useState(0);
  const [oeeGoalInputs, setOeeGoalInputs] = useState<Record<string, string>>({});
  const oeeGoalSaveTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [machineOeeMap, setMachineOeeMap] = useState<Map<string, number>>(new Map());

  // NOVOS ESTADOS
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>(null);
  const [machineScrapMap, setMachineScrapMap] = useState<Map<string, MachineScrapData>>(new Map());
  const [lastUpdateTime, setlastUpdateTime] = useState<Date>(new Date());
  const [operatorOeeMap, setOperatorOeeMap] = useState<Map<string, { totalOee: number; count: number }>>(new Map());
  const [maintenanceMachines, setMaintenanceMachines] = useState<Set<string>>(new Set());

  // FASE 2: Novos estados
  const [sortType, setSortType] = useState<SortType>('status');
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [previousAlertCount, setPreviousAlertCount] = useState(0);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const [historyModalMachine, setHistoryModalMachine] = useState<MachineData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<ProductionHistoryItem[]>([]);

  // Configurações
  const OEE_GOAL = 80; // Meta OEE (fallback)
  const SCRAP_LIMIT = 5; // Limite de refugo em %
  const STOP_ALERT_MINUTES = 10; // Minutos para alerta de parada

  const getMachineOeeGoal = useCallback((machine: MachineData): number => {
    const raw = oeeGoalInputs[machine.id];
    const parsed = Number(raw);
    const fallback = Number(machine.oee_meta ?? OEE_GOAL);
    const value = Number.isNaN(parsed) ? fallback : parsed;
    return Math.max(0, Math.min(100, value));
  }, [oeeGoalInputs, OEE_GOAL]);

  const persistMachineOeeGoal = useCallback(async (machineId: string, goal: number) => {
    const { error } = await supabase
      .from('maquinas')
      .update({ oee_meta: goal })
      .eq('id', machineId);
    if (error) {
      console.error('Erro ao salvar meta de OEE:', error);
    }
  }, []);

  const fetchMachineOee = useCallback(async () => {
    if (!machines.length) {
      setMachineOeeMap(new Map());
      return;
    }

    const opIds = machines.map((m) => m.op_atual_id).filter((id): id is string => !!id);
    if (!opIds.length) {
      setMachineOeeMap(new Map());
      return;
    }

    const { data, error } = await supabase
      .from('op_summary')
      .select('op_id, machine_id, quantidade_produzida, quantidade_refugo, tempo_rodando_seg, tempo_parado_seg, tempo_setup_seg')
      .in('op_id', opIds);

    if (error || !data) {
      setMachineOeeMap(new Map());
      return;
    }

    const nextMap = new Map<string, number>();
    data.forEach((row: any) => {
      const machineId = row.machine_id;
      if (!machineId) return;

      const produced = row.quantidade_produzida || 0;
      const scrap = row.quantidade_refugo || 0;
      const runSeconds = row.tempo_rodando_seg || 0;
      const stopSeconds = row.tempo_parado_seg || 0;
      const setupSeconds = row.tempo_setup_seg || 0;
      const totalSeconds = runSeconds + stopSeconds + setupSeconds;

      const availability = totalSeconds > 0 ? (runSeconds / totalSeconds) * 100 : 0;
      const totalProduced = produced + scrap;
      const quality = totalProduced > 0 ? (produced / totalProduced) * 100 : 100;
      const operatingMinutes = runSeconds / 60;
      const throughputPerMinute = operatingMinutes > 0 ? produced / operatingMinutes : 0;
      const performance = Math.min(100, throughputPerMinute * 100);
      const oeeValue = (availability / 100) * (quality / 100) * (performance / 100) * 100;

      nextMap.set(machineId, Number.isFinite(oeeValue) ? oeeValue : 0);
    });

    setMachineOeeMap(nextMap);
  }, [machines, machineOeeMap, getMachineOeeGoal]);

  useEffect(() => {
    return () => {
      oeeGoalSaveTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      oeeGoalSaveTimeoutsRef.current.clear();
    };
  }, []);

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

  useEffect(() => {
    setOeeGoalInputs((prev) => {
      let changed = false;
      const next = { ...prev };
      machines.forEach((machine) => {
        const base = Number(machine.oee_meta ?? OEE_GOAL);
        const clamped = Number.isNaN(base) ? OEE_GOAL : Math.max(0, Math.min(100, base));
        if (next[machine.id] !== String(clamped)) {
          next[machine.id] = String(clamped);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [machines, OEE_GOAL]);

  // Fetch shift data when turno is identified
  const fetchShiftData = useCallback(async () => {
    if (!turnoStartTime) return;
    const turnoStartISO = turnoStartTime.toISOString();

    // Fetch active maintenance calls from dedicated table
    const { data: maintenanceCalls } = await supabase
      .from('chamados_manutencao')
      .select('maquina_id, descricao, status')
      .in('status', ['ABERTO', 'EM_ANDAMENTO']);

    const maintenanceSet = new Set<string>();
    if (maintenanceCalls) {
      maintenanceCalls.forEach(call => maintenanceSet.add(call.maquina_id));
    }
    setMaintenanceMachines(maintenanceSet);

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

    let totalBoas = 0;
    let totalScrap = 0;
    if (producaoData && producaoData.length > 0) {
      totalBoas = producaoData.reduce((acc, r) => acc + (r.quantidade_boa || 0), 0);
      totalScrap = producaoData.reduce((acc, r) => acc + (r.quantidade_refugo || 0), 0);
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

      // NOVO: Calcular refugo por máquina
      const machineScrap = new Map<string, MachineScrapData>();
      producaoData.forEach(r => {
        const mId = r.maquina_id;
        if (mId) {
          const existing = machineScrap.get(mId) || { machineId: mId, scrapRate: 0, scrapQty: 0, goodQty: 0 };
          existing.scrapQty += r.quantidade_refugo || 0;
          existing.goodQty += r.quantidade_boa || 0;
          const total = existing.goodQty + existing.scrapQty;
          existing.scrapRate = total > 0 ? (existing.scrapQty / total) * 100 : 0;
          machineScrap.set(mId, existing);
        }
      });
      setMachineScrapMap(machineScrap);

      // NOVO: Calcular OEE médio por operador (aproximação baseada em produção)
      const opOeeMap = new Map<string, { totalOee: number; count: number }>();
      const operadorMap = new Map<string, { name: string; total: number }>();
      producaoData.forEach(r => {
        const op = r.operadores as any;
        const opId = r.operador_id;
        if (opId) {
          const existing = operadorMap.get(opId) || { name: op?.nome || 'Operador', total: 0 };
          existing.total += r.quantidade_boa || 0;
          operadorMap.set(opId, existing);

          // Aproximar OEE baseado na produtividade relativa
          const opOee = opOeeMap.get(opId) || { totalOee: 0, count: 0 };
          opOee.totalOee += (r.quantidade_boa || 0) > 0 ? 85 : 60; // Aproximação
          opOee.count += 1;
          opOeeMap.set(opId, opOee);
        }
      });
      setOperatorOeeMap(opOeeMap);

      const operatorResult: OperatorProduction[] = Array.from(operadorMap.entries())
        .map(([id, data]) => {
          const oeeData = opOeeMap.get(id);
          const avgOee = oeeData && oeeData.count > 0 ? oeeData.totalOee / oeeData.count : 0;
          return { operatorId: id, operatorName: data.name, totalProduced: data.total, averageOee: avgOee };
        })
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
      setMachineScrapMap(new Map());
    }

    const { data: stopData } = await supabase
      .from('paradas')
      .select('data_inicio, data_fim')
      .gte('data_inicio', turnoStartISO);

    const stopMinutes = (stopData || []).reduce((acc, p) => {
      const start = p.data_inicio ? new Date(p.data_inicio).getTime() : null;
      const end = p.data_fim ? new Date(p.data_fim).getTime() : Date.now();
      if (!start) return acc;
      return acc + Math.max(0, Math.floor((end - start) / 60000));
    }, 0);

    const periodMinutes = Math.max(1, Math.floor((Date.now() - turnoStartTime.getTime()) / 60000));
    const availability = periodMinutes > 0 ? ((periodMinutes - stopMinutes) / periodMinutes) * 100 : 100;
    const quality = totalBoas + totalScrap > 0 ? (totalBoas / (totalBoas + totalScrap)) * 100 : 100;
    const operatingMinutes = Math.max(0, periodMinutes - stopMinutes);
    const productivity = operatingMinutes > 0 ? Math.min(100, (totalBoas / operatingMinutes) * 100) : 0;
    const oeeValue = (availability / 100) * (quality / 100) * (productivity / 100) * 100;
    setOeeGlobal(Number.isFinite(oeeValue) ? oeeValue : 0);

    const { data: sessionData, error: sessionError } = await supabase
      .from('op_operator_sessions')
      .select('started_at, op_id, ordens_producao(maquina_id)')
      .is('ended_at', null);

    if (!sessionError && sessionData) {
      const sessionMap = new Map<string, string>();
      sessionData.forEach((session: any) => {
        const op = session.ordens_producao as any;
        const machineId = op?.maquina_id;
        if (machineId && session.started_at) {
          sessionMap.set(machineId, session.started_at);
        }
      });
      setMachineSessionMap(sessionMap);
    } else if (sessionError) {
      setMachineSessionMap(new Map());
    }

    // Atualizar timestamp
    setlastUpdateTime(new Date());
  }, [turnoStartTime]);

  useEffect(() => {
    fetchShiftData();
    fetchMachineOee();
    const channel = supabase
      .channel('shift-production-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao' }, () => {
        fetchShiftData();
        fetchMachineOee();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_producao' }, () => {
        fetchShiftData();
        fetchMachineOee();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, () => {
        fetchShiftData();
        fetchMachineOee();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchShiftData, fetchMachineOee]);

  useEffect(() => {
    const tick = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const stats = useMemo(() => {
    return {
      running: machines.filter(m => m.status_atual === MachineStatus.RUNNING || m.status_atual === MachineStatus.IN_USE).length,
      stopped: machines.filter(m => m.status_atual === MachineStatus.STOPPED).length,
      maintenance: machines.filter(m => m.status_atual === MachineStatus.MAINTENANCE).length,
      setup: machines.filter(m => m.status_atual === MachineStatus.SETUP).length,
      totalOee: oeeGlobal.toFixed(1)
    };
  }, [machines, oeeGlobal]);

  // NOVO: Gerar itens do painel "Atenção Necessária"
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];
    const now = Date.now();

    machines.forEach(m => {
      // Normalize status for comparison
      const status = String(m.status_atual || '').toUpperCase();

      // Máquinas em manutenção (PRIORIDADE MÁXIMA) - apenas por STATUS real
      if (status === 'MAINTENANCE') {
        const stoppedMs = m.status_change_at ? now - new Date(m.status_change_at).getTime() : 0;
        const stoppedMins = Math.floor(stoppedMs / 60000);
        items.push({
          id: `maint-${m.id}`,
          type: 'stopped',
          machineName: m.nome,
          machineId: m.id,
          detail: `🔧 EM MANUTENÇÃO há ${formatStopTime(stoppedMins)}`,
          severity: 0, // Maior prioridade
          stoppedMinutes: stoppedMins
        });
      }
      // Máquinas paradas
      else if (status === 'STOPPED' && m.status_change_at) {
        const stoppedMs = now - new Date(m.status_change_at).getTime();
        const stoppedMins = Math.floor(stoppedMs / 60000);
        items.push({
          id: `stopped-${m.id}`,
          type: 'stopped',
          machineName: m.nome,
          machineId: m.id,
          detail: `Parada há ${formatStopTime(stoppedMins)} – ${m.stopReason || 'Sem motivo'}`,
          severity: 1,
          stoppedMinutes: stoppedMins
        });
      }

      // OEE abaixo da meta
      const oeeValue = machineOeeMap.get(m.id) ?? (m.oee ?? 0);
      const machineGoal = getMachineOeeGoal(m);
      if (oeeValue > 0 && oeeValue < machineGoal * 0.7) {
        items.push({
          id: `oee-${m.id}`,
          type: 'low_oee',
          machineName: m.nome,
          machineId: m.id,
          detail: `OEE ${oeeValue.toFixed(0)}% (meta ${machineGoal}%)`,
          severity: 2
        });
      }

      // Sem operador alocado (apenas para máquinas que deveriam ter operador)
      if (!m.operador_atual_id && status !== 'AVAILABLE' && status !== 'IDLE' && status !== '') {
        items.push({
          id: `no-op-${m.id}`,
          type: 'no_operator',
          machineName: m.nome,
          machineId: m.id,
          detail: 'Sem operador alocado',
          severity: 3
        });
      }
    });

    // Ordenar por severidade e tempo de parada
    return items
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity - b.severity;
        if (a.stoppedMinutes && b.stoppedMinutes) return b.stoppedMinutes - a.stoppedMinutes;
        return 0;
      })
      .slice(0, 5);
  }, [machines]);

  // FASE 2: Detectar novos alertas
  useEffect(() => {
    if (attentionItems.length > previousAlertCount) {
      setHasNewAlerts(true);
      // Auto-reset após 5 segundos
      const timer = setTimeout(() => setHasNewAlerts(false), 5000);
      return () => clearTimeout(timer);
    }
    setPreviousAlertCount(attentionItems.length);
  }, [attentionItems.length, previousAlertCount]);

  // Filtrar e ordenar máquinas
  const filteredAndSortedMachines = useMemo(() => {
    let result = machines;

    // Aplicar filtro de status
    if (statusFilter) {
      result = result.filter(m => {
        if (statusFilter === 'RUNNING') {
          return m.status_atual === MachineStatus.RUNNING || m.status_atual === MachineStatus.IN_USE;
        }
        if (statusFilter === 'STOPPED') {
          return m.status_atual === MachineStatus.STOPPED;
        }
        if (statusFilter === 'MAINTENANCE') {
          return m.status_atual === MachineStatus.MAINTENANCE;
        }
        if (statusFilter === 'SETUP') {
          return m.status_atual === MachineStatus.SETUP;
        }
        return true;
      });
    }

    // FASE 2: Aplicar ordenação
    return [...result].sort((a, b) => {
      switch (sortType) {
        case 'status': {
          const priority = (status: string | undefined) => {
            switch (status) {
              case 'STOPPED': return 0; // Paradas primeiro
              case 'SETUP': return 1;
              case 'RUNNING': case 'IN_USE': return 2;
              case 'MAINTENANCE': return 3;
              default: return 4;
            }
          };
          return priority(a.status_atual) - priority(b.status_atual);
        }
        case 'oee': {
          const aOee = machineOeeMap.get(a.id) ?? (a.oee ?? 0);
          const bOee = machineOeeMap.get(b.id) ?? (b.oee ?? 0);
          return aOee - bOee; // Menor OEE primeiro
        }
        case 'stopTime': {
          const getStopTime = (m: MachineData) => {
            if (m.status_atual !== MachineStatus.STOPPED || !m.status_change_at) return 0;
            return Date.now() - new Date(m.status_change_at).getTime();
          };
          return getStopTime(b) - getStopTime(a); // Maior tempo primeiro
        }
        case 'alpha': {
          return a.nome.localeCompare(b.nome);
        }
        case 'cell': {
          return (a.setor_id || '').localeCompare(b.setor_id || '');
        }
        default:
          return 0;
      }
    });
  }, [machines, statusFilter, sortType, machineOeeMap]);

  // Handler para click nos cards de status
  const handleStatusCardClick = (filter: StatusFilterType) => {
    setStatusFilter(prev => prev === filter ? null : filter);
  };

  // Abrir painel do operador em nova aba
  const openOperatorPanel = (machine: MachineData) => {
    const slug = (machine as any).slug || machine.id;
    window.open(`/maquinas/${slug}`, '_blank');
  };

  // Carregar histórico de produção (3 dias) para modal
  const openHistoryModal = async (machine: MachineData) => {
    setHistoryModalMachine(machine);
    setHistoryLoading(true);
    setHistoryRecords([]);
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('registros_producao')
      .select('created_at, turno, quantidade_boa, quantidade_refugo, operadores(nome)')
      .eq('maquina_id', machine.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (!error && data) setHistoryRecords(data as ProductionHistoryItem[]);
    setHistoryLoading(false);
  };

  // FASE 2: Labels para ordenação
  const sortLabels: Record<SortType, string> = {
    status: 'Por Status',
    oee: 'Por OEE (menor)',
    stopTime: 'Por Tempo Parada',
    alpha: 'Alfabética',
    cell: 'Por Célula'
  };

  return (
    <div className="p-6 md:p-10 space-y-8 animate-fade-in">
      {/* Header com turno e OEE */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display font-bold tracking-tight text-white uppercase">Status Geral do Turno (v2)</h2>
          {currentTurno && (
            <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
              {currentTurno.nome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-sub-dark uppercase tracking-widest font-bold">OEE Global:</span>
            <span className="text-xl font-display font-bold text-secondary">{stats.totalOee}%</span>
          </div>
        </div>
      </div>

      {/* Grid principal: Cards de status + Painel Atenção */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Cards de Status Clicáveis */}
        <div className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { label: 'Máquinas Rodando', val: stats.running, icon: 'settings_motion_mode', color: 'text-green-500', filter: 'RUNNING' as StatusFilterType, progress: (stats.running / machines.length) * 100 },
              { label: 'Máquinas Paradas', val: stats.stopped, icon: 'warning', color: 'text-orange-500', filter: 'STOPPED' as StatusFilterType, progress: (stats.stopped / machines.length) * 100 },
              { label: 'Em Manutenção', val: stats.maintenance, icon: 'engineering', color: 'text-red-600', filter: 'MAINTENANCE' as StatusFilterType, progress: (stats.maintenance / machines.length) * 100 },
              { label: 'Em Setup', val: stats.setup, icon: 'settings', color: 'text-warning', filter: 'SETUP' as StatusFilterType, progress: (stats.setup / machines.length) * 100 },
              { label: 'OPs em Andamento', val: machines.filter(m => m.op_atual_id).length, icon: 'play_circle', color: 'text-primary' },
              { label: 'Total Produzido', val: totalProduzido, icon: 'inventory_2', color: 'text-blue-400' },
              { label: 'OPs Finalizadas', val: opsFinalizadas, icon: 'check_circle', color: 'text-secondary' },
              { label: 'Alertas Ativos', val: attentionItems.length, icon: 'notifications_active', color: 'text-danger', alerts: attentionItems.length > 0, isAlertsCard: true, hasNewAlerts }
            ].map((kpi, i) => (
              <div
                key={i}
                onClick={() => {
                  if ((kpi as any).isAlertsCard) {
                    setShowAlertsModal(true);
                  } else if (kpi.filter) {
                    handleStatusCardClick(kpi.filter);
                  }
                }}
                className={`flex flex-col gap-1 rounded-xl p-5 border bg-surface-dark shadow-sm relative overflow-hidden group transition-all
                  ${kpi.filter || (kpi as any).isAlertsCard ? 'cursor-pointer hover:border-primary/50' : ''}
                  ${statusFilter === kpi.filter ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border-dark'}
                  ${(kpi as any).hasNewAlerts ? 'animate-pulse ring-2 ring-danger/50' : ''}
                `}
              >
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
                {kpi.filter && (
                  <span className="absolute bottom-2 right-2 text-[9px] text-text-sub-dark opacity-0 group-hover:opacity-100 transition-opacity">
                    Clique para filtrar
                  </span>
                )}
                {(kpi as any).isAlertsCard && (
                  <span className="absolute bottom-2 right-2 text-[9px] text-text-sub-dark opacity-0 group-hover:opacity-100 transition-opacity">
                    Clique para ver detalhes
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* NOVO: Painel Atenção Necessária */}
        <div className="w-full xl:w-[360px] shrink-0">
          <div className="bg-surface-dark rounded-xl border border-danger/30 p-5 h-full">
            <h3 className="text-sm font-bold text-danger mb-4 uppercase tracking-widest flex items-center gap-2">
              <span className="material-icons-outlined">warning</span>
              Atenção Necessária
            </h3>
            {attentionItems.length > 0 ? (
              <div className="space-y-3">
                {attentionItems.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      const machine = machines.find(m => m.id === item.machineId);
                      if (machine) openOperatorPanel(machine);
                    }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-danger/5 border border-danger/10 cursor-pointer hover:bg-danger/10 transition-colors group"
                  >
                    <span className="text-lg font-bold text-danger/60">{i + 1})</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-danger transition-colors">
                        {item.machineName}
                      </p>
                      <p className="text-xs text-text-sub-dark truncate">
                        {item.detail}
                      </p>
                    </div>
                    <span className={`material-icons-outlined text-base ${item.type === 'stopped' ? 'text-danger' :
                      item.type === 'low_oee' ? 'text-warning' : 'text-orange-500'
                      }`}>
                      {item.type === 'stopped' ? 'pause_circle' :
                        item.type === 'low_oee' ? 'trending_down' : 'person_off'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-sub-dark">
                <span className="material-icons-outlined text-3xl mb-2 block opacity-30">check_circle</span>
                <p className="text-xs">Nenhum problema identificado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mapa Operacional + Performance */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Mapa Operacional</h2>
              {/* Indicador Live */}
              <LiveIndicator lastUpdate={lastUpdateTime} />
            </div>
            <div className="flex items-center gap-2">
              {/* FASE 2: Dropdown de ordenação */}
              <div className="relative">
                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  className="appearance-none bg-surface-dark border border-border-dark rounded-lg px-3 py-1.5 pr-8 text-[10px] font-bold text-white uppercase tracking-widest cursor-pointer hover:border-primary/50 focus:border-primary focus:outline-none transition-colors"
                >
                  {(Object.keys(sortLabels) as SortType[]).map(key => (
                    <option key={key} value={key}>{sortLabels[key]}</option>
                  ))}
                </select>
                <span className="material-icons-outlined text-xs absolute right-2 top-1/2 -translate-y-1/2 text-text-sub-dark pointer-events-none">
                  expand_more
                </span>
              </div>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-primary/20 text-primary border border-primary/30 uppercase tracking-widest hover:bg-primary/30 transition-colors"
                >
                  <span className="material-icons-outlined text-xs">close</span>
                  Limpar Filtro
                </button>
              )}
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-widest">Rodando</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-warning/10 text-warning border border-warning/20 uppercase tracking-widest">Setup</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-widest">Parado</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-red-600/10 text-red-600 border border-red-600/20 uppercase tracking-widest">Manutenção</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredAndSortedMachines
              .map((m) => {
                // Map DB status to UI logic - normalize status to uppercase for reliable comparison
                const status = String(m.status_atual || '').toUpperCase();

                // Status flags using normalized uppercase comparison
                const isActive = status === 'RUNNING' || status === 'IN_USE';
                const isStopped = status === 'STOPPED';
                const isMaintenance = status === 'MAINTENANCE';
                const isSetup = status === 'SETUP';
                const isSuspended = status === 'SUSPENDED';
                const isAvailable = status === 'AVAILABLE' || status === 'IDLE' || status === '';
                const hasMaintenanceCall = maintenanceMachines.has(m.id);

                // Calculate border color class - prioritize actual machine status
                const getBorderColorClass = () => {
                  // Only show maintenance call animation if machine is actually in MAINTENANCE status
                  if (isMaintenance && hasMaintenanceCall) return 'border-l-red-600 shadow-red-600/20 animate-pulse-border ring-2 ring-red-600/50';
                  if (isMaintenance) return 'border-l-red-600 shadow-red-600/5';
                  if (isStopped) return 'border-l-orange-500 shadow-orange-500/5';
                  if (isSetup) return 'border-l-yellow-500 shadow-yellow-500/5';
                  if (isActive) return 'border-l-green-500 shadow-green-500/5';
                  if (isSuspended) return 'border-l-orange-500 shadow-orange-500/5';
                  if (isAvailable) return 'border-l-blue-500 shadow-blue-500/5';
                  return 'border-l-gray-500 shadow-gray-500/5'; // Fallback
                };

                // Safe value access
                const machineLiveProd = machineProductionMap.get(m.id);
                const productionCount = machineLiveProd !== undefined ? machineLiveProd : (m.realized ?? 0);
                const oeeValue = machineOeeMap.get(m.id) ?? (m.oee ?? 0);
                const machineGoal = getMachineOeeGoal(m);

                // NOVO: Dados de refugo da máquina
                const scrapInfo = machineScrapMap.get(m.id);
                const scrapRate = scrapInfo?.scrapRate ?? 0;

                // NOVO: Verificar se deve mostrar alerta
                const showAlert = (
                  oeeValue < machineGoal * 0.7 ||
                  scrapRate > SCRAP_LIMIT ||
                  (isStopped && !m.stopReason && m.status_change_at &&
                    (Date.now() - new Date(m.status_change_at).getTime()) > STOP_ALERT_MINUTES * 60000)
                );

                const currentOp = m.ordens_producao?.codigo ||
                  (m.op_atual_id ? `OP-${m.op_atual_id.substring(0, 8)}...` : '--');
                const sessionStartedAt = machineSessionMap.get(m.id);
                const operatorElapsed = sessionStartedAt
                  ? formatElapsedSeconds(sessionStartedAt, nowTimestamp)
                  : null;
                const operatorProductionElapsed = (sessionStartedAt && isActive && m.status_change_at)
                  ? formatElapsedMs(
                    Math.max(new Date(sessionStartedAt).getTime(), new Date(m.status_change_at).getTime()),
                    nowTimestamp
                  )
                  : null;

                return (
                  <div
                    key={m.id}
                    onDoubleClick={() => openHistoryModal(m)}
                    className={`bg-surface-dark rounded-xl border-l-[6px] p-5 hover:shadow-glow transition-all cursor-pointer group flex flex-col justify-between h-full relative ${getBorderColorClass()}`}
                  >
                    {/* Ícone de manutenção ou alerta */}
                    {(isMaintenance && hasMaintenanceCall) ? (
                      <div className="absolute top-2 right-2">
                        <span className="material-icons-outlined text-red-600 text-2xl animate-bounce" title="Chamado de Manutenção Ativo">
                          build_circle
                        </span>
                      </div>
                    ) : showAlert && (
                      <div className="absolute top-2 right-2">
                        <span className="material-icons-outlined text-warning text-lg animate-pulse" title="Atenção necessária">
                          warning
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-white mb-2 leading-tight text-left">{m.nome}</h3>
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isMaintenance ? 'text-red-600' :
                            isStopped ? 'text-orange-500' :
                              isSetup ? 'text-yellow-500' :
                                isActive ? 'text-green-500' :
                                  isSuspended ? 'text-orange-500' :
                                    isAvailable ? 'text-blue-500' : 'text-text-sub-dark'
                            }`}>
                            <span className="material-icons-outlined text-base">{
                              isMaintenance ? 'engineering' :
                                isStopped ? 'error' :
                                  isSetup ? 'settings' :
                                    isActive ? 'play_arrow' :
                                      isSuspended ? 'pause_circle' :
                                        isAvailable ? 'check_circle' : 'check_circle'
                            }</span> {translateStatus(m.status_atual)}
                          </span>
                          <StatusTimer
                            statusChangeAt={m.status_change_at}
                            status={m.status_atual}
                            operatorSessionStartedAt={sessionStartedAt}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white tabular-nums bg-white/5 px-2 py-1 rounded shadow-inner border border-white/5">
                          {oeeValue.toFixed(0)}% OEE
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-text-sub-dark">Meta</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={oeeGoalInputs[m.id] ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setOeeGoalInputs((prev) => ({ ...prev, [m.id]: nextValue }));

                              const existing = oeeGoalSaveTimeoutsRef.current.get(m.id);
                              if (existing) {
                                clearTimeout(existing);
                              }

                              const parsed = Number(nextValue);
                              if (Number.isNaN(parsed)) {
                                return;
                              }

                              const nextGoal = Math.max(0, Math.min(100, parsed));
                              const timeoutId = setTimeout(() => {
                                persistMachineOeeGoal(m.id, nextGoal);
                              }, 500);
                              oeeGoalSaveTimeoutsRef.current.set(m.id, timeoutId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-16 bg-background-dark border border-border-dark rounded-md px-2 py-0.5 text-[10px] text-white text-right outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {
                      isStopped && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
                          <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">Motivo da Parada:</p>
                          <p className="text-sm text-white font-medium">{m.stopReason || 'Aguardando justificativa...'}</p>
                        </div>
                      )
                    }

                    <div className="space-y-4 mb-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 shadow-sm">
                            {(m.operadores as any)?.nome?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-bold text-white">{(m.operadores as any)?.nome || 'Sem Operador'}</span>
                        </div>
                        {/* NOVO: Indicadores mínimos */}

                        {operatorElapsed && (
                          <div className="text-[11px] text-text-sub-dark font-mono">
                            Tempo no posto: {operatorElapsed}
                          </div>
                        )}
                        {operatorProductionElapsed && (
                          <div className="text-[11px] text-text-sub-dark font-mono">
                            Tempo de producao: {operatorProductionElapsed}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-text-sub-dark uppercase tracking-widest font-bold opacity-60">Prod:</span>
                            <span className="text-primary font-mono font-bold">{productionCount} un</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-sub-dark uppercase tracking-widest font-bold opacity-60">Refugo:</span>
                            <span className={`font-mono font-bold ${scrapRate > SCRAP_LIMIT ? 'text-danger' : 'text-text-sub-dark'}`}>
                              {scrapRate.toFixed(1)}%
                            </span>
                          </div>
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

                    {/* NOVO: Botão Ver Detalhes (aparece no hover) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openHistoryModal(m); }}
                      className="w-full py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                    >
                      <span className="material-icons-outlined text-sm">visibility</span>
                      Ver Detalhes
                    </button>

                  </div>
                );
              })}
          </div>
        </div>

        {/* Performance do Turno - Ranking de Operadores */}
        <div className="w-full xl:w-[320px] shrink-0 space-y-6">
          <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Performance do Turno</h2>

          <div className="bg-surface-dark rounded-xl border border-border-dark p-6 h-full">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-icons-outlined text-primary">groups</span>
              Ranking Operadores
            </h3>
            <div className="space-y-4">
              {operatorProduction.length > 0 ? operatorProduction.map((op, i) => {
                const maxProduced = operatorProduction[0]?.totalProduced || 1;
                const isTop3 = i < 3;
                // FASE 2: Calcular desvio da meta
                const isAboveGoal = op.totalProduced >= SHIFT_PRODUCTION_GOAL;
                const isBelowCritical = op.totalProduced < SHIFT_PRODUCTION_GOAL * 0.7;
                return (
                  <div key={op.operatorId} className="flex items-center gap-3 group">
                    {/* Posição no ranking */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      i === 1 ? 'bg-gray-400/20 text-gray-400' :
                        i === 2 ? 'bg-orange-600/20 text-orange-600' : 'bg-surface-dark-highlight text-text-sub-dark'
                      }`}>
                      {i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-surface-dark-highlight border border-border-dark flex items-center justify-center text-xs font-bold text-white group-hover:border-primary/50 transition-colors relative">
                      {op.operatorName.charAt(0)}
                      {/* FASE 2: Ícone de desvio */}
                      {isAboveGoal && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full flex items-center justify-center">
                          <span className="material-icons-outlined text-[10px] text-white">arrow_upward</span>
                        </span>
                      )}
                      {isBelowCritical && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center">
                          <span className="material-icons-outlined text-[10px] text-white">arrow_downward</span>
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-bold group-hover:text-primary transition-colors ${isTop3 ? 'text-white' : 'text-text-sub-dark'}`}>
                          {op.operatorName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-primary tabular-nums font-mono">{op.totalProduced} un</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${op.averageOee >= OEE_GOAL ? 'bg-secondary/20 text-secondary' :
                            op.averageOee >= OEE_GOAL * 0.7 ? 'bg-warning/20 text-warning' : 'bg-danger/20 text-danger'
                            }`}>
                            {op.averageOee.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-background-dark rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${i === 0 ? 'bg-yellow-500' :
                            i === 1 ? 'bg-gray-400' :
                              i === 2 ? 'bg-orange-600' : 'bg-primary'
                            }`}
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
                <p className="text-[10px] text-text-sub-dark uppercase tracking-widest font-bold mb-1">Méta: {SHIFT_PRODUCTION_GOAL} un/turno</p>
                <p className="text-xl font-display font-bold text-white">
                  {(operatorProduction.reduce((acc, curr) => acc + curr.totalProduced, 0) / operatorProduction.length).toFixed(0)} <span className="text-xs text-text-sub-dark font-sans font-normal">un/turno</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FASE 2: Modal de Alertas */}
      {
        showAlertsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowAlertsModal(false)}>
            <div
              className="bg-surface-dark rounded-2xl border border-border-dark w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-border-dark">
                <div className="flex items-center gap-3">
                  <span className="material-icons-outlined text-danger text-2xl">notifications_active</span>
                  <h2 className="text-xl font-display font-bold text-white">Alertas Ativos</h2>
                  <span className="px-2 py-0.5 rounded-full bg-danger/20 text-danger text-xs font-bold">
                    {attentionItems.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowAlertsModal(false)}
                  className="w-10 h-10 rounded-full bg-surface-dark-highlight hover:bg-danger/20 flex items-center justify-center transition-colors group"
                >
                  <span className="material-icons-outlined text-text-sub-dark group-hover:text-danger">close</span>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {attentionItems.length > 0 ? (
                  <div className="space-y-4">
                    {attentionItems.map((item, i) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          const machine = machines.find(m => m.id === item.machineId);
                          if (machine) {
                            openOperatorPanel(machine);
                            setShowAlertsModal(false);
                          }
                        }}
                        className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${item.type === 'stopped' ? 'bg-danger/10 border border-danger/20 hover:bg-danger/20' :
                          item.type === 'low_oee' ? 'bg-warning/10 border border-warning/20 hover:bg-warning/20' :
                            'bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20'
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.type === 'stopped' ? 'bg-danger/20' :
                          item.type === 'low_oee' ? 'bg-warning/20' : 'bg-orange-500/20'
                          }`}>
                          <span className={`material-icons-outlined text-2xl ${item.type === 'stopped' ? 'text-danger' :
                            item.type === 'low_oee' ? 'text-warning' : 'text-orange-500'
                            }`}>
                            {item.type === 'stopped' ? 'pause_circle' :
                              item.type === 'low_oee' ? 'trending_down' : 'person_off'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.type === 'stopped' ? 'bg-danger/20 text-danger' :
                              item.type === 'low_oee' ? 'bg-warning/20 text-warning' : 'bg-orange-500/20 text-orange-500'
                              }`}>
                              {item.type === 'stopped' ? 'Parada' :
                                item.type === 'low_oee' ? 'OEE Baixo' : 'Sem Operador'}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white">{item.machineName}</h3>
                          <p className="text-sm text-text-sub-dark">{item.detail}</p>
                        </div>
                        <span className="material-icons-outlined text-text-sub-dark">chevron_right</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <span className="material-icons-outlined text-5xl text-secondary/30 mb-4 block">check_circle</span>
                    <h3 className="text-lg font-bold text-white mb-2">Tudo em ordem!</h3>
                    <p className="text-sm text-text-sub-dark">Nenhum alerta ativo no momento</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de histórico (3 dias) */}
      {historyModalMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setHistoryModalMachine(null)}></div>
          <div className="relative w-full max-w-3xl bg-surface-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-dark flex items-center justify-between bg-[#0f1117]">
              <div>
                <div className="text-xs uppercase tracking-widest text-text-sub-dark">Histórico (3 dias)</div>
                <div className="text-white text-lg font-bold">{historyModalMachine.nome}</div>
              </div>
              <button onClick={() => setHistoryModalMachine(null)} className="text-text-sub-dark hover:text-white">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {historyLoading && (
                <div className="text-text-sub-dark text-sm">Carregando histórico...</div>
              )}
              {!historyLoading && historyRecords.length === 0 && (
                <div className="text-text-sub-dark text-sm">Sem registros nos últimos 3 dias.</div>
              )}
              {!historyLoading && historyRecords.length > 0 && (
                <div className="space-y-3">
                  {Object.entries(historyRecords.reduce((acc, rec) => {
                    const dateStr = new Date(rec.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                    const key = `${dateStr}-${rec.turno || 'Turno'}`;
                    if (!acc[key]) {
                      acc[key] = { dateStr, turno: rec.turno || 'Turno', boa: 0, refugo: 0, rows: [] as ProductionHistoryItem[] };
                    }
                    acc[key].boa += rec.quantidade_boa || 0;
                    acc[key].refugo += rec.quantidade_refugo || 0;
                    acc[key].rows.push(rec);
                    return acc;
                  }, {} as Record<string, { dateStr: string; turno: string; boa: number; refugo: number; rows: ProductionHistoryItem[] }>))
                    .map(([key, group]) => (
                      <div key={key} className="border border-border-dark rounded-xl p-4 bg-surface-dark/50">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm font-bold text-white">{group.dateStr} · {group.turno}</div>
                          <div className="text-xs text-text-sub-dark font-mono">Bom: {group.boa} · Refugo: {group.refugo}</div>
                        </div>
                        <div className="space-y-1">
                          {group.rows.map((r, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-text-sub-dark">
                              <span>{new Date(r.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>
                              <span>{(r.operadores as any)?.nome || 'Operador'}</span>
                              <span className="font-mono text-white">+{r.quantidade_boa || 0} / Refugo {r.quantidade_refugo || 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default SupervisionDashboard;

