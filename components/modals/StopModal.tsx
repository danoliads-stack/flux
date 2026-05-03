import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

interface StopModalProps {
  onClose: () => void;
  onConfirm: (reason: string, notes: string, producedDelta: number, scrapDelta: number) => void;
}

interface TipoParada {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  // other fields ignored
}

const StopModal: React.FC<StopModalProps> = ({ onClose, onConfirm }) => {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [producedDelta, setProducedDelta] = useState<number>(0);
  const [scrapDelta, setScrapDelta] = useState<number>(0);
  const [reasons, setReasons] = useState<TipoParada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReasons = async () => {
      const { data } = await supabase
        .from('tipos_parada')
        .select('id, nome, icone, cor')
        .eq('ativo', true)
        .order('nome');

      if (data) {
        setReasons(data);
      }
      setLoading(false);
    };
    fetchReasons();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-4xl bg-surface-dark rounded-xl border border-border-dark shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-8 pt-8 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white text-2xl font-bold leading-tight tracking-tight">Motivo da Parada</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-danger border border-danger/40 bg-danger/10 px-2 py-0.5 rounded">Obrigatório</span>
            </div>
            <p className="text-text-sub-dark text-sm mt-1">Selecione o motivo para justificar a interrupção.</p>
          </div>
          <button onClick={onClose} className="text-text-sub-dark hover:text-white p-2 rounded-lg hover:bg-white/5">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <span className="material-icons-outlined animate-spin text-3xl mr-3">sync</span>
              Carregando motivos...
            </div>
          ) : reasons.length === 0 ? (
            <div className="text-center py-12 text-gray-500 italic">
              Nenhum motivo de parada cadastrado.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 outline-none relative ${reason === r.id
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border-dark bg-background-dark hover:bg-surface-dark-highlight hover:border-text-sub-dark'
                    }`}
                >
                  <div className={`flex items-center justify-center w-14 h-14 rounded-full transition-all ${reason === r.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-surface-dark text-text-sub-dark group-hover:text-white'
                    }`} style={reason === r.id ? {} : { color: r.cor }}>
                    <span className="material-icons-outlined text-[32px]">{r.icone || 'warning'}</span>
                  </div>
                  <p className={`text-sm font-bold leading-normal text-center transition-colors ${reason === r.id ? 'text-white' : 'text-text-sub-dark group-hover:text-white'
                    }`}>
                    {r.nome}
                  </p>
                  {reason === r.id && (
                    <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-primary rounded-full text-white">
                      <span className="material-icons-outlined text-sm font-bold">check</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Contagem da máquina — campo principal, destaque visual */}
          <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-secondary">speed</span>
              <span className="text-white font-bold text-sm">Contagem da máquina</span>
              <span className="ml-auto text-[10px] font-bold uppercase text-secondary border border-secondary/30 bg-secondary/10 px-2 py-0.5 rounded">Registre antes de parar</span>
            </div>
            <p className="text-text-sub-dark text-xs -mt-2">Leia o contador da máquina e informe abaixo. Fica registrado no histórico da OP.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-sub-dark uppercase tracking-wider flex items-center gap-1" htmlFor="produced">
                  <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
                  Produzido (bom)
                </label>
                <input
                  id="produced"
                  type="number"
                  min={0}
                  value={producedDelta || ''}
                  onChange={(e) => setProducedDelta(Math.max(0, Number(e.target.value)))}
                  className="rounded-lg border border-secondary/30 bg-background-dark text-white px-4 py-3 text-xl font-bold text-center focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-sub-dark uppercase tracking-wider flex items-center gap-1" htmlFor="scrap">
                  <span className="w-2 h-2 rounded-full bg-danger inline-block"></span>
                  Refugo
                </label>
                <input
                  id="scrap"
                  type="number"
                  min={0}
                  value={scrapDelta || ''}
                  onChange={(e) => setScrapDelta(Math.max(0, Number(e.target.value)))}
                  className="rounded-lg border border-danger/30 bg-background-dark text-white px-4 py-3 text-xl font-bold text-center focus:ring-2 focus:ring-danger focus:border-danger transition-all"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-white text-sm font-bold leading-normal flex items-center gap-2" htmlFor="notes">
              <span className="material-icons-outlined text-lg text-text-sub-dark">edit_note</span>
              Observações <span className="text-text-sub-dark font-normal text-xs">(opcional)</span>
            </label>
            <textarea
              id="notes"
              className="flex w-full min-h-[80px] resize-none rounded-lg text-white focus:ring-2 focus:ring-primary border border-border-dark bg-background-dark placeholder:text-text-sub-dark p-4 text-base font-normal leading-normal transition-all"
              placeholder="Detalhes adicionais sobre a parada (ex: barulho no motor 2)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-border-dark bg-background-dark/30 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-lg text-text-sub-dark hover:text-white font-bold transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason, notes, producedDelta, scrapDelta)}
            disabled={!reason}
            className={`flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-base font-bold transition-all transform active:scale-95 ${
              reason
                ? 'bg-danger hover:bg-danger/80 text-white shadow-lg shadow-danger/20'
                : 'bg-border-dark text-text-sub-dark cursor-not-allowed opacity-50'
            }`}
          >
            <span className="material-icons-outlined">pause_circle</span>
            {reason ? 'Confirmar Parada' : 'Selecione um motivo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StopModal;
