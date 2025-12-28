import { supabase } from '../../supabase';

// ============================================
// TYPES
// ============================================

export interface SyncQueueItem {
    id: string;
    type: 'production' | 'stop' | 'checklist' | 'diary';
    data: any;
    timestamp: string; // ISO8601
    retries: number;
    lastAttempt?: string; // ISO8601
}

interface SyncQueue {
    items: SyncQueueItem[];
    lastSync: string; // ISO8601
}

const STORAGE_KEY = 'flux_sync_queue';
const MAX_RETRIES = 5;

// ============================================
// QUEUE MANAGEMENT
// ============================================

export const SyncQueueManager = {
    /**
     * Carrega fila do localStorage
     */
    loadQueue(): SyncQueue {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                return { items: [], lastSync: new Date().toISOString() };
            }
            return JSON.parse(saved) as SyncQueue;
        } catch (e) {
            console.error('[SyncQueue] ❌ Error loading queue:', e);
            return { items: [], lastSync: new Date().toISOString() };
        }
    },

    /**
     * Salva fila no localStorage
     */
    saveQueue(queue: SyncQueue): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
            console.log(`[SyncQueue] 💾 Queue saved (${queue.items.length} items)`);
        } catch (e) {
            console.error('[SyncQueue] ❌ Error saving queue:', e);
        }
    },

    /**
     * Adiciona item à fila
     */
    enqueue(type: SyncQueueItem['type'], data: any): void {
        const queue = this.loadQueue();

        const item: SyncQueueItem = {
            id: crypto.randomUUID(),
            type,
            data,
            timestamp: new Date().toISOString(),
            retries: 0,
        };

        queue.items.push(item);
        this.saveQueue(queue);

        console.log(`[SyncQueue] ➕ Item enqueued:`, type, item.id);

        // Tenta sincronizar imediatamente se online
        if (navigator.onLine) {
            this.processQueue();
        }
    },

    /**
     * Processa fila de sync
     */
    async processQueue(): Promise<void> {
        if (!navigator.onLine) {
            console.log('[SyncQueue] ⏸️ Offline, waiting...');
            return;
        }

        const queue = this.loadQueue();
        if (queue.items.length === 0) {
            console.log('[SyncQueue] ✅ Queue empty');
            return;
        }

        console.log(`[SyncQueue] 🔄 Processing ${queue.items.length} items...`);

        const itemsToProcess = [...queue.items];
        const failedItems: SyncQueueItem[] = [];

        for (const item of itemsToProcess) {
            try {
                await this.syncItem(item);
                console.log(`[SyncQueue] ✅ Synced:`, item.type, item.id);
            } catch (error) {
                console.error(`[SyncQueue] ❌ Sync failed:`, item.type, item.id, error);

                item.retries++;
                item.lastAttempt = new Date().toISOString();

                if (item.retries < MAX_RETRIES) {
                    failedItems.push(item);
                } else {
                    console.error(`[SyncQueue] 🚫 Item exceeded max retries:`, item.id);
                }
            }
        }

        // Atualiza fila com apenas itens que falharam
        queue.items = failedItems;
        queue.lastSync = new Date().toISOString();
        this.saveQueue(queue);

        console.log(`[SyncQueue] ✅ Processing complete. ${failedItems.length} items remaining`);
    },

    /**
     * Sincroniza item individual
     */
    async syncItem(item: SyncQueueItem): Promise<void> {
        switch (item.type) {
            case 'production':
                return this.syncProduction(item.data);
            case 'stop':
                return this.syncStop(item.data);
            case 'checklist':
                return this.syncChecklist(item.data);
            case 'diary':
                return this.syncDiary(item.data);
            default:
                throw new Error(`Unknown sync type: ${item.type}`);
        }
    },

    /**
     * Sincroniza registro de produção
     */
    async syncProduction(data: any): Promise<void> {
        const { error } = await supabase
            .from('registros_producao')
            .insert(data);

        if (error) throw error;
    },

    /**
     * Sincroniza parada
     */
    async syncStop(data: any): Promise<void> {
        const { error } = await supabase
            .from('paradas')
            .insert(data);

        if (error) throw error;
    },

    /**
     * Sincroniza checklist
     */
    async syncChecklist(data: any): Promise<void> {
        const { error } = await supabase
            .from('checklist_eventos')
            .insert(data);

        if (error) throw error;
    },

    /**
     * Sincroniza diário de bordo
     */
    async syncDiary(data: any): Promise<void> {
        const { error } = await supabase
            .from('diario_bordo_eventos')
            .insert(data);

        if (error) throw error;
    },

    /**
     * Obtém estatísticas da fila
     */
    getStats(): { total: number; byType: Record<string, number>; oldestItem?: SyncQueueItem } {
        const queue = this.loadQueue();

        const byType: Record<string, number> = {};
        queue.items.forEach(item => {
            byType[item.type] = (byType[item.type] || 0) + 1;
        });

        const oldestItem = queue.items.length > 0
            ? queue.items.reduce((oldest, item) =>
                new Date(item.timestamp) < new Date(oldest.timestamp) ? item : oldest
            )
            : undefined;

        return {
            total: queue.items.length,
            byType,
            oldestItem,
        };
    },

    /**
     * Limpa toda a fila (use com cuidado)
     */
    clearQueue(): void {
        const queue: SyncQueue = {
            items: [],
            lastSync: new Date().toISOString(),
        };
        this.saveQueue(queue);
        console.log('[SyncQueue] 🗑️ Queue cleared');
    },
};

