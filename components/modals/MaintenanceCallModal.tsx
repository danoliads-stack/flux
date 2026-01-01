import React, { useState } from 'react';

interface MaintenanceCallModalProps {
    onClose: () => void;
    onConfirm: (description: string) => void;
    machineName?: string;
}

const MaintenanceCallModal: React.FC<MaintenanceCallModalProps> = ({ onClose, onConfirm, machineName }) => {
    const [description, setDescription] = useState('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-surface-dark rounded-xl shadow-2xl border-2 border-orange-500 overflow-hidden animate-fade-in">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-orange-500/30 bg-orange-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <span className="material-icons-outlined text-orange-500 text-3xl">build</span>
                        </div>
                        <div>
                            <h2 className="text-white text-xl font-bold">Chamar Manutenção</h2>
                            <p className="text-orange-400 text-sm font-medium">Isso irá PARAR a máquina {machineName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-text-sub-dark hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <span className="material-icons-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                            Qual é o problema?
                        </label>
                        <textarea
                            className="w-full h-48 bg-background-dark border border-border-dark rounded-xl p-4 text-white text-lg placeholder-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all resize-none"
                            placeholder="Descreva o problema da máquina... (Ex: Vazamento de óleo, ruído estranho no motor, etc)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            autoFocus
                        />
                        <p className="text-right text-xs text-gray-500 mt-1">
                            {description.length} caracteres
                        </p>
                    </div>

                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 flex items-start gap-3">
                        <span className="material-icons-outlined text-orange-500 shrink-0">warning</span>
                        <p className="text-orange-200 text-sm">
                            Ao confirmar, a máquina ficará parada e a equipe de manutenção será notificada no painel.
                            A produção será interrompida.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-background-dark border-t border-border-dark flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-lg font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(description)}
                        disabled={!description.trim()}
                        className={`
                    px-8 py-3 rounded-lg font-bold text-black flex items-center gap-2 transition-all
                    ${description.trim()
                                ? 'bg-orange-500 hover:bg-orange-400 shadow-lg shadow-orange-500/20 translate-y-0'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                `}
                    >
                        <span className="material-icons-outlined">notifications_active</span>
                        Solicitar Manutenção
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceCallModal;
