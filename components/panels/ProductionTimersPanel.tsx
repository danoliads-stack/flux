import React from 'react';
import { OPState } from '../../types';

interface ProductionTimersPanelProps {
    opState: OPState;
    totalSetupDisplay: string;
    totalProductionDisplay: string;
    totalStopDisplay: string;
    displayTimer: string;
}

/**
 * ProductionTimersPanel - Displays production timers
 * 
 * Extracted from OperatorDashboard.tsx to reduce component size.
 * Shows: Setup time, Production time, Stop time, and current phase timer.
 */
const ProductionTimersPanel: React.FC<ProductionTimersPanelProps> = ({
    opState,
    totalSetupDisplay,
    totalProductionDisplay,
    totalStopDisplay,
    displayTimer
}) => {
    // Determine active timer styling
    const getTimerStyle = (timerType: string) => {
        const isActive =
            (timerType === 'setup' && opState === 'SETUP') ||
            (timerType === 'production' && opState === 'PRODUCAO') ||
            (timerType === 'stop' && opState === 'PARADA');

        return isActive
            ? 'ring-2 ring-primary animate-pulse'
            : '';
    };

    const getTimerColor = (timerType: string) => {
        switch (timerType) {
            case 'setup': return 'text-yellow-400';
            case 'production': return 'text-emerald-400';
            case 'stop': return 'text-red-400';
            default: return 'text-text-muted-dark';
        }
    };

    return (
        <div className="grid grid-cols-3 gap-2">
            {/* Setup Timer */}
            <div
                className={`bg-surface-dark rounded-lg p-3 text-center border border-border-dark ${getTimerStyle('setup')}`}
            >
                <div className="text-xs text-text-muted-dark uppercase tracking-wide mb-1">
                    Setup
                </div>
                <div className={`text-lg font-mono font-semibold ${getTimerColor('setup')}`}>
                    {totalSetupDisplay}
                </div>
            </div>

            {/* Production Timer */}
            <div
                className={`bg-surface-dark rounded-lg p-3 text-center border border-border-dark ${getTimerStyle('production')}`}
            >
                <div className="text-xs text-text-muted-dark uppercase tracking-wide mb-1">
                    Produção
                </div>
                <div className={`text-lg font-mono font-semibold ${getTimerColor('production')}`}>
                    {totalProductionDisplay}
                </div>
            </div>

            {/* Stop Timer */}
            <div
                className={`bg-surface-dark rounded-lg p-3 text-center border border-border-dark ${getTimerStyle('stop')}`}
            >
                <div className="text-xs text-text-muted-dark uppercase tracking-wide mb-1">
                    Parada
                </div>
                <div className={`text-lg font-mono font-semibold ${getTimerColor('stop')}`}>
                    {totalStopDisplay}
                </div>
            </div>

            {/* Current Phase Timer - Full Width */}
            <div className="col-span-3 bg-surface-dark rounded-lg p-4 text-center border border-border-dark mt-2">
                <div className="text-xs text-text-muted-dark uppercase tracking-wide mb-2">
                    Tempo na Fase Atual ({opState})
                </div>
                <div className="text-3xl font-mono font-bold text-primary">
                    {displayTimer}
                </div>
            </div>
        </div>
    );
};

export default ProductionTimersPanel;
