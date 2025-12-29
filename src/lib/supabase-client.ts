import { supabase } from '../../supabase';
import { PostgrestError } from '@supabase/supabase-js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface RetryOptions {
    retries?: number;
    delay?: number;
}

// Utilitário de delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper genérico para chamadas Supabase com retry
export async function executeWithRetry<T>(
    operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
    options: RetryOptions = {}
): Promise<{ data: T | null; error: PostgrestError | null }> {
    const retries = options.retries ?? MAX_RETRIES;
    const delayMs = options.delay ?? RETRY_DELAY;

    let attempt = 0;

    while (attempt <= retries) {
        try {
            const { data, error } = await operation();

            if (!error) {
                return { data, error: null };
            }

            // Se for erro de conexão ou timeout (status 0 ou 5xx), tentamos novamente
            // Erros 4xx geralmente são de cliente (bad request) e não devem ser retentados cegamente
            // PostgrestError não tem status HTTP direto fácil sempre, mas vamos assumir que queremos retry em falhas de fetch
            console.warn(`[Supabase] Erro na tentativa ${attempt + 1}/${retries + 1}:`, error.message);

            if (attempt < retries) {
                await delay(delayMs * Math.pow(2, attempt)); // Backoff exponencial
                attempt++;
                continue;
            }

            return { data: null, error };

        } catch (err: any) {
            console.error(`[Supabase] Exceção na tentativa ${attempt + 1}:`, err);
            if (attempt < retries) {
                await delay(delayMs * Math.pow(2, attempt));
                attempt++;
                continue;
            }

            // Retornar um erro formatado como PostgrestError
            return {
                data: null,
                error: {
                    message: err.message || 'Erro desconhecido de rede',
                    details: '',
                    hint: '',
                    code: 'NETWORK_ERROR'
                } as PostgrestError
            };
        }
    }

    return { data: null, error: { message: 'Max retries exceeded', code: 'TIMEOUT', details: '', hint: '' } as PostgrestError };
}

// Exemplos de uso exportados (se necessário)
export { supabase };
