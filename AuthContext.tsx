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
        console.log(`[DEBUG-AUTH] 💓 fetchProfile START for ${userId}`);
        const startTime = Date.now();
        try {
            console.log(`[DEBUG-AUTH] 💓 fetchProfile: Awaiting Supabase query...`);
            const { data, error } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', userId)
                .single();

            if (error || !data) {
                console.error('[DEBUG-AUTH] ❌ fetchProfile error:', error);
                return null;
            }

            console.log(`[DEBUG-AUTH] 💓 fetchProfile SUCCESS in ${Date.now() - startTime}ms`);
            return {
                id: userId,
                name: data.full_name,
                role: data.role as UserRole,
                avatar: data.full_name.charAt(0),
                sector: 'Administração'
            };
        } catch (err) {
            console.error('[DEBUG-AUTH] ❌ fetchProfile EXCEPTION:', err);
            return null;
        }
    }, []);

    // Inicialização - Verificar sessão existente DESTA ABA
    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            if (!isMounted) return;
            console.log(`[DEBUG-AUTH] 🏁 START Initialization (Tab: ${SessionStorage.getTabId()})`);
            const startTime = Date.now();

            try {
                // 1. PRIMEIRO verificar sessão de OPERADOR
                const operator = SessionStorage.getOperator();
                console.log('[DEBUG-AUTH] 🔍 Checking operator session:', operator ? 'FOUND' : 'NOT FOUND');

                if (operator) {
                    console.log('[DEBUG-AUTH] ✅ Setting operator user:', operator.name);
                    if (isMounted) {
                        setUser(operator);
                        setLoading(false);
                        SessionStorage.setAuthInitialized();
                    }
                    return;
                }

                // 2. Supabase Auth
                console.log('[DEBUG-AUTH] 🔍 Fetching Supabase session...');
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[DEBUG-AUTH] ❌ getSession error:', sessionError);
                }

                if (session?.user) {
                    console.log('[DEBUG-AUTH] ✅ Supabase session found for:', session.user.email);
                    const profile = await fetchProfile(session.user.id);
                    console.log('[DEBUG-AUTH] 🔍 Profile fetch result:', profile ? 'SUCCESS' : 'FAILED');

                    if (profile) {
                        if (isMounted) {
                            setUser(profile);
                            console.log('[DEBUG-AUTH] ✅ Profile set:', profile.role);
                        }
                    } else {
                        console.warn('[DEBUG-AUTH] ⚠️ Profile missing, attempting refresh...');
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

                        if (refreshError || !refreshData.session) {
                            console.error('[DEBUG-AUTH] ❌ Refresh failed, signing out.');
                            await supabase.auth.signOut();
                            clearSupabaseAuthData();
                        } else {
                            const retryProfile = await fetchProfile(refreshData.session.user.id);
                            if (isMounted && retryProfile) {
                                setUser(retryProfile);
                                console.log('[DEBUG-AUTH] ✅ Profile recovered.');
                            }
                        }
                    }
                } else {
                    console.log('[DEBUG-AUTH] ℹ️ No Supabase session found');
                }
            } catch (err) {
                console.error('[DEBUG-AUTH] ❌ CRITICAL initialization error:', err);
            } finally {
                if (isMounted) {
                    console.log(`[DEBUG-AUTH] 🏁 END Initialization in ${Date.now() - startTime}ms`);
                    setLoading(false);
                    SessionStorage.setAuthInitialized();
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;
            console.log(`[DEBUG-AUTH] 🔔 Event Received: ${event} (User: ${session?.user?.email || 'NONE'})`);

            // Se ainda estamos no "initializeAuth", não precisamos processar SIGNED_IN aqui
            // pois o initializeAuth já vai tratar o resultado do getSession.
            if (SessionStorage.isAuthInitialized() === false) {
                console.log('[DEBUG-AUTH] ⏭️ Skipping event - Initialization still in progress');
                return;
            }

            const currentOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);
            if (currentOperator) {
                console.log('[DEBUG-AUTH] ⏭️ Ignoring event - Operator logged in this tab');
                return;
            }

            if (typeof window !== 'undefined' && (window as any).isCreatingUserAdmin) {
                console.log('[DEBUG-AUTH] ⏭️ Ignoring event - Admin user creation flag ACTIVE');
                return;
            }

            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
                console.log('[DEBUG-AUTH] 🔄 Processing SIGNED_IN/USER_UPDATED');
                const profile = await fetchProfile(session.user.id);
                if (profile && isMounted) {
                    setUser(prev => {
                        const isSame = (prev?.id === profile.id && prev.role === profile.role);
                        console.log('[DEBUG-AUTH] 👤 Identity Check:', isSame ? 'SAME (Skipping update)' : 'DIFFERENT (Updating state)');
                        return isSame ? prev : profile;
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                console.log('[DEBUG-AUTH] 🔄 Processing SIGNED_OUT');
                if (!sessionStorage.getItem(OPERATOR_SESSION_KEY)) {
                    if (isMounted) setUser(null);
                }
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
