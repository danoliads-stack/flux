import React from 'react';
import { TipoEtiqueta } from '../../types';

interface LabelTypeSelectionModalProps {
    onClose: () => void;
    onSelectType: (type: TipoEtiqueta) => void;
    opCodigo?: string;
}

const LabelTypeSelectionModal: React.FC<LabelTypeSelectionModalProps> = ({
    onClose,
    onSelectType,
    opCodigo
}) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg flex flex-col bg-surface-dark rounded-2xl shadow-2xl border border-border-dark overflow-hidden animate-fade-in">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-dark bg-surface-dark-highlight">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-icons-outlined text-2xl">label</span>
                        </div>
                        <div>
                            <h2 className="text-white text-xl font-bold tracking-tight">Emitir Etiqueta</h2>
                            <p className="text-text-sub-dark text-xs mt-0.5">
                                {opCodigo ? `OP ${opCodigo}` : 'Selecione o tipo de etiqueta'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-sub-dark hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                        <span className="material-icons-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-4">
                    <p className="text-text-sub-dark text-sm text-center mb-2">
                        Escolha o tipo de etiqueta que deseja emitir:
                    </p>

                    {/* Checklist Label Option */}
                    <button
                        onClick={() => onSelectType('CHECKLIST')}
                        className="group flex items-center gap-5 p-5 rounded-xl border-2 border-blue-500/30 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
                    >
                        <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <span className="material-icons-outlined text-3xl">fact_check</span>
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-white font-bold text-lg mb-1">Etiqueta de Checklist</h3>
                            <p className="text-text-sub-dark text-xs leading-relaxed">
                                Para rastreio de qualidade pontual. Tamanho pequeno para caixas.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">70x50mm</span>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-text-sub-dark text-[10px] font-bold uppercase">Caixa</span>
                            </div>
                        </div>
                        <span className="material-icons-outlined text-2xl text-text-sub-dark group-hover:text-blue-400 transition-colors">
                            arrow_forward
                        </span>
                    </button>

                    {/* Pallet Label Option */}
                    <button
                        onClick={() => onSelectType('PALLET')}
                        className="group flex items-center gap-5 p-5 rounded-xl border-2 border-orange-500/30 bg-orange-500/5 hover:border-orange-500 hover:bg-orange-500/10 transition-all"
                    >
                        <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                            <span className="material-icons-outlined text-3xl">inventory_2</span>
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-white font-bold text-lg mb-1">Etiqueta de Pallet</h3>
                            <p className="text-text-sub-dark text-xs leading-relaxed">
                                Para rastreio logístico e produtivo. Pode ser emitida várias vezes na mesma OP.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase">100x150mm</span>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-text-sub-dark text-[10px] font-bold uppercase">Pallet</span>
                            </div>
                        </div>
                        <span className="material-icons-outlined text-2xl text-text-sub-dark group-hover:text-orange-400 transition-colors">
                            arrow_forward
                        </span>
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-background-dark/50 border-t border-border-dark">
                    <p className="text-text-sub-dark text-[10px] text-center italic">
                        A numeração será atribuída automaticamente por OP
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LabelTypeSelectionModal;
