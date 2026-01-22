
import React, { useState, useEffect } from 'react';
import { OPState, MachineStatus, Permission } from '../types';
import { useAppStore } from '../src/store/useAppStore';
import { formatSeconds } from '../src/hooks/useFormatTime';
import './MobileOperatorDashboard.css';

interface MobileOperatorDashboardProps {
    opState: OPState;
    realized: number;
    oee: number;
    opCodigo: string | null;
    statusChangeAt: string | null;
    onOpenSetup: () => void;
    onOpenStop: () => void;
    onOpenFinalize: () => void;
    onStartProduction: () => void;
    onRegisterChecklist: () => void;
    onQuickUpdate: (type: 'produced' | 'scrap', delta: number) => void;
}

const MobileOperatorDashboard: React.FC<MobileOperatorDashboardProps> = ({
    opState, realized, oee, opCodigo, statusChangeAt,
    onOpenSetup, onOpenStop, onOpenFinalize, onStartProduction,
    onRegisterChecklist, onQuickUpdate
}) => {
    const { currentMachine, activeOPData, totalScrap, meta } = useAppStore();
    const [elapsed, setElapsed] = useState('00:00:00');

    useEffect(() => {
        if (!statusChangeAt) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const start = new Date(statusChangeAt).getTime();
            const diff = Math.max(0, Math.floor((now - start) / 1000));

            const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const seconds = (diff % 60).toString().padStart(2, '0');
            setElapsed(`${hours}:${minutes}:${seconds}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [statusChangeAt]);

    const getStatusInfo = () => {
        switch (opState) {
            case 'PRODUCAO': return { label: 'Produzindo', class: 'running' };
            case 'SETUP': return { label: 'Setup', class: 'setup' };
            case 'PARADA': return { label: 'Parada', class: 'stopped' };
            default: return { label: 'Disponível', class: 'idle' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className="mobile-dashboard animate-fade-in">
            {/* Header */}
            <header className="mobile-dashboard-header">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">Painel Operacional</h1>
                    <div className="machine-badge mt-1">{currentMachine?.nome || 'Máquina'}</div>
                </div>
                <div className="status-indicator">
                    <span className={`status-dot ${statusInfo.class}`}></span>
                    <span className="text-xs font-bold uppercase tracking-wider">{statusInfo.label}</span>
                </div>
            </header>

            {/* OP Info Card */}
            <div className="op-info-card animate-slide-up">
                <div className="op-codigo">{opCodigo || 'Sem OP Ativa'}</div>
                <div className="op-produto">{activeOPData?.nome_produto || 'Aguardando Ordem...'}</div>

                <div className="metrics-grid">
                    <div className="metric-item">
                        <span className="metric-label">Produzido</span>
                        <span className="metric-value highlight">{realized}</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-label">Refugo</span>
                        <span className="metric-value text-danger">{totalScrap}</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-label">Eficiência</span>
                        <span className="metric-value">{Math.round(oee)}%</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#2d3342]/50 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-text-sub-dark">Tempo em Faze</span>
                        <span className="text-sm font-mono font-bold text-white">{elapsed}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-text-sub-dark">Meta OP</span>
                        <span className="text-sm font-mono font-bold text-white">{meta}</span>
                    </div>
                </div>
            </div>

            {/* Main Actions */}
            <div className="action-grid">
                {opState === 'IDLE' || opState === 'SETUP' || opState === 'PARADA' ? (
                    <button onClick={onStartProduction} className="mobile-action-btn primary col-span-2">
                        <span className="material-icons-outlined">play_arrow</span>
                        <span className="btn-label">INICIAR PRODUÇÃO</span>
                    </button>
                ) : (
                    <button onClick={onOpenStop} className="mobile-action-btn danger col-span-2">
                        <span className="material-icons-outlined">pause</span>
                        <span className="btn-label">PAUSAR PRODUÇÃO</span>
                    </button>
                )}

                <button onClick={onRegisterChecklist} className="mobile-action-btn secondary">
                    <span className="material-icons-outlined text-primary">fact_check</span>
                    <span className="btn-label">CHECKLIST</span>
                </button>

                <button onClick={onOpenFinalize} className="mobile-action-btn secondary">
                    <span className="material-icons-outlined text-secondary">edit_note</span>
                    <span className="btn-label">APONTAMENTO</span>
                </button>
            </div>

            {/* Quick Counters */}
            <div className="quick-counters">
                <div className="counter-box">
                    <span className="metric-label">Produção Rápida</span>
                    <div className="counter-controls">
                        <button onClick={() => onQuickUpdate('produced', -1)} className="counter-btn">
                            <span className="material-icons-outlined">remove</span>
                        </button>
                        <span className="counter-display text-primary">{realized}</span>
                        <button onClick={() => onQuickUpdate('produced', 1)} className="counter-btn">
                            <span className="material-icons-outlined">add</span>
                        </button>
                    </div>
                </div>

                <div className="counter-box">
                    <span className="metric-label">Ajuste de Refugo</span>
                    <div className="counter-controls">
                        <button onClick={() => onQuickUpdate('scrap', -1)} className="counter-btn">
                            <span className="material-icons-outlined">remove</span>
                        </button>
                        <span className="counter-display text-danger">{totalScrap}</span>
                        <button onClick={() => onQuickUpdate('scrap', 1)} className="counter-btn">
                            <span className="material-icons-outlined">add</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Secondary Actions */}
            <div className="mt-4 flex gap-2">
                <button onClick={onOpenSetup} className="flex-1 py-3 bg-[#1a1d24] border border-[#2d3342] rounded-xl text-xs font-bold uppercase tracking-wider text-text-sub-dark active:bg-surface-highlight transition-all">
                    Ajuste / Setup
                </button>
            </div>
        </div>
    );
};

export default MobileOperatorDashboard;
