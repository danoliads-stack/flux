import React, { useState, useEffect, useMemo } from 'react';
import { MachineStatus, AppUser, Permission, MachineData, ProductionOrder, OPState, ShiftOption } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OperatorDashboard from './components/OperatorDashboard';
import SupervisionDashboard from './components/SupervisionDashboard';
import QualityDashboard from './components/QualityDashboard';
import AdminDashboard from './components/AdminDashboard';
import Reports from './components/Reports';
import AdminInsights from './components/AdminInsights';
import LoginScreen from './components/LoginScreen';
import MachineSelection from './components/MachineSelection';
import SetupModal from './components/modals/SetupModal';
import StopModal from './components/modals/StopModal';
import FinalizeModal from './components/modals/FinalizeModal';
import LabelModal from './components/modals/LabelModal';
import OperatorSwitchModal from './components/modals/OperatorSwitchModal';
import LabelHistoryPage from './components/LabelHistoryPage';
import MaintenanceDashboard from './components/MaintenanceDashboard';
import TraceabilityPage from './components/TraceabilityPage';
import Preloader from './components/Preloader';
import { ROLE_CONFIGS } from './constants';
import { useAuth } from './AuthContext';
import { supabase } from './src/lib/supabase-client';
import { realtimeManager, createMachineUpdate } from './src/utils/realtimeManager';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useAppStore } from './src/store/useAppStore';
import { getMachineSlug } from './src/utils/slug';
import { logger } from './src/utils/logger';

// --- PROTECTED ROUTE COMPONENT ---
interface ProtectedRouteProps {
  children: React.ReactNode;
  user: AppUser | null;
  permission?: Permission;
  userPermissions: Permission[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, user, permission, userPermissions }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !userPermissions?.includes(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
};



type ThemeMode = 'dark' | 'light';

const App: React.FC = () => {
  useEffect(() => {
    logger.log('[DEBUG-APP] 🏗️ App component MOUNTED');
    return () => logger.log('[DEBUG-APP] 🏚️ App component UNMOUNTED');
  }, []);

  const { user: currentUser, logout: handleLogout, loading: authLoading } = useAuth();

  useEffect(() => {
    logger.log(`[DEBUG-APP] 🔄 Auth State Tracer -> loading: ${authLoading}, user: ${currentUser?.name || 'GUEST'}`);
  }, [authLoading, currentUser]);

  const navigate = useNavigate();
  const location = useLocation();

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('dark'); // força tema escuro

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('flux_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => setTheme('dark'); // desabilita modo claro

  // --- ZUSTAND STORE ---
  const {
    selectedMachineId, setSelectedMachine,
    currentMachine, setCurrentMachine,
    activeOP, setActiveOP,
    activeOPCodigo,
    activeOPData,
    opState, setOpState,
    statusChangeAt: localStatusChangeAt, syncTimers,
    accumulatedSetupTime, accumulatedProductionTime, accumulatedStopTime,
    // Production Data from Store
    totalProduced,
    setProductionData
  } = useAppStore();

  const [operatorTurno, setOperatorTurno] = useState<string>('Turno Atual');
  const [operatorAssignment, setOperatorAssignment] = useState<{ id: string; name: string } | null>(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [isFetchingSwitchData, setIsFetchingSwitchData] = useState(false);
  const [isSubmittingSwitch, setIsSubmittingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);
  const [activeOperatorSessionId, setActiveOperatorSessionId] = useState<string | null>(null);
  const activeOperatorId = operatorAssignment?.id || currentMachine?.operador_atual_id || currentUser?.id || null;
  const activeOperatorName = operatorAssignment?.name || currentUser?.name || 'Operador';
  const currentShiftOptionId = shiftOptions.find(s => s.nome === operatorTurno)?.id || null;

  // Last phase start time (synced with store statusChangeAt for relative calc)
  const lastPhaseStartTime = localStatusChangeAt;

  // Last phase start time (for calculating time to add when transitioning)
  // Legacy states removed in favor of store


  const [liveMachines, setLiveMachines] = useState<MachineData[]>([]);

  // STATE RECOVERY: Fetch machine and OP data from database on mount using persisted selectedMachineId
  useEffect(() => {
    const recoverState = async () => {
      // Only run if we have a persisted machineId but no currentMachine loaded
      if (selectedMachineId && !currentMachine && currentUser) {
        logger.log('[App] 🔄 Recovering state for machine:', selectedMachineId);

        // 1. Fetch machine from database
        const { data: machineData, error: machineError } = await supabase
          .from('maquinas')
          .select('*, setores(nome)')
          .eq('id', selectedMachineId)
          .single();

        if (machineError || !machineData) {
          logger.error('[App] ❌ Failed to recover machine:', machineError);
          // Clear stale persisted state
          setSelectedMachine(null);
          return;
        }

        logger.log('[App] ✅ Recovered machine:', machineData.nome, 'status:', machineData.status_atual, 'op_atual_id:', machineData.op_atual_id);
        setCurrentMachine(machineData);

        // 2. Sync timers from database
        if (machineData.status_change_at) {
          syncTimers({ statusChangeAt: machineData.status_change_at });
        }

        // 3. Fetch active OP if exists
        if (machineData.op_atual_id) {
          logger.log('[App] 🔍 Fetching OP from database:', machineData.op_atual_id);
          const { data: opData, error: opError } = await supabase
            .from('ordens_producao')
            .select('*')
            .eq('id', machineData.op_atual_id)
            .single();

          if (opError) {
            logger.error('[App] ❌ Failed to fetch OP:', opError);
          } else if (opData) {
            logger.log('[App] ✅ Recovered OP:', opData.codigo);
            setActiveOP(opData as any);
          }
        } else {
          logger.log('[App] ⚠️ Machine has no op_atual_id - OP will be null');
        }

        // 4. Map machine status to opState (database is source of truth)
        let dbOpState: OPState = 'IDLE';

        // ✅ Detect Inconsistency: Running without OP
        if ((machineData.status_atual === MachineStatus.RUNNING || machineData.status_atual === MachineStatus.SETUP) && !machineData.op_atual_id) {
          logger.warn('[App] ⚠️ State recovery detected production/setup without OP. Forcing IDLE.');
          dbOpState = 'IDLE';
          await supabase.from('maquinas').update({
            status_atual: MachineStatus.AVAILABLE,
            op_atual_id: null
          }).eq('id', machineData.id);
        } else {
          switch (machineData.status_atual) {
            case MachineStatus.SETUP: dbOpState = 'SETUP'; break;
            case MachineStatus.RUNNING: dbOpState = 'PRODUCAO'; break;
            case MachineStatus.STOPPED: dbOpState = 'PARADA'; break;
            case MachineStatus.SUSPENDED: dbOpState = 'SUSPENSA'; break;
            default: dbOpState = 'IDLE';
          }
        }

        setOpState(dbOpState);
        logger.log('[App] ✅ State recovery complete. opState:', dbOpState, 'activeOP:', activeOP);
      }
    };

    recoverState();
  }, [selectedMachineId, currentMachine, currentUser]);

  // DEBUG: Log activeOP changes
  useEffect(() => {
    logger.log('[App] 🔔 activeOP changed:', activeOP, 'activeOPCodigo:', activeOPCodigo);
  }, [activeOP, activeOPCodigo]);

  // SLUG-BASED URL: Detect machine slug from URL and load machine
  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith('/maquinas/')) return;

    const slug = path.replace('/maquinas/', '').split('/')[0];
    if (!slug || slug === '' || slug === 'maquinas') return;

    // Skip if we already have this machine loaded
    if (currentMachine) {
      const currentSlug = getMachineSlug(currentMachine);
      if (currentSlug === slug) return;
    }

    const findMachineBySlug = async () => {
      logger.log('[App] 🔍 Looking for machine by slug:', slug);

      // First try exact codigo match (most efficient)
      let { data: machine, error } = await supabase
        .from('maquinas')
        .select('*, setores(nome)')
        .ilike('codigo', slug.replace(/-/g, '%'))
        .limit(1)
        .maybeSingle();

      // If not found, try matching by generated slug from codigo or nome
      if (!machine && liveMachines.length > 0) {
        machine = liveMachines.find(m => getMachineSlug(m) === slug) || null;
      }

      // Fallback: try as UUID for backwards compatibility
      if (!machine) {
        const uuidResult = await supabase
          .from('maquinas')
          .select('*, setores(nome)')
          .eq('id', slug)
          .maybeSingle();
        machine = uuidResult.data;
      }

      if (machine) {
        logger.log('[App] ✅ Found machine by slug:', machine.nome);
        setSelectedMachine(machine.id);
        setCurrentMachine(machine);
      } else {
        logger.warn('[App] ⚠️ Machine not found for slug:', slug);
        navigate('/maquinas');
      }
    };

    findMachineBySlug();
  }, [location.pathname, liveMachines]);
  // We keep this effect only to sync legacy localStorage if completely necessary during migration, 
  // but for now we rely on the store. 
  // TODO: Fully clean up this block after verification.

