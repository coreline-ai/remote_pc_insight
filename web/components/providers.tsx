'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';

type DevErrorKind = 'error' | 'unhandledrejection' | 'resource-error';

interface DevErrorEntry {
    id: string;
    ts: string;
    kind: DevErrorKind;
    message: string;
    page: string;
    userAgent: string;
    sourceUrl?: string;
    stack?: string;
}

const DEV_ERROR_LOG_KEY = 'pcinsight:dev-error-log';
const DEV_ERROR_LOG_MAX = 100;

declare global {
    interface Window {
        __pcInsightDebugDumpErrors?: () => DevErrorEntry[];
        __pcInsightDebugClearErrors?: () => void;
    }
}

function stringifyUnknown(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function loadDevErrorEntries(): DevErrorEntry[] {
    try {
        const raw = localStorage.getItem(DEV_ERROR_LOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as DevErrorEntry[];
    } catch {
        return [];
    }
}

function saveDevErrorEntries(entries: DevErrorEntry[]): void {
    try {
        localStorage.setItem(DEV_ERROR_LOG_KEY, JSON.stringify(entries.slice(-DEV_ERROR_LOG_MAX)));
    } catch {
        // Ignore localStorage quota/privacy failures in dev telemetry.
    }
}

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    useEffect(() => {
        const handleAuthChanged = () => {
            // Prevent cross-account stale data (e.g., previous user's profile/device cache).
            queryClient.clear();
        };

        window.addEventListener('pcinsight-auth-changed', handleAuthChanged as EventListener);
        return () => {
            window.removeEventListener('pcinsight-auth-changed', handleAuthChanged as EventListener);
        };
    }, [queryClient]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;

        const pushEntry = (entry: Omit<DevErrorEntry, 'id' | 'ts' | 'page' | 'userAgent'>) => {
            const current = loadDevErrorEntries();
            const next: DevErrorEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ts: new Date().toISOString(),
                page: window.location.href,
                userAgent: navigator.userAgent,
                ...entry,
            };
            current.push(next);
            saveDevErrorEntries(current);
        };

        const onWindowError = (event: Event) => {
            const target = event.target;
            if (target instanceof HTMLScriptElement && target.src) {
                pushEntry({
                    kind: 'resource-error',
                    message: 'Script load failed',
                    sourceUrl: target.src,
                });
                return;
            }
            if (event instanceof ErrorEvent) {
                const sourceUrl = event.filename
                    ? `${event.filename}:${event.lineno}:${event.colno}`
                    : undefined;
                pushEntry({
                    kind: 'error',
                    message: event.message || 'Unknown runtime error',
                    sourceUrl,
                    stack: event.error instanceof Error ? event.error.stack : undefined,
                });
            }
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            pushEntry({
                kind: 'unhandledrejection',
                message: stringifyUnknown(reason),
                stack: reason instanceof Error ? reason.stack : undefined,
            });
        };

        window.__pcInsightDebugDumpErrors = () => {
            const entries = loadDevErrorEntries();
            console.table(
                entries.map((entry) => ({
                    ts: entry.ts,
                    kind: entry.kind,
                    message: entry.message,
                    sourceUrl: entry.sourceUrl || '',
                    page: entry.page,
                }))
            );
            return entries;
        };

        window.__pcInsightDebugClearErrors = () => {
            localStorage.removeItem(DEV_ERROR_LOG_KEY);
            console.info('[pc-insight] dev error log cleared');
        };

        window.addEventListener('error', onWindowError, true);
        window.addEventListener('unhandledrejection', onUnhandledRejection);
        return () => {
            window.removeEventListener('error', onWindowError, true);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            delete window.__pcInsightDebugDumpErrors;
            delete window.__pcInsightDebugClearErrors;
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
