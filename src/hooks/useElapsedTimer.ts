import { useState, useEffect } from 'react';
import { formatTime } from './useFormatTime';

interface UseElapsedTimerOptions {
    /** ISO timestamp string for when the timer started */
    startedAt: string | null;
    /** Current state - timer only runs in active states */
    isActive?: boolean;
    /** Alternative start time to use (takes max of both) */
    alternativeStart?: string | null;
}

interface UseElapsedTimerResult {
    /** Formatted elapsed time string "HH:MM:SS" */
    elapsedString: string;
    /** Elapsed seconds as number */
    elapsedSeconds: number;
}

/**
 * useElapsedTimer - Hook for managing elapsed time display
 * 
 * Consolidates timer logic from:
 * - App.tsx (lines 604-646) - operator session timer
 * - OperatorDashboard.tsx (lines 100-126) - phase timer
 */
export function useElapsedTimer({
    startedAt,
    isActive = true,
    alternativeStart
}: UseElapsedTimerOptions): UseElapsedTimerResult {
    const [elapsedString, setElapsedString] = useState('00:00:00');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!startedAt || !isActive) {
            setElapsedString('00:00:00');
            setElapsedSeconds(0);
            return;
        }

        // Calculate effective start time
        const startTime = new Date(startedAt).getTime();
        const altTime = alternativeStart ? new Date(alternativeStart).getTime() : 0;
        const effectiveStart = Math.max(startTime, altTime);

        if (!effectiveStart) {
            setElapsedString('00:00:00');
            setElapsedSeconds(0);
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - effectiveStart) / 1000));
            setElapsedSeconds(diff);
            setElapsedString(formatTime(diff));
        };

        // Initial update
        updateTimer();

        // Update every second
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [startedAt, isActive, alternativeStart]);

    return { elapsedString, elapsedSeconds };
}

export default useElapsedTimer;
