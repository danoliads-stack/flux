import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { AppUser, UserRole } from './types';
import { SessionStorage } from './src/utils/storageManager';

// Namespace para sessão de operador
// Usando sessionStorage (isolado por aba) + localStorage como backup de persistência
const OPERATOR_SESSION_KEY = 'flux_operator_session_v1';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    loginAsAdmin: (email: string, pass: string) => Promise<{ error: any }>;
    loginAsOperator: (matricula: string, pin: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
    clearAllSessions: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Limpa APENAS dados de operador
const clearOperatorSession = () => {
    sessionStorage.removeItem(OPERATOR_SESSION_KEY);
    localStorage.removeItem(OPERATOR_SESSION_KEY);
    localStorage.removeItem('flux_selected_machine');
    localStorage.removeItem('flux_current_shift');
    console.log('[Auth] Operator session cleared');
};

// Limpa APENAS dados do Supabase Auth
const clearSupabaseAuthData = () => {
    const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') || key === 'flux_auth_session'
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    // NÃO limpa sessionStorage aqui - pode ter sessão de operador
    console.log('[Auth] Supabase auth data cleared');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch profile do admin/supervisor
    const fetchProfile = useCallback(async (userId: string): Promise<AppUser | null> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', userId)
            .single();

        if (data && !error) {
            return {
                id: userId,
                name: data.full_name,
                role: data.role as UserRole,
                avatar: data.full_name.charAt(0),
                sector: 'Administração'
            };
        }
        console.error('[Auth] Error fetching profile:', error);
        return null;
    }, []);

    // Inicialização - Verificar sessão existente DESTA ABA
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            console.log(`[Auth] 🔄 Initializing auth for tab ${SessionStorage.getTabId()}...`);
            const startTime = Date.now();

            // Auto-recovery: Check for initialization loops
            const loopDetectionKey = 'flux_auth_loop_detection';
            const now = Date.now();
            const loopData = localStorage.getItem(loopDetectionKey);

            if (loopData) {
                try {
                    const { count, firstAttempt } = JSON.parse(loopData);
                    const timeSinceFirst = now - firstAttempt;

                    // If more than 3 initializations in 10 seconds, clear everything and force login
                    if (count >= 3 && timeSinceFirst < 10000) {
                        console.error('[Auth] ⚠️ Auth loop detected! Forcing logout and redirect to login...');
                        localStorage.clear();
                        sessionStorage.clear();
                        await supabase.auth.signOut();
                        window.location.href = '/';
                        return;
                    }

                    // Reset counter if more than 10 seconds passed
                    if (timeSinceFirst > 10000) {
                        localStorage.setItem(loopDetectionKey, JSON.stringify({ count: 1, firstAttempt: now }));
                    } else {
                        localStorage.setItem(loopDetectionKey, JSON.stringify({ count: count + 1, firstAttempt }));
                    }
                } catch (e) {
                    localStorage.setItem(loopDetectionKey, JSON.stringify({ count: 1, firstAttempt: now }));
                }
            } else {
                localStorage.setItem(loopDetectionKey, JSON.stringify({ count: 1, firstAttempt: now }));
            }

            try {
                // 1. PRIMEIRO verificar sessão de OPERADOR (SessionStorage helper)
                const operator = SessionStorage.getOperator();
                if (operator) {
                    console.log('[Auth] ✅ Found operator session in this tab:', operator.name);
                    if (isMounted) {
                        setUser(operator);
                        setLoading(false);
                        SessionStorage.setAuthInitialized();
                    }
                    return; // Operador tem prioridade nesta aba
                }

                // 2. Se não tem operador, verificar Supabase Auth (Admin/Supervisor)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[Auth] ❌ getSession error:', sessionError);
                }

                if (session?.user) {
                    console.log('[Auth] ✅ Found Supabase session for:', session.user.email);

                    const profile = await fetchProfile(session.user.id);

                    if (profile) {
                        if (isMounted) {
                            setUser(profile);
                            console.log('[Auth] ✅ Profile loaded:', profile.role);
                        }
                    } else {
                        // Sessão corrompida - tentar refresh
                        console.warn('[Auth] ⚠️ Session exists but profile fetch failed. Attempting refresh...');
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

                        if (refreshError || !refreshData.session) {
                            console.error('[Auth] ❌ Refresh failed. Forcing signOut.');
                            await supabase.auth.signOut();
                            clearSupabaseAuthData();
                        } else {
                            const retryProfile = await fetchProfile(refreshData.session.user.id);
                            if (isMounted && retryProfile) {
                                setUser(retryProfile);
                                console.log('[Auth] ✅ Profile recovered after refresh:', retryProfile.role);
                            }
                        }
                    }
                } else {
                    console.log('[Auth] ℹ️ No active session found');
                }
            } catch (err) {
                console.error('[Auth] ❌ Critical error during initialization:', err);
            } finally {
                if (isMounted) {
                    const elapsed = Date.now() - startTime;
                    console.log(`[Auth] ✅ Initialization complete in ${elapsed}ms`);
                    setLoading(false);
                    SessionStorage.setAuthInitialized();
                }
            }
        };

        initializeAuth();

        // Listener para mudanças de auth do Supabase (Admin/Supervisor)
        // IMPORTANTE: Só reage se NÃO tiver operador logado nesta aba
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Se tem operador logado nesta aba, ignorar mudanças de auth do Supabase
            const currentOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);
            if (currentOperator) {
                console.log('[Auth] Ignoring Supabase auth change - operator is logged in this tab');
                return;
            }

            // Check if we're in the middle of creating a user administratively
            // @ts-ignore - accessing global flag from AdminUsuarios
            if (typeof window !== 'undefined' && (window as any).isCreatingUserAdmin) {
                console.log('[Auth] Ignoring auth change - admin user creation in progress');
                return;
            }

            console.log('[Auth] Supabase state change:', event, session?.user?.email);

            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await fetchProfile(session.user.id);
                if (profile && isMounted) {
                    setUser(profile);
                }
            } else if (event === 'SIGNED_OUT') {
                // Só faz logout se não tiver operador
                if (!sessionStorage.getItem(OPERATOR_SESSION_KEY)) {
                    if (isMounted) setUser(null);
                }
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('[Auth] Token refreshed successfully');
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    // Login Admin/Supervisor - Usa Supabase Auth
    const loginAsAdmin = useCallback(async (email: string, pass: string) => {
        console.log('[Auth] Admin login attempt:', email);

        // Limpa sessão de operador DESTA ABA apenas
        sessionStorage.removeItem(OPERATOR_SESSION_KEY);
        setUser(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pass
        });

        if (error) {
            console.error('[Auth] Admin login error:', error.message);
            return { error };
        }

        console.log('[Auth] Admin login successful');
        return { error: null };
    }, []);

    // Login Operador - NÃO usa Supabase Auth, usa tabela operadores + sessionStorage
    const loginAsOperator = useCallback(async (matricula: string, pin: string) => {
        console.log('[Auth] Operator login attempt:', matricula);

        // NÃO faz signOut do Supabase Auth aqui - outras abas podem estar usando
        // Apenas limpa a sessão de operador desta aba
        sessionStorage.removeItem(OPERATOR_SESSION_KEY);
        setUser(null);

        const { data, error } = await supabase
            .from('operadores')
            .select('*, setores(nome), turnos(nome)')
            .eq('matricula', matricula)
            .eq('pin', pin)
            .eq('ativo', true)
            .single();

        if (error || !data) {
            console.error('[Auth] Operator login error:', error?.message);
            return { error: 'Matrícula ou PIN inválido' };
        }

        const opUser: AppUser = {
            id: data.id,
            name: data.nome,
            role: 'OPERATOR',
            avatar: data.avatar || data.nome.charAt(0),
            sector: data.setores?.nome || 'Produção',
            setor_id: data.setor_id,
            turno: data.turnos?.nome || 'Turno',
            matricula: data.matricula
        };

        setUser(opUser);
        // Usa SessionStorage helper (APENAS sessionStorage, não localStorage)
        SessionStorage.setOperator(opUser);
        return { error: null };
    }, []);

    // Logout - Apenas desta aba
    const logout = useCallback(async () => {
        console.log('[Auth] 🔓 Logging out from this tab...');

        const wasOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);

        // Limpa estado local primeiro
        setUser(null);

        // Limpa TUDO do sessionStorage desta aba (exceto flag de inicialização)
        const authInitialized = sessionStorage.getItem('flux_auth_initialized');
        sessionStorage.clear();
        if (authInitialized) sessionStorage.setItem('flux_auth_initialized', 'true');

        // Limpa dados relacionados de localStorage
        localStorage.removeItem('flux_selected_machine');

        // Limpa timers, OPs ativas, etc.
        const fluxKeys = Object.keys(localStorage).filter(k =>
            k.startsWith('flux_') && !k.startsWith('sb-')
        );
        fluxKeys.forEach(k => localStorage.removeItem(k));

        // Se era admin/supervisor, faz signout do Supabase
        if (!wasOperator) {
            try {
                await supabase.auth.signOut();
                console.log('[Auth] ✅ Supabase signOut complete');
            } catch (e) {
                console.error('[Auth] ❌ Supabase signOut error:', e);
            }
        }

        console.log('[Auth] ✅ Logout complete');
    }, []);

    // Função para limpar TUDO (uso manual/debug)
    const clearAllSessions = useCallback(() => {
        clearOperatorSession();
        clearSupabaseAuthData();
        setUser(null);
        console.log('[Auth] All sessions cleared manually');
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, loginAsAdmin, loginAsOperator, logout, clearAllSessions }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
