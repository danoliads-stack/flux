import { AppUser, MachineStatus } from '../../types';
import { supabase } from '../../supabase';
import { logger } from './logger';

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEYS = {
    // SessionStorage - Isolado por aba
    OPERATOR_SESSION: 'flux_operator_session_v1',

    AUTH_INITIALIZED: 'flux_auth_initialized',
    TAB_ID: 'flux_tab_id',

    // LocalStorage - Estado compartilhado
    SELECTED_MACHINE: 'flux_selected_machine',
    MACHINE_STATE_PREFIX: 'flux_machine_state_',
    OP_STATE_PREFIX: 'flux_op_state_',
    ACCUMULATED_TIMES_PREFIX: 'flux_accumulated_times_',

    // LocalStorage - Sync offline
    SYNC_QUEUE: 'flux_sync_queue',
} as const;

// ============================================
// TYPES
// ============================================

export interface MachineState {
    machineId: string;
    status: MachineStatus;
    currentOP: string | null;
    operatorId: string | null;
    statusChangedAt: string; // ISO8601
    lastSync: string; // ISO8601
}

export interface AccumulatedTimes {
    opId: string;
    setupTime: number; // milliseconds
    productionTime: number;
    stopTime: number;
    lastUpdate: string; // ISO8601
}

// ============================================
// SESSION STORAGE (Isolado por aba)
// ============================================

export const SessionStorage = {
    /**
     * Gera ou recupera ID único desta aba
     */
    getTabId(): string {
        let tabId = sessionStorage.getItem(STORAGE_KEYS.TAB_ID);
        if (!tabId) {
            tabId = crypto.randomUUID();
            sessionStorage.setItem(STORAGE_KEYS.TAB_ID, tabId);
        }
        return tabId;
    },

    /**
     * Salva sessão de operador (APENAS nesta aba)
     */
    setOperator(user: AppUser): void {
        try {
            sessionStorage.setItem(STORAGE_KEYS.OPERATOR_SESSION, JSON.stringify(user));
            console.log(`[SessionStorage] ✅ Operator saved in tab ${this.getTabId()}:`, user.name);
        } catch (e) {
            console.error('[SessionStorage] ❌ Error saving operator:', e);
        }
    },

    /**
     * Recupera sessão de operador desta aba
     */
    getOperator(): AppUser | null {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEYS.OPERATOR_SESSION);
            if (!saved) return null;

            const parsed = JSON.parse(saved);
            if (parsed?.id && parsed?.name && parsed?.role === 'OPERATOR') {
                return parsed as AppUser;
            }
            return null;
        } catch (e) {
            console.error('[SessionStorage] ❌ Error parsing operator:', e);
            this.clearOperator();
            return null;
        }
    },

    /**
     * Remove sessão de operador APENAS desta aba
     */
    clearOperator(): void {
        sessionStorage.removeItem(STORAGE_KEYS.OPERATOR_SESSION);
        console.log(`[SessionStorage] 🗑️ Operator cleared from tab ${this.getTabId()}`);
    },



    /**
     * Marca que autenticação foi inicializada
     */
    setAuthInitialized(): void {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_INITIALIZED, 'true');
    },

    /**
     * Verifica se autenticação foi inicializada
     */
    isAuthInitialized(): boolean {
        return sessionStorage.getItem(STORAGE_KEYS.AUTH_INITIALIZED) === 'true';
    },
};

// ============================================
// MACHINE STATE STORAGE (Compartilhado)
// ============================================

export const MachineStateStorage = {
    /**
     * Salva estado de máquina no localStorage
     */
    saveMachineState(state: MachineState): void {
        try {
            const key = `${STORAGE_KEYS.MACHINE_STATE_PREFIX}${state.machineId}`;
            state.lastSync = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(state));
            logger.log('[MachineState] 💾 Saved:', state.machineId, state.status);
        } catch (e) {
            logger.error('[MachineState] ❌ Error saving:', e);
        }
    },

    /**
     * Recupera estado de máquina do localStorage
     */
    getMachineState(machineId: string): MachineState | null {
        try {
            const key = `${STORAGE_KEYS.MACHINE_STATE_PREFIX}${machineId}`;
            const saved = localStorage.getItem(key);
            if (!saved) return null;

            return JSON.parse(saved) as MachineState;
        } catch (e) {
            logger.error('[MachineState] ❌ Error loading:', e);
            return null;
        }
    },

    /**
     * Sincroniza estado de máquina com Supabase
     */
    async syncToSupabase(machineId: string): Promise<void> {
        const state = this.getMachineState(machineId);
        if (!state) return;

        try {
            const { error } = await supabase
                .from('maquinas')
                .update({
                    status_atual: state.status,
                    op_atual_id: state.currentOP,
                    operador_atual_id: state.operatorId,
                    status_change_at: state.statusChangedAt,
                })
                .eq('id', machineId);

            if (error) throw error;

            logger.log('[MachineState] ☁️ Synced to Supabase:', machineId);

            // Atualiza timestamp de sync
            state.lastSync = new Date().toISOString();
            this.saveMachineState(state);
        } catch (e) {
            logger.error('[MachineState] ❌ Sync error:', e);
        }
    },

    /**
     * Restaura estado de máquina do Supabase
     */
    async restoreFromSupabase(machineId: string): Promise<MachineState | null> {
        try {
            const { data, error } = await supabase
                .from('maquinas')
                .select('id, status_atual, op_atual_id, operador_atual_id, status_change_at')
                .eq('id', machineId)
                .single();

            if (error) throw error;
            if (!data) return null;

            const state: MachineState = {
                machineId: data.id,
                status: data.status_atual,
                currentOP: data.op_atual_id,
                operatorId: data.operador_atual_id,
                statusChangedAt: data.status_change_at || new Date().toISOString(),
                lastSync: new Date().toISOString(),
            };

            this.saveMachineState(state);
            logger.log('[MachineState] ⬇️ Restored from Supabase:', machineId);
            return state;
        } catch (e) {
            logger.error('[MachineState] ❌ Restore error:', e);
            return null;
        }
    },

    /**
     * Remove estado de máquina específica
     */
    clearMachineState(machineId: string): void {
        const key = `${STORAGE_KEYS.MACHINE_STATE_PREFIX}${machineId}`;
        localStorage.removeItem(key);
        logger.log('[MachineState] 🗑️ Cleared:', machineId);
    },

    /**
     * Lista todas as máquinas com estado salvo
     */
    listMachines(): string[] {
        const prefix = STORAGE_KEYS.MACHINE_STATE_PREFIX;
        const machines: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                machines.push(key.replace(prefix, ''));
            }
        }

        return machines;
    },
};

