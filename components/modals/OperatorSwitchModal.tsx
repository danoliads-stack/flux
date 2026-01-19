import React, { useEffect, useState } from 'react';
import { ShiftOption } from '../../types';

interface OperatorSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (matricula: string, pin: string, shiftId?: string | null) => void;
  shifts: ShiftOption[];
  isLoading: boolean;
  isSubmitting: boolean;
  error?: string | null;
  currentShiftId?: string | null;
}

const OperatorSwitchModal: React.FC<OperatorSwitchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shifts,
  isLoading,
  isSubmitting,
  error,
  currentShiftId
}) => {
  const [matricula, setMatricula] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>(currentShiftId || '');

  useEffect(() => {
    if (!isOpen) return;
    setMatricula('');
    setPin('');
    setSelectedShift(currentShiftId || '');
  }, [isOpen, currentShiftId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!matricula.trim() || !pin.trim()) return;
    onConfirm(matricula.trim(), pin.trim(), selectedShift || null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-[#10121a] border border-border-dark rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border-dark bg-[#141622]">
          <h3 className="text-lg font-bold text-white">Troca de turno (sem encerrar OP)</h3>
          <p className="text-xs text-text-sub-dark mt-1">A OP continua ativa. Informe matricula e PIN do novo operador.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-text-sub-dark">
            {isLoading ? 'Carregando operadores e turnos...' : 'Digite a matricula e o PIN do novo operador.'}
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-text-sub-dark">Matrícula</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Digite a matrícula do operador"
              autoFocus
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              disabled={isLoading}
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-text-sub-dark">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Digite o PIN do operador"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={isLoading}
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-text-sub-dark">Turno</label>
            <select
              value={selectedShift}
              disabled={isLoading}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
            >
              <option value="">Manter turno atual</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.nome} ({shift.hora_inicio.slice(0, 5)} - {shift.hora_fim.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-dark bg-[#0f1117]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-text-sub-dark border border-border-dark rounded-lg hover:border-white/40 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || isSubmitting || !matricula.trim() || !pin.trim()}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-colors ${isLoading || isSubmitting || !matricula.trim() || !pin.trim()
              ? 'bg-primary/25 text-white cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'}`}
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar troca'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatorSwitchModal;
