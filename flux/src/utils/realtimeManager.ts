import { supabase } from '../../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface MachineStateUpdate {
    machineId: string;
    status: string;
    operatorId?: string | null;
    opId?: string | null;
    timestamp: string;
    source: 'database' | 'broadcast';
    tabId?: string;
}

export interface PresenceUser {
    user_id: string;
    user_name: string;
    user_role: string;
    machine_id?: string | null;
    online_at: string;
}

type MachineUpdateCallback = (update: MachineStateUpdate) => void;
type PresenceCallback = (users: PresenceUser[]) => void;

// ============================================
// REALTIME MANAGER CLASS
// ============================================

export class RealtimeManager {
    private channels: Map<string, RealtimeChannel> = new Map();
    private callbacks: Map<string, Set<Function>> = new Map();
    private currentUser: PresenceUser | null = null;

    /**
     * Subscreve a atualizações de máquinas (broadcast + postgres changes)
     */
    subscribeMachineUpdates(callback: MachineUpdateCallback): () => void {
        const channelName = 'machine-updates';

        if (!this.channels.has(channelName)) {
            console.log('[Realtime] Creating machine-updates channel...');
            const channel = supabase.channel(channelName);

            // 1. Ouve broadcasts de outras abas (instantâneo)
            channel.on('broadcast', { event: 'machine-state' }, ({ payload }) => {
                console.log('[Realtime] 📡 Broadcast received:', payload);
                this.notifyCallbacks(channelName, payload);
            });

            // 2. Ouve mudanças no banco (fallback)
            channel.on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'maquinas'
            }, (payload: any) => {
                console.log('[Realtime] 💾 DB change detected:', payload.eventType);

                const record = payload.new || payload.old;
                if (!record) return;

                const update: MachineStateUpdate = {
                    machineId: record.id,
                    status: record.status_atual,
                    operatorId: record.operador_atual_id,
                    opId: record.op_atual_id,
                    timestamp: new Date().toISOString(),
                    source: 'database'
                };

                this.notifyCallbacks(channelName, update);
            });

