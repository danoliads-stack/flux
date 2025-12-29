import React, { useState, useEffect, useMemo } from 'react';
import { MachineStatus, AppUser, Permission, MachineData, ProductionOrder, OPState } from './types';
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
import { supabase } from './src/lib/supabase-client';
import { realtimeManager, createMachineUpdate } from './src/utils/realtimeManager';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useAppStore } from './src/store/useAppStore';

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



const App: React.FC = () => {
  const { user: currentUser, logout: handleLogout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeModal, setActiveModal] = useState<string | null>(null);

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
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);

  // Last phase start time (synced with store statusChangeAt for relative calc)
  const lastPhaseStartTime = localStatusChangeAt;

  // Last phase start time (for calculating time to add when transitioning)
  // Legacy states removed in favor of store


  const [liveMachines, setLiveMachines] = useState<MachineData[]>([]);

  // PERSISTENCE: Replaced by Zustand persist middleware
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
  useEffect(() => {
    if (location.pathname.startsWith('/r/')) return; // Traceability links

    if (currentUser) {
      console.log('[App] 👤 User changed, role:', currentUser.role);

      // Default redirections based on login
      if (location.pathname === '/' || location.pathname === '/login') {
        if (currentUser.role === 'OPERATOR') {
          navigate('/maquinas');
        } else if (currentUser.role === 'ADMIN') {
          navigate('/administracao');
        } else if (currentUser.role === 'SUPERVISOR') {
          navigate('/supervisao');
        }
      }
    } else if (!authLoading) {
      // User logged out
      console.log('[App] 🔓 User logged out, redirecting to login');
      if (location.pathname !== '/login' && !location.pathname.startsWith('/r/')) {
        navigate('/login');
      }
    }
  }, [currentUser, authLoading, navigate]);

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

    // Subscribe to realtime updates usando o manager centralizado
    const unsubscribe = realtimeManager.subscribeMachineUpdates((update) => {
      console.log('[App] 🔄 Machine update received:', update);

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
        console.log('[App] 🔃 Refreshing machines due to update');
        fetchMachines();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

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
        .select('*, produtos(nome, codigo)')
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
        setProductionData({ totalProduced: total });
      }
    };

    fetchOPDetails();
  }, [activeOP]);

  // currentMachine is now from store




  // ✅ FIX: Sync activeOP from currentMachine.op_atual_id when machine updates (e.g., page reload)
  useEffect(() => {
    const syncOP = async () => {
      if (currentMachine?.op_atual_id && !activeOP) {
        console.log('[App] 📋 Syncing active OP from machine:', currentMachine.op_atual_id);
        const { data: opData } = await supabase
          .from('ordens_producao')
          .select('*, produtos(nome, codigo)')
          .eq('id', currentMachine.op_atual_id)
          .single();

        if (opData) {
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
  }, [currentMachine?.op_atual_id, activeOP]);

  // Legacy Timer Logic Removed - Handled by Store and OperatorDashboard


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

    // Update Store
    setSelectedMachine(machine.id);
    setCurrentMachine(machine);
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

    // Sync Timers from Machine Data
    if (machine.status_change_at) {
      syncTimers({ statusChangeAt: machine.status_change_at });
    }

    // If machine has an active OP, fetch its data
    if (machine.op_atual_id) {
      const { data: opData } = await supabase
        .from('ordens_producao')
        .select('*, produtos(nome, codigo)')
        .eq('id', machine.op_atual_id)
        .single();

      if (opData) {
        setActiveOP(opData); // Store Action
      }
    } else {
      // ✅ FIX: Se a máquina está em status de produção/setup mas SEM OP, reseta ela
      if (initialOPState === 'PRODUCAO' || initialOPState === 'SETUP' || initialOPState === 'PARADA') {
        console.warn('[App] ⚠️ Máquina em estado inconsistente (sem OP). Resetando para IDLE.');
        setOpState('IDLE');
        await updateSelectedMachine({
          status_atual: MachineStatus.AVAILABLE,
          status_change_at: new Date().toISOString()
        });
        setActiveOP(null);
      } else {
        setActiveOP(null);
      }
    }

    navigate(`/maquinas/${machine.id}`);
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
    // Reset Store via Action (optional, or just clear selected)
    setSelectedMachine(null);
    localStorage.removeItem('flux_selected_machine');
    navigate('/maquinas');
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



  if (authLoading) {
    return <Preloader />;
  }

  return (
    <div className="flex h-screen bg-background-dark text-white overflow-hidden font-sans selection:bg-primary/30 selection:text-white">
      {location.pathname !== '/login' && !location.pathname.startsWith('/r/') && (
        <Sidebar
          onLogout={handleLogout}
          userRole={currentUser?.role || 'OPERATOR'}
          userPermissions={userPermissions}
        />
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {location.pathname !== '/login' && !location.pathname.startsWith('/r/') && (
          <Header
            onLogout={handleLogout}
            user={currentUser}
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
                    onLogout={handleLogout}
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
                      onOpenFinalize={() => setActiveModal('finalize')}
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

                          await supabase.from('maquinas').update({
                            status_atual: nextStatus,
                            status_change_at: now
                          }).eq('id', currentMachine.id);

                          syncTimers({
                            statusChangeAt: now,
                            accStop: newAccStop
                          });

                          await realtimeManager.broadcastMachineUpdate(createMachineUpdate(currentMachine.id, nextStatus, {
                            operatorId: currentUser!.id,
                            opId: activeOP
                          }));

                          setOpState(nextOpState);
                        }
                      }}
                      onStartProduction={async () => {
                        if (currentMachine) {
                          const now = new Date().toISOString();

                          // Accumulate Setup Time BEFORE switching to Production
                          let newAccSetup = accumulatedSetupTime;
                          if (localStatusChangeAt && opState === 'SETUP') {
                            const elapsed = Math.floor((new Date().getTime() - new Date(localStatusChangeAt).getTime()) / 1000);
                            newAccSetup += elapsed;
                          }

                          await supabase.from('maquinas').update({
                            status_atual: MachineStatus.RUNNING,
                            status_change_at: now
                          }).eq('id', currentMachine.id);

                          syncTimers({
                            statusChangeAt: now,
                            accSetup: newAccSetup
                          });

                          await realtimeManager.broadcastMachineUpdate(createMachineUpdate(currentMachine.id, MachineStatus.RUNNING, {
                            operatorId: currentUser!.id,
                            opId: activeOP
                          }));

                          setOpState('PRODUCAO');
                        }
                      }}
                      machineId={currentMachine.id}
                      machineName={currentMachine.nome || 'Máquina'}
                      sectorName={currentUser?.sector || 'Produção'}
                      operatorName={currentUser?.name || 'Operador'}
                      shiftName={operatorTurno}
                      meta={activeOPData?.quantidade_meta || 0}
                      operatorId={currentUser!.id}
                      sectorId={currentMachine.setor_id}
                      loteId={currentLoteId || 'LOTE-PADRAO'}
                      onChangeMachine={handleChangeMachine}
                      accumulatedSetupTime={accumulatedSetupTime}
                      accumulatedProductionTime={accumulatedProductionTime}
                      accumulatedStopTime={accumulatedStopTime}
                      onGenerateLabel={() => setActiveModal('label')}
                      onRegisterChecklist={async (status, obs) => {
                        const { data: opData } = await supabase.from('ordens_producao').select('id').eq('codigo', activeOP).single();
                        await supabase.from('checklist_eventos').insert({
                          op_id: opData?.id,
                          operador_id: currentUser!.id,
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

              <Route path="/r/:loteId" element={<TraceabilityPage loteId={currentLoteId || ''} />} />

              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/" element={<Navigate to={currentUser?.role === 'ADMIN' ? "/administracao" : "/maquinas"} replace />} />
            </Routes>
          </ErrorBoundary>
        </div>

        {/* Global Modals */}
        {activeModal === 'setup' && hasPermission(Permission.MANAGE_MACHINE_SETUP) && (
          <SetupModal
            machineId={currentMachine?.id}
            onClose={closeModals}
            onConfirm={(op) => {
              const handleMachineSetup = async (op: ProductionOrder) => {
                if (selectedMachineId && currentUser) {
                  await supabase.from('op_operadores').update({ fim: new Date().toISOString() }).eq('maquina_id', selectedMachineId).is('fim', null);
                  await supabase.from('op_operadores').insert({
                    op_id: op.id,
                    operador_id: currentUser.id,
                    maquina_id: selectedMachineId,
                    inicio: new Date().toISOString()
                  });
                  const now = new Date().toISOString();
                  await supabase.from('maquinas').update({
                    status_atual: MachineStatus.SETUP,
                    status_change_at: now,
                    op_atual_id: op.id
                  }).eq('id', selectedMachineId);

                  // Update Store
                  syncTimers({
                    accSetup: 0,
                    accProd: 0,
                    accStop: 0,
                    statusChangeAt: now
                  });

                  await realtimeManager.broadcastMachineUpdate(createMachineUpdate(selectedMachineId, MachineStatus.SETUP, {
                    operatorId: currentUser.id,
                    opId: op.id
                  }));

                  setOpState('SETUP');
                  setActiveOP(op); // Sets activeOP, activeOPCodigo, activeOPData, meta
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

                await supabase.from('maquinas').update({
                  status_atual: MachineStatus.STOPPED,
                  status_change_at: now
                }).eq('id', currentMachine.id);

                syncTimers({
                  statusChangeAt: now,
                  accProd: newAccProd,
                  accSetup: newAccSetup
                });

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.STOPPED, {
                    operatorId: currentUser.id,
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
            sectorName={currentUser?.sector || 'Produção'}
            onTransfer={async (produced, pending) => {
              // Transfer to next sector (mark as ready for transfer)
              if (currentMachine && activeOP) {
                const delta = Math.max(0, produced - totalProduced);

                await supabase.from('registros_producao').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  operador_id: currentUser?.id,
                  quantidade_boa: delta,
                  quantidade_refugo: 0,
                  data_inicio: localStatusChangeAt || new Date().toISOString(), // ✅ Added data_inicio
                  data_fim: new Date().toISOString(),
                  turno: 'Transferência'
                });

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
                    operatorId: currentUser?.id, // ✅ Operator remains on machine
                    opId: null
                  })
                );

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
                const { error: prodError } = await supabase.from('registros_producao').insert({
                  op_id: activeOP, // activeOP is already the UUID
                  maquina_id: currentMachine.id,
                  operador_id: currentUser.id,
                  quantidade_boa: delta,
                  quantidade_refugo: scrap,
                  data_inicio: localStatusChangeAt || new Date().toISOString(), // ✅ Added data_inicio
                  data_fim: new Date().toISOString(),
                  turno: turno
                });

                if (prodError) throw new Error(`Erro ao salvar registro de produção: ${prodError.message}`);

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

                console.log('[App] 🔄 Atualizando status da máquina...');
                // Update Machine Status & Timestamp (Reset to AVAILABLE but KEEP operator)
                const { error: machineError } = await supabase.from('maquinas').update({
                  status_atual: MachineStatus.AVAILABLE,
                  status_change_at: new Date().toISOString(),
                  op_atual_id: null
                  // ✅ operador_atual_id NOT cleared - operator stays logged in
                }).eq('id', currentMachine.id);

                if (machineError) throw new Error(`Erro ao liberar máquina: ${machineError.message}`);

                await realtimeManager.broadcastMachineUpdate(
                  createMachineUpdate(currentMachine.id, MachineStatus.AVAILABLE, {
                    operatorId: currentUser.id, // ✅ Operator remains on machine
                    opId: null
                  })
                );

                console.log('[App] 📝 Atualizando Ordem de Produção...');
                // Update OP Status with accumulated quantities and times
                const { error: opError } = await supabase.from('ordens_producao').update({
                  status: 'FINALIZADA',
                  quantidade_produzida: good,
                  quantidade_refugo: scrap,
                  tempo_producao_segundos: accumulatedProductionTime,
                  tempo_setup_segundos: accumulatedSetupTime,
                  tempo_parada_segundos: accumulatedStopTime
                }).eq('id', activeOP);

                if (opError) throw new Error(`Erro ao atualizar OP: ${opError.message}`);

                // ✅ FIX: Limpar localStorage da OP finalizada
                localStorage.removeItem(`flux_acc_setup_${activeOP}`);
                localStorage.removeItem(`flux_acc_prod_${activeOP}`);
                localStorage.removeItem(`flux_acc_stop_${activeOP}`);
                localStorage.removeItem(`flux_phase_start_${activeOP}`);
                localStorage.removeItem(`flux_status_change_${activeOP}`);

                console.log('[App] ⏭️ Verificando próxima OP...');
                // --- AUTO-START NEXT OP ---
                // Buscar a próxima OP na sequência
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
                  syncTimers({
                    accSetup: 0,
                    accProd: 0,
                    accStop: 0,
                    statusChangeAt: now
                  });
                  setOpState('SETUP');
                  setProductionData({ totalProduced: 0 }); // ✅ FIX: Reset Realizado para nova OP
                  setActiveOP(nextOP); // will fully load details via useEffect if needed, but here we set basic info
                } else {
                  // ✅ FIX: Limpar tudo se não há próxima OP
                  setActiveOP(null);
                  setProductionData({ totalProduced: 0 });
                  setOpState('IDLE'); // IDLE em vez de FINALIZADA para permitir iniciar nova OP
                }

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
                const { error: prodError } = await supabase.from('registros_producao').insert({
                  op_id: activeOP,
                  maquina_id: currentMachine.id,
                  operador_id: currentUser?.id,
                  quantidade_boa: delta,
                  quantidade_refugo: 0,
                  data_inicio: localStatusChangeAt || new Date().toISOString(), // ✅ Added data_inicio
                  data_fim: new Date().toISOString(),
                  turno: 'Parcial'
                });

                if (prodError) {
                  console.error('Erro ao salvar produção parcial:', prodError);
                  alert(`Erro ao salvar produção: ${prodError.message}`);
                }

                setProductionData({ totalProduced: totalProduced + delta });

                await supabase
                  .from('op_operadores')
                  .update({ fim: new Date().toISOString() })
                  .eq('maquina_id', currentMachine.id)
                  .is('fim', null);

                // Update OP with accumulated quantities and status
                await supabase.from('ordens_producao').update({
                  status: 'SUSPENSA',
                  quantidade_produzida: produced,
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
            realized={totalProduced}
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
