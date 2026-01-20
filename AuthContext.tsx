import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { AppUser, UserRole } from './types';
import { SessionStorage } from './src/utils/storageManager';
import { logger } from './src/utils/logger';
import type { Session } from '@supabase/supabase-js';

// Namespace para sessão de operador
const OPERATOR_SESSION_KEY = 'flux_operator_session_v1';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    loginAsAdmin: (email: string, pass: string) => Promise<{ error: any }>;
    loginAsOperator: (matricula: string, pin: string) => Promise<{ error: string | null }>;
    setOperatorSession: (operator: AppUser) => void;
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
    logger.log('[Auth] Operator session cleared');
};

// Limpa APENAS dados do Supabase Auth
const clearSupabaseAuthData = () => {
    const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') || key === 'flux_auth_session'
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    logger.log('[Auth] Supabase auth data cleared');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    // 🛡️ Refs para evitar processamento duplicado e memory leaks
    const lastUserIdRef = useRef<string | null>(null);
    const initialized = useRef(false);
    const isMountedRef = useRef(true);

    // 🏗️ Helper: Cria user mínimo a partir da sessão Supabase (fallback)
    const createFallbackUser = useCallback((session: Session): AppUser => {
        const email = session.user.email || '';
        return {
            id: session.user.id,
            name: email.split('@')[0] || 'Usuário',
            role: 'ADMIN' as UserRole,
            avatar: (email.charAt(0) || 'U').toUpperCase(),
            sector: 'Administração'
        };
    }, []);

    // 🔍 Fetch profile com timeout de 3s usando Promise.race
    const fetchProfile = useCallback(async (userId: string): Promise<AppUser | null> => {
        logger.log(`[PROFILE] Fetch started for ${userId}`);
        const startTime = Date.now();

        // Timeout de 3 segundos
        const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
                logger.warn('[PROFILE] Query timeout (3s) - using fallback');
                resolve(null);
            }, 3000);
        });

        const queryPromise = (async (): Promise<AppUser | null> => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role, full_name, avatar_url')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    logger.warn('[PROFILE] Query error:', error.message);
                    return null;
                }

                if (!data) {
                    logger.log(`[PROFILE] Not found -> using fallback user`);
                    return null;
                }

                logger.log(`[PROFILE] Loaded in ${Date.now() - startTime}ms:`, data.role);
                return {
                    id: userId,
                    name: data.full_name,
                    role: data.role as UserRole,
                    avatar: data.avatar_url || data.full_name.charAt(0),
                    sector: 'Administração'
                };
            } catch (err: any) {
                logger.warn('[PROFILE] Exception:', err.message);
                return null;
            }
        })();

        // Retorna o que completar primeiro: query ou timeout
        return Promise.race([queryPromise, timeoutPromise]);
    }, []);

    // 🎯 Handler centralizado para mudanças de sessão
    const handleSessionChange = useCallback(async (session: Session | null, source: string) => {
        if (!isMountedRef.current) return;

        // Se não há sessão, limpa user
        if (!session?.user) {
            logger.log(`[AUTH] ${source}: No session`);
            lastUserIdRef.current = null;
            setUser(null);
            setLoading(false);
            return;
        }

        // ✅ Evita processar mesmo usuário duas vezes
        if (lastUserIdRef.current === session.user.id) {
            logger.log(`[AUTH] ${source}: Same user (${session.user.email}), skipping`);
            setLoading(false);
            return;
        }

        logger.log(`[AUTH] ${source}: Processing user ${session.user.email}`);
        lastUserIdRef.current = session.user.id;

        // Busca profile (com timeout de 3s)
        const profile = await fetchProfile(session.user.id);
        const userToSet = profile ?? createFallbackUser(session);

        if (isMountedRef.current) {
            setUser(userToSet);
            setLoading(false);
            logger.log(`[AUTH] ${source}: User set ->`, userToSet.name, profile ? '(with profile)' : '(fallback)');
        }
    }, [fetchProfile, createFallbackUser]);

    // 🚀 Inicialização principal
    useEffect(() => {
        // Trava de inicialização única
        if (initialized.current) {
            logger.log('[AUTH] Already initialized, skipping');
            return;
        }
        initialized.current = true;
        isMountedRef.current = true;

        logger.log('[AUTH] Initializing...');

        const initAuth = async () => {
            try {
                // 1️⃣ PRIMEIRO: Verifica operador (sessionStorage - instantâneo)
                const operator = SessionStorage.getOperator();
                if (operator) {
                    logger.log('[AUTH] Operator found in sessionStorage:', operator.name);
                    lastUserIdRef.current = operator.id;
                    setUser(operator);
                    setLoading(false);
                    return; // ✅ Retorna imediatamente, não configura listener Supabase
                }

                // 2️⃣ Busca sessão Supabase
                logger.log('[AUTH] Checking Supabase session...');
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    logger.error('[AUTH] getSession error:', error.message);
                }

                // Processa sessão inicial
                await handleSessionChange(session, 'INIT');

            } catch (err) {
                logger.error('[AUTH] Initialization error:', err);
                if (isMountedRef.current) {
                    setUser(null);
                    setLoading(false);
                }
            }
        };

        // 3️⃣ Configura listener ANTES de inicializar (para não perder eventos)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMountedRef.current) return;

                // Ignora se operador está logado
                const currentOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);
                if (currentOperator) {
                    logger.log('[AUTH] Event ignored - operator logged in');
                    return;
                }

                // Ignora durante criação admin de usuário
                if (typeof window !== 'undefined' && (window as any).isCreatingUserAdmin) {
                    logger.log('[AUTH] Event ignored - admin creating user');
                    return;
                }

                logger.log(`[AUTH] onAuthStateChange: ${event}`);

                switch (event) {
                    case 'INITIAL_SESSION':
                        // Já tratado pelo initAuth()
                        break;
                    case 'SIGNED_IN':
                        await handleSessionChange(session, 'SIGNED_IN');
                        break;
                    case 'SIGNED_OUT':
                        lastUserIdRef.current = null;
                        setUser(null);
                        setLoading(false);
                        logger.log('[AUTH] User signed out');
                        break;
                    case 'TOKEN_REFRESHED':
                        logger.log('[AUTH] Token refreshed');
                        break;
                    // Ignora outros eventos (USER_UPDATED, etc)
                }
            }
        );

        // 4️⃣ Inicia autenticação
        initAuth();

        // 🧹 Cleanup
        return () => {
            logger.log('[AUTH] Cleanup - unsubscribing');
            isMountedRef.current = false;
            initialized.current = false; // Reset for StrictMode remount
            subscription.unsubscribe();
        };
    }, [handleSessionChange]);


    // 🔐 Login Admin/Supervisor - Usa Supabase Auth
    const loginAsAdmin = useCallback(async (email: string, pass: string) => {
        logger.log('[AUTH] Admin login attempt:', email);

        // Limpa sessão de operador desta aba
        sessionStorage.removeItem(OPERATOR_SESSION_KEY);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pass
        });

        if (error) {
            logger.error('[AUTH] Login error:', error.message);
            return { error };
        }

        logger.log('[AUTH] Login successful');
        return { error: null };
    }, []);

    // 👷 Login Operador - Usa função RPC segura (PIN validado no servidor via hash)
    const loginAsOperator = useCallback(async (matricula: string, pin: string) => {
        logger.log('[AUTH] Operator login attempt:', matricula);

        // Limpa sessão anterior
        sessionStorage.removeItem(OPERATOR_SESSION_KEY);

        // ✅ Usa função RPC que valida PIN hash no servidor (PIN nunca exposto na query)
        const { data, error } = await supabase
            .rpc('validate_operator_pin', {
                p_matricula: matricula,
                p_pin: pin
            });

        if (error) {
            logger.error('[AUTH] Operator login RPC error:', error.message);
            return { error: 'Erro ao validar credenciais (RPC Error)' };
        }

        if (!data || data.length === 0) {
            logger.warn('[AUTH] Operator not found or invalid PIN');
            return { error: 'Matrícula ou PIN inválido (No Data)' };
        }

        const operatorData = data[0];
        const opUser: AppUser = {
            id: operatorData.id,
            name: operatorData.nome,
            role: 'OPERATOR',
            avatar: operatorData.avatar || operatorData.nome.charAt(0),
            sector: operatorData.setor_nome || 'Produção',
            setor_id: operatorData.setor_id,
            turno: operatorData.turno_nome || 'Turno',
            matricula: operatorData.matricula
        };

        // Salva no sessionStorage e atualiza estado
        SessionStorage.setOperator(opUser);
        lastUserIdRef.current = opUser.id;
        setUser(opUser);

        logger.log('[AUTH] Operator logged in:', opUser.name);
        return { error: null };
    }, []);

    const setOperatorSession = useCallback((operator: AppUser) => {
        SessionStorage.setOperator(operator);
        lastUserIdRef.current = operator.id;
        setUser(operator);
        logger.log('[AUTH] Operator session updated:', operator.name);
    }, []);


    // 🚪 Logout - Apenas desta aba
    const logout = useCallback(async () => {
        logger.log('[AUTH] Logging out...');

        const wasOperator = sessionStorage.getItem(OPERATOR_SESSION_KEY);

        // Limpa estado
        lastUserIdRef.current = null;
        setUser(null);

        // Limpa sessionStorage desta aba
        const authInitialized = sessionStorage.getItem('flux_auth_initialized');
        sessionStorage.clear();
        if (authInitialized) sessionStorage.setItem('flux_auth_initialized', 'true');

        // Limpa dados relacionados de localStorage
        localStorage.removeItem('flux_selected_machine');
        const fluxKeys = Object.keys(localStorage).filter(k =>
            k.startsWith('flux_') && !k.startsWith('sb-') && k !== 'flux_theme'
        );
        fluxKeys.forEach(k => localStorage.removeItem(k));

        // Se era admin/supervisor, faz signout do Supabase
        if (!wasOperator) {
            try {
                await supabase.auth.signOut();
                logger.log('[AUTH] Supabase signOut complete');
            } catch (e) {
                logger.error('[AUTH] Supabase signOut error:', e);
            }
        }

        logger.log('[AUTH] Logout complete');
    }, []);

    // 🧹 Função para limpar TUDO (uso manual/debug)
    const clearAllSessions = useCallback(() => {
        clearOperatorSession();
        clearSupabaseAuthData();
        lastUserIdRef.current = null;
        setUser(null);
        logger.log('[AUTH] All sessions cleared');
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, loginAsAdmin, loginAsOperator, setOperatorSession, logout, clearAllSessions }}>
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