            // 3. Ouve inserções em registros_producao (para atualizar produção em tempo real)
            channel.on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'registros_producao'
            }, (payload) => {
                console.log('[Realtime] 🏭 Production record inserted');

                const record = payload.new;
                if (record?.maquina_id) {
                    const update: MachineStateUpdate = {
                        machineId: record.maquina_id,
                        status: 'RUNNING', // Produção implica que está rodando
                        operatorId: record.operador_id,
                        opId: record.op_id,
                        timestamp: new Date().toISOString(),
                        source: 'database'
                    };

                    this.notifyCallbacks(channelName, update);
                }
            });

            // 4. Subscribe
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] ✅ Machine updates channel subscribed');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] ❌ Channel error');
                } else if (status === 'TIMED_OUT') {
                    console.warn('[Realtime] ⏱️ Channel timed out, retrying...');
                }
            });

            this.channels.set(channelName, channel);
        }

        // Adiciona callback
        if (!this.callbacks.has(channelName)) {
            this.callbacks.set(channelName, new Set());
        }
        this.callbacks.get(channelName)!.add(callback);

        console.log(`[Realtime] Callback added. Total callbacks: ${this.callbacks.get(channelName)!.size}`);

        // Retorna função de cleanup
        return () => {
            this.callbacks.get(channelName)?.delete(callback);
            console.log('[Realtime] Callback removed');
        };
    }

    /**
     * Envia broadcast de mudança de estado para todas as abas
     */
    async broadcastMachineUpdate(
        update: Omit<MachineStateUpdate, 'source' | 'timestamp'>
    ): Promise<void> {
        const channel = this.channels.get('machine-updates');
        if (!channel) {
            console.warn('[Realtime] ⚠️ Channel not subscribed, cannot broadcast');
            return;
        }

        const fullUpdate: MachineStateUpdate = {
            ...update,
            timestamp: new Date().toISOString(),
            source: 'broadcast'
        };

        try {
            const result = await channel.send({
                type: 'broadcast',
                event: 'machine-state',
                payload: fullUpdate
            });

            if (result === 'ok') {
                console.log('[Realtime] ✅ Broadcast sent successfully:', fullUpdate);
            } else {
                console.warn('[Realtime] ⚠️ Broadcast failed:', result);
            }
        } catch (error) {
            console.error('[Realtime] ❌ Broadcast error:', error);
        }
    }

    /**
     * Subscreve a presence (rastreamento de usuários online)
     */
    subscribePresence(
        user: PresenceUser,
        callback: PresenceCallback
    ): () => void {
        const channelName = 'online-users';
        this.currentUser = user;

        if (!this.channels.has(channelName)) {
            console.log('[Realtime] Creating presence channel...');
            const channel = supabase.channel(channelName, {
                config: { presence: { key: user.user_id } }
            });

            // Ouve mudanças de presence
            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    const users: PresenceUser[] = Object.values(state)
                        .flat()
                        .map((s: any) => s as PresenceUser);

                    console.log('[Realtime] 👥 Presence synced. Online users:', users.length);
                    this.notifyCallbacks(channelName, users);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    console.log('[Realtime] ➕ User joined:', newPresences);
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    console.log('[Realtime] ➖ User left:', leftPresences);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('[Realtime] ✅ Presence channel subscribed');

                        // Track this user
                        await channel.track(user);
                        console.log('[Realtime] 📍 User tracked:', user.user_name);
                    }
                });

            this.channels.set(channelName, channel);
        }

        // Adiciona callback
        if (!this.callbacks.has(channelName)) {
            this.callbacks.set(channelName, new Set());
        }
        this.callbacks.get(channelName)!.add(callback);

        // Cleanup
        return () => {
            this.callbacks.get(channelName)?.delete(callback);

            // Se não há mais callbacks, untrack
            if (this.callbacks.get(channelName)?.size === 0) {
                const channel = this.channels.get(channelName);
                if (channel) {
                    channel.untrack();
                    console.log('[Realtime] User untracked');
                }
            }
        };
    }

    /**
     * Atualiza presence do usuário atual (ex: mudou de máquina)
     */
    async updatePresence(updates: Partial<PresenceUser>): Promise<void> {
        const channel = this.channels.get('online-users');
        if (!channel || !this.currentUser) {
            console.warn('[Realtime] Cannot update presence: not tracking');
            return;
        }

        this.currentUser = { ...this.currentUser, ...updates };
        await channel.track(this.currentUser);
        console.log('[Realtime] 🔄 Presence updated:', updates);
    }

    /**
     * Notifica todos os callbacks registrados
     */
    private notifyCallbacks(channelName: string, payload: any): void {
        const callbacks = this.callbacks.get(channelName);
        if (callbacks && callbacks.size > 0) {
            callbacks.forEach(cb => {
                try {
                    cb(payload);
                } catch (error) {
                    console.error('[Realtime] Error in callback:', error);
                }
            });
        }
    }

    /**
     * Verifica status da conexão
     */
    getConnectionStatus(): { connected: boolean; channels: string[] } {
        return {
            connected: this.channels.size > 0,
            channels: Array.from(this.channels.keys())
        };
    }

    /**
     * Remove todos os canais (cleanup ao desmontar)
     */
    cleanup(): void {
        console.log('[Realtime] 🧹 Cleaning up all channels...');

        this.channels.forEach((channel, name) => {
            console.log(`[Realtime] Removing channel: ${name}`);
            supabase.removeChannel(channel);
        });

        this.channels.clear();
        this.callbacks.clear();
        this.currentUser = null;

        console.log('[Realtime] ✅ Cleanup complete');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const realtimeManager = new RealtimeManager();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Helper para criar update de máquina
 */
export function createMachineUpdate(
    machineId: string,
    status: string,
    options?: {
        operatorId?: string | null;
        opId?: string | null;
        tabId?: string;
    }
): Omit<MachineStateUpdate, 'source' | 'timestamp'> {
    return {
        machineId,
        status,
        operatorId: options?.operatorId,
        opId: options?.opId,
        tabId: options?.tabId
    };
}
