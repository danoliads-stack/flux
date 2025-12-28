import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { AppUser, UserRole } from './types';

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
            console.log('[Auth] Initializing for this tab...');

            try {
                // 1. PRIMEIRO verificar sessão de OPERADOR no sessionStorage (específica desta aba)
                const savedOp = sessionStorage.getItem(OPERATOR_SESSION_KEY);
                if (savedOp) {
                    try {
                        const parsed = JSON.parse(savedOp);
                        if (parsed?.id && parsed?.name && parsed?.role === 'OPERATOR') {
                            console.log('[Auth] Found operator session in this tab:', parsed.name);
                            if (isMounted) {
                                setUser(parsed);
                                setLoading(false);
                            }
                            return; // Operador tem prioridade nesta aba
                        }
                    } catch (e) {
                        console.error('[Auth] Error parsing operator session:', e);
                        sessionStorage.removeItem(OPERATOR_SESSION_KEY);
                    }
                }

                // 2. Se não tem operador, verificar Supabase Auth (Admin/Supervisor)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[Auth] getSession error:', sessionError);
                }

                if (session?.user) {
                    console.log('[Auth] Found Supabase session for:', session.user.email);

                    const profile = await fetchProfile(session.user.id);

                    if (profile) {
                        if (isMounted) setUser(profile);
                    } else {
                        // Sessão corrompida - tentar refresh
                        console.warn('[Auth] Session exists but profile fetch failed. Attempting refresh...');
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

                        if (refreshError || !refreshData.session) {
                            console.error('[Auth] Refresh failed. Forcing signOut.');
                            await supabase.auth.signOut();
                            clearSupabaseAuthData();
                        } else {
                            const retryProfile = await fetchProfile(refreshData.session.user.id);
                            if (isMounted && retryProfile) {
                                setUser(retryProfile);
                            }
                        }
                    }
                } else {
                    // 3. Fallback: verificar localStorage como backup (ex: usuário fechou aba e reabriu)
                    const backupOp = localStorage.getItem(OPERATOR_SESSION_KEY);
                    if (backupOp) {
                        try {
                            const parsed = JSON.parse(backupOp);
                            if (parsed?.id && parsed?.name && parsed?.role === 'OPERATOR') {
                                console.log('[Auth] Recovered operator session from backup:', parsed.name);
                                // Restaurar no sessionStorage desta aba
                                sessionStorage.setItem(OPERATOR_SESSION_KEY, backupOp);
                                if (isMounted) setUser(parsed);
                            }
                        } catch (e) {
                            console.error('[Auth] Error parsing backup operator session:', e);
                            localStorage.removeItem(OPERATOR_SESSION_KEY);
                        }
                    }
                }
            } catch (err) {
                console.error('[Auth] Critical error during initialization:', err);
            } finally {
                if (isMounted) {
                    console.log('[Auth] Initialization complete');
                    setLoading(false);
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
        // Salva no sessionStorage (específico desta aba)
        sessionStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify(opUser));
        // Também salva no localStorage como backup (para recuperar se fechar e reabrir)
        localStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify(opUser));

        console.log('[Auth] Operator login successful:', opUser.name);
        return { error: null };
    }, []);

    // Logout - Apenas desta aba
    const logout = useCallback(async () => {
        console.log('[Auth] Logging out from this tab...');

        const wasOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);

        // Limpa estado local primeiro
        setUser(null);

        // Limpa sessão de operador desta aba
        sessionStorage.removeItem(OPERATOR_SESSION_KEY);
        localStorage.removeItem('flux_selected_machine');

        // Se era admin, faz signout do Supabase
        if (!wasOperator) {
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.error('[Auth] Supabase signOut error:', e);
            }
        }

        // Se era operador, limpa backup do localStorage também
        if (wasOperator) {
            localStorage.removeItem(OPERATOR_SESSION_KEY);
        }

        console.log('[Auth] Logout complete');
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
