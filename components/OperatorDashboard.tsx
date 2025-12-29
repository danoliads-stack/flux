import React, { useState, useEffect, useRef } from 'react';
import { RecentRecord, OPState } from '../types';
import { supabase } from '../supabase';
import ChecklistExecutionModal from './modals/ChecklistExecutionModal';
import LabelModal from './modals/LabelModal';

interface OperatorDashboardProps {
  opState: OPState;
  statusChangeAt: string | null; // Timestamp for current phase timer
  realized: number;
  oee: number;
  opId: string | null;
  onOpenSetup: () => void;
  onOpenStop: () => void;
  onOpenFinalize: () => void;
  onStop: () => void;
  onRetomar: () => void;
  onStartProduction: () => void;
  onRegisterChecklist: (status: 'ok' | 'problema', obs?: string) => void;
  onRegisterLogbook: (description: string) => void;
  onGenerateLabel?: () => void; // New: Generate label at any time
  machineId: string;
  opCodigo?: string | null;
  machineName?: string;
  sectorName?: string;
  operatorName?: string;
  shiftName?: string;
  meta?: number;
  operatorId?: string;
  sectorId?: string;
  loteId?: string;
  onChangeMachine?: () => void;
  // Accumulated times (in seconds)
  accumulatedSetupTime?: number;
  accumulatedProductionTime?: number;
  accumulatedStopTime?: number;
}

interface Checklist {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  item_count?: number;
  intervalo_minutos?: number;
  intervalo_etiqueta_minutos?: number;
}

interface DiaryEntry {
  id: string;
  descricao: string;
  tipo: 'info' | 'warning' | 'danger';
  autor: string;
  created_at: string;
}

