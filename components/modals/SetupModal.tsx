
import React, { useState, useEffect } from 'react';
import { ProductionOrder } from '../../types';
import { supabase } from '../../supabase';

interface SetupModalProps {
  onClose: () => void;
  onConfirm: (op: ProductionOrder) => void;
  machineId?: string;
  sectorId?: string; // For filtering suspended OPs by sector
}

const SetupModal: React.FC<SetupModalProps> = ({ onClose, onConfirm, machineId, sectorId }) => {
  const [sequencedOrders, setSequencedOrders] = useState<ProductionOrder[]>([]);
  const [suspendedOrders, setSuspendedOrders] = useState<ProductionOrder[]>([]);
  const [otherOrders, setOtherOrders] = useState<ProductionOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opInUseWarning, setOpInUseWarning] = useState<{ opId: string; machineName: string } | null>(null);

  // Check if selected OP is already in use on another machine
  const checkOpExclusivity = async (opId: string) => {
    const { data } = await supabase
      .from('maquinas')
      .select('id, nome, op_atual_id')
      .eq('op_atual_id', opId)
      .neq('id', machineId || '')
      .single();

    if (data) {
      setOpInUseWarning({ opId, machineName: data.nome });
      return true; // OP is in use
    }
    setOpInUseWarning(null);
    return false;
  };

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);

      // 1. Fetch OPs specifically assigned to this machine (Sequence)
      let sequencedOps: ProductionOrder[] = [];
      if (machineId) {
        const { data: seqData } = await supabase
          .from('ordens_producao')
          .select('*')
          .eq('maquina_id', machineId)
          .neq('status', 'FINALIZADA')
          .neq('status', 'SUSPENSA')
          .order('posicao_sequencia', { ascending: true });

        if (seqData) sequencedOps = seqData;
      }

      // 2. Fetch SUSPENDED OPs from current sector
      let suspendedOps: ProductionOrder[] = [];
      if (sectorId) {
        const { data: suspData } = await supabase
          .from('ordens_producao')
          .select('*')
          .eq('status', 'SUSPENSA')
          .eq('setor_suspensao_id', sectorId)
          .order('created_at', { ascending: false });

        if (suspData) suspendedOps = suspData;
      }

      // 3. Fetch all other pending OPs (General Pool) - excluding those already running on other machines
      const { data: runningOps } = await supabase
        .from('maquinas')
        .select('op_atual_id')
        .not('op_atual_id', 'is', null);

      const runningOpIds = runningOps?.map(m => m.op_atual_id).filter(Boolean) || [];

      const { data: otherData } = await supabase
        .from('ordens_producao')
        .select('*')
        .is('maquina_id', null)
        .in('status', ['PENDENTE', 'EM_ANDAMENTO'])
        .order('prioridade', { ascending: false });

      // Mark OPs that are in use on other machines
      const filteredOther = otherData?.map(op => ({
        ...op,
        inUseOnOtherMachine: runningOpIds.includes(op.id)
      })) || [];

      if (sequencedOps.length > 0) {
        setSequencedOrders(sequencedOps);
        setSelectedId(sequencedOps[0].id);
      } else if (suspendedOps.length > 0) {
        // Prioritize suspended OPs for resumption
        setSelectedId(suspendedOps[0].id);
      }

      setSuspendedOrders(suspendedOps);

      if (filteredOther.length > 0) {
        setOtherOrders(filteredOther as ProductionOrder[]);
        if (sequencedOps.length === 0 && suspendedOps.length === 0) {
          // Auto-select first available (not in use)
          const firstAvailable = filteredOther.find(op => !op.inUseOnOtherMachine);
          if (firstAvailable) setSelectedId(firstAvailable.id);
        }
      }

      setLoading(false);
    };

    fetchOrders();
  }, [machineId, sectorId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      {/* Container Principal */}
      <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in">

        {/* Header */}
        <div className="px-8 py-6 border-b border-border-dark flex items-center justify-between bg-background-dark">
          <div>
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
              Setup de Máquina
            </h2>
            <p className="text-sm text-text-sub-dark mt-1">Selecione a Ordem de Produção para iniciar</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-text-sub-dark hover:text-white"
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        {/* Content Area - Increased Padding */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8 bg-gradient-to-b from-surface-dark to-background-dark">

          {/* Search Bar */}
          <div className="relative">
            {/* Icon removed to prevent text duplication if font fails */}
            <input
              className="w-full bg-background-dark border border-border-dark text-white rounded-xl py-4 pl-4 pr-4 focus:ring-2 focus:ring-primary focus:border-transparent placeholder-text-sub-dark transition-all font-medium"
              placeholder="Buscar por OP, Produto ou Código..."
              type="text"
            />
          </div>

          <div className="space-y-8">
            {/* Sequenced Orders Section */}
            {sequencedOrders.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest">
                    Sequência da Máquina ({sequencedOrders.length})
                  </span>
                </div>

                <div className="grid gap-3">
                  {sequencedOrders.map((op, index) => (
                    <label
                      key={op.id}
                      onClick={() => setSelectedId(op.id)}
                      className={`group relative flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${selectedId === op.id
                          ? 'border-secondary bg-secondary/10 shadow-lg shadow-secondary/5'
                          : 'border-border-dark bg-surface-dark hover:border-secondary/50 hover:bg-surface-dark-highlight'
                        }`}
                    >
                      <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-secondary text-black font-bold flex items-center justify-center shadow-lg ring-4 ring-surface-dark z-10">
                        {index + 1}
                      </div>

                      <input
                        type="radio"
                        checked={selectedId === op.id}
                        onChange={() => { }}
                        className="mt-1 h-5 w-5 text-secondary border-gray-600 bg-transparent focus:ring-secondary"
                      />

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-white tracking-tight">{op.codigo}</span>
                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${op.prioridade === 'ALTA'
                              ? 'bg-danger/10 text-danger border-danger/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                              }`}>
                              {op.prioridade}
                            </span>
                          </div>
                          <span className="text-sm font-mono text-gray-500">{new Date(op.data_emissao).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <h4 className="text-base font-medium text-gray-300 mb-4">{op.nome_produto}</h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 bg-black/20 rounded-lg border border-white/5">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Meta</span>
                            <span className="text-sm font-bold text-white">{op.quantidade_meta} un</span>
                          </div>
                          {op.ciclo_estimado && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 uppercase">Ciclo</span>
                              <span className="text-sm font-bold text-white">{op.ciclo_estimado}s</span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Status</span>
                            <span className={`text-sm font-bold ${op.status === 'PENDENTE' ? 'text-yellow-500' : 'text-blue-500'}`}>
                              {op.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Suspended OPs Section - for resumption */}
            {suspendedOrders.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-orange-500/20 pb-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
                    <span className="material-icons-outlined text-sm">pause_circle</span>
                    OPs Suspensas neste Setor ({suspendedOrders.length})
                  </span>
                </div>

                <div className="grid gap-3">
                  {suspendedOrders.map((op) => (
                    <label
                      key={op.id}
                      onClick={() => setSelectedId(op.id)}
                      className={`group relative flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${selectedId === op.id
                          ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/5'
                          : 'border-border-dark bg-surface-dark hover:border-orange-500/50 hover:bg-surface-dark-highlight'
                        }`}
                    >
                      <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-orange-500 text-black font-bold flex items-center justify-center shadow-lg ring-4 ring-surface-dark z-10">
                        <span className="material-icons-outlined text-sm">replay</span>
                      </div>

                      <input
                        type="radio"
                        checked={selectedId === op.id}
                        onChange={() => { }}
                        className="mt-1 h-5 w-5 text-orange-500 border-gray-600 bg-transparent focus:ring-orange-500"
                      />

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-white tracking-tight">{op.codigo}</span>
                            <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20">
                              SUSPENSA
                            </span>
                          </div>
                        </div>

                        <h4 className="text-base font-medium text-gray-300 mb-4">{op.nome_produto}</h4>

                        {/* Production Progress Info */}
                        <div className="grid grid-cols-3 gap-4 p-3 bg-black/20 rounded-lg border border-orange-500/10">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Já Produzido</span>
                            <span className="text-sm font-bold text-green-400">{(op as any).quantidade_produzida || 0} un</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Pendente</span>
                            <span className="text-sm font-bold text-orange-400">{(op as any).quantidade_pendente || 0} un</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Meta Total</span>
                            <span className="text-sm font-bold text-white">{op.quantidade_meta} un</span>
                          </div>
                        </div>

                        <p className="text-xs text-orange-400/70 mt-2 flex items-center gap-1">
                          <span className="material-icons-outlined text-xs">info</span>
                          Ao retomar, insira apenas a quantidade adicional produzida
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Other Orders Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-dark pb-2">
                <span className="text-xs font-bold text-text-sub-dark uppercase tracking-widest">
                  Outras Ordens Disponíveis ({otherOrders.length})
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-text-sub-dark">
                  <span className="material-icons-outlined animate-spin mr-2">sync</span>
                  Carregando ordens...
                </div>
              ) : otherOrders.length === 0 ? (
                <div className="text-center py-12 text-text-sub-dark bg-black/20 rounded-xl border border-dashed border-border-dark">
                  Nenhuma outra ordem disponível.
                </div>
              ) : (
                <div className="grid gap-3">
                  {otherOrders.map((op) => (
                    <label
                      key={op.id}
                      onClick={() => setSelectedId(op.id)}
                      className={`group relative flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${selectedId === op.id
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
                          : 'border-border-dark bg-surface-dark hover:border-primary/50 hover:bg-surface-dark-highlight'
                        }`}
                    >
                      <input
                        type="radio"
                        checked={selectedId === op.id}
                        onChange={() => { }}
                        className="mt-1 h-5 w-5 text-primary border-gray-600 bg-transparent focus:ring-primary"
                      />

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-white tracking-tight">{op.codigo}</span>
                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${op.prioridade === 'ALTA'
                              ? 'bg-danger/10 text-danger border-danger/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                              }`}>
                              {op.prioridade}
                            </span>
                          </div>
                          <span className="text-sm font-mono text-gray-500">{new Date(op.data_emissao).toLocaleDateString('pt-BR')}</span>
                        </div>

                        <h4 className="text-base font-medium text-gray-300 mb-4">{op.nome_produto}</h4>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 bg-black/20 rounded-lg border border-white/5">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase">Meta</span>
                            <span className="text-sm font-bold text-white">{op.quantidade_meta} un</span>
                          </div>
                          {op.ciclo_estimado && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 uppercase">Ciclo</span>
                              <span className="text-sm font-bold text-white">{op.ciclo_estimado}s</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-8 mb-8 pt-6 border-t border-border-dark bg-surface-dark flex flex-col gap-4 rounded-b-2xl">
          {/* Warning if OP is in use */}
          {opInUseWarning && (
            <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
              <span className="material-icons-outlined text-2xl">warning</span>
              <div className="flex-1">
                <p className="font-bold">OP em uso em outra máquina!</p>
                <p className="text-sm text-yellow-300">Esta OP está ativa na máquina "{opInUseWarning.machineName}". Transferência requer autorização.</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-border-dark text-text-sub-dark hover:bg-white/5 hover:text-white transition-all font-bold uppercase tracking-wide text-xs"
            >
              Cancelar
            </button>
            <button
              disabled={!selectedId || !!opInUseWarning}
              onClick={async () => {
                const selected = [...sequencedOrders, ...otherOrders].find((op) => op.id === selectedId);
                if (selected) {
                  // Check exclusivity before confirming
                  const isInUse = await checkOpExclusivity(selected.id);
                  if (!isInUse) {
                    onConfirm(selected);
                  }
                  // If isInUse, the warning will be shown
                }
              }}
              className={`px-8 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wide text-xs ${opInUseWarning
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-primary hover:bg-primary-hover text-black shadow-primary/20'
                }`}
            >
              {opInUseWarning ? 'Solicitar Autorização' : 'Confirmar Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
