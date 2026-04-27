/**
 * Sistema de dialogo de confirmacao do FLUX.
 *
 * Substitui o window.confirm() nativo. Retorna Promise<boolean>:
 *   const ok = await confirmDialog({ message: 'Tem certeza?' });
 *   if (ok) doIt();
 *
 * Variante "danger" (botao confirmar vermelho):
 *   const ok = await confirmDialog({ message: 'Excluir?', danger: true });
 *
 * O componente <FluxNotifications /> registra o listener.
 */

export interface ConfirmRequest {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmListener = (req: ConfirmRequest) => void;

class ConfirmDialogEmitter {
  private listener: ConfirmListener | null = null;

  setListener(l: ConfirmListener | null): void {
    this.listener = l;
  }

  request(opts: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      // Fallback: se nao tem componente montado, usa o nativo (DEV apenas)
      if (!this.listener) {
        if (typeof window !== 'undefined') {
          resolve(window.confirm(opts.message));
        } else {
          resolve(false);
        }
        return;
      }
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      this.listener({
        id,
        title: opts.title ?? 'Confirmar',
        message: opts.message,
        confirmText: opts.confirmText ?? 'Confirmar',
        cancelText: opts.cancelText ?? 'Cancelar',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  }
}

export const confirmDialogEmitter = new ConfirmDialogEmitter();

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return confirmDialogEmitter.request(opts);
}
