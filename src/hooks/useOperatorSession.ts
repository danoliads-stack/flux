import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import { formatTime } from './useFormatTime';
import { logger } from '../utils/logger';

interface OperatorSessionState {
    /** Active session ID from op_operator_sessions table */
    activeSessionId: string | null;
    /** ISO timestamp when session started */
    sessionStartedAt: string | null;
    /** Formatted elapsed time "HH:MM:SS" */
    sessionElapsed: string;
    /** Loading state */
    isLoading: boolean;
}

interface OperatorSessionActions {
    /** Fetch active session for given OP */
    fetchActiveSession: (opId: string | null) => Promise<void>;
    /** Set active session ID directly */
    setActiveSessionId: (id: string | null) => void;
}

type UseOperatorSessionResult = OperatorSessionState & OperatorSessionActions;

/**
 * useOperatorSession - Hook for managing operator session state
 * 
 * Consolidates session logic from App.tsx:
 * - Lines 92-94: activeOperatorSessionId, operatorSessionStartedAt, operatorSessionElapsed
 * - Lines 604-671: fetchActiveSession, timer effect
 */
export function useOperatorSession(): UseOperatorSessionResult {
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
    const [sessionElapsed, setSessionElapsed] = useState('00:00:00');
    const [isLoading, setIsLoading] = useState(false);

    // Fetch session start time when session ID changes
    useEffect(() => {
        if (!activeSessionId) {
            setSessionStartedAt(null);
            setSessionElapsed('00:00:00');
            return;
        }

        const fetchSessionStart = async () => {
            const { data, error } = await supabase
                .from('op_operator_sessions')
                .select('started_at')
                .eq('id', activeSessionId)
                .maybeSingle();

            if (!error && data?.started_at) {
                setSessionStartedAt(data.started_at);
            } else {
                setSessionStartedAt(null);
            }
        };

        fetchSessionStart();
    }, [activeSessionId]);

    // Update elapsed timer
    useEffect(() => {
        if (!sessionStartedAt) {
            setSessionElapsed('00:00:00');
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const start = new Date(sessionStartedAt).getTime();
            const diff = Math.max(0, Math.floor((now - start) / 1000));
            setSessionElapsed(formatTime(diff));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [sessionStartedAt]);

    // Fetch active session for given OP
    const fetchActiveSession = useCallback(async (opId: string | null) => {
        if (!opId) {
            setActiveSessionId(null);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('op_operator_sessions')
                .select('id, operator_id, operadores(nome)')
                .eq('op_id', opId)
                .is('ended_at', null)
                .order('started_at', { ascending: false })
                .maybeSingle();

            if (!error && data) {
                setActiveSessionId(data.id);
                logger.log('[useOperatorSession] Active session found:', data.id);
            } else {
                setActiveSessionId(null);
            }
        } catch (err) {
            logger.error('[useOperatorSession] Error fetching session:', err);
            setActiveSessionId(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        activeSessionId,
        sessionStartedAt,
        sessionElapsed,
        isLoading,
        fetchActiveSession,
        setActiveSessionId,
    };
}

export default useOperatorSession;
