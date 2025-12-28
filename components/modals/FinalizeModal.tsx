
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
  const [count, setCount] = useState(realized);
  const [scrap, setScrap] = useState(0);
  const target = meta || 500;
  const pending = Math.max(0, target - count);
  const progress = Math.min((count / target) * 100, 100);

  // Check if current sector is the final sector (Colagem)
  const isFinalSector = sectorName?.toLowerCase().includes('colagem') ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl flex flex-col bg-surface-dark rounded-xl shadow-2xl border border-border-dark overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark bg-surface-dark-highlight">
          <div>
            <h2 className="text-white text-xl font-bold tracking-tight">Finalizar OP {opId}</h2>
            <p className="text-text-sub-dark text-xs mt-0.5">Confirme os totais antes de encerrar.</p>
          </div>
          <button onClick={onClose} className="text-text-sub-dark hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <span className="material-icons-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Produced Card */}
            <div className="flex flex-col justify-center gap-2 rounded-xl p-6 bg-background-dark border border-border-dark relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons-outlined text-8xl text-green-500">check_circle</span>
              </div>
              <p className="text-text-sub-dark text-xs font-medium uppercase tracking-wider">Produzido</p>
              <div className="flex items-baseline gap-2">
                <p className="text-green-500 text-4xl font-bold leading-tight">{count}</p>
                <p className="text-text-sub-dark text-lg font-medium">un</p>
              </div>
            </div>

            {/* Pending Card */}
            <div className="flex flex-col justify-center gap-2 rounded-xl p-6 bg-background-dark border border-border-dark relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons-outlined text-8xl text-yellow-500">pending</span>
              </div>
              <p className="text-text-sub-dark text-xs font-medium uppercase tracking-wider">Pendente</p>
              <div className="flex items-baseline gap-2">
                <p className="text-yellow-500 text-4xl font-bold leading-tight">{pending}</p>
                <p className="text-text-sub-dark text-lg font-medium">un</p>
              </div>
            </div>

            {/* Progress Card */}
            <div className="flex flex-col justify-center gap-4 rounded-xl p-6 bg-background-dark border border-border-dark">
              <div className="flex justify-between items-end">
                <p className="text-text-sub-dark text-xs font-medium uppercase tracking-wider">Meta</p>
                <div className="text-right">
                  <span className="text-white text-lg font-bold">{count}</span>
                  <span className="text-text-sub-dark text-sm">/ {target}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-3 w-full rounded-full bg-surface-dark overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="text-primary text-xs font-bold">{Math.round(progress)}% Concluído</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <p className="text-white text-base font-medium">Ajustar Quantidade Final</p>
                <span className="material-icons-outlined text-text-sub-dark text-lg cursor-help">info</span>
              </div>
              <div className="relative flex items-center">
                <button
                  onClick={() => setCount(Math.max(0, count - 1))}
                  className="absolute left-1 w-12 h-12 flex items-center justify-center text-text-sub-dark hover:text-white hover:bg-surface-dark-highlight rounded-lg transition-colors z-10"
                >
                  <span className="material-icons">remove</span>
                </button>
                <input
                  className="w-full rounded-xl text-white text-center font-bold text-xl focus:ring-2 focus:ring-primary border border-border-dark bg-background-dark h-14"
                  type="number"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                />
                <button
                  onClick={() => setCount(count + 1)}
                  className="absolute right-1 w-12 h-12 flex items-center justify-center text-text-sub-dark hover:text-white hover:bg-surface-dark-highlight rounded-lg transition-colors z-10"
                >
                  <span className="material-icons">add</span>
                </button>
              </div>
              <p className="text-text-sub-dark text-xs italic">Contagem do sistema: {realized} un</p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-white text-base font-medium">Informar Refugo</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub-dark">
                  <span className="material-icons-outlined text-[20px]">delete</span>
                </span>
                <input
                  className="w-full rounded-xl text-white font-medium text-lg focus:ring-2 focus:ring-danger/30 border border-border-dark bg-background-dark h-14 pl-12"
                  placeholder="0"
                  type="number"
                  value={scrap}
                  onChange={(e) => setScrap(parseInt(e.target.value) || 0)}
                />
              </div>
              <p className="text-text-sub-dark text-xs">Informe a quantidade de peças rejeitadas</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-background-dark/30 border-t border-border-dark flex flex-col gap-4">
          {/* Sector indicator */}
          {!isFinalSector && (
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <span className="material-icons-outlined">info</span>
              <p className="text-sm">Setor atual: <strong>{sectorName}</strong> — Finalize apenas no setor final (Colagem)</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-4">
            <button
              onClick={() => onSuspend(count, pending)}
              className="flex items-center justify-center gap-2 h-14 px-6 rounded-xl border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-all font-bold group"
            >
              <span className="material-icons-outlined group-hover:scale-110 transition-transform">pause_circle_outline</span>
              <span className="flex flex-col items-start">
                <span>SUSPENDER OP</span>
                <span className="text-[10px] text-blue-300">Pendente: {pending} un</span>
              </span>
            </button>

            {isFinalSector ? (
              <button
                onClick={() => onConfirm(count, scrap)}
                className="flex items-center justify-center gap-2 h-14 px-8 rounded-xl border-2 border-primary bg-primary/10 text-white font-bold text-lg hover:bg-primary shadow-glow transition-all hover:-translate-y-0.5"
              >
                <span className="material-icons-outlined">check_circle</span>
                ENCERRAR OP
              </button>
            ) : (
              <button
                onClick={() => onTransfer?.(count, pending)}
                className="flex items-center justify-center gap-2 h-14 px-8 rounded-xl border-2 border-green-500 bg-green-500/10 text-green-400 font-bold text-lg hover:bg-green-500/20 transition-all hover:-translate-y-0.5"
              >
                <span className="material-icons-outlined">arrow_forward</span>
                <span className="flex flex-col items-start">
                  <span>TRANSFERIR</span>
                  <span className="text-[10px] text-green-300">Próximo setor</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalizeModal;
