
import React, { useState } from 'react';

interface FinalizeModalProps {
  onClose: () => void;
  opId: string;
  realized: number;
  meta: number;
  sectorName?: string; // Current sector name
  onConfirm: (good: number, scrap: number) => void;
  onSuspend: (produced: number, pending: number) => void;
  onTransfer?: (produced: number, pending: number) => void; // Transfer to next sector
}

const FinalizeModal: React.FC<FinalizeModalProps> = ({
  onClose, opId, realized, meta, sectorName, onConfirm, onSuspend, onTransfer
}) => {
  const [additionalCount, setAdditionalCount] = useState(0);
  const [scrap, setScrap] = useState(0);
  const target = meta || 0;

  // Previous stats (before this interaction)
  const initialPending = Math.max(0, target - realized);

  // Projected stats (including this interaction)
  const totalProduced = realized + additionalCount;
  const finalPending = Math.max(0, target - totalProduced);
  const progress = target > 0 ? Math.min((totalProduced / target) * 100, 100) : 0;

  // Check if current sector is the final sector (Colagem)
  const isFinalSector = sectorName?.toLowerCase().includes('colagem') ?? true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl flex flex-col bg-surface-dark rounded-xl shadow-2xl border border-border-dark overflow-hidden animate-fade-in text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark bg-surface-dark-highlight">
          <div>
            <h2 className="text-white text-xl font-bold tracking-tight">Finalizar OP {opId}</h2>
            <p className="text-text-sub-dark text-xs mt-0.5">Confirme a produção para encerrar ou suspender.</p>
          </div>
          <button onClick={onClose} className="text-text-sub-dark hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <span className="material-icons-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          {/* Main Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reference Card: What was pending */}
            <div className="flex items-center gap-4 rounded-xl p-5 bg-orange-500/10 border border-orange-500/30">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                <span className="material-icons-outlined text-2xl">pending</span>
              </div>
              <div>
                <p className="text-orange-400/70 text-[10px] font-bold uppercase tracking-widest">Pendente no Sistema</p>
                <p className="text-2xl font-bold text-orange-400">{initialPending} <span className="text-sm font-medium">un</span></p>
              </div>
            </div>

            {/* Target Card */}
            <div className="flex items-center gap-4 rounded-xl p-5 bg-background-dark border border-border-dark">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-sub-dark">
                <span className="material-icons-outlined text-2xl">flag</span>
              </div>
              <div>
                <p className="text-text-sub-dark text-[10px] font-bold uppercase tracking-widest">Meta Total</p>
                <p className="text-2xl font-bold text-white">{target} <span className="text-sm font-medium">un</span></p>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <p className="text-white text-base font-bold flex items-center gap-2">
                  <span className="material-icons-outlined text-primary">add_box</span>
                  Produção Adicional
                </p>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">ENTRADA</span>
              </div>

              <div className="relative flex items-center group">
                <button
                  onClick={() => setAdditionalCount(Math.max(0, additionalCount - 1))}
                  className="absolute left-1 w-12 h-12 flex items-center justify-center text-text-sub-dark hover:text-white hover:bg-surface-dark-highlight rounded-lg transition-colors z-10"
                >
                  <span className="material-icons">remove</span>
                </button>
                <input
                  className="w-full rounded-xl text-white text-center font-bold text-2xl focus:ring-2 focus:ring-primary border border-border-dark bg-background-dark h-16 group-hover:border-primary/50 transition-all placeholder-white/20"
                  type="number"
                  placeholder="0"
                  autoFocus
                  value={additionalCount || ''}
                  onChange={(e) => setAdditionalCount(parseInt(e.target.value) || 0)}
                />
                <button
                  onClick={() => setAdditionalCount(additionalCount + 1)}
                  className="absolute right-1 w-12 h-12 flex items-center justify-center text-text-sub-dark hover:text-white hover:bg-surface-dark-highlight rounded-lg transition-colors z-10"
                >
                  <span className="material-icons">add</span>
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-text-sub-dark italic">Já produzido: {realized} un</span>
                <span className="text-primary font-bold">Digite apenas o que produziu agora</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <p className="text-white text-base font-bold flex items-center gap-2">
                  <span className="material-icons-outlined text-danger">delete_sweep</span>
                  Refugo
                </p>
                <span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-[10px] font-bold">PERDA</span>
              </div>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub-dark group-hover:text-danger transition-colors">
                  <span className="material-icons-outlined text-[20px]">delete</span>
                </span>
                <input
                  className="w-full rounded-xl text-white font-bold text-xl focus:ring-2 focus:ring-danger border border-border-dark bg-background-dark h-16 pl-12 group-hover:border-danger/50 transition-all"
                  placeholder="0"
                  type="number"
                  value={scrap || ''}
                  onChange={(e) => setScrap(parseInt(e.target.value) || 0)}
                />
              </div>
              <p className="text-text-sub-dark text-[10px] text-right italic">Peças com defeito não serão somadas ao total bom</p>
            </div>
          </div>

          {/* Result Summary Bar */}
          <div className="p-4 rounded-xl bg-background-dark border border-border-dark flex items-center justify-between">
            <div className="flex gap-8">
              <div>
                <p className="text-text-sub-dark text-[10px] font-bold uppercase tracking-wider mb-1">Novo Total Produzido</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-green-400">{totalProduced}</span>
                  <span className="text-xs text-text-sub-dark font-medium">un</span>
                </div>
              </div>
              <div className="border-l border-border-dark pl-8">
                <p className="text-text-sub-dark text-[10px] font-bold uppercase tracking-wider mb-1">Saldo Final Pendente</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${finalPending === 0 ? 'text-green-500' : 'text-yellow-500'}`}>{finalPending}</span>
                  <span className="text-xs text-text-sub-dark font-medium">un</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-text-sub-dark text-[10px] font-bold uppercase tracking-wider mb-1">Progresso</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 rounded-full bg-surface-dark overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-background-dark/30 border-t border-border-dark flex flex-col gap-4">
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4">
            <button
              onClick={() => onSuspend(totalProduced, finalPending)}
              className="flex items-center justify-center gap-2 h-14 px-6 rounded-xl border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-all font-bold group flex-1"
            >
              <span className="material-icons-outlined group-hover:scale-110 transition-transform">pause_circle</span>
              <span>SUSPENDER OP</span>
            </button>

            {onTransfer && !isFinalSector && (
              <button
                onClick={() => onTransfer(totalProduced, finalPending)}
                className="flex items-center justify-center gap-2 h-14 px-6 rounded-xl border-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 transition-all font-bold group flex-1"
              >
                <span className="material-icons-outlined group-hover:scale-110 transition-transform">arrow_forward</span>
                <span>TRANSFERIR PARA {sectorName === 'Colagem' ? 'EXPEDIÇÃO' : 'PRÓXIMO SETOR'}</span>
              </button>
            )}

            <button
              onClick={() => onConfirm(totalProduced, scrap)}
              className="flex items-center justify-center gap-2 h-14 px-8 rounded-xl bg-primary text-black font-extrabold text-lg hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 flex-[1.5]"
            >
              <span className="material-icons">check_circle</span>
              ENCERRAR PRODUÇÃO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalizeModal;
