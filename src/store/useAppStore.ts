import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MachineStatus, OPState, MachineData, ProductionOrder } from '../../types';

interface AppState {
    // Machine State
    selectedMachineId: string | null;
    currentMachine: MachineData | null;

    // OP State
    activeOP: string | null;
    activeOPCodigo: string | null;
    activeOPData: ProductionOrder | null;
    opState: OPState;

    // Production Counters
    totalProduced: number;
    totalScrap: number;
    meta: number;

    // Timer State (Server-side timestamps are source of truth)
    statusChangeAt: string | null; // Database timestamp for current phase start
    accumulatedSetupTime: number;
    accumulatedProductionTime: number;
    accumulatedStopTime: number;

    // Actions
    setSelectedMachine: (machineId: string | null) => void;
    setCurrentMachine: (machine: MachineData | null) => void;
    setActiveOP: (op: ProductionOrder | null) => void;
    setOpState: (state: OPState) => void;
    setProductionData: (data: Partial<{ totalProduced: number; totalScrap: number; meta: number }>) => void;
    updateProduction: (type: 'produced' | 'scrap', delta: number) => void;

    // Timer Actions
    syncTimers: (data: {
        statusChangeAt?: string | null;
        accSetup?: number;
        accProd?: number;
        accStop?: number;
    }) => void;

    resetState: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial State
            selectedMachineId: null,
            currentMachine: null,
            activeOP: null,
            activeOPCodigo: null,
            activeOPData: null,
            opState: 'IDLE',

            totalProduced: 0,
            totalScrap: 0,
            meta: 0,

            statusChangeAt: null,
            accumulatedSetupTime: 0,
            accumulatedProductionTime: 0,
            accumulatedStopTime: 0,

            // Actions
            setSelectedMachine: (machineId) => set({ selectedMachineId: machineId }),

            setCurrentMachine: (machine) => {
                set((state) => ({
                    currentMachine: machine,
                    selectedMachineId: machine?.id || state.selectedMachineId
                }));
            },

            setActiveOP: (op) => {
                if (!op) {
                    set({
                        activeOP: null,
                        activeOPCodigo: null,
                        activeOPData: null,
                        totalProduced: 0,
                        totalScrap: 0,
                        meta: 0
                    });
                } else {
                    set({
                        activeOP: op.id,
                        activeOPCodigo: op.codigo,
                        activeOPData: op,
                        totalProduced: 0, // ✅ Reset counters for new OP
                        totalScrap: 0,    // ✅ Reset counters for new OP
                        meta: op.quantidade_meta || 0
                    });
                }
            },

            setOpState: (newState) => set({ opState: newState }),

            setProductionData: (data) => set((state) => ({ ...state, ...data })),

            updateProduction: (type, delta) => set((state) => ({
                totalProduced: type === 'produced' ? Math.max(0, state.totalProduced + delta) : state.totalProduced,
                totalScrap: type === 'scrap' ? Math.max(0, state.totalScrap + delta) : state.totalScrap
            })),

            syncTimers: (data) => set((state) => ({
                statusChangeAt: data.statusChangeAt !== undefined ? data.statusChangeAt : state.statusChangeAt,
                accumulatedSetupTime: data.accSetup !== undefined ? data.accSetup : state.accumulatedSetupTime,
                accumulatedProductionTime: data.accProd !== undefined ? data.accProd : state.accumulatedProductionTime,
                accumulatedStopTime: data.accStop !== undefined ? data.accStop : state.accumulatedStopTime,
            })),

            resetState: () => set({
                selectedMachineId: null,
                currentMachine: null,
                activeOP: null,
                activeOPCodigo: null,
                activeOPData: null,
                opState: 'IDLE',
                totalProduced: 0,
                totalScrap: 0,
                meta: 0,
                statusChangeAt: null,
                accumulatedSetupTime: 0,
                accumulatedProductionTime: 0,
                accumulatedStopTime: 0
            })
        }),
        {
            name: 'flux-app-storage', // unique name
            storage: createJSONStorage(() => localStorage), // Persist to localStorage
            partialize: (state) => ({
                // Persist machine and OP state for recovery on refresh
                selectedMachineId: state.selectedMachineId,
                activeOP: state.activeOP,
                activeOPCodigo: state.activeOPCodigo,
                opState: state.opState,
                statusChangeAt: state.statusChangeAt,
                accumulatedSetupTime: state.accumulatedSetupTime,
                accumulatedProductionTime: state.accumulatedProductionTime,
                accumulatedStopTime: state.accumulatedStopTime,
            }),
        }
    )
);