// ============================================
// AUTO-SYNC SETUP
// ============================================

/**
 * Configura listeners para auto-sync
 */
export function setupAutoSync(): void {
    // Processa fila quando voltar online
    window.addEventListener('online', () => {
        console.log('[SyncQueue] 📶 Back online, processing queue...');
        SyncQueueManager.processQueue();
    });

    // Log quando ficar offline
    window.addEventListener('offline', () => {
        console.log('[SyncQueue] ⚠️ Offline mode activated');
    });

    // Sync periódico a cada 30 segundos se houver itens
    setInterval(() => {
        const stats = SyncQueueManager.getStats();
        if (stats.total > 0 && navigator.onLine) {
            console.log(`[SyncQueue] 🔄 Periodic sync (${stats.total} items pending)`);
            SyncQueueManager.processQueue();
        }
    }, 30000);

    console.log('[SyncQueue] ✅ Auto-sync configured');
}

// ============================================
// SAFE INSERT HELPERS
// ============================================

/**
 * Insere registro de produção com fallback offline
 */
export async function safeInsertProduction(data: any): Promise<void> {
    if (!navigator.onLine) {
        SyncQueueManager.enqueue('production', data);
        return;
    }

    try {
        const { error } = await supabase
            .from('registros_producao')
            .insert(data);

        if (error) throw error;
    } catch (e) {
        console.error('[SyncQueue] ⚠️ Insert failed, queuing:', e);
        SyncQueueManager.enqueue('production', data);
    }
}

/**
 * Insere parada com fallback offline
 */
export async function safeInsertStop(data: any): Promise<void> {
    if (!navigator.onLine) {
        SyncQueueManager.enqueue('stop', data);
        return;
    }

    try {
        const { error } = await supabase
            .from('paradas')
            .insert(data);

        if (error) throw error;
    } catch (e) {
        console.error('[SyncQueue] ⚠️ Insert failed, queuing:', e);
        SyncQueueManager.enqueue('stop', data);
    }
}

/**
 * Insere checklist com fallback offline
 */
export async function safeInsertChecklist(data: any): Promise<void> {
    if (!navigator.onLine) {
        SyncQueueManager.enqueue('checklist', data);
        return;
    }

    try {
        const { error } = await supabase
            .from('checklist_eventos')
            .insert(data);

        if (error) throw error;
    } catch (e) {
        console.error('[SyncQueue] ⚠️ Insert failed, queuing:', e);
        SyncQueueManager.enqueue('checklist', data);
    }
}

/**
 * Insere entrada de diário com fallback offline
 */
export async function safeInsertDiary(data: any): Promise<void> {
    if (!navigator.onLine) {
        SyncQueueManager.enqueue('diary', data);
        return;
    }

    try {
        const { error } = await supabase
            .from('diario_bordo_eventos')
            .insert(data);

        if (error) throw error;
    } catch (e) {
        console.error('[SyncQueue] ⚠️ Insert failed, queuing:', e);
        SyncQueueManager.enqueue('diary', data);
    }
}
