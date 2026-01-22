/**
 * useFormatTime - Utility functions for time formatting
 * 
 * Consolidates duplicated formatTime/formatSeconds functions from:
 * - App.tsx (line 562)
 * - OperatorDashboard.tsx (line 128)
 * - SupervisionDashboard.tsx (lines 101-124)
 */

/**
 * Formats seconds to HH:MM:SS string
 */
export function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Alias for backward compatibility
export const formatSeconds = formatTime;

/**
 * Parses cycle time from various formats to seconds
 * Supports: 
 * - Number: returns as-is
 * - String "HH:MM:SS" or "MM:SS" or "SS"
 * - String with unit suffix: "45s", "5m", "1h"
 */
export function parseCycleTimeToSeconds(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }
    if (typeof value !== 'string') return 0;

    const raw = value.trim().toLowerCase();
    if (!raw) return 0;

    // Handle HH:MM:SS or MM:SS format
    if (raw.includes(':')) {
        const parts = raw.split(':').map((part) => Number(part.replace(',', '.')));
        if (parts.some((p) => Number.isNaN(p))) return 0;
        if (parts.length === 3) {
            return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
        }
        if (parts.length === 2) {
            return Math.max(0, parts[0] * 60 + parts[1]);
        }
        return Math.max(0, parts[0]);
    }

    // Handle number with unit suffix
    const normalized = raw.replace(',', '.');
    const match = normalized.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/);
    if (!match) {
        const fallback = Number(normalized);
        return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return 0;

    const unit = match[2] || 's';
    if (unit === 's' || unit === 'sec' || unit === 'secs') return Math.max(0, amount);
    if (unit === 'm' || unit === 'min' || unit === 'mins') return Math.max(0, amount * 60);
    if (unit === 'h' || unit === 'hr' || unit === 'hrs') return Math.max(0, amount * 3600);

    return Math.max(0, amount);
}

/**
 * Formats minutes to human readable display
 * Used in SupervisionDashboard for stop time display
 */
export function formatStopTimeMinutes(minutes: number): string {
    if (minutes < 60) {
        return `${Math.round(minutes)}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Formats elapsed time from ISO timestamp to now
 */
export function formatElapsedFromTimestamp(startedAt: string, nowMs: number = Date.now()): string {
    const start = new Date(startedAt).getTime();
    const diff = Math.max(0, Math.floor((nowMs - start) / 1000));
    return formatTime(diff);
}
