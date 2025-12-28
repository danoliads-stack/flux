import React, { useState, useEffect, useMemo } from 'react';
import { UserPerspective, MachineStatus, AppUser, Permission, MachineData, ProductionOrder, OPState } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OperatorDashboard from './components/OperatorDashboard';
import SupervisionDashboard from './components/SupervisionDashboard';
import AdminDashboard from './components/AdminDashboard';
import Reports from './components/Reports';
import LoginScreen from './components/LoginScreen';
import MachineSelection from './components/MachineSelection';
import SetupModal from './components/modals/SetupModal';
import StopModal from './components/modals/StopModal';
import FinalizeModal from './components/modals/FinalizeModal';
import LabelModal from './components/modals/LabelModal';
import TraceabilityPage from './components/TraceabilityPage';
import Preloader from './components/Preloader';
import { ROLE_CONFIGS } from './constants';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';



const App: React.FC = () => {
  const { user: currentUser, logout: handleLogout, loading: authLoading } = useAuth();

  // Persist perspective in sessionStorage (independent per tab)
  // Aguarda AuthContext finalizar para evitar race conditions
  const [perspective, setPerspective] = useState<UserPerspective>('LOGIN');
  const [perspectiveInitialized, setPerspectiveInitialized] = useState(false);

  // Restaura perspectiva apenas após AuthContext inicializar
  useEffect(() => {
    if (!authLoading && !perspectiveInitialized) {
      const authInitialized = sessionStorage.getItem('flux_auth_initialized');
      if (authInitialized === 'true') {
        const saved = sessionStorage.getItem('flux_perspective');
        if (saved && saved !== 'LOGIN') {
          console.log('[App] 🔄 Restoring perspective:', saved);
          setPerspective(saved as UserPerspective);
        }
        setPerspectiveInitialized(true);
      }
    }
  }, [authLoading, perspectiveInitialized]);

  // Salva perspectiva quando mudar
  useEffect(() => {
    if (perspectiveInitialized && perspective !== 'LOGIN') {
      console.log('[App] 💾 Saving perspective:', perspective);
      sessionStorage.setItem('flux_perspective', perspective);
    }
  }, [perspective, perspectiveInitialized]);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeOP, setActiveOP] = useState<string | null>(null);
  const [activeOPCodigo, setActiveOPCodigo] = useState<string | null>(null);
  const [activeOPData, setActiveOPData] = useState<any>(null); // Full OP data with meta
  const [operatorTurno, setOperatorTurno] = useState<string>('Turno Atual');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);

  // --- CENTRAL OPS STATE ---
  const [opState, setOpState] = useState<OPState>('IDLE');
  const [localStatusChangeAt, setLocalStatusChangeAt] = useState<string | null>(null); // Local timestamp for current phase timer

  // Accumulated Times (in seconds) - persisted per OP session
  const [accumulatedSetupTime, setAccumulatedSetupTime] = useState(0);
  const [accumulatedProductionTime, setAccumulatedProductionTime] = useState(0);
  const [accumulatedStopTime, setAccumulatedStopTime] = useState(0);

  // Last phase start time (for calculating time to add when transitioning)
  const [lastPhaseStartTime, setLastPhaseStartTime] = useState<string | null>(null);

  // Legacy states (kept for compatibility)
  const [setupSeconds, setSetupSeconds] = useState(0);
  const [productionSeconds, setProductionSeconds] = useState(0);
  const [timerStartDate, setTimerStartDate] = useState<Date | null>(null);

  const [liveMachines, setLiveMachines] = useState<MachineData[]>([]);

  // PERSISTENCE: Save accumulated times to localStorage whenever they change
  useEffect(() => {
    if (activeOP) {
      localStorage.setItem(`flux_acc_setup_${activeOP}`, accumulatedSetupTime.toString());
      localStorage.setItem(`flux_acc_prod_${activeOP}`, accumulatedProductionTime.toString());
      localStorage.setItem(`flux_acc_stop_${activeOP}`, accumulatedStopTime.toString());
      if (lastPhaseStartTime) {
        localStorage.setItem(`flux_phase_start_${activeOP}`, lastPhaseStartTime);
      }
      if (localStatusChangeAt) {
        localStorage.setItem(`flux_status_change_${activeOP}`, localStatusChangeAt);
      }
    }
  }, [activeOP, accumulatedSetupTime, accumulatedProductionTime, accumulatedStopTime, lastPhaseStartTime, localStatusChangeAt]);

  // PERSISTENCE: Load accumulated times from localStorage when OP is activated
  useEffect(() => {
    if (activeOP) {
      const savedSetup = localStorage.getItem(`flux_acc_setup_${activeOP}`);
      const savedProd = localStorage.getItem(`flux_acc_prod_${activeOP}`);
      const savedStop = localStorage.getItem(`flux_acc_stop_${activeOP}`);
      const savedPhaseStart = localStorage.getItem(`flux_phase_start_${activeOP}`);
      const savedStatusChange = localStorage.getItem(`flux_status_change_${activeOP}`);

      if (savedSetup) setAccumulatedSetupTime(parseInt(savedSetup));
      if (savedProd) setAccumulatedProductionTime(parseInt(savedProd));
      if (savedStop) setAccumulatedStopTime(parseInt(savedStop));
      if (savedPhaseStart) setLastPhaseStartTime(savedPhaseStart);
      if (savedStatusChange) setLocalStatusChangeAt(savedStatusChange);
    }
  }, [activeOP]);

  // Detect public traceability link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lote = params.get('lote');
    if (lote) {
      setCurrentLoteId(lote);
      setPerspective('TRACEABILITY');
    }
  }, []);

  // Update perspective based on user role when user changes
  useEffect(() => {
    if (perspective === 'TRACEABILITY') return; // Don't override if in traceability view
    if (!perspectiveInitialized) return; // Aguarda inicialização de perspectiva

    if (currentUser) {
      console.log('[App] 👤 User changed, role:', currentUser.role);

      if (currentUser.role === 'OPERATOR') {
        // Always reset to machine selection when operator logs in
        // The selectedMachineId should be null for new sessions
        if (!selectedMachineId) {
          setPerspective('MACHINE_SELECTION');
        } else {
          setPerspective('OPERATOR');
        }
      } else {
        // Reset machine selection for non-operators
        setSelectedMachineId(null);
        localStorage.removeItem('flux_selected_machine');

        // Restore saved perspective if valid for this role, otherwise default to role
        const savedPerspective = sessionStorage.getItem('flux_perspective');
        const isAllowed = (p: string) => {
          if (currentUser.role === 'ADMIN') return true;
          if (currentUser.role === 'SUPERVISOR') return ['SUPERVISOR', 'REPORTS', 'OPERATOR'].includes(p);
          if (currentUser.role === 'OPERATOR') return ['OPERATOR', 'MACHINE_SELECTION'].includes(p);
          return false;
        };

        if (savedPerspective && isAllowed(savedPerspective) && savedPerspective !== 'LOGIN') {
          console.log('[App] ✅ Keeping saved perspective:', savedPerspective);
          setPerspective(savedPerspective as UserPerspective);
        } else {
          // Default views per role
          const defaultPerspective: UserPerspective = currentUser.role === 'OPERATOR'
            ? (selectedMachineId ? 'OPERATOR' : 'MACHINE_SELECTION')
            : (currentUser.role as UserPerspective);
          console.log('[App] 🔄 Setting default perspective:', defaultPerspective);
          setPerspective(defaultPerspective);
        }
      }
    } else {
      // User logged out - reset everything
      console.log('[App] 🔓 User logged out, resetting perspective');
      setSelectedMachineId(null);
      localStorage.removeItem('flux_selected_machine');
      sessionStorage.removeItem('flux_perspective');
      setPerspective('LOGIN');
    }
  }, [currentUser, perspectiveInitialized]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return [];
    const config = ROLE_CONFIGS.find(c => c.role === currentUser.role);
    return config?.permissions || [];
  }, [currentUser]);

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

        console.log('Paradas encontradas:', paradas, paradasError);

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

        console.log('ParadasMap:', Object.fromEntries(paradasMap));

        setLiveMachines(data.map(m => ({
          ...m,
          status: m.status_atual as MachineStatus,
          stopReason: paradasMap.get(m.id) || null
        })));
      }
    };

    fetchMachines();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, () => {
        fetchMachines();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros_producao' }, () => {
        // Refresh machines when production is logged (updates OEE/Realized if they are in the table)
        fetchMachines();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Fetch detailed Active OP data (including product info) when activeOP changes
  useEffect(() => {
    const fetchOPDetails = async () => {
      if (!activeOP) return;

      const { data, error } = await supabase
        .from('ordens_producao')
        .select('*, produtos(nome, codigo)')
        .eq('id', activeOP)
        .single();

      if (data && !error) {
        setActiveOPData(data as any);
      } else if (error) {
        console.error('Error fetching extended OP details:', error);
      }
    };

    fetchOPDetails();
  }, [activeOP]);

  const currentMachine = useMemo(() =>
    liveMachines.find(m => m.id === selectedMachineId) || null
    , [liveMachines, selectedMachineId]);

  // Centralized Timer with Persistence
  useEffect(() => {
    let interval: any;
    const updateTimer = () => {
      if (!timerStartDate) return;
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - timerStartDate.getTime()) / 1000);

      if (opState === 'SETUP') {
        const initialSeconds = parseInt(localStorage.getItem(`flux_setup_offset_${selectedMachineId}`) || '0');
        setSetupSeconds(initialSeconds + diffSeconds);
      } else if (opState === 'PRODUCAO') {
        const initialSeconds = parseInt(localStorage.getItem(`flux_production_offset_${selectedMachineId}`) || '0');
        setProductionSeconds(initialSeconds + diffSeconds);
      }
    };

    if (opState === 'SETUP' || opState === 'PRODUCAO') {
      // Immediate update
      updateTimer();
      // Interval update
      interval = setInterval(updateTimer, 1000);
    }

    return () => clearInterval(interval);
  }, [opState, timerStartDate, selectedMachineId]);

  // Manage Timer Start/Resume Logic on Status Change
  useEffect(() => {
    if (!selectedMachineId) return;

    const storageKey = `flux_timer_start_${selectedMachineId}`;
    const savedStart = localStorage.getItem(storageKey);

    if (opState === 'SETUP' || opState === 'PRODUCAO') {
      if (savedStart) {
        // Resume from saved start
        setTimerStartDate(new Date(parseInt(savedStart)));
      } else {
        // New start
        const now = new Date();
        setTimerStartDate(now);
        localStorage.setItem(storageKey, now.getTime().toString());
      }
    } else {
      // Pause/Stop: Clear current timer start but KEEP the accumulated offset if creating a pause logic (not implemented here fully yet)
      // For now, if we go to IDLE or PARADA, we stop the active timer.
      // Ideally, on PARADA we might want to keep the productionSeconds frozen but ready to resume.
      // BUT, checking the requirement: "production continues running... until explicitly finalized"

      // If we are strictly stopped (PARADA), we don't increment, but we shouldn't lose the accumulated time.
      if (opState === 'PARADA' && timerStartDate) {
        // Accumulate current session into offset
        const now = new Date();
        const diff = Math.floor((now.getTime() - timerStartDate.getTime()) / 1000);
        const currentOffset = parseInt(localStorage.getItem(`flux_production_offset_${selectedMachineId}`) || '0');
        localStorage.setItem(`flux_production_offset_${selectedMachineId}`, (currentOffset + diff).toString());
        localStorage.removeItem(storageKey); // Stop current session
        setTimerStartDate(null);
      }
      else if (opState === 'FINALIZADA') {
        // Clear everything
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`flux_production_offset_${selectedMachineId}`);
        localStorage.removeItem(`flux_setup_offset_${selectedMachineId}`);
        setProductionSeconds(0);
        setSetupSeconds(0);
        setTimerStartDate(null);
      }
    }
  }, [opState, selectedMachineId]);

  // Sync opState to DB status_atual
  useEffect(() => {
    const syncStatus = async () => {
      if (!selectedMachineId) return;
      let dbStatus: MachineStatus = MachineStatus.AVAILABLE;

      switch (opState) {
        case 'IDLE': dbStatus = MachineStatus.AVAILABLE; break;
        case 'SETUP': dbStatus = MachineStatus.SETUP; break;
        case 'PRODUCAO': dbStatus = MachineStatus.RUNNING; break;
        case 'PARADA': dbStatus = MachineStatus.STOPPED; break;
        case 'SUSPENSA': dbStatus = MachineStatus.SUSPENDED; break;
        case 'FINALIZADA': dbStatus = MachineStatus.AVAILABLE; break;
      }

      const updates: any = { status_atual: dbStatus };
      if (opState === 'IDLE' || opState === 'FINALIZADA') {
        updates.op_atual_id = null;
        updates.operador_atual_id = null;
      } else if (opState === 'SETUP' && activeOPData?.id) {
        updates.op_atual_id = activeOPData.id;
        updates.operador_atual_id = currentUser?.id;
      }

      await supabase.from('maquinas').update(updates).eq('id', selectedMachineId);
    };
    syncStatus();
  }, [opState, selectedMachineId]);

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

  const handleMachineSelect = async (machine: MachineData) => {
    console.log('Selecting machine:', machine.nome, 'Current status:', machine.status_atual);
    setSelectedMachineId(machine.id);
    localStorage.setItem('flux_selected_machine', machine.id);

    // Map MachineStatus to OPState
    let initialOPState: OPState = 'IDLE';
    switch (machine.status_atual) {
      case MachineStatus.SETUP: initialOPState = 'SETUP'; break;
      case MachineStatus.RUNNING: initialOPState = 'PRODUCAO'; break;
      case MachineStatus.STOPPED: initialOPState = 'PARADA'; break;
      case MachineStatus.SUSPENDED: initialOPState = 'SUSPENSA'; break;
      default: initialOPState = 'IDLE';
    }
    setOpState(initialOPState);

    // Initial load of offsets
    const savedSetupOffset = parseInt(localStorage.getItem(`flux_setup_offset_${machine.id}`) || '0');
    const savedProdOffset = parseInt(localStorage.getItem(`flux_production_offset_${machine.id}`) || '0');
    setSetupSeconds(savedSetupOffset);
    setProductionSeconds(savedProdOffset);

    // If machine has an active OP, fetch its data
    if (machine.op_atual_id) {
      const { data: opData } = await supabase
        .from('ordens_producao')
        .select('*')
        .eq('id', machine.op_atual_id)
        .single();

      if (opData) {
        setActiveOP(opData.id); // Store UUID
        setActiveOPCodigo(opData.codigo); // Store Code for display
        setActiveOPData(opData);
      }
    } else {
      setActiveOP(null);
      setActiveOPCodigo(null);
      setActiveOPData(null);
    }

    setPerspective('OPERATOR');
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
      console.log('No machine selected, cannot update');
      return;
    }
    console.log('Updating machine:', selectedMachineId, 'with:', updates);
    const { error } = await supabase.from('maquinas').update(updates).eq('id', selectedMachineId);
    if (error) {
      console.error('Error updating machine:', error);
    } else {
      console.log('Machine updated successfully');
    }
  };

  const closeModals = () => setActiveModal(null);

  // Return to machine selection
  const handleChangeMachine = () => {
    setSelectedMachineId(null);
    localStorage.removeItem('flux_selected_machine');
    setActiveOP(null);
    setActiveOPCodigo(null);
    setActiveOPData(null);
    setOpState('IDLE');
    setSetupSeconds(0);
    setProductionSeconds(0);
    setTimerStartDate(null);
    setPerspective('MACHINE_SELECTION');
  };

  // Emergency clear function for stuck loading
  const handleEmergencyClear = () => {
    console.log('Emergency clear triggered');
    // Clear ALL localStorage
    localStorage.clear();
    sessionStorage.clear();
    // Force page reload
    window.location.href = '/';
  };



  if (perspective === 'LOGIN' || (!currentUser && perspective !== 'TRACEABILITY')) {
    return <LoginScreen />;
  }

  if (perspective === 'MACHINE_SELECTION' && currentUser) {
    return (
      <MachineSelection
        user={currentUser}
        machines={liveMachines}
        onSelect={handleMachineSelect}
        onLogout={handleLogout}
      />
    );
  }

  if (authLoading) {
    return <Preloader />;
  }

  return (
    <div className="flex h-screen bg-background-dark text-white overflow-hidden font-sans selection:bg-primary/30 selection:text-white">
      {perspective !== 'TRACEABILITY' && (
        <Sidebar
          perspective={perspective}
          setPerspective={setPerspective}
          onLogout={handleLogout}
          userRole={currentUser?.role || 'OPERATOR'}
          userPermissions={userPermissions}
        />
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {perspective !== 'TRACEABILITY' && (
          <Header
            perspective={perspective}
            onLogout={handleLogout}
            user={currentUser}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          {perspective === 'OPERATOR' && hasPermission(Permission.VIEW_OPERATOR_DASHBOARD) && currentMachine && (
            <OperatorDashboard

              opState={opState}
              statusChangeAt={localStatusChangeAt}
              realized={0} // TODO: Fetch from registros_producao
              oee={95} // TODO: Calculate OEE
              opId={activeOP}
              opCodigo={activeOPCodigo}
              onOpenSetup={() => setActiveModal('setup')}
              onOpenStop={() => setActiveModal('stop')}
              onOpenFinalize={() => setActiveModal('finalize')}
              onStop={async () => {
                setActiveModal('stop');
              }}
              onRetomar={async () => {
                if (currentMachine) {
                  const now = new Date().toISOString();

                  // Accumulate stop time from PARADA phase
                  if (lastPhaseStartTime && opState === 'PARADA') {
                    const elapsed = Math.floor((new Date().getTime() - new Date(lastPhaseStartTime).getTime()) / 1000);
                    setAccumulatedStopTime(prev => prev + elapsed);
                  }

                  await supabase.from('maquinas').update({
                    status_atual: MachineStatus.RUNNING,
                    status_change_at: now
                  }).eq('id', currentMachine.id);

                  setLocalStatusChangeAt(now);
                  setLastPhaseStartTime(now);
                  setOpState('PRODUCAO');
                }
              }}
              onStartProduction={async () => {
                if (currentMachine) {
                  const now = new Date().toISOString();

                  // Accumulate setup time from SETUP phase
                  if (lastPhaseStartTime && opState === 'SETUP') {
                    const elapsed = Math.floor((new Date().getTime() - new Date(lastPhaseStartTime).getTime()) / 1000);
                    setAccumulatedSetupTime(prev => prev + elapsed);
                  }

                  await supabase.from('maquinas').update({
                    status_atual: MachineStatus.RUNNING,
                    status_change_at: now
                  }).eq('id', currentMachine.id);

                  setLocalStatusChangeAt(now);
                  setLastPhaseStartTime(now);
                  setOpState('PRODUCAO');
                }
              }}
              machineId={currentMachine.id}
              machineName={currentMachine.nome || 'Máquina'}
              sectorName={currentUser.sector || 'Produção'}
              operatorName={currentUser.name || 'Operador'}
              shiftName={operatorTurno}
              meta={activeOPData?.quantidade_meta || 0}
              operatorId={currentUser.id}
              sectorId={currentMachine.setor_id}
              loteId={currentLoteId || 'LOTE-PADRAO'}
              onChangeMachine={handleChangeMachine}
              // Accumulated times
              accumulatedSetupTime={accumulatedSetupTime}
              accumulatedProductionTime={accumulatedProductionTime}
              accumulatedStopTime={accumulatedStopTime}
              // Generate label at any time
              onGenerateLabel={() => setActiveModal('label')}
              onRegisterChecklist={async (status, obs) => {
                const { data: opData } = await supabase.from('ordens_producao').select('id').eq('codigo', activeOP).single();
                await supabase.from('checklist_eventos').insert({
                  op_id: opData?.id,
                  operador_id: currentUser.id,
                  maquina_id: currentMachine.id,
                  setor_id: currentMachine.setor_id,
                  tipo_acionamento: 'tempo',
                  referencia_acionamento: 'Manual',
                  status,
                  observacao: obs
                });
              }}
              onRegisterLogbook={async (desc) => {
                console.log('Saving diary entry:', { desc, activeOP, machineId: currentMachine.id });
                const { error } = await supabase.from('diario_bordo_eventos').insert({
                  op_id: activeOP || null, // activeOP já é o UUID
                  operador_id: currentUser.id,
                  maquina_id: currentMachine.id,
                  setor_id: currentMachine.setor_id,
                  descricao: desc
                });
                if (error) {
                  console.error('Error saving diary entry:', error);
                  throw error;
                }
                console.log('Diary entry saved successfully');
              }}
            />
          )}
          {perspective === 'SUPERVISOR' && hasPermission(Permission.VIEW_SUPERVISOR_DASHBOARD) && (
            <SupervisionDashboard machines={liveMachines} />
          )}
          {perspective === 'ADMIN' && hasPermission(Permission.VIEW_ADMIN_DASHBOARD) && (
            <AdminDashboard />
          )}
          {perspective === 'REPORTS' && (
            <Reports />
          )}
          {perspective === 'TRACEABILITY' && currentLoteId && (
            <TraceabilityPage loteId={currentLoteId} />
          )}

          {((perspective === 'OPERATOR' && !hasPermission(Permission.VIEW_OPERATOR_DASHBOARD)) ||
            (perspective === 'SUPERVISOR' && !hasPermission(Permission.VIEW_SUPERVISOR_DASHBOARD)) ||
            (perspective === 'ADMIN' && !hasPermission(Permission.VIEW_ADMIN_DASHBOARD))) && (
              <div className="h-full flex flex-col items-center justify-center text-text-sub-dark">
                <span className="material-icons-outlined text-6xl mb-4">lock</span>
                <h2 className="text-2xl font-bold text-white">Acesso Negado</h2>
                <p>Você não tem permissão para visualizar esta tela.</p>
              </div>
            )}
        </div>

        {/* Global Modals */}
        {activeModal === 'setup' && hasPermission(Permission.MANAGE_MACHINE_SETUP) && (
          <SetupModal
            machineId={currentMachine?.id}
            onClose={closeModals}
            onConfirm={(op) => {
              const handleMachineSetup = async (op: ProductionOrder) => {
                if (selectedMachineId && currentUser) {
                  // 1. End previous assignment if it exists
                  await supabase
                    .from('op_operadores')
                    .update({ fim: new Date().toISOString() })
                    .eq('maquina_id', selectedMachineId)
                    .is('fim', null);

                  // 2. Start new assignment
                  await supabase
                    .from('op_operadores')
                    .insert({
                      op_id: op.id,
                      operador_id: currentUser.id,
                      maquina_id: selectedMachineId,
                      inicio: new Date().toISOString()
                    });

                  // 3. Update Machine Status & Timestamp for Timer
                  const now = new Date().toISOString();
                  await supabase.from('maquinas').update({
                    status_atual: MachineStatus.SETUP,
                    status_change_at: now,
                    op_atual_id: op.id
                  }).eq('id', selectedMachineId);

                  // Reset all accumulators for new OP session
                  setAccumulatedSetupTime(0);
                  setAccumulatedProductionTime(0);
                  setAccumulatedStopTime(0);

                  setLocalStatusChangeAt(now);
                  setLastPhaseStartTime(now); // Start tracking phase time
                  setOpState('SETUP');
                  setSetupSeconds(0);
                  setProductionSeconds(0);
                  setActiveOP(op.id);
                  setActiveOPCodigo(op.codigo);
                  setActiveOPData(op);
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
                console.log('Salvando parada:', {
                  maquina_id: currentMachine.id,
                  operador_id: currentUser.id,
                  op_id: currentMachine.op_atual_id,
                  motivo: reason,
                  notas: notes
                });

                const { data, error } = await supabase.from('paradas').insert({
                  maquina_id: currentMachine.id,
                  operador_id: currentUser.id,
                  op_id: currentMachine.op_atual_id,
                  motivo: reason,
                  notas: notes,
                  data_inicio: new Date().toISOString()
                }).select();

                if (error) {
                  console.error('Erro ao salvar parada:', error);
                  alert(`Erro ao salvar parada: ${error.message}`);
                } else {
                  console.log('Parada salva com sucesso:', data);
                }

                // End assignment
                await supabase
                  .from('op_operadores')
                  .update({ fim: new Date().toISOString() })
                  .eq('maquina_id', currentMachine.id)
                  .is('fim', null);

                // Update Machine Status & Timestamp
                const now = new Date().toISOString();

                // Accumulate production time before stopping
                if (lastPhaseStartTime && opState === 'PRODUCAO') {
                  const elapsed = Math.floor((new Date().getTime() - new Date(lastPhaseStartTime).getTime()) / 1000);
                  setAccumulatedProductionTime(prev => prev + elapsed);
                }

                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.STOPPED,
                  status_change_at: now
                }).eq('id', currentMachine.id);

                setLocalStatusChangeAt(now);
                setLastPhaseStartTime(now);
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
            realized={0} // TODO: Fetch real produced count from registros_producao
            sectorName={currentUser?.sector || 'Produção'}
            onTransfer={async (produced, pending) => {
              // Transfer to next sector (mark as ready for transfer)
              if (currentMachine && activeOP) {
                await supabase.from('registros_producao').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  operador_id: currentUser?.id,
                  quantidade_boa: produced,
                  quantidade_refugo: 0,
                  data_fim: new Date().toISOString(),
                  turno: 'Transferência'
                });

                // Release machine but keep OP in EM_ANDAMENTO
                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.AVAILABLE,
                  status_change_at: new Date().toISOString(),
                  op_atual_id: null,
                  operador_atual_id: null
                }).eq('id', currentMachine.id);

                setOpState('IDLE');
                setActiveOP(null);
                closeModals();
              }
            }}
            onConfirm={async (good, scrap) => {
              if (currentMachine && currentUser && activeOP) {
                // Determine shift (simplified logic for now)
                const currentHour = new Date().getHours();
                const turno = (currentHour >= 6 && currentHour < 14) ? 'Manhã' : (currentHour >= 14 && currentHour < 22) ? 'Tarde' : 'Noite';

                await supabase.from('registros_producao').insert({
                  op_id: activeOP, // activeOP is already the UUID
                  maquina_id: currentMachine.id,
                  operador_id: currentUser.id,
                  quantidade_boa: good,
                  quantidade_refugo: scrap,
                  data_fim: new Date().toISOString(),
                  turno: turno
                });

                // Generate Lot Record
                const { data: lote } = await supabase.from('lotes_rastreabilidade').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  setor_origem_id: currentMachine.setor_id,
                  quantidade_liberada: good,
                  quantidade_refugo: scrap
                }).select('id').single();

                if (lote) setCurrentLoteId(lote.id);

                // End assignment
                // Update Machine Status & Timestamp (Reset to AVAILABLE)
                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.AVAILABLE,
                  status_change_at: new Date().toISOString(),
                  op_atual_id: null,
                  operador_atual_id: null
                }).eq('id', currentMachine.id);

                // Update OP Status
                await supabase.from('ordens_producao').update({ status: 'FINALIZADA' }).eq('id', activeOP);

                // --- AUTO-START NEXT OP ---
                // Buscar a próxima OP na sequência (status != FINALIZADA, != CANCELADA, sequence > current OR just next by sequence)
                const { data: nextOPs } = await supabase
                  .from('ordens_producao')
                  .select('*')
                  .eq('maquina_id', currentMachine.id)
                  .neq('status', 'FINALIZADA')
                  .neq('status', 'CANCELADA')
                  .neq('id', activeOP) // Garante que não pega a mesma
                  .order('posicao_sequencia', { ascending: true })
                  .limit(1);

                const nextOP = nextOPs && nextOPs.length > 0 ? nextOPs[0] : null;

                if (nextOP) {
                  console.log('Iniciando próxima OP automaticamente:', nextOP.codigo);

                  // 1. Criar vínculo operador-máquina-OP
                  await supabase.from('op_operadores').insert({
                    op_id: nextOP.id,
                    operador_id: currentUser.id,
                    maquina_id: currentMachine.id,
                    inicio: new Date().toISOString()
                  });

                  // 2. Atualizar Máquina para SETUP com nova OP
                  const now = new Date().toISOString();
                  await supabase.from('maquinas').update({
                    status_atual: MachineStatus.SETUP,
                    status_change_at: now,
                    op_atual_id: nextOP.id,
                    operador_atual_id: currentUser.id
                  }).eq('id', currentMachine.id);

                  // 3. Resetar estados locais e carregar nova OP
                  setAccumulatedSetupTime(0);
                  setAccumulatedProductionTime(0);
                  setAccumulatedStopTime(0);
                  setLocalStatusChangeAt(now);
                  setLastPhaseStartTime(now);
                  setOpState('SETUP');
                  setSetupSeconds(0);
                  setProductionSeconds(0);
                  setActiveOP(nextOP.id);
                  setActiveOPCodigo(nextOP.codigo);
                  setActiveOPData(nextOP); // Será atualizado detalhadamente pelo useEffect
                } else {
                  setOpState('FINALIZADA');
                  // Se não tem próxima, fica disponível
                }

                setActiveModal('label');
              }
            }}
            onSuspend={async (produced, pending) => {
              if (currentMachine && activeOP) {
                // Save partial production record
                await supabase.from('registros_producao').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  operador_id: currentUser?.id,
                  quantidade_boa: produced,
                  quantidade_refugo: 0,
                  data_fim: new Date().toISOString(),
                  turno: 'Parcial'
                });

                await supabase
                  .from('op_operadores')
                  .update({ fim: new Date().toISOString() })
                  .eq('maquina_id', currentMachine.id)
                  .is('fim', null);

                // Update OP with pending quantity info
                await supabase.from('ordens_producao').update({
                  status: 'SUSPENSA'
                }).eq('id', activeOP);

                // Update Machine Status & Timestamp
                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.SUSPENDED,
                  status_change_at: new Date().toISOString()
                }).eq('id', currentMachine.id);

                setOpState('SUSPENSA');
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
            realized={0} // TODO: Get final count from DB state
            loteId={currentLoteId || ''}
            machine={currentMachine?.nome || 'Máquina'}
            operator={currentUser?.name || 'Operador'}
            unit="PÇS"
            productName={activeOPData?.produtos?.nome || 'Produto Indefinido'}
            productDescription={activeOPData?.produtos?.codigo || ''}
          />
        )}
      </main>
    </div>
  );
};

export default App;
