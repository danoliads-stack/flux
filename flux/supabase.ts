/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing. Check your .env file.');
}

// INSTÂNCIA ÚNICA do Supabase Client - com configurações corretas de auth
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'flux_auth_session' // Namespace único para evitar conflitos
    }
});

// Expose for debugging (apenas em dev)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).supabase = supabase;
}
