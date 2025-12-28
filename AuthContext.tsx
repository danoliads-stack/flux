import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { AppUser, UserRole } from './types';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    loginAsAdmin: (email: string, pass: string) => Promise<{ error: any }>;
    loginAsOperator: (matricula: string, pin: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
    clearAllSessions: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Função global para limpar todas as sessões
const clearAllSessionData = () => {
    // Remove dados do operador
    localStorage.removeItem('flux_operator_session');

    // Remove outros dados relacionados à sessão
    localStorage.removeItem('flux_selected_machine');
    localStorage.removeItem('flux_current_shift');

    // Limpa dados do Supabase auth
    const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') || key.includes('supabase')
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));

    // Limpa sessionStorage também
    sessionStorage.clear();

    console.log('All session data cleared');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check initial session for Admin/Supervisor
        const checkSession = async () => {
            console.log('Checking session...');
            try {
                // Force a timeout to prevent infinite hang - reduced to 3 seconds
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session check timed out')), 3000)
                );

                const { data: { session }, error } = await Promise.race([
                    sessionPromise,
                    timeoutPromise
                ]) as any;

                console.log('Session result:', { session: !!session, error });

                if (session) {
                    await fetchProfile(session.user.id);
                } else {
                    // Check localStorage for Operator session (simple persistence)
                    const savedOp = localStorage.getItem('flux_operator_session');
                    if (savedOp) {
                        try {
                            console.log('Found saved operator session');
                            const parsed = JSON.parse(savedOp);
                            // Validate the saved session has required fields
                            if (parsed && parsed.id && parsed.name && parsed.role) {
                                setUser(parsed);
                            } else {
                                console.log('Invalid saved session');
                                // Don't clear immediately here, waiting for explicit failure
                            }
                        } catch (e) {
                            console.error('Error parsing saved operator session', e);
                        }
                    }
                }
            } catch (err) {
                console.error('Critical error or timeout in checkSession:', err);

                // CRITICAL FIX: Don't clear everything immediately on timeout.
                // Try to recover operator session first.
                console.log('Attempting offline/fallback operator recovery...');

                const savedOp = localStorage.getItem('flux_operator_session');
                let recovered = false;

                if (savedOp) {
                    try {
                        const parsed = JSON.parse(savedOp);
                        if (parsed && parsed.id && parsed.name && parsed.role) {
                            console.log('Fallback: Using saved operator session despite connection error');
                            setUser(parsed);
                            recovered = true;
                        }
                    } catch (e) {
                        console.error('Fallback parse error', e);
                    }
                }

                // Only clear if we really couldn't recover anything
                if (!recovered) {
                    console.log('Could not recover session. Clearing data.');
                    clearAllSessionData();
                }
            } finally {
                console.log('Setting loading to false');
                setLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event, session?.user?.id);
            if (session) {
                await fetchProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                // Limpa tudo quando fizer signout
                clearAllSessionData();
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', userId)
            .single();

        if (data && !error) {
            setUser({
                id: userId,
                name: data.full_name,
                role: data.role as UserRole,
                avatar: data.full_name.charAt(0),
                sector: 'Administração'
            });
        }
    };

    const loginAsAdmin = async (email: string, pass: string) => {
        // Limpa sessão anterior antes do novo login
        clearAllSessionData();
        setUser(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        return { error };
    };

    const loginAsOperator = async (matricula: string, pin: string) => {
        // Limpa sessão anterior antes do novo login
        clearAllSessionData();
        setUser(null);

        const { data, error } = await supabase
            .from('operadores')
            .select('*, setores(nome), turnos(nome)')
            .eq('matricula', matricula)
            .eq('pin', pin)
            .eq('ativo', true)
            .single();

        if (error || !data) {
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
        localStorage.setItem('flux_operator_session', JSON.stringify(opUser));
        return { error: null };
    };

    const logout = async () => {
        console.log('Logging out...');

        // Primeiro limpa o estado local
        setUser(null);

        // Limpa todos os dados de sessão
        clearAllSessionData();

        // Faz signout do Supabase (para admin)
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Error signing out from Supabase:', e);
        }

        console.log('Logout complete');
    };

    // Função exposta para limpar sessões manualmente se necessário
    const clearAllSessions = () => {
        clearAllSessionData();
        setUser(null);
    };

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
