/**
 * Logger Utility
 * Substitui console.log para evitar exposição de dados sensíveis em produção.
 * 
 * Uso:
 * import { logger } from './utils/logger';
 * logger.log('Mensagem', dados);
 * logger.error('Erro crítica', erro);
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log de informação (apenas em DEV)
     */
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Log de aviso (apenas em DEV)
     */
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    /**
     * Log de erro (Sempre visível, mas pode ser filtrado no futuro)
     */
    error: (...args: any[]) => {
        console.error(...args);
    },

    /**
     * Log de tabela (apenas em DEV)
     */
    table: (...args: any[]) => {
        if (isDev) {
            console.table(...args);
        }
    }
};