const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  opState, statusChangeAt, realized, oee, opId, opCodigo,
  onOpenSetup, onOpenStop, onOpenFinalize, machineId,
  onRegisterChecklist, onRegisterLogbook, onStartProduction, onRetomar,
  onGenerateLabel,
  machineName = 'Máquina', sectorName = 'Produção', operatorName = 'Operador', shiftName = 'Turno', meta: propMeta,
  operatorId = '', sectorId = '', loteId = 'LOTE-001',
  onChangeMachine,
  accumulatedSetupTime = 0, accumulatedProductionTime = 0, accumulatedStopTime = 0
}) => {
  const meta = propMeta || 500;
  const [time, setTime] = useState(new Date().toLocaleTimeString('pt-BR'));

  // New Independent Timer State
  const [elapsedString, setElapsedString] = useState('00:00:00');

  // Timer Effect
  useEffect(() => {
    if (!statusChangeAt || opState === 'IDLE') {
      setElapsedString('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(statusChangeAt).getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));

      const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');

      setElapsedString(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [statusChangeAt, opState]);

  // Helper: Format seconds to HH:MM:SS
  const formatSeconds = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Calculate current phase elapsed seconds (for adding to accumulated)
  const currentPhaseSeconds = statusChangeAt
    ? Math.max(0, Math.floor((Date.now() - new Date(statusChangeAt).getTime()) / 1000))
    : 0;

  // Total times including current phase
  const totalSetupDisplay = opState === 'SETUP'
    ? formatSeconds(accumulatedSetupTime + currentPhaseSeconds)
    : formatSeconds(accumulatedSetupTime);

  const totalProductionDisplay = opState === 'PRODUCAO'
    ? formatSeconds(accumulatedProductionTime + currentPhaseSeconds)
    : formatSeconds(accumulatedProductionTime);

  const totalStopDisplay = opState === 'PARADA'
    ? formatSeconds(accumulatedStopTime + currentPhaseSeconds)
    : formatSeconds(accumulatedStopTime);

  // Pass the correct elapsed string to display based on state
  const displayTimer = elapsedString;

  const [records, setRecords] = useState<RecentRecord[]>([]);
  // ... rest of state ...
  const [productInfo, setProductInfo] = useState<{ nome: string; codigo: string } | null>(null);

  // Production stats state
  const [totalProduced, setTotalProduced] = useState(0);
  const [totalScrap, setTotalScrap] = useState(0);
  const [opQuantity, setOpQuantity] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('--:--');
  const [operatorShiftProduction, setOperatorShiftProduction] = useState(0);


  // Configuration Constants (In future this could be loaded from backend)
  const [labelIntervalMinutes, setLabelIntervalMinutes] = useState(90); // 90 minutes adjustable
  const MONITORING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes fixed

  // States
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [lastMonitorTime, setLastMonitorTime] = useState<Date>(new Date());

  // OEE States
  const [cycleTime, setCycleTime] = useState(0);
  const [calculatedOEE, setCalculatedOEE] = useState(0);

  // Calculate OEE Effect
  useEffect(() => {
    // Avoid division by zero
    if (accumulatedProductionTime > 0 && cycleTime > 0) {
      // OEE = (Total Produced * Ideal Cycle Time) / Run Time
      // Result is a percentage (0-100+)
      const theoreticalTime = totalProduced * cycleTime;
      const efficiency = (theoreticalTime / accumulatedProductionTime) * 100;
      setCalculatedOEE(Math.min(999, Math.max(0, efficiency))); // Cap at sensible limits if needed, but allow over-performance
    } else if (accumulatedProductionTime === 0 && totalProduced === 0) {
      setCalculatedOEE(0); // Start at 0
    }
  }, [accumulatedProductionTime, totalProduced, cycleTime]);

  // Checklist states
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [allDiaryEntries, setAllDiaryEntries] = useState<DiaryEntry[]>([]); // For full view
  const [showDiaryModal, setShowDiaryModal] = useState(false); // Popup for all entries
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>('');
  const [newDiaryText, setNewDiaryText] = useState('');
  const [showDiaryInput, setShowDiaryInput] = useState(false);

  // Diary editing state
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [editingDiaryText, setEditingDiaryText] = useState('');

  // Alert states for timer notifications
  const [pendingAlert, setPendingAlert] = useState<{ type: 'checklist' | 'etiqueta'; message: string; checklistId?: string } | null>(null);

  // OP Sequence for machine
  const [sequencedOPs, setSequencedOPs] = useState<{ id: string; codigo: string; status: string; produto_nome?: string }[]>([]);

  // Draggable sidebar state - Initial position bottom-right to avoid clock
  const [sidebarPosition, setSidebarPosition] = useState({ x: window.innerWidth - 280, y: window.innerHeight - 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (sidebarRef.current) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - sidebarPosition.x,
        y: e.clientY - sidebarPosition.y
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setSidebarPosition({
          x: Math.max(0, Math.min(window.innerWidth - 220, e.clientX - dragOffset.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.current.y))
        });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sidebarPosition]);

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch and combine records function
  const fetchLogs = async () => {
    // 1. Logs de Produção
    const { data: prodData } = await supabase
      .from('registros_producao')
      .select('*')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 2. Paradas
    const { data: stopData } = await supabase
      .from('paradas')
      .select('*')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar tipos de parada para mapear ID -> Nome
    const { data: tiposParada } = await supabase
      .from('tipos_parada')
      .select('id, nome');

    const tiposMap = new Map<string, string>();
    tiposParada?.forEach((t: any) => tiposMap.set(t.id, t.nome));

    // 3. Buscar checklists para nome
    const { data: checklistData } = await supabase
      .from('checklist_eventos')
      .select('*, checklists(nome)')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Diário de Bordo (NOVO)
    const { data: diaryData } = await supabase
      .from('diario_bordo_eventos')
      .select('*')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Combinar e Ordenar
    const allRecords = [
      ...(prodData || []).map(p => ({
        timestamp: p.created_at,
        data: {
          time: new Date(p.created_at).toLocaleTimeString('pt-BR'),
          event: 'Produção',
          detail: `Meta: ${p.quantidade_meta || 0} | Bom: ${p.quantidade_boa}`,
          user: operatorName, // TODO: Fetch actual user name
          status: 'Finalizado'
        }
      })),
      ...(stopData || []).map(s => ({
        timestamp: s.created_at,
        data: {
          time: new Date(s.created_at).toLocaleTimeString('pt-BR'),
          event: 'Parada',
          detail: tiposMap.get(s.motivo) || s.notas || 'Parada registrada',
          user: operatorName,
          status: 'Justificado'
        }
      })),
      ...(checklistData || []).map(c => ({
        timestamp: c.created_at,
        data: {
          time: new Date(c.created_at).toLocaleTimeString('pt-BR'),
          event: 'Checklist',
          detail: c.checklists?.nome || 'Checklist',
          user: operatorName,
          status: c.status === 'ok' ? 'OK' : c.status === 'NAO_REALIZADO' ? 'Não Realizado' : c.status
        }
      })),
      ...(diaryData || []).map(d => ({
        timestamp: d.created_at,
        data: {
          time: new Date(d.created_at).toLocaleTimeString('pt-BR'),
          event: 'Diário',
          detail: d.descricao,
          user: d.autor,
          status: 'Nota'
        }
      }))
    ];

    // Sort by timestamp descending ensuring correct chronological order
    allRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Update state with top 5 records
    setRecords(allRecords.slice(0, 5).map(x => x.data));
  };

  // Fetch checklists
  const fetchChecklists = async () => {
    const { data } = await supabase
      .from('checklists')
      .select('id, nome, tipo, obrigatorio, intervalo_minutos, intervalo_etiqueta_minutos')
      .eq('ativo', true)
      .order('obrigatorio', { ascending: false });

    if (data) setChecklists(data);
  };

  // Fetch OP Sequence for current machine
  const fetchOPSequence = async () => {
    if (!machineId) return;

    const { data } = await supabase
      .from('ordens_producao')
      .select('id, codigo, status, produtos(nome)')
      .eq('maquina_id', machineId)
      .neq('status', 'FINALIZADA')
      .order('posicao_sequencia', { ascending: true })
      .limit(10);

    if (data) {
      setSequencedOPs(data.map(op => ({
        id: op.id,
        codigo: op.codigo,
        status: op.status,
        produto_nome: Array.isArray(op.produtos) ? op.produtos[0]?.nome : (op.produtos as any)?.nome
      })));
    }
  };

  // Fetch operator shift production
  const fetchOperatorShiftProduction = async () => {
    if (!operatorId) return;

    // Get current turno start
    const { data: turnos } = await supabase
      .from('turnos')
      .select('*')
      .eq('ativo', true);

    if (turnos && turnos.length > 0) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

      const activeTurno = turnos.find(t => {
        const inicio = t.hora_inicio.substring(0, 5);
        const fim = t.hora_fim.substring(0, 5);
        if (inicio > fim) {
          return currentTime >= inicio || currentTime < fim;
        }
        return currentTime >= inicio && currentTime < fim;
      });

      if (activeTurno) {
        const [h, m] = activeTurno.hora_inicio.split(':').map(Number);
        const shiftStart = new Date();
        shiftStart.setHours(h, m, 0, 0);

        const inicioStr = activeTurno.hora_inicio.substring(0, 5);
        const fimStr = activeTurno.hora_fim.substring(0, 5);
        if (inicioStr > fimStr && currentTime < inicioStr) {
          shiftStart.setDate(shiftStart.getDate() - 1);
        }

        const { data: prodData } = await supabase
          .from('registros_producao')
          .select('quantidade_boa')
          .eq('operador_id', operatorId)
          .gte('created_at', shiftStart.toISOString());

        if (prodData) {
          const total = prodData.reduce((acc, r) => acc + (r.quantidade_boa || 0), 0);
          setOperatorShiftProduction(total);
        }
      }
    }
  };

  // Fetch production stats for current OP
  const fetchProductionStats = async () => {
    if (!opId) return;

    // Get OP details (now includes persisted state fields)
    const { data: opData, error: opError } = await supabase
      .from('ordens_producao')
      .select('quantidade_meta, ciclo_estimado, quantidade_produzida, quantidade_refugo, produtos(nome, codigo)')
      .eq('id', opId)
      .single();


    if (opError) {
      console.error('Error fetching OP data:', opError);
    }

    if (opData) {
      // Use persisted values from OP as primary source
      const persistedProduced = opData.quantidade_produzida || 0;
      const persistedScrap = opData.quantidade_refugo || 0;

      // Also check registros_producao for validation/backup
      const { data: prodRecords } = await supabase
        .from('registros_producao')
        .select('quantidade_boa, quantidade_refugo')
        .eq('op_id', opId);

      let recordsProduced = 0;
      let recordsScrap = 0;
      if (prodRecords && prodRecords.length > 0) {
        recordsProduced = prodRecords.reduce((sum, r) => sum + (r.quantidade_boa || 0), 0);
        recordsScrap = prodRecords.reduce((sum, r) => sum + (r.quantidade_refugo || 0), 0);
      }

      // Use persisted values (they're always the source of truth)
      // Records are kept for historical audit trail
      setTotalProduced(persistedProduced);
      setTotalScrap(persistedScrap);

      console.log('[fetchProductionStats] ✅ Using persisted OP state:', {
        persistedProduced,
        persistedScrap,
        recordsProduced,
        recordsScrap
      });

      setOpQuantity(opData.quantidade_meta || 0);
      setCycleTime(opData.ciclo_estimado || 0);

      // Calculate estimated time (HH:MM format) - based on REMAINING quantity
      // Time Remaining = (Meta - Produced) * CycleTime
      const remainingQty = Math.max(0, (opData.quantidade_meta || 0) - persistedProduced);
      const totalSecondsRemaining = remainingQty * (opData.ciclo_estimado || 0);

      const hours = Math.floor(totalSecondsRemaining / 3600);
      const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
      setEstimatedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);


      if (opData.produtos) {
        // Handle both array (Supabase join) and single object cases
        const produto = Array.isArray(opData.produtos) ? opData.produtos[0] : opData.produtos;
        if (produto) {
          setProductInfo({
            nome: produto.nome,
            codigo: produto.codigo
          });
        }
      }
    }
  };

  // Quick Update Function for Production/Scrap
  const handleQuickUpdate = async (type: 'produced' | 'scrap', delta: number) => {
    if (!opId || !machineId) return;

    // Optimistic Update
    if (type === 'produced') {
      setTotalProduced(prev => Math.max(0, prev + delta));
    } else {
      setTotalScrap(prev => Math.max(0, prev + delta));
    }

    try {
      // 1. Insert Record into registros_producao (Audit Trail)
      const { error: logError } = await supabase.from('registros_producao').insert({
        op_id: opId,
        maquina_id: machineId,
        operador_id: operatorId,
        quantidade_boa: type === 'produced' ? delta : 0,
        quantidade_refugo: type === 'scrap' ? delta : 0,
        created_at: new Date().toISOString()
      });

      if (logError) throw logError;

      // 2. Update ordens_producao (Persistence)
      const { data: currentOp } = await supabase
        .from('ordens_producao')
        .select('quantidade_produzida, quantidade_refugo')
        .eq('id', opId)
        .single();

      if (currentOp) {
        const newProduced = (currentOp.quantidade_produzida || 0) + (type === 'produced' ? delta : 0);
        const newScrap = (currentOp.quantidade_refugo || 0) + (type === 'scrap' ? delta : 0);

        await supabase
          .from('ordens_producao')
          .update({
            quantidade_produzida: newProduced,
            quantidade_refugo: newScrap
          })
          .eq('id', opId);
      }

    } catch (error) {
      console.error('Error in quick update:', error);
      // Revert optimistic update on error
      fetchProductionStats();
      alert('Erro ao atualizar quantidade.');
    }
  };

  // Fetch diary entries
  const fetchDiaryEntries = async () => {
    const { data, error } = await supabase
      .from('diario_bordo_eventos')
      .select('*') // Simplificado para evitar erro de Foreign Key ou RLS na tabela operadores
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching diary:', error);
    } else {
      console.log('Diary data fetched:', data);
    }

    if (data) {
      setDiaryEntries(data.map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        tipo: 'info',
        autor: 'Operador', // Fallback temporário até resolvermos o join
        created_at: d.created_at
      })));
    }
  };

  // Fetch ALL diary entries for full view modal
  const fetchAllDiaryEntries = async () => {
    const { data } = await supabase
      .from('diario_bordo_eventos')
      .select('*')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to 50 for performance

    if (data) {
      setAllDiaryEntries(data.map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        tipo: 'info',
        autor: 'Operador',
        created_at: d.created_at
      })));
    }
    setShowDiaryModal(true);
  };

  // Add diary entry
  const handleAddDiaryEntry = async () => {
    if (!newDiaryText.trim()) return;

    try {
      await onRegisterLogbook(newDiaryText);
      setNewDiaryText('');
      setShowDiaryInput(false);
      // Small delay to allow DB propagation before refetch
      setTimeout(fetchDiaryEntries, 500);
    } catch (error) {
      console.error('Error adding diary entry:', error);
      alert('Erro ao salvar anotação.');
    }
  };

  // Edit diary entry
  const handleEditDiaryEntry = async () => {
    if (!editingDiaryId || !editingDiaryText.trim()) return;

    const { error } = await supabase
      .from('diario_bordo_eventos')
      .update({ descricao: editingDiaryText })
      .eq('id', editingDiaryId);

    if (error) {
      console.error('Error updating diary entry:', error);
      alert('Erro ao atualizar anotação.');
    } else {
      setEditingDiaryId(null);
      setEditingDiaryText('');
      fetchDiaryEntries();
    }
  };

  // Delete diary entry
  const handleDeleteDiaryEntry = async (entryId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta anotação?')) return;

    const { error } = await supabase
      .from('diario_bordo_eventos')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting diary entry:', error);
      alert('Erro ao excluir anotação.');
    } else {
      fetchDiaryEntries();
    }
  };

  // Auto-register missed checklist
  const handleAutoChecklistMissed = async (checklistId: string) => {
    if (!opId) return;
    const { error } = await supabase.from('checklist_eventos').insert({
      checklist_id: checklistId,
      op_id: opId,
      operador_id: operatorId || null,
      maquina_id: machineId,
      setor_id: sectorId || null,
      tipo_acionamento: 'tempo',
      referencia_acionamento: 'SISTEMA',
      status: 'NAO_REALIZADO',
      observacao: 'Checklist não realizado no tempo'
    });

    if (!error) {
      // alert('Checklist não realizado registrado automaticamente.'); // Optional: notify user
      fetchLogs(); // Refresh logs
    } else {
      console.error('DEBUG: Error auto-registering checklist miss:', error, error.message, error.details);
    }
  };

  // Auto-generate Lote and Label
  const handleAutoGenerateLote = async () => {
    if (!opId) return;

    // 1. Get period start (last lote time or just 1 hour ago)
    const { data: lastLote } = await supabase
      .from('lotes_rastreabilidade')
      .select('created_at')
      .eq('maquina_id', machineId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const periodStart = lastLote ? lastLote.created_at : new Date(Date.now() - 3600000).toISOString();
    const periodEnd = new Date().toISOString();

    // 2. Consolidate Stats
    // Checklists OK
    const { count: checklistsOk } = await supabase
      .from('checklist_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('maquina_id', machineId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .eq('status', 'ok');

    // Checklists Missed
    const { count: checklistsMissed } = await supabase
      .from('checklist_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('maquina_id', machineId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .eq('status', 'NAO_REALIZADO');

    // Stops
    const { count: stopCount } = await supabase
      .from('paradas')
      .select('*', { count: 'exact', head: true })
      .eq('maquina_id', machineId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    // 3. Create Lote
    const loteData = {
      op_id: opId,
      maquina_id: machineId,
      setor_id: sectorId || null,
      operador_id: operatorId || null,
      periodo_inicio: periodStart,
      periodo_fim: periodEnd,
      checklists_ok: checklistsOk || 0,
      checklists_nao_realizados: checklistsMissed || 0,
      paradas_count: stopCount || 0,
      qr_code_data: `LOTE-${Date.now()}-${opId.slice(0, 4)}`, // Simple unique string
      quantidade_produzida: 0 // Placeholder, could fetch from production records
    };

    const { error } = await supabase
      .from('lotes_rastreabilidade')
      .insert(loteData);

    if (error) {
      console.error('Error auto-generating lote:', error);
    } else {
      setShowLabelModal(true); // Show modal with new label
    }
  };

  // Open checklist modal
  const openChecklist = (checklistId: string) => {
    setSelectedChecklistId(checklistId);
    setShowChecklistModal(true);
  };

  // --- NEW SERVER-SIDE AUTOMATION ENGINE ---
  useEffect(() => {
    if (!opId || opState !== 'PRODUCAO') return;

    const checkTimers = async () => {
      console.log(`[${new Date().toLocaleTimeString()}] DEBUG: Checking Server-Side Timers...`, { opId, opState, checklistsCount: checklists.length });

      // 1. CHECK CHECKLISTS TIMERS
      for (const checklist of checklists) {
        if (!checklist.intervalo_minutos) continue;

        // Get last event for this specific checklist
        const { data: lastEvent, error } = await supabase
          .from('checklist_eventos')
          .select('created_at, status')
          .eq('op_id', opId)
          .eq('checklist_id', checklist.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // Ignore "Row not found" error
          console.error('DEBUG: Error querying last checklist event:', error);
        }

        const lastTime = lastEvent ? new Date(lastEvent.created_at).getTime() : new Date(statusChangeAt || Date.now()).getTime(); // Fallback to status change or now
        const now = Date.now();
        const elapsedMinutes = (now - lastTime) / 60000;

        console.log(`DEBUG: Checklist '${checklist.nome}' check:`, {
          hasLastEvent: !!lastEvent,
          lastEventTime: lastEvent?.created_at,
          statusChangeAt,
          elapsedMinutes: elapsedMinutes.toFixed(2),
          interval: checklist.intervalo_minutos
        });

        if (elapsedMinutes > checklist.intervalo_minutos) {
          console.warn(`Checklist ${checklist.nome} OVERDUE (${elapsedMinutes.toFixed(1)} min). Auto-registering miss...`);

          // Show alert to operator
          setPendingAlert({
            type: 'checklist',
            message: `Checklist "${checklist.nome}" vencido! Clique aqui para realizar.`,
            checklistId: checklist.id
          });

          await handleAutoChecklistMissed(checklist.id);
        }
      }

      // 2. CHECK LABEL GENERATION TIMER
      // Use the first available checklist's label interval or default 60
      const labelInterval = checklists[0]?.intervalo_etiqueta_minutos || 60;

      const { data: lastLote, error: loteError } = await supabase
        .from('lotes_rastreabilidade')
        .select('created_at')
        .eq('op_id', opId) // Filter by OP
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loteError) {
        console.error('DEBUG: Error querying last lote:', loteError);
      }

      const lastLoteTime = lastLote ? new Date(lastLote.created_at).getTime() : new Date(statusChangeAt || Date.now()).getTime();
      const now = Date.now();
      const elapsedLabelMinutes = (now - lastLoteTime) / 60000;

      console.log(`DEBUG: Label Gen Check:`, {
        hasLastLote: !!lastLote,
        lastLoteTime: lastLote?.created_at,
        statusChangeAt,
        elapsedMinutes: elapsedLabelMinutes.toFixed(2),
        interval: labelInterval
      });

      if (elapsedLabelMinutes > labelInterval) {
        console.warn(`Label Generation OVERDUE (${elapsedLabelMinutes.toFixed(1)} min). Auto-generating lote...`);
        await handleAutoGenerateLote();
      }
    };

    // Run check immediately and then every 30 seconds
    checkTimers();
    const timerLoop = setInterval(checkTimers, 30000); // Check every 30s

    return () => clearInterval(timerLoop);
  }, [opId, opState, checklists, machineId]); // Re-run if these change

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    fetchChecklists();
    fetchDiaryEntries();
    fetchProductionStats();
    fetchOperatorShiftProduction();
  }, [machineId, opState, operatorName, opId, accumulatedProductionTime]);

  // Real-time shift production update
  useEffect(() => {
    if (!operatorId) return;
    const channel = supabase
      .channel(`op-shift-${operatorId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'registros_producao',
        filter: `operador_id=eq.${operatorId}`
      }, () => fetchOperatorShiftProduction())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [operatorId]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!machineId) return;

    // Subscribe to production records changes
    const prodSubscription = supabase
      .channel('registros_producao_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registros_producao',
          filter: `maquina_id=eq.${machineId}`
        },
        () => {
          fetchLogs();
          fetchProductionStats();
          fetchOPSequence(); // Update OP sequence
        }
      )
      .subscribe();

    // Subscribe to stop records changes
    const stopSubscription = supabase
      .channel('paradas_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paradas', filter: `maquina_id=eq.${machineId}` },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    // 3. Checklists
    const checklistSubscription = supabase
      .channel('checklist_eventos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_eventos', filter: `maquina_id=eq.${machineId}` },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    // 4. Diário
    const diarySubscription = supabase
      .channel('diario_bordo_eventos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'diario_bordo_eventos', filter: `maquina_id=eq.${machineId}` },
        () => {
          fetchDiaryEntries();
          fetchLogs();
        }
      )
      .subscribe();

    // 5. Ordens de Produção (Updates Sequence and Production Stats)
    const opSubscription = supabase
      .channel('ordens_producao_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordens_producao', filter: `maquina_id=eq.${machineId}` },
        () => {
          console.log('Realtime OP update detected');
          fetchOPSequence();
          fetchProductionStats(); // ✅ Also update production stats when OP changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(prodSubscription);
      supabase.removeChannel(stopSubscription);
      supabase.removeChannel(checklistSubscription);
      supabase.removeChannel(diarySubscription);
      supabase.removeChannel(opSubscription);
    };
  }, [machineId, operatorName]);

  // Initial fetch of OP Sequence
  useEffect(() => {
    fetchOPSequence();
  }, [machineId]);

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Draggable Sidebar with OP Sequence and Checklists */}
      <div
        ref={sidebarRef}
        className={`fixed z-50 w-56 bg-surface-dark/95 backdrop-blur-sm border border-border-dark rounded-xl shadow-2xl select-none ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{ left: sidebarPosition.x, top: sidebarPosition.y }}
      >
        {/* Drag Handle */}
        <div
          className="flex items-center gap-2 p-3 border-b border-border-dark bg-surface-dark rounded-t-xl cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <span className="material-icons-outlined text-text-sub-dark text-sm">drag_indicator</span>
          <span className="text-white text-xs font-bold uppercase tracking-wide flex-1">Painel de Controle</span>
        </div>

        <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* OP Sequence Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-icons-outlined text-primary text-sm">playlist_play</span>
              <span className="text-white text-[10px] font-bold uppercase">Sequência OPs</span>
            </div>
            <div className="space-y-1">
              {sequencedOPs.length > 0 ? (
                sequencedOPs.slice(0, 5).map((op, idx) => (
                  <div
                    key={op.id}
                    className={`p-2 rounded-md border text-xs flex items-center gap-2 transition-colors ${op.id === opId
                      ? 'bg-primary/20 border-primary text-white shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'bg-[#1a1c23] border-[#2d3342] text-gray-300 hover:bg-[#252830] hover:border-gray-500'
                      }`}
                  >
                    <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${op.id === opId ? 'bg-primary text-black' : 'bg-[#2d3342] text-gray-400'
                      }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold truncate flex-1">{op.codigo}</span>
                    {op.id === opId && <span className="material-icons-outlined text-primary text-sm animate-pulse">play_arrow</span>}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center opacity-50">
                  <span className="material-icons-outlined text-gray-500 text-lg mb-1">playlist_remove</span>
                  <p className="text-gray-500 text-[10px] italic">Sem OPs na fila</p>
                </div>
              )}
            </div>
          </div>

          {/* Checklists Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-icons-outlined text-secondary text-sm">fact_check</span>
              <span className="text-white text-[10px] font-bold uppercase">Checklists</span>
            </div>
            <div className="space-y-1">
              {checklists.length > 0 ? (
                checklists.slice(0, 5).map((checklist) => (
                  <button
                    key={checklist.id}
                    onClick={() => openChecklist(checklist.id)}
                    className="w-full p-1.5 rounded border bg-background-dark border-border-dark/50 text-[10px] flex items-center gap-1.5 text-text-sub-dark hover:border-secondary hover:text-secondary transition-colors text-left"
                  >
                    <span className="material-icons-outlined text-xs">assignment</span>
                    <span className="truncate flex-1">{checklist.nome}</span>
                    {checklist.intervalo_minutos && (
                      <span className="text-[8px] bg-secondary/20 text-secondary px-1 rounded">{checklist.intervalo_minutos}min</span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-text-sub-dark text-[10px] text-center py-2">Sem checklists</p>
              )}
            </div>
          </div>
        </div>

        {/* Diary Section (New) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-purple-400 text-sm">menu_book</span>
              <span className="text-white text-[10px] font-bold uppercase">Diário de Bordo</span>
            </div>
            <button
              onClick={() => setShowDiaryInput(!showDiaryInput)}
              className="text-[10px] text-primary hover:text-white flex items-center gap-1"
            >
              <span className="material-icons-outlined text-[10px]">{showDiaryInput ? 'close' : 'add'}</span>
              {showDiaryInput ? 'Cancelar' : 'Adicionar'}
            </button>
          </div>

          {/* Mini Input for Diary */}
          {showDiaryInput && (
            <div className="mb-2 p-1.5 bg-background-dark rounded border border-border-dark">
              <textarea
                value={newDiaryText}
                onChange={(e) => setNewDiaryText(e.target.value)}
                placeholder="Msg..."
                className="w-full bg-transparent text-white text-[10px] resize-none focus:outline-none mb-1 h-12"
              />
              <button
                onClick={handleAddDiaryEntry}
                className="w-full bg-primary text-white text-[10px] font-bold rounded py-1 hover:bg-primary/80"
              >
                Salvar
              </button>
            </div>
          )}

          <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
            {diaryEntries.length > 0 ? (
              diaryEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="p-1.5 rounded border bg-background-dark border-border-dark/50 text-[10px] text-text-sub-dark hover:text-white group">
                  <p className="line-clamp-2">{entry.descricao}</p>
                  <span className="text-[8px] text-text-sub-dark/50 block mt-0.5">{new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))
            ) : (
              <p className="text-text-sub-dark text-[10px] text-center py-2">Sem registros</p>
            )}
          </div>
          {/* View All Button */}
          <button
            onClick={() => { fetchAllDiaryEntries(); setShowDiaryModal(true); }}
            className="w-full mt-2 text-[10px] text-text-sub-dark hover:text-white border-t border-border-dark/50 pt-1"
          >
            Ver Diário Completo
          </button>
        </div>
      </div>

      {/* Machine Status indicator */}
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shadow-glow-green ${opState === 'PRODUCAO' ? 'bg-secondary animate-pulse' : opState === 'PARADA' ? 'bg-danger shadow-glow-red' : opState === 'SUSPENSA' ? 'bg-orange-500 shadow-glow-orange' : 'bg-primary shadow-glow-blue'
          }`}></span>
        <span className={`text-sm font-bold tracking-wide uppercase ${opState === 'PRODUCAO' ? 'text-secondary' : opState === 'PARADA' ? 'text-danger' : 'text-primary'
          }`}>
          {opState === 'PRODUCAO' ? 'Máquina Rodando' : opState === 'PARADA' ? 'Máquina Parada' : opState === 'SETUP' ? 'Em Ajuste (Setup)' : opState === 'SUSPENSA' ? 'OP Suspensa' : 'Máquina Disponível'}
        </span>
      </div>



      {/* Main Stats Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl md:text-6xl font-display font-black tracking-tight text-white drop-shadow-lg">{machineName.toUpperCase()}</h2>
            {onChangeMachine && (
              <button
                onClick={onChangeMachine}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-dark bg-surface-dark hover:bg-primary/20 hover:border-primary/50 text-text-sub-dark hover:text-white transition-all duration-200 group"
                title="Voltar para seleção de máquinas"
              >
                <span className="material-icons-outlined text-lg group-hover:text-primary transition-colors">swap_horiz</span>
                <span className="text-sm font-semibold hidden md:inline">Trocar Máquina</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 md:gap-8 text-sm text-text-sub-dark">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-lg">grid_view</span>
              <span>Setor: <strong className="text-text-main-dark">{sectorName.toUpperCase()}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-lg">fingerprint</span>
              <span>Ordem: <strong className="text-primary">{opCodigo || opId || 'N/A'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-lg">schedule</span>
              <span>Turno: <strong className="text-text-main-dark">{shiftName}</strong></span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-text-sub-dark mb-1">Relógio do Sistema</div>
          <div className="text-3xl md:text-5xl font-mono font-medium tracking-tight mb-2 text-white">{time}</div>
          <div className={`inline-block px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider ${opState === 'PRODUCAO'
            ? 'bg-secondary/10 text-secondary border-secondary/30'
            : opState === 'SUSPENSA' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
              : 'bg-blue-900/30 text-blue-400 border-blue-500/30'
            }`}>
            {opState === 'PRODUCAO' ? 'Produzindo' : opState === 'SETUP' ? 'Setup' : opState === 'PARADA' ? 'Parada' : opState === 'SUSPENSA' ? 'Suspensa' : 'Aguardando'}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-surface-dark rounded-lg p-5 border border-border-dark relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-icons-outlined text-6xl">flag</span>
          </div>
          <div className="text-xs font-bold text-text-sub-dark uppercase tracking-wider mb-2">Meta da OP (UN)</div>
          <div className="text-4xl md:text-5xl font-display font-bold text-text-main-dark mb-1">{opQuantity || meta}</div>
          <div className="text-xs text-text-sub-dark">
            Tempo estimado: <strong className="text-primary">{estimatedTime}</strong>
          </div>
        </div>

        <div className="bg-surface-dark rounded-lg p-5 border border-border-dark relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-icons-outlined text-6xl">inventory_2</span>
          </div>
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs font-bold text-text-sub-dark uppercase tracking-wider">Realizado (UN)</div>
            {opState === 'PRODUCAO' && (
              <button
                onClick={() => handleQuickUpdate('produced', 1)}
                className="bg-secondary/20 hover:bg-secondary text-secondary hover:text-black p-1 rounded transition-colors"
                title="Adicionar 1 peça"
              >
                <span className="material-icons text-lg font-bold">add</span>
              </button>
            )}
          </div>
          <div className={`text-4xl md:text-5xl font-display font-bold mb-1 transition-all duration-300 ${totalProduced > 0 ? 'text-secondary' : 'text-text-sub-dark'}`}>
            {totalProduced}
          </div>
          <div className="text-xs font-bold text-secondary">
            {opQuantity > 0 ? `${((totalProduced / opQuantity) * 100).toFixed(1)}% concluído` : '0% progresso'}
          </div>
          <div className="text-xs text-text-sub-dark mt-1">Faltam: {Math.max(0, (opQuantity || meta) - totalProduced)} peças</div>
        </div>

        <div className="bg-surface-dark rounded-lg p-5 border border-border-dark relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-danger">
            <span className="material-icons-outlined text-6xl">delete_outline</span>
          </div>
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs font-bold text-text-sub-dark uppercase tracking-wider">Refugo (UN)</div>
            {opState === 'PRODUCAO' && (
              <button
                onClick={() => handleQuickUpdate('scrap', 1)}
                className="bg-danger/20 hover:bg-danger text-danger hover:text-white p-1 rounded transition-colors"
                title="Adicionar 1 refugo"
              >
                <span className="material-icons text-lg font-bold">add</span>
              </button>
            )}
          </div>
          <div className={`text-4xl md:text-5xl font-display font-bold mb-1 ${totalScrap > 0 ? 'text-danger' : 'text-text-sub-dark'}`}>{totalScrap}</div>
          <div className="text-xs font-bold text-secondary">
            {totalProduced > 0 ? `${((totalScrap / (totalProduced + totalScrap)) * 100).toFixed(1)}% taxa` : '0% taxa'}
          </div>
          <div className="text-xs text-text-sub-dark mt-1">{totalScrap === 0 ? 'Dentro do limite' : 'Atenção'}</div>
        </div>

        <div className="bg-surface-dark rounded-lg p-5 border border-border-dark relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-icons-outlined text-6xl">trending_up</span>
          </div>
          <div className="text-xs font-bold text-text-sub-dark uppercase tracking-wider mb-2">OEE (Eficiência)</div>
          <div className={`text-4xl md:text-5xl font-display font-bold mb-1 transition-all duration-500 ${calculatedOEE < 85 ? 'text-danger' : 'text-warning'}`}>
            {calculatedOEE.toFixed(1)}%
          </div>
          <div className="text-xs font-bold text-secondary">Live feed</div>
          <div className="text-xs text-text-sub-dark mt-1">Meta de OEE: 95%</div>
        </div>

        <div className="bg-surface-dark rounded-lg p-5 border border-border-dark relative overflow-hidden group border-l-primary/30">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-icons-outlined text-6xl text-primary">person</span>
          </div>
          <div className="text-xs font-bold text-text-sub-dark uppercase tracking-wider mb-2">Sua Produção (Turno)</div>
          <div className="text-4xl md:text-5xl font-display font-bold text-primary mb-1">{operatorShiftProduction}</div>
          <div className="text-xs font-bold text-secondary capitalize">{shiftName?.toLowerCase() || 'Turno atual'}</div>
          <div className="text-xs text-text-sub-dark mt-1">Total acumulado hoje</div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h3 className="text-xl font-display font-bold text-text-main-dark">Controle de Produção</h3>
          <div className="flex items-center gap-1 text-xs text-text-sub-dark">
            <span className="w-2 h-2 rounded-full bg-text-sub-dark"></span>
            Teclas de atalho disponíveis
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Setup Button */}
          <button
            disabled={opState === 'PRODUCAO' || opState === 'SETUP'}
            onClick={onOpenSetup}
            className={`bg-surface-dark rounded-xl p-6 text-left transition-all duration-200 h-48 flex flex-col justify-between relative overflow-hidden ${opState === 'SETUP'
              ? 'border-2 border-yellow-500 shadow-lg shadow-yellow-500/20 animate-pulse-border'
              : 'border border-border-dark opacity-40 grayscale'
              } ${(opState === 'PRODUCAO' || opState === 'SETUP') ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between">
              <span className={`material-icons-outlined text-3xl ${opState === 'SETUP' ? 'text-yellow-500' : 'text-text-sub-dark'}`}>build</span>
              {opState === 'SETUP' && (
                <div className="text-right">
                  <div className="text-xs text-yellow-500 font-bold">SETUP</div>
                  <div className="text-2xl font-mono font-bold text-yellow-500">{displayTimer}</div>
                </div>
              )}
            </div>
            <div>
              <div className="font-display font-bold text-lg uppercase mb-1 text-white">Setup de Máquina</div>
              <div className="text-xs text-text-sub-dark leading-snug">Preparar e ajustar máquina</div>
            </div>
          </button>

          {/* 2. Production Button */}
          <button
            onClick={() => {
              console.log('Production button clicked, opState:', opState);
              if (opState === 'SETUP') onStartProduction();
              if (opState === 'PARADA' || opState === 'SUSPENSA') onRetomar();
            }}
            disabled={opState !== 'SETUP' && opState !== 'PARADA' && opState !== 'SUSPENSA'}
            className={`rounded-xl p-6 text-left transition-all duration-200 h-48 flex flex-col justify-between relative overflow-hidden ${opState === 'PRODUCAO'
              ? 'bg-green-900/10 border-2 border-green-500 shadow-lg shadow-green-500/20 cursor-default'
              : (opState === 'SETUP' || opState === 'PARADA' || opState === 'SUSPENSA')
                ? 'bg-primary/10 border-2 border-primary hover:bg-primary/20 cursor-pointer'
                : 'bg-surface-dark border border-border-dark opacity-40 grayscale cursor-not-allowed'
              }`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${opState === 'PRODUCAO' ? 'bg-green-500/20 text-green-500' :
                (opState === 'SETUP' || opState === 'PARADA' || opState === 'SUSPENSA') ? 'bg-primary/20 text-primary' :
                  'bg-gray-700/20 text-gray-500'
                }`}>
                <span className={`material-icons-outlined text-2xl ${opState === 'PRODUCAO' ? 'animate-spin-slow' : ''}`}>
                  {opState === 'PRODUCAO' ? 'settings' : 'play_arrow'}
                </span>
              </div>
              {opState === 'PRODUCAO' && (
                <div className="text-right">
                  <div className="text-xs text-green-500 font-bold">PRODUÇÃO</div>
                  <div className="text-2xl font-mono font-bold text-green-500">{displayTimer}</div>
                </div>
              )}
            </div>
            <div>
              <div className="font-display font-bold text-lg uppercase mb-1 text-white">
                {opState === 'PRODUCAO' ? 'Produzindo...' : (opState === 'PARADA' || opState === 'SUSPENSA') ? 'Retomar Produção' : 'Iniciar Produção'}
              </div>
              <div className="text-xs text-text-sub-dark leading-snug">
                {opState === 'PRODUCAO' ? 'Contagem ativa' : (opState === 'PARADA' || opState === 'SUSPENSA') ? 'Voltar ao trabalho' : 'Clique para iniciar'}
              </div>
            </div>
          </button>

          {/* 3. Stop Button */}
          <button
            onClick={onOpenStop}
            disabled={opState !== 'PRODUCAO'}
            className={`bg-surface-dark rounded-xl p-6 text-left transition-all duration-200 h-48 flex flex-col justify-between ${opState === 'PARADA'
              ? 'border-2 border-red-500 shadow-lg shadow-red-500/20 cursor-default'
              : opState === 'PRODUCAO'
                ? 'border border-border-dark opacity-100 cursor-pointer hover:opacity-80 hover:border-red-500/50'
                : 'border border-border-dark opacity-40 grayscale cursor-not-allowed'
              }`}
          >
            <div className="flex items-start justify-between">
              <span className={`material-icons-outlined text-3xl ${opState === 'PARADA' ? 'text-red-500' : 'text-text-sub-dark'
                }`}>pause_circle</span>
              {opState === 'PARADA' && (
                <div className="text-right">
                  <div className="text-xs text-red-500 font-bold">PARADA</div>
                  <div className="text-2xl font-mono font-bold text-red-500">{displayTimer}</div>
                </div>
              )}
            </div>
            <div>
              <div className="font-display font-bold text-lg uppercase mb-1 text-white">Parar (Justificar)</div>
              <div className="text-xs text-text-sub-dark leading-snug">Interromper produção e informar motivo</div>
            </div>
          </button>

          {/* 4. Finalize Button - Active when there's an OP */}
          <button
            onClick={onOpenFinalize}
            disabled={!opId}
            className={`bg-surface-dark rounded-xl p-6 text-left transition-all duration-200 h-48 flex flex-col justify-between ${opId
              ? 'border border-border-dark opacity-80 cursor-pointer hover:opacity-100 hover:border-blue-500/50'
              : 'border border-border-dark opacity-40 grayscale cursor-not-allowed'
              }`}
          >
            <span className={`material-symbols-outlined text-3xl ${opId ? 'text-blue-500' : 'text-gray-500'}`}>check_circle</span>
            <div>
              <div className="font-display font-bold text-lg uppercase mb-1 text-white">Finalizar OP</div>
              <div className="text-xs text-text-sub-dark leading-snug">Encerrar ou suspender ordem</div>
            </div>
          </button>
        </div>

        {/* Time Summary and Quick Actions */}
        <div className="flex flex-wrap gap-4 items-center justify-between mt-4 p-4 bg-surface-dark/50 rounded-lg border border-border-dark">
          {/* Accumulated Times Summary */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-text-sub-dark">Setup:</span>
              <span className="font-mono font-bold text-yellow-500">{totalSetupDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-text-sub-dark">Produção:</span>
              <span className="font-mono font-bold text-green-500">{totalProductionDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-text-sub-dark">Paradas:</span>
              <span className="font-mono font-bold text-red-500">{totalStopDisplay}</span>
            </div>
          </div>

          {/* Generate Label Button - Always visible when OP is active */}
          {opId && (
            <button
              onClick={() => setShowLabelModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary hover:bg-primary/20 transition-all"
            >
              <span className="material-icons-outlined text-lg">qr_code_2</span>
              <span className="font-bold text-sm uppercase">Gerar Etiqueta</span>
            </button>
          )}
        </div>
      </div>



      {/* Checklist Execution Modal */}
      < ChecklistExecutionModal
        isOpen={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
        checklistId={selectedChecklistId}
        opId={opId || undefined}
        operadorId={operatorId}
        maquinaId={machineId}
        setorId={sectorId}
        onSuccess={() => {
          setShowChecklistModal(false);
          fetchLogs();
        }}
      />

      {/* Auto-Label Generation Modal */}
      {
        showLabelModal && (
          <LabelModal
            onClose={() => setShowLabelModal(false)}
            opId={opCodigo || opId || 'N/A'}
            realized={realized}
            loteId={loteId}
            machine={machineName}
            operator={operatorName}
            unit="PÇS"
            productName={productInfo?.nome || 'Carregando...'}
            productDescription={productInfo?.codigo || ''}
          />
        )
      }

      {/* Recent Records Table */}
      <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden flex flex-col mb-6">
        <div className="p-4 border-b border-border-dark flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-text-sub-dark text-lg">history</span>
            <h3 className="font-bold text-text-main-dark">Registros Recentes</h3>
          </div>
          <button className="text-xs font-bold text-primary hover:text-blue-400 uppercase">Ver Todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#111217] text-text-sub-dark text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 font-medium">Hora</th>
                <th className="px-6 py-3 font-medium">Evento</th>
                <th className="px-6 py-3 font-medium">Detalhe</th>
                <th className="px-6 py-3 font-medium">Usuário</th>
                <th className="px-6 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {records.map((rec, i) => (
                <tr key={i} className="hover:bg-surface-dark-highlight transition-colors">
                  <td className="px-6 py-4 text-text-main-dark">{rec.time}</td>
                  <td className="px-6 py-4 font-bold text-primary">{rec.event}</td>
                  <td className="px-6 py-4 text-text-sub-dark">{rec.detail}</td>
                  <td className="px-6 py-4 text-text-main-dark">{rec.user}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase border border-secondary/20">
                      {rec.status}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-sub-dark italic">Nenhum registro encontrado para esta máquina.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diary Full View Modal */}
      {
        showDiaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDiaryModal(false)}></div>
            <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl shadow-2xl border border-border-dark overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark bg-[#1a1c23]">
                <div className="flex items-center gap-3">
                  <span className="material-icons-outlined text-primary text-2xl">menu_book</span>
                  <div>
                    <h2 className="text-white text-lg font-bold">Diário da Máquina</h2>
                    <p className="text-text-sub-dark text-xs">Todos os registros</p>
                  </div>
                </div>
                <button onClick={() => setShowDiaryModal(false)} className="text-text-sub-dark hover:text-white p-2 rounded-lg hover:bg-white/5">
                  <span className="material-icons-outlined text-2xl">close</span>
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                {allDiaryEntries.length > 0 ? allDiaryEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-4 bg-background-dark rounded-lg border border-border-dark/50">
                    <span className="material-icons-outlined text-lg mt-0.5 text-secondary">info</span>
                    <div className="flex-1">
                      <p className="text-sm text-text-main-dark">{entry.descricao}</p>
                      <p className="text-xs text-text-sub-dark mt-2">
                        {entry.autor} • {new Date(entry.created_at).toLocaleDateString('pt-BR')} às {new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-text-sub-dark italic">Nenhum registro encontrado</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-background-dark border-t border-border-dark flex justify-end">
                <button
                  onClick={() => setShowDiaryModal(false)}
                  className="px-6 py-2 bg-primary hover:bg-primary/80 text-white font-bold rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Floating Checklist Alert - Top Banner (Less Invasive) */}
      {
        pendingAlert && (
          <div
            className="fixed top-0 left-0 right-0 z-[9999] p-4 cursor-pointer animate-slide-down"
            onClick={() => {
              if (pendingAlert.type === 'checklist' && pendingAlert.checklistId) {
                openChecklist(pendingAlert.checklistId);
              } else if (pendingAlert.type === 'etiqueta') {
                setShowLabelModal(true);
              }
              setPendingAlert(null);
            }}
          >
            <div className="max-w-4xl mx-auto bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-2xl border-2 border-yellow-400 p-4 flex items-center gap-4">
              <div className="animate-bounce">
                <span className="material-icons-outlined text-white text-4xl">
                  {pendingAlert.type === 'checklist' ? 'assignment_late' : 'qr_code_2'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-lg uppercase">
                  {pendingAlert.type === 'checklist' ? 'Checklist Pendente!' : 'Etiqueta Pendente!'}
                </h3>
                <p className="text-white/90 text-sm">{pendingAlert.message}</p>
              </div>
              <button className="bg-white text-orange-600 font-bold px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors text-sm uppercase">
                Realizar Agora
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingAlert(null); }}
                className="text-white/70 hover:text-white p-1"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default OperatorDashboard;