  // Detect public traceability link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lote = params.get('lote');
    if (lote) {
      setCurrentLoteId(lote);
      navigate(`/r/${lote}`);
    }
  }, [navigate]);

  // Handle role-based redirection when user logs in/out
  // Handle role-based redirection when user logs in/out
  useEffect(() => {
    if (location.pathname.startsWith('/r/')) return;

    if (currentUser) {
      logger.log(`[DEBUG-APP] 👤 User identified: ${currentUser.name} (${currentUser.role})`);
      logger.log(`[DEBUG-APP] 📍 Current Path: ${location.pathname}`);

      if (location.pathname === '/' || location.pathname === '/login') {
        let target = '/maquinas';
        if (currentUser.role === 'ADMIN') target = '/administracao';
        else if (currentUser.role === 'SUPERVISOR') target = '/supervisao';

        logger.log(`[DEBUG-APP] 🚀 Redirecting to role default: ${target}`);
        navigate(target);
      }
    } else if (!authLoading) {
      if (location.pathname === '/' || (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/r/'))) {
        logger.log('[DEBUG-APP] 🔓 No user, redirecting to login');
        navigate('/login');
      }
    }
  }, [currentUser, authLoading, navigate, location.pathname]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return [];
    const config = ROLE_CONFIGS.find(c => c.role === currentUser.role);
    return config?.permissions || [];
  }, [currentUser]);

  useEffect(() => {
    fetchActiveSession(currentMachine?.op_atual_id || null);
  }, [currentMachine?.op_atual_id]);

  const hasPermission = (permission: Permission) => userPermissions.includes(permission);

  // Fetch machines and subscribe to changes
  useEffect(() => {
    const fetchMachines = async () => {
      const { data, error } = await supabase
        .from('maquinas')
        .select('*, setores(nome), ordens_producao!op_atual_id(codigo), operadores(nome)');

      if (data && !error) {
        // Buscar paradas ativas de todas as máquinas (ordenar pela mais recente)
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('*')
          .order('created_at', { ascending: false });

        logger.log('Paradas encontradas:', paradas, paradasError);

        // Buscar todos os tipos de parada para mapear ID -> Nome
        const { data: tiposParada } = await supabase
          .from('tipos_parada')
          .select('id, nome');

        const tiposMap = new Map();
        tiposParada?.forEach(t => tiposMap.set(t.id, t.nome));

        // Mapear máquina -> motivo (apenas paradas ATIVAS)
        const paradasMap = new Map();
        paradas?.forEach(p => {
          // Se fim for nulo, é uma parada ativa
          if (!p.fim) {
            // O campo motivo contém o ID do tipo. Buscar o nome no mapa de tipos
            const tipaNome = tiposMap.get(p.motivo);
            // Prioridade: Nome do Tipo > Motivo (texto/ID) > Notas > Default
            const razao = tipaNome || p.motivo || p.notas || 'Parada não identificada';
            paradasMap.set(p.maquina_id, razao);
          }
        });

        logger.log('ParadasMap:', Object.fromEntries(paradasMap));

        setLiveMachines(data.map(m => ({
          ...m,
          status: m.status_atual as MachineStatus,
          stopReason: paradasMap.get(m.id) || null
        })));
      }
    };

    fetchMachines();

    // ✅ Subscribe to realtime updates para sincronização instantânea
    const unsubscribe = realtimeManager.subscribeMachineUpdates((update) => {
      logger.log('[App] 🔄 Machine update received:', update);

      // Atualiza apenas a máquina específica na lista
      setLiveMachines(prev => prev.map(m =>
        m.id === update.machineId
          ? {
            ...m,
            status: update.status as MachineStatus,
            operador_atual_id: update.operatorId || null,
            op_atual_id: update.opId || null
          }
          : m
      ));

      // Se for a máquina selecionada ou update veio do banco, faz refresh completo
      if (update.machineId === selectedMachineId || update.source === 'database') {
        logger.log('[App] 🔃 Refreshing machines due to update');
        fetchMachines();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, selectedMachineId]);

  // Fetch detailed Active OP data (including product info and production total) when activeOP changes
  useEffect(() => {
    const fetchOPDetails = async () => {
      if (!activeOP) {
        setProductionData({ totalProduced: 0 });
        return;
      }

      // 1. Fetch OP meta and product info
      const { data, error } = await supabase
        .from('ordens_producao')
        .select('*')
        .eq('id', activeOP)
        .single();

      if (data && !error) {
        // Only update if data is different/missing to avoid loops? 
        // Actually store setActiveOP already sets basic data, but this fetches relations.
        // We can update activeOPData directly in store if needed, or just let it be.
        // For now, let's assume setActiveOP handled it, or update it:
        useAppStore.getState().setActiveOP(data as any);
      }

      // 2. Fetch sum of produced items for this OP
      const { data: prodData, error: prodError } = await supabase
        .from('registros_producao')
        .select('quantidade_boa')
        .eq('op_id', activeOP);

      if (prodData && !prodError) {
        const total = prodData.reduce((acc, r) => acc + (r.quantidade_boa || 0), 0);

        // Context-aware update: Determine if we should overwrite local state
        const currentState = useAppStore.getState();
        const localProduced = currentState.totalProduced;
        const isActive = currentState.opState === 'PRODUCAO' || currentState.opState === 'SETUP' || currentState.opState === 'PARADA';

        // Update if:
        // 1. Machine is IDLE/Available (starting fresh)
        // 2. Machine is FINALIZED
        // 3. DB has MORE production than local (synced from another source)
        // 4. We are NOT active (fallback)
        if (!isActive || currentState.opState === 'FINALIZADA' || total > localProduced) {
          logger.log('[App] 📥 Syncing production from DB:', total);
          setProductionData({ totalProduced: total });
        } else {
          logger.log('[App] 🛡️ Preserving local production state:', localProduced, '(DB:', total, ')');
        }
      }
    };

    fetchOPDetails();
  }, [activeOP]);

  // currentMachine is now from store




  // ✅ FIX: Sync activeOP from currentMachine.op_atual_id when machine updates (e.g., page reload)
  // Also re-sync if we have the ID but not the full data (can happen after page refresh)
  useEffect(() => {
    const syncOP = async () => {
      // Sync if: machine has OP ID AND (activeOP is missing OR activeOPData is missing)
      if (currentMachine?.op_atual_id && (!activeOP || !activeOPData)) {
        logger.log('[App] 📋 Syncing active OP from machine:', currentMachine.op_atual_id);
        const { data: opData, error } = await supabase
          .from('ordens_producao')
          .select('*')
          .eq('id', currentMachine.op_atual_id)
          .single();

        if (error) {
          logger.error('[App] ❌ Error fetching OP:', error.message);
          return;
        }

        if (opData) {
          logger.log('[App] ✅ OP data loaded:', opData.codigo);
          // Update Store
          setActiveOP(opData as any);

          // Also set opState based on machine status
          let mappedState: OPState = 'IDLE';
          switch (currentMachine.status_atual) {
            case MachineStatus.SETUP: mappedState = 'SETUP'; break;
            case MachineStatus.RUNNING: mappedState = 'PRODUCAO'; break;
            case MachineStatus.STOPPED: mappedState = 'PARADA'; break;
            case MachineStatus.SUSPENDED: mappedState = 'SUSPENSA'; break;
            default: mappedState = 'IDLE';
          }
          setOpState(mappedState);
        }
      }
    };
    syncOP();
  }, [currentMachine?.op_atual_id, activeOP, activeOPData]);

  // Legacy Timer Logic Removed - Handled by Store and OperatorDashboard


  // opState is UI-only; RPCs handle DB transitions.
  useEffect(() => {
    // RPCs own machine state transitions to keep DB consistent.
  }, [opState, selectedMachineId, activeOP]);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Set operator's turno from user session (already fetched on login)
  useEffect(() => {
    if (currentUser?.turno) {
      setOperatorTurno(currentUser.turno);
    }
  }, [currentUser]);

  // Se o operador tentar entrar em máquina ocupada, abrir modal de troca em vez de redirecionar
  useEffect(() => {
    if (currentUser?.role !== 'OPERATOR') return;
    if (currentMachine?.operador_atual_id && currentMachine.operador_atual_id !== currentUser.id) {
      setSwitchError('Máquina ocupada. Digite a matrícula para assumir este posto.');
      setIsSwitchModalOpen(true);
    }
  }, [currentMachine?.operador_atual_id, currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!currentUser) {
      setOperatorAssignment(null);
      return;
    }
    if (!operatorAssignment || operatorAssignment.id === currentUser.id) {
      setOperatorAssignment({ id: currentUser.id, name: currentUser.name });
    }
  }, [currentUser]);

  const fetchActiveSession = async (opId: string | null) => {
    if (!opId) {
      setActiveOperatorSessionId(null);
      return;
    }
    const { data, error } = await supabase
      .from('op_operator_sessions')
      .select('id, operator_id, operadores(nome)')
      .eq('op_id', opId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .maybeSingle();
    if (!error && data) {
      setActiveOperatorSessionId(data.id);
      if (!operatorAssignment || operatorAssignment.id !== data.operator_id) {
        setOperatorAssignment({
          id: data.operator_id,
          name: (data as any).operadores?.nome || activeOperatorName
        });
      }
    } else {
      setActiveOperatorSessionId(null);
    }
  };

  const fetchOperatorSwitchData = async () => {
    setSwitchError(null);
    setIsFetchingSwitchData(true);
    try {
      const { data, error } = await supabase.from('turnos').select('id, nome, hora_inicio, hora_fim').order('hora_inicio', { ascending: true });
      if (error) throw error;
      setShiftOptions(data || []);
    } catch (error: any) {
      setSwitchError(error?.message || 'Erro ao carregar operadores e turnos.');
    } finally {
      setIsFetchingSwitchData(false);
    }
  };

  useEffect(() => {
    if (!isSwitchModalOpen) return;
    fetchOperatorSwitchData();
  }, [isSwitchModalOpen]);

  const handleOperatorSwitchConfirm = async (matricula: string, shiftId?: string | null) => {
    // Validações iniciais
    if (!selectedMachineId || !currentMachine) {
      setSwitchError('Selecione uma máquina antes de trocar o operador.');
      return;
    }

    if (!currentMachine?.id) {
      setSwitchError('Máquina não encontrada para registrar a sessão.');
      return;
    }

    if (!matricula?.trim()) {
      setSwitchError('Digite uma matrícula válida.');
      return;
    }

    const opIdForSession = currentMachine.op_atual_id || activeOP || activeOPCodigo || null;
    if (!opIdForSession) {
      setSwitchError('Nenhuma OP ativa encontrada para esta máquina.');
      return;
    }

    setIsSubmittingSwitch(true);
    setSwitchError(null);

    try {
      // Busca dados do operador
      const { data: opData, error: opError } = await supabase
        .from('operadores')
        .select('id, nome, matricula, setor_id, turno_id, turnos(nome)')
        .eq('matricula', matricula.trim())
        .eq('ativo', true)
        .maybeSingle();

      if (opError) {
        logger.error('[OperatorSwitch] Erro ao buscar operador:', opError);
        throw new Error('Erro ao validar matrícula do operador.');
      }

      if (!opData) {
        setSwitchError('Matrícula não encontrada ou operador inativo.');
        return;
      }

      // Validação de setor
      if (opData.setor_id !== currentMachine.setor_id) {
        setSwitchError('Operador não pertence ao setor desta máquina.');
        return;
      }

      if (!opData.id) {
        setSwitchError('Operador inválido para troca.');
        return;
      }

      logger.log('[OperatorSwitch] Iniciando troca de operador:', {
        op_id: opIdForSession,
        operator_id: opData.id,
        operator_name: opData.nome,
        maquina_id: currentMachine.id,
        shift_id: shiftId
      });

      // Executa a RPC de troca de operador
      const { data: sessionResult, error: sessionError } = await supabase.rpc('mes_switch_operator', {
        p_op_id: opIdForSession,
        p_operator_id: opData.id,
        p_shift_id: shiftId || null
      });

      if (sessionError) {
        logger.error('[OperatorSwitch] Erro na RPC mes_switch_operator:', sessionError);
        throw new Error('Falha ao registrar troca de operador: ' + sessionError.message);
      }

      const sessionId = Array.isArray(sessionResult) ? sessionResult[0] : sessionResult;
      if (!sessionId) {
        throw new Error('Não foi possível criar a sessão do operador.');
      }

      setActiveOperatorSessionId(sessionId);

      // Atualiza operador atual da máquina para UI
      await supabase.from('maquinas').update({
        operador_atual_id: opData.id
      }).eq('id', selectedMachineId);

      // Atualiza estados locais para refletir a troca imediatamente
      setLiveMachines(prev => prev.map(m =>
        m.id === selectedMachineId ? { ...m, operador_atual_id: opData.id } : m
      ));

      setCurrentMachine(prev => prev ? { ...prev, operador_atual_id: opData.id } : prev);

      // Atualiza a atribuição do operador ativo
      setOperatorAssignment({
        id: opData.id,
        name: opData.nome || activeOperatorName
      });

      // Atualiza o turno se fornecido
      const resolvedShift = shiftOptions.find(s => s.id === shiftId);
      const newShiftLabel = resolvedShift?.nome || (opData as any).turnos?.nome || operatorTurno;
      setOperatorTurno(newShiftLabel);

      // Busca a sessão recém-criada para garantir sincronização
      await fetchActiveSession(opIdForSession);

      // Broadcast da atualização para outros clientes
      await realtimeManager.broadcastMachineUpdate(
        createMachineUpdate(
          selectedMachineId,
          currentMachine.status_atual || MachineStatus.AVAILABLE,
          {
            operatorId: opData.id,
            opId: currentMachine.op_atual_id || null
          }
        )
      );

      logger.log('[OperatorSwitch] ✅ Troca realizada com sucesso:', {
        newOperatorId: opData.id,
        newOperatorName: opData.nome,
        sessionId,
        shiftId
      });

      setIsSwitchModalOpen(false);
    } catch (error: any) {
      setSwitchError(error?.message || 'Erro ao trocar o operador.');
    } finally {
      setIsSubmittingSwitch(false);
    }
  };

  const handleMachineSelect = async (machine: MachineData) => {
    logger.log('Selecting machine:', machine.nome, 'Current status:', machine.status_atual);

    // ✅ VALIDAÇÃO: Verificar se o operador já está em outra máquina
    if (currentUser?.role === 'OPERATOR') {
      // 1. Prevent selecting a machine preoccupied by ANOTHER operator
      if (machine.operador_atual_id && machine.operador_atual_id !== currentUser.id) {
        setSwitchError('Máquina ocupada. Digite a matrícula para assumir este posto.');
        setIsSwitchModalOpen(true);
      }

      // 2. Warn if operator is leaving a machine active (Optional: Logic exists below to clear it)
      const { data: occupiedMachine } = await supabase
        .from('maquinas')
        .select('id, nome')
        .eq('operador_atual_id', currentUser.id)
        .neq('id', machine.id)
        .maybeSingle();

      if (occupiedMachine) {
        // Allow switching, but warn/inform (Logic handled in handleChangeMachine mostly, but here we just warn)
        // Actually user said: "can pular de uma maquina pra outra". 
        // So we should ALLOW it, provided the TARGET is free.
        // We will clear the old machine binding below.
      }
    }

    // Update Store
    setSelectedMachine(machine.id);
    setCurrentMachine(machine);
    localStorage.setItem('flux_selected_machine', machine.id);

    // ✅ Atribuir operador à máquina
    if (currentUser?.role === 'OPERATOR') {
      await supabase.from('maquinas').update({
        operador_atual_id: currentUser.id
      }).eq('id', machine.id);
    }

    // Map MachineStatus to OPState
    let initialOPState: OPState = 'IDLE';
    switch (machine.status_atual) {
      case MachineStatus.SETUP: initialOPState = 'SETUP'; break;
      case MachineStatus.RUNNING: initialOPState = 'PRODUCAO'; break;
      case MachineStatus.STOPPED: initialOPState = 'PARADA'; break;
      case MachineStatus.SUSPENDED: initialOPState = 'SUSPENSA'; break;
      case MachineStatus.MAINTENANCE: initialOPState = 'MANUTENCAO'; break;
      default: initialOPState = 'IDLE';
    }
    setOpState(initialOPState);

    // Sync Timers from Machine Data
    if (machine.status_change_at) {
      syncTimers({ statusChangeAt: machine.status_change_at });
    }

    // If machine has an active OP, fetch its data
    if (machine.op_atual_id) {
      const { data: opData } = await supabase
        .from('ordens_producao')
        .select('*')
        .eq('id', machine.op_atual_id)
        .single();

      if (opData) {
        setActiveOP(opData); // Store Action
      }
    } else {
      // ✅ FIX: Se a máquina está em status de produção/setup mas SEM OP, reseta ela
      if (initialOPState === 'PRODUCAO' || initialOPState === 'SETUP' || initialOPState === 'PARADA') {
        logger.warn('[App] ⚠️ Máquina em estado inconsistente (sem OP). Resetando para IDLE.');
        setOpState('IDLE');
        await updateSelectedMachine({
          status_atual: MachineStatus.AVAILABLE,
          status_change_at: new Date().toISOString(),
          op_atual_id: null
        });
        setActiveOP(null);
      } else {
        setActiveOP(null);
      }
    }

    // Navigate using machine code/slug for friendly URLs
    const slug = getMachineSlug(machine);
    navigate(`/maquinas/${slug}`);
  };

  // Recover selected machine only on initial load, and only if user is the same
  useEffect(() => {
    // Don't auto-recover machine - always start fresh with machine selection
    // The machine selection is now mandatory for operators
    // Commented out to force machine selection on every login
    // const saved = localStorage.getItem('flux_selected_machine');
    // if (saved) setSelectedMachineId(saved);
  }, []);

  const updateSelectedMachine = async (updates: any) => {
    if (!selectedMachineId) {
      logger.log('No machine selected, cannot update');
      return;
    }
    logger.log('Updating machine:', selectedMachineId, 'with:', updates);
    const { error } = await supabase.from('maquinas').update(updates).eq('id', selectedMachineId);
    if (error) {
      logger.error('Error updating machine:', error);
    } else {
      logger.log('Machine updated successfully');
    }
  };

  const closeModals = () => setActiveModal(null);

  // Return to machine selection
  const handleChangeMachine = async () => {
    // ✅ Limpar operador da máquina atual no banco
    if (selectedMachineId && currentUser?.role === 'OPERATOR') {
      await supabase.from('maquinas').update({
        operador_atual_id: null
      }).eq('id', selectedMachineId);
    }

    // Reset Store via Action (optional, or just clear selected)
    setSelectedMachine(null);
    localStorage.removeItem('flux_selected_machine');
    navigate('/maquinas');
  };

  // Emergency clear function for stuck loading
  const handleEmergencyClear = () => {
    logger.log('Emergency clear triggered');
    // Clear ALL localStorage
    localStorage.clear();
    sessionStorage.clear();
    // Force page reload
    window.location.href = '/';
  };

  // Wrapper para logout com navegação
  const handleLogoutWithNav = async () => {
    // ✅ FIX: Navega para login PRIMEIRO usando window.location para garantir a navegação
    // Isso evita tela preta porque a navegação acontece antes do state mudar
    await handleLogout();
    // Força navegação com window.location para garantir que a página recarrega
    window.location.href = '/login';
  };



  if (authLoading) {
    return <Preloader />;
  }

  return (
    <div className="flex h-screen bg-background-dark text-text-main-dark overflow-hidden selection:bg-primary/30 selection:text-white">
      {location.pathname !== '/login' && !location.pathname.startsWith('/r/') && (
        <Sidebar
          onLogout={handleLogoutWithNav}
          userRole={currentUser?.role || 'OPERATOR'}
          userPermissions={userPermissions}
          sectorId={currentUser?.setor_id || null}
        />
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {location.pathname !== '/login' && !location.pathname.startsWith('/r/') && (
          <Header
            onLogout={handleLogoutWithNav}
            user={currentUser}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginScreen />} />

              <Route path="/maquinas" element={
                <ProtectedRoute user={currentUser} userPermissions={userPermissions}>
                  <MachineSelection
                    user={currentUser!}
                    machines={liveMachines}
                    onSelect={handleMachineSelect}
                    onLogout={handleLogoutWithNav}
                  />
                </ProtectedRoute>
              } />

              <Route path="/maquinas/:id" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_OPERATOR_DASHBOARD} userPermissions={userPermissions}>
                  {currentMachine ? (
                      <OperatorDashboard
                        opState={opState}
                        statusChangeAt={localStatusChangeAt}
                        realized={totalProduced}
                        oee={95} // TODO: Calculate OEE
                        opId={activeOP}
                        opCodigo={activeOPCodigo}
                      onOpenSetup={() => setActiveModal('setup')}
                      onOpenStop={() => setActiveModal('stop')}
                      onOpenFinalize={() => {
                        logger.log('Opening Finalize Modal');
                        setActiveModal('finalize');
                      }}
                      onGenerateLabel={() => setActiveModal('label')}
                      sessionId={activeOperatorSessionId}
                      onStop={async () => {
                        setActiveModal('stop');
                      }}
                      onRetomar={async () => {
                        if (currentMachine) {
                          const now = new Date().toISOString();

                          // Accumulate Stop Time
                          let newAccStop = accumulatedStopTime;
                          if (localStatusChangeAt && opState === 'PARADA') {
                            const elapsed = Math.floor((new Date().getTime() - new Date(localStatusChangeAt).getTime()) / 1000);
                            newAccStop += elapsed;
                          }

                          const lastState = localStorage.getItem(`flux_pre_stop_state_${currentMachine.id}`);
                          const nextStatus = lastState === 'SETUP' ? MachineStatus.SETUP : MachineStatus.RUNNING;
                          const nextOpState = lastState === 'SETUP' ? 'SETUP' : 'PRODUCAO';

                          const operatorId = activeOperatorId;
                          const { error: resumeError } = await supabase.rpc('mes_resume_machine', {
                            p_machine_id: currentMachine.id,
                            p_next_status: nextStatus,
                            p_operator_id: operatorId,
                            p_op_id: activeOP || null
                          });
                          if (resumeError) {
                            logger.error('Erro ao retomar maquina:', resumeError);
                            alert(`Erro ao retomar maquina: ${resumeError.message}`);
                            return;
                          }

                          syncTimers({
                            statusChangeAt: now,
                            accStop: newAccStop
                          });

                          await realtimeManager.broadcastMachineUpdate(createMachineUpdate(currentMachine.id, nextStatus, {
                            operatorId: activeOperatorId,
                            opId: activeOP
                          }));

                          setOpState(nextOpState);
                        }
                      }}
                      onStartProduction={async () => {
                        if (currentMachine) {
                          if (!activeOP) {
                            alert('⚠️ Não é possível iniciar a produção sem uma Ordem de Produção (OP) selecionada. Por favor, realize o SETUP.');
                            return;
                          }
                          const now = new Date().toISOString();

                          // Accumulate Setup Time BEFORE switching to Production
                          let newAccSetup = accumulatedSetupTime;
                          if (localStatusChangeAt && opState === 'SETUP') {
                            const elapsed = Math.floor((new Date().getTime() - new Date(localStatusChangeAt).getTime()) / 1000);
                            newAccSetup += elapsed;
                          }

                          const operatorId = activeOperatorId;
                          const { error: prodStartError } = await supabase.rpc('mes_start_production', {
                            p_machine_id: currentMachine.id,
                            p_op_id: activeOP,
                            p_operator_id: operatorId
                          });
                          if (prodStartError) {
                            logger.error('Erro ao iniciar producao:', prodStartError);
                            alert(`Erro ao iniciar producao: ${prodStartError.message}`);
                            return;
                          }

                          syncTimers({
                            statusChangeAt: now,
                            accSetup: newAccSetup
                          });

                          await realtimeManager.broadcastMachineUpdate(createMachineUpdate(currentMachine.id, MachineStatus.RUNNING, {
                            operatorId: activeOperatorId,
                            opId: activeOP
                          }));

                          setOpState('PRODUCAO');
                        }
                      }}
                      machineId={currentMachine.id}
                      machineName={currentMachine.nome || 'Máquina'}
                      sectorName={currentUser?.sector || 'Produção'}
                      operatorName={activeOperatorName}
                      shiftName={operatorTurno}
                      onSwitchOperator={() => setIsSwitchModalOpen(true)}
                      meta={activeOPData?.quantidade_meta || 0}
                      operatorId={currentUser!.id}
                      sectorId={currentMachine.setor_id}
                      loteId={currentLoteId || 'LOTE-PADRAO'}
                      onChangeMachine={handleChangeMachine}
                      userPermissions={userPermissions}
                      accumulatedSetupTime={accumulatedSetupTime}
                      accumulatedProductionTime={accumulatedProductionTime}
                      accumulatedStopTime={accumulatedStopTime}
                      onRegisterChecklist={async (status, obs) => {
                        const { data: opData } = await supabase.from('ordens_producao').select('id').eq('codigo', activeOP).single();
                        await supabase.from('checklist_eventos').insert({
                          op_id: opData?.id,
                          operador_id: activeOperatorId,
                          maquina_id: currentMachine.id,
                          setor_id: currentMachine.setor_id,
                          tipo_acionamento: 'tempo',
                          referencia_acionamento: 'Manual',
                          status,
                          observacao: obs
                        });
                      }}
                      onRegisterLogbook={async (desc) => {
                        const { error } = await supabase.from('diario_bordo_eventos').insert({
                          op_id: activeOP || null,
                          operador_id: currentUser!.id,
                          maquina_id: currentMachine.id,
                          setor_id: currentMachine.setor_id,
                          descricao: desc
                        });
                        if (error) throw error;
                      }}
                      onRequestMaintenance={async (description) => {
                        if (currentMachine && currentUser) {
                          logger.log('Solicitando manutenção:', { machine: currentMachine.id, description });

                          // 1. Criar chamado de manutenção na tabela separada
                          const { error } = await supabase.from('chamados_manutencao').insert({
                            maquina_id: currentMachine.id,
                            operador_id: activeOperatorId,
                            op_id: opIdForSession,
                            descricao: description,
                            prioridade: 'NORMAL',
                            status: 'ABERTO',
                            data_abertura: new Date().toISOString()
                          });

                          if (error) {
                            logger.error('Erro ao abrir chamado:', error);
                            alert('Erro ao registrar chamado de manutenção.');
                            return;
                          }

                          // 2. Mudar status para MAINTENANCE (mantém OP e operador vinculados)
                          // NÃO fechamos op_operadores - a manutenção é temporária
                          const now = new Date().toISOString();
                          localStorage.setItem(`flux_pre_stop_state_${currentMachine.id}`, opState);

                          let newAccProd = accumulatedProductionTime;
                          let newAccSetup = accumulatedSetupTime;

                          if (localStatusChangeAt && opState === 'PRODUCAO') {
                            newAccProd += Math.floor((new Date().getTime() - new Date(localStatusChangeAt).getTime()) / 1000);
                          } else if (localStatusChangeAt && opState === 'SETUP') {
                            newAccSetup += Math.floor((new Date().getTime() - new Date(localStatusChangeAt).getTime()) / 1000);
                          }

                          await supabase.from('maquinas').update({
                            status_atual: MachineStatus.MAINTENANCE,  // Status específico de manutenção
                            status_change_at: now
                          }).eq('id', currentMachine.id);

                          syncTimers({
                            statusChangeAt: now,
                            accProd: newAccProd,
                            accSetup: newAccSetup
                          });

                          await realtimeManager.broadcastMachineUpdate(
                            createMachineUpdate(currentMachine.id, MachineStatus.MAINTENANCE, {
                              operatorId: activeOperatorId,
                              opId: currentMachine.op_atual_id
                            })
                          );
                          setOpState('MANUTENCAO');
                          alert('Chamado de manutenção registrado. A máquina está aguardando atendimento.');
                        }
                      }}
                    />
                  ) : <Navigate to="/maquinas" replace />}
                </ProtectedRoute>
              } />

              <Route path="/supervisao" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_SUPERVISOR_DASHBOARD} userPermissions={userPermissions}>
                  <SupervisionDashboard machines={liveMachines} />
                </ProtectedRoute>
              } />

              <Route path="/administracao/*" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_ADMIN_DASHBOARD} userPermissions={userPermissions}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              <Route path="/relatorios" element={
                <ProtectedRoute user={currentUser} userPermissions={userPermissions}>
                  <Reports />
                </ProtectedRoute>
              } />

              <Route path="/admin/insights" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_SUPERVISOR_DASHBOARD} userPermissions={userPermissions}>
                  <AdminInsights />
                </ProtectedRoute>
              } />

              <Route path="/qualidade" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_QUALITY_DASHBOARD} userPermissions={userPermissions}>
                  <QualityDashboard />
                </ProtectedRoute>
              } />

              <Route path="/r/:loteId" element={<TraceabilityPage loteId={currentLoteId || ''} />} />

              <Route path="/etiqueta/:id" element={<LabelHistoryPage />} />

              {/* Maintenance Dashboard - TV/Admin */}
              <Route path="/manutencao" element={
                <ProtectedRoute user={currentUser} permission={Permission.VIEW_ADMIN_DASHBOARD} userPermissions={userPermissions}>
                  <MaintenanceDashboard machines={liveMachines} />
                </ProtectedRoute>
              } />

              <Route path="/" element={<Navigate to={!currentUser ? "/login" : (currentUser.role === 'ADMIN' ? "/administracao" : "/maquinas")} replace />} />
              <Route path="*" element={<Navigate to={!currentUser ? "/login" : "/"} replace />} />
            </Routes>
          </ErrorBoundary>
        </div>

        {/* Global Modals */}
        {activeModal === 'setup' && hasPermission(Permission.MANAGE_MACHINE_SETUP) && (
          <SetupModal
            machineId={currentMachine?.id}
            sectorId={currentMachine?.setor_id}
            onClose={closeModals}
            onConfirm={(op) => {
              const handleMachineSetup = async (op: ProductionOrder) => {
                if (selectedMachineId && currentUser) {
                  await supabase.from('op_operadores').update({ fim: new Date().toISOString() }).eq('maquina_id', selectedMachineId).is('fim', null);
                  await supabase.from('op_operadores').insert({
                    op_id: op.id,
                    operador_id: activeOperatorId,
                    maquina_id: selectedMachineId,
                    inicio: new Date().toISOString()
                  });
                  const now = new Date().toISOString();
                  const operatorId = activeOperatorId;
                  const { error: setupError } = await supabase.rpc('mes_start_setup', {
                    p_machine_id: selectedMachineId,
                    p_op_id: op.id,
                    p_operator_id: operatorId
                  });
                  if (setupError) {
                    logger.error('Erro ao iniciar setup:', setupError);
                    alert(`Erro ao iniciar setup: ${setupError.message}`);
                    return;
                  }

                  // Update Store
                  syncTimers({
                    accSetup: 0,
                    accProd: 0,
                    accStop: 0,
                    statusChangeAt: now
                  });

                  await realtimeManager.broadcastMachineUpdate(createMachineUpdate(selectedMachineId, MachineStatus.SETUP, {
                    operatorId: activeOperatorId,
                    opId: op.id
                  }));

                  setOpState('SETUP');
                  setActiveOP(op); // Sets activeOP, activeOPCodigo, activeOPData, meta AND resets counters to 0
                  setProductionData({ totalProduced: 0, totalScrap: 0 }); // Double ensure reset
                  setActiveModal(null);
                }
              };
              handleMachineSetup(op);
            }}
          />
        )}
        {activeModal === 'stop' && (
          <StopModal
            onClose={closeModals}
            onConfirm={async (reason, notes) => {
              if (currentMachine && currentUser) {
                logger.log('Salvando parada:', {
                  maquina_id: currentMachine.id,
                  operador_id: activeOperatorId,
                  op_id: opIdForSession,
                  motivo: reason,
                  notas: notes
                });

                const operatorId = activeOperatorId;
                const { error: stopError } = await supabase.rpc('mes_stop_machine', {
                  p_machine_id: currentMachine.id,
                  p_reason: reason,
                  p_notes: notes,
                  p_operator_id: operatorId,
                  p_op_id: opIdForSession || null
                });
                if (stopError) {
                  logger.error('Erro ao salvar parada:', stopError);
                  alert(`Erro ao salvar parada: ${stopError.message}`);
                  return;
                }

                // End assignment
                await supabase
                  .from('op_operadores')
                  .update({ fim: new Date().toISOString() })
                  .eq('maquina_id', currentMachine.id)
                  .is('fim', null);

                // Update Machine Status & Timestamp
                const now = new Date().toISOString();

                // ✅ FIX: Save current state to restore later
                localStorage.setItem(`flux_pre_stop_state_${currentMachine.id}`, opState);

                // Accumulate production time before stopping
                let newAccProd = accumulatedProductionTime;
                let newAccSetup = accumulatedSetupTime;

                if (lastPhaseStartTime && opState === 'PRODUCAO') {
                  const elapsed = Math.floor((new Date().getTime() - new Date(lastPhaseStartTime).getTime()) / 1000);
                  newAccProd += elapsed;
                }
                // ✅ FIX: Subscribe setup time as well
                else if (lastPhaseStartTime && opState === 'SETUP') {
                  const elapsed = Math.floor((new Date().getTime() - new Date(lastPhaseStartTime).getTime()) / 1000);
                  newAccSetup += elapsed;
                }

                syncTimers({
                  statusChangeAt: now,
                  accProd: newAccProd,
                  accSetup: newAccSetup
                });

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.STOPPED, {
                  operatorId: activeOperatorId,
                    opId: currentMachine.op_atual_id
                  })
                );
                setOpState('PARADA');
              }
              closeModals();
            }}
          />
        )}
        {activeModal === 'finalize' && (
          <FinalizeModal
            onClose={closeModals}
            opId={activeOPCodigo || 'N/A'}
            meta={activeOPData?.quantidade_meta || 500}
            realized={totalProduced}
            // Fix: Pass machine sector name if available to handle specific sector logic (like Colagem)
            sectorName={currentMachine?.setores?.nome || currentUser?.sector || 'Produção'}
            onTransfer={async (produced, pending) => {
              // Transfer to next sector (mark as ready for transfer)
              if (currentMachine && activeOP) {
                const delta = Math.max(0, produced - totalProduced);

                const operatorId = activeOperatorId;
                const { error: recordError } = await supabase.rpc('mes_record_production', {
                  p_op_id: activeOP,
                  p_machine_id: currentMachine.id,
                  p_operator_id: operatorId,
                  p_good_qty: delta,
                  p_scrap_qty: 0,
                  p_data_inicio: localStatusChangeAt || new Date().toISOString(),
                  p_data_fim: new Date().toISOString(),
                  p_turno: 'Transferencia'
                });
                if (recordError) {
                  logger.error('Erro ao registrar producao:', recordError);
                  alert(`Erro ao registrar producao: ${recordError.message}`);
                  return;
                }

                setProductionData({ totalProduced: totalProduced + delta });

                // Update OP with accumulated quantities
                await supabase.from('ordens_producao').update({
                  quantidade_produzida: produced,
                  quantidade_refugo: 0,
                  tempo_producao_segundos: accumulatedProductionTime,
                  tempo_setup_segundos: accumulatedSetupTime,
                  tempo_parada_segundos: accumulatedStopTime
                }).eq('id', activeOP);

                // Release machine but KEEP operator logged in
                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.AVAILABLE,
                  status_change_at: new Date().toISOString(),
                  op_atual_id: null
                  // ✅ operador_atual_id NOT cleared - operator stays logged in
                }).eq('id', currentMachine.id);

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.AVAILABLE, {
                    operatorId: activeOperatorId, // ✅ Operator remains on machine
                    opId: null
                  })
                );

                // ✅ CRITICAL FIX: Atualizar currentMachine local
                setCurrentMachine({
                  ...currentMachine,
                  op_atual_id: null,
                  status_atual: MachineStatus.AVAILABLE
                });

                setOpState('IDLE');
                setActiveOP(null);
                closeModals();
              }
            }}
            onConfirm={async (good, scrap) => {
              console.log('[App] 🏁 Iniciando finalização de OP...', { activeOP, currentMachine: currentMachine?.id, currentUser: currentUser?.id });

              if (!currentMachine || !currentUser || !activeOP) {
                console.error('[App] ❌ Erro: Estado inválido para finalizar OP', {
                  hasMachine: !!currentMachine,
                  hasUser: !!currentUser,
                  hasOP: !!activeOP
                });
                alert('Erro: Não foi possível finalizar a OP. Verifique se você está logado e se a máquina está selecionada corretamente.');
                return;
              }

              try {
                // Determine shift (simplified logic for now)
                const currentHour = new Date().getHours();
                const turno = (currentHour >= 6 && currentHour < 14) ? 'Manhã' : (currentHour >= 14 && currentHour < 22) ? 'Tarde' : 'Noite';

                const delta = Math.max(0, good - totalProduced);

                console.log('[App] 💾 Salvando registro de produção...');
                // Save production log (historical record)
                const operatorId = activeOperatorId;
                const { error: recordError } = await supabase.rpc('mes_record_production', {
                  p_op_id: activeOP,
                  p_machine_id: currentMachine.id,
                  p_operator_id: operatorId,
                  p_good_qty: delta,
                  p_scrap_qty: scrap,
                  p_data_inicio: localStatusChangeAt || new Date().toISOString(),
                  p_data_fim: new Date().toISOString(),
                  p_turno: turno
                });

                if (recordError) throw new Error(`Erro ao salvar registro de producao: ${recordError.message}`);

                setProductionData({ totalProduced: totalProduced + delta });

                console.log('[App] 📦 Gerando lote de rastreabilidade...');
                // Generate Lot Record
                const { data: lote, error: loteError } = await supabase.from('lotes_rastreabilidade').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  setor_origem_id: currentMachine.setor_id,
                  quantidade_liberada: good,
                  quantidade_refugo: scrap
                }).select('id').single();

                if (loteError) console.error('[App] ⚠️ Erro ao gerar lote (não bloqueante):', loteError);
                if (lote) setCurrentLoteId(lote.id);

                console.log('[App] Finalizando OP...');
                const { error: finalizeError } = await supabase.rpc('mes_finalize_op', {
                  p_machine_id: currentMachine.id,
                  p_op_id: activeOP,
                  p_operator_id: operatorId,
                  p_good_qty: good,
                  p_scrap_qty: scrap,
                  p_tempo_setup: accumulatedSetupTime,
                  p_tempo_producao: accumulatedProductionTime,
                  p_tempo_parada: accumulatedStopTime
                });

                if (finalizeError) throw new Error(`Erro ao finalizar OP: ${finalizeError.message}`);

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.AVAILABLE, {
                    operatorId: activeOperatorId, // ✅ Operator remains on machine
                    opId: null
                  })
                );


                // ✅ FIX: Limpar localStorage da OP finalizada
                localStorage.removeItem(`flux_acc_setup_${activeOP}`);
                localStorage.removeItem(`flux_acc_prod_${activeOP}`);
                localStorage.removeItem(`flux_acc_stop_${activeOP}`);
                localStorage.removeItem(`flux_phase_start_${activeOP}`);
                localStorage.removeItem(`flux_status_change_${activeOP}`);

                // ✅ FIX: Após encerrar OP, a máquina SEMPRE volta para IDLE
                // O operador deve iniciar manualmente a próxima OP via SETUP
                console.log('[App] ℹ️ OP Finalizada. Retornando máquina para estado IDLE/Aguardando.');

                // ✅ CRITICAL FIX: Atualizar currentMachine local para evitar que o useEffect de sync restaure a OP
                if (currentMachine) {
                  setCurrentMachine({
                    ...currentMachine,
                    op_atual_id: null,
                    status_atual: MachineStatus.AVAILABLE
                  });
                }

                setOpState('IDLE');
                setActiveOP(null);
                setProductionData({ totalProduced: 0, totalScrap: 0 });

                // Resetar acumuladores de tempo
                syncTimers({
                  accSetup: 0,
                  accProd: 0,
                  accStop: 0,
                  statusChangeAt: new Date().toISOString()
                });

                setActiveModal('label');
                console.log('[App] ✅ OP Finalizada com sucesso!');

              } catch (error: any) {
                console.error('[App] ❌ Erro CRÍTICO ao finalizar OP:', error);
                alert(`ERRO AO FINALIZAR OP: ${error.message || 'Erro desconhecido'}. \n\nPor favor, anote os valores e contate o suporte.`);
              }
            }}

            onSuspend={async (produced, pending) => {
              if (currentMachine && activeOP) {
                const delta = Math.max(0, produced - totalProduced);

                // Save partial production record (the delta)
                const operatorId = activeOperatorId;
                const { error: prodError } = await supabase.rpc('mes_record_production', {
                  p_op_id: activeOP,
                  p_machine_id: currentMachine.id,
                  p_operator_id: operatorId,
                  p_good_qty: delta,
                  p_scrap_qty: 0,
                  p_data_inicio: localStatusChangeAt || new Date().toISOString(),
                  p_data_fim: new Date().toISOString(),
                  p_turno: 'Parcial'
                });

                if (prodError) {
                  console.error('Erro ao salvar producao parcial:', prodError);
                  alert(`Erro ao salvar producao: ${prodError.message}`);
                }

                setProductionData({ totalProduced: totalProduced + delta });

                await supabase
                  .from('op_operadores')
                  .update({ fim: new Date().toISOString() })
                  .eq('maquina_id', currentMachine.id)
                  .is('fim', null);

                // Update OP with accumulated quantities, sector of suspension, and status
                await supabase.from('ordens_producao').update({
                  status: 'SUSPENSA',
                  quantidade_produzida: produced,
                  quantidade_pendente: pending,
                  setor_suspensao_id: currentMachine.setor_id,
                  quantidade_refugo: 0,
                  tempo_producao_segundos: accumulatedProductionTime,
                  tempo_setup_segundos: accumulatedSetupTime,
                  tempo_parada_segundos: accumulatedStopTime
                }).eq('id', activeOP);

                // Update Machine Status & Timestamp (KEEP operator logged in)
                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.SUSPENDED,
                  status_change_at: new Date().toISOString(),
                  op_atual_id: null
                  // ✅ operador_atual_id NOT cleared - operator stays logged in
                }).eq('id', currentMachine.id);

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.SUSPENDED, {
                    operatorId: currentUser?.id, // ✅ Operator remains on machine
                    opId: null
                  })
                );

                // ✅ CRITICAL FIX: Atualizar currentMachine local
                setCurrentMachine({
                  ...currentMachine,
                  op_atual_id: null,
                  status_atual: MachineStatus.SUSPENDED
                });

                setActiveOP(null); // ✅ Clear local OP state
                setOpState('IDLE'); // ✅ Return dashboard to IDLE (Free machine)
                closeModals();
              }
            }}
          />
        )}
        {activeModal === 'label' && (
          <LabelModal
            onClose={() => {
              setActiveOP(null);
              setCurrentLoteId(null);
              closeModals();
            }}
            opId={activeOPCodigo || activeOP || 'N/A'}
            realized={totalProduced}
            loteId={currentLoteId || ''}
            machine={currentMachine?.nome || 'Máquina'}
            operator={activeOperatorName}
            unit="PÇS"
            productName={activeOPData?.nome_produto || 'Produto Indefinido'}
            productDescription={activeOPData?.codigo || ''}
            shift={operatorTurno || 'N/A'}
          />
        )}
        <OperatorSwitchModal
          isOpen={isSwitchModalOpen}
          onClose={() => setIsSwitchModalOpen(false)}
          onConfirm={handleOperatorSwitchConfirm}
          shifts={shiftOptions}
          isLoading={isFetchingSwitchData}
          isSubmitting={isSubmittingSwitch}
          error={switchError}
          currentShiftId={currentShiftOptionId}
        />
      </main>
    </div>
  );
};

export default App;









