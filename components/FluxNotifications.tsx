import React, { useEffect, useState, useCallback } from 'react';
import { notifyEmitter, NotifItem, notify } from '../src/utils/notify';
import {
  confirmDialogEmitter,
  ConfirmRequest,
} from '../src/utils/confirmDialog';

/**
 * Container de UI para toasts e confirm dialogs do FLUX.
 * Deve ser montado UMA VEZ na raiz da aplicacao (em App.tsx).
 *
 * Toasts: stack no canto superior direito, auto-dismiss.
 * Confirm: modal centralizado, bloqueante.
 */

const ICON_BY_TYPE: Record<NotifItem['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const TONE_BY_TYPE: Record<NotifItem['type'], { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-secondary/10',
    border: 'border-secondary/40',
    icon: 'text-secondary',
    text: 'text-white',
  },
  error: {
    bg: 'bg-danger/10',
    border: 'border-danger/40',
    icon: 'text-danger',
    text: 'text-white',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/40',
    icon: 'text-warning',
    text: 'text-white',
  },
  info: {
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    icon: 'text-primary',
    text: 'text-white',
  },
};

const FluxNotifications: React.FC = () => {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [confirms, setConfirms] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    const unsub = notifyEmitter.subscribe(setItems);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    confirmDialogEmitter.setListener(req => {
      setConfirms(prev => [...prev, req]);
    });
    return () => {
      confirmDialogEmitter.setListener(null);
    };
  }, []);

  const resolveConfirm = useCallback((id: string, ok: boolean) => {
    setConfirms(prev => {
      const target = prev.find(c => c.id === id);
      if (target) target.resolve(ok);
      return prev.filter(c => c.id !== id);
    });
  }, []);

  // Esc fecha o confirm dialog (cancela)
  useEffect(() => {
    if (confirms.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const top = confirms[confirms.length - 1];
        if (top) resolveConfirm(top.id, false);
      } else if (e.key === 'Enter') {
        const top = confirms[confirms.length - 1];
        if (top) resolveConfirm(top.id, true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirms, resolveConfirm]);

  return (
    <>
      {/* TOAST STACK */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))] pointer-events-none"
      >
        {items.map(item => {
          const tone = TONE_BY_TYPE[item.type];
          return (
            <div
              key={item.id}
              role="status"
              className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md shadow-2xl pointer-events-auto animate-slide-in ${tone.bg} ${tone.border}`}
            >
              <span
                className={`material-icons-outlined text-xl shrink-0 ${tone.icon}`}
                aria-hidden="true"
              >
                {ICON_BY_TYPE[item.type]}
              </span>
              <p className={`flex-1 text-sm leading-snug ${tone.text}`}>
                {item.message}
              </p>
              <button
                type="button"
                onClick={() => notify.dismiss(item.id)}
                className="text-text-sub-dark hover:text-white transition-colors shrink-0"
                aria-label="Fechar"
              >
                <span className="material-icons-outlined text-base">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* CONFIRM DIALOG */}
      {confirms.map(req => (
        <div
          key={req.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-title-${req.id}`}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={e => {
            // Click no overlay (fora do card) cancela
            if (e.target === e.currentTarget) resolveConfirm(req.id, false);
          }}
        >
          <div className="relative w-full max-w-md bg-surface-dark rounded-2xl border border-border-dark shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <span
                  className={`material-icons-outlined text-3xl ${
                    req.danger ? 'text-danger' : 'text-primary'
                  }`}
                  aria-hidden="true"
                >
                  {req.danger ? 'warning' : 'help_outline'}
                </span>
                <div className="flex-1">
                  <h3
                    id={`confirm-title-${req.id}`}
                    className="text-base font-display font-semibold text-white uppercase tracking-wide"
                  >
                    {req.title}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-text-main-dark leading-relaxed whitespace-pre-line">
                {req.message}
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => resolveConfirm(req.id, false)}
                className="px-4 py-2 rounded-lg border border-border-dark text-text-main-dark hover:bg-white/5 text-sm font-semibold transition-colors"
              >
                {req.cancelText}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolveConfirm(req.id, true)}
                className={`px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors ${
                  req.danger
                    ? 'bg-danger hover:bg-danger/90'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {req.confirmText}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Animacoes inline (nao depende de tailwind config externa) */}
      <style>{`
        @keyframes flux-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: flux-slide-in 0.18s ease-out;
        }
      `}</style>
    </>
  );
};

export default FluxNotifications;