// ============================================
// ACCUMULATED TIMES STORAGE
// ============================================

export const AccumulatedTimesStorage = {
    /**
     * Salva tempos acumulados de uma OP
     */
    saveTimes(times: AccumulatedTimes): void {
        try {
            const key = `${STORAGE_KEYS.ACCUMULATED_TIMES_PREFIX}${times.opId}`;
            times.lastUpdate = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify(times));
            logger.log('[AccumulatedTimes] 💾 Saved for OP:', times.opId);
        } catch (e) {
            logger.error('[AccumulatedTimes] ❌ Error saving:', e);
        }
    },

    /**
     * Recupera tempos acumulados de uma OP
     */
    getTimes(opId: string): AccumulatedTimes | null {
        try {
            const key = `${STORAGE_KEYS.ACCUMULATED_TIMES_PREFIX}${opId}`;
            const saved = localStorage.getItem(key);
            if (!saved) return null;

            return JSON.parse(saved) as AccumulatedTimes;
        } catch (e) {
            logger.error('[AccumulatedTimes] ❌ Error loading:', e);
            return null;
        }
    },

    /**
     * Remove tempos acumulados de uma OP
     */
    clearTimes(opId: string): void {
        const key = `${STORAGE_KEYS.ACCUMULATED_TIMES_PREFIX}${opId}`;
        localStorage.removeItem(key);
        logger.log('[AccumulatedTimes] 🗑️ Cleared for OP:', opId);
    },
};

// ============================================
// STORAGE CLEANER
// ============================================

export const StorageCleaner = {
    /**
     * Limpa APENAS a sessão desta aba
     * NÃO toca em dados de máquina ou produção
     */
    clearSession(): void {
        logger.log('[StorageCleaner] 🧹 Clearing session...');

        // Preserva tabId
        const tabId = SessionStorage.getTabId();

        // Limpa tudo do sessionStorage
        sessionStorage.clear();

        // Restaura tabId
        sessionStorage.setItem(STORAGE_KEYS.TAB_ID, tabId);

        // Remove máquina selecionada (contexto de operador)
        localStorage.removeItem(STORAGE_KEYS.SELECTED_MACHINE);

        console.log('[StorageCleaner] ✅ Session cleared for tab:', tabId);
    },

    /**
     * Limpa estado de máquina específica e tempos da OP
     */
    clearMachineState(machineId: string, opId?: string): void {
        logger.log('[StorageCleaner] 🧹 Clearing machine state:', machineId);

        MachineStateStorage.clearMachineState(machineId);

        if (opId) {
            AccumulatedTimesStorage.clearTimes(opId);
        }

        logger.log('[StorageCleaner] ✅ Machine state cleared');
    },

    /**
     * Limpa estados antigos (> 24h sem uso)
     */
    clearStaleStates(): void {
        logger.log('[StorageCleaner] 🧹 Clearing stale states...');

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Limpa estados de máquina antigos
        const machines = MachineStateStorage.listMachines();
        let clearedCount = 0;

        machines.forEach(machineId => {
            const state = MachineStateStorage.getMachineState(machineId);
            if (state && new Date(state.lastSync) < oneDayAgo) {
                MachineStateStorage.clearMachineState(machineId);
                clearedCount++;
            }
        });

        logger.log(`[StorageCleaner] ✅ Cleared ${clearedCount} stale machine states`);
    },

    /**
     * CUIDADO: Limpa TUDO exceto dados de produção no Supabase
     * Use apenas para debug ou reset completo
     */
    clearAll(): void {
        if (!confirm('⚠️ Isso vai limpar TODOS os dados locais. Continuar?')) {
            return;
        }

        logger.log('[StorageCleaner] 🚨 CLEARING ALL LOCAL DATA...');

        // Limpa sessionStorage
        sessionStorage.clear();

        // Limpa TUDO do localStorage que começa com flux_
        // Mas preserva sb- (Supabase auth)
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('flux_')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        logger.log(`[StorageCleaner] ✅ Cleared ${keysToRemove.length} items from localStorage`);
        logger.log('[StorageCleaner] ℹ️ Supabase data (production records) preserved');
    },
};

// ============================================
// SELECTED MACHINE HELPERS
// ============================================

export const SelectedMachineStorage = {
    set(machineId: string): void {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MACHINE, machineId);
    },

    get(): string | null {
        return localStorage.getItem(STORAGE_KEYS.SELECTED_MACHINE);
    },

    clear(): void {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_MACHINE);
    },
};
