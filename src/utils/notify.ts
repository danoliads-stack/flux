/**
 * Sistema de notificacoes (toasts) do FLUX.
 *
 * Substitui o alert() nativo do browser. Use de qualquer lugar:
 *   notify.success('Producao registrada');
 *   notify.error('Erro ao salvar');
 *   notify.warn('Atencao: meta nao atingida');
 *   notify.info('OP atualizada pelo PCP');
 *
 * O componente <FluxNotifications /> deve estar montado uma vez na raiz da app.
 */

export type NotifType = 'success' | 'error' | 'warning' | 'info';

export interface NotifItem {
  id: string;
  type: NotifType;
  message: string;
  duration: number; // ms; 0 = persistente
  createdAt: number;
}

type Listener = (items: NotifItem[]) => void;

class NotifyEmitter {
  private items: NotifItem[] = [];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.items);
    return () => {
      this.listeners.delete(listener);
    };
  }

  push(type: NotifType, message: string, duration = 4500): string {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const item: NotifItem = {
      id,
      type,
      message,
      duration,
      createdAt: Date.now(),
    };
    this.items = [...this.items, item];
    this.emit();
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  dismiss(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
    this.emit();
  }

  clear(): void {
    this.items = [];
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) {
      l(this.items);
    }
  }
}

export const notifyEmitter = new NotifyEmitter();

export const notify = {
  success: (message: string, duration?: number) =>
    notifyEmitter.push('success', message, duration),
  error: (message: string, duration?: number) =>
    notifyEmitter.push('error', message, duration ?? 6000), // erro fica mais tempo
  warn: (message: string, duration?: number) =>
    notifyEmitter.push('warning', message, duration),
  info: (message: string, duration?: number) =>
    notifyEmitter.push('info', message, duration),
  dismiss: (id: string) => notifyEmitter.dismiss(id),
  clear: () => notifyEmitter.clear(),
};
