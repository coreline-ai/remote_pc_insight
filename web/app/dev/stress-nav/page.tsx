'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DEFAULT_ROUTE_TEXT = '/\n/login\n/signup\n/devices';
const MAX_EVENT_LOGS = 300;
const DEV_ERROR_LOG_KEY = 'pcinsight:dev-error-log';

type DevErrorEntry = {
    ts?: string;
    kind?: string;
    message?: string;
    sourceUrl?: string;
};

type RunSummary = {
    startedAt: string;
    finishedAt: string;
    totalErrors: number;
    chunkLoadErrors: number;
    resourceChunkErrors: number;
};

type StressLog = {
    ts: string;
    step: number;
    route: string;
    note: string;
};

function parseRoutes(input: string): string[] {
    const items = input
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item.startsWith('/') ? item : `/${item}`));
    return Array.from(new Set(items));
}

export default function DevStressNavPage() {
    const router = useRouter();
    const timerRef = useRef<number | null>(null);
    const stepRef = useRef(0);
    const runStartedAtRef = useRef<string | null>(null);
    const [routesText, setRoutesText] = useState(DEFAULT_ROUTE_TEXT);
    const [iterations, setIterations] = useState(200);
    const [intervalMs, setIntervalMs] = useState(120);
    const [isRunning, setIsRunning] = useState(false);
    const [eventLogs, setEventLogs] = useState<StressLog[]>([]);
    const [lastSummary, setLastSummary] = useState<RunSummary | null>(null);

    const routes = useMemo(() => parseRoutes(routesText), [routesText]);

    const appendLog = (log: StressLog) => {
        setEventLogs((prev) => [...prev, log].slice(-MAX_EVENT_LOGS));
    };

    const loadDevErrors = (): DevErrorEntry[] => {
        try {
            const raw = localStorage.getItem(DEV_ERROR_LOG_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as DevErrorEntry[]) : [];
        } catch {
            return [];
        }
    };

    const isChunkError = (entry: DevErrorEntry): boolean => {
        const message = (entry.message || '').toLowerCase();
        const sourceUrl = (entry.sourceUrl || '').toLowerCase();
        return (
            message.includes('chunkloaderror')
            || (message.includes('loading chunk') && message.includes('failed'))
            || (sourceUrl.includes('/_next/static/chunks/') && sourceUrl.endsWith('.js'))
        );
    };

    const isResourceChunkError = (entry: DevErrorEntry): boolean => {
        const sourceUrl = (entry.sourceUrl || '').toLowerCase();
        const kind = (entry.kind || '').toLowerCase();
        return kind === 'resource-error' && sourceUrl.includes('/_next/static/chunks/');
    };

    const buildRunSummary = (finishedAt: string) => {
        const startedAt = runStartedAtRef.current;
        if (!startedAt) return;
        const startedAtMs = Date.parse(startedAt);
        const finishedAtMs = Date.parse(finishedAt);
        if (Number.isNaN(startedAtMs) || Number.isNaN(finishedAtMs)) return;

        const errorsInRun = loadDevErrors().filter((entry) => {
            const tsMs = Date.parse(entry.ts || '');
            if (Number.isNaN(tsMs)) return false;
            return tsMs >= startedAtMs && tsMs <= finishedAtMs;
        });
        const chunkLoadErrors = errorsInRun.filter(isChunkError).length;
        const resourceChunkErrors = errorsInRun.filter(isResourceChunkError).length;

        setLastSummary({
            startedAt,
            finishedAt,
            totalErrors: errorsInRun.length,
            chunkLoadErrors,
            resourceChunkErrors,
        });
    };

    const stopRun = (reason = '중지') => {
        const finishedAt = new Date().toISOString();
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (isRunning) {
            appendLog({
                ts: new Date().toISOString(),
                step: stepRef.current,
                route: '-',
                note: reason,
            });
            buildRunSummary(finishedAt);
        }
        setIsRunning(false);
    };

    const runStep = () => {
        if (!isRunning) return;
        if (stepRef.current >= iterations) {
            stopRun('완료');
            return;
        }
        const route = routes[stepRef.current % routes.length];
        const nextStep = stepRef.current + 1;
        appendLog({
            ts: new Date().toISOString(),
            step: nextStep,
            route,
            note: 'navigate',
        });
        router.push(route);
        stepRef.current = nextStep;
        timerRef.current = window.setTimeout(runStep, intervalMs);
    };

    const startRun = () => {
        if (process.env.NODE_ENV !== 'development') return;
        if (routes.length === 0) {
            appendLog({
                ts: new Date().toISOString(),
                step: 0,
                route: '-',
                note: '라우트가 비어 있습니다.',
            });
            return;
        }
        if (intervalMs < 40) {
            appendLog({
                ts: new Date().toISOString(),
                step: 0,
                route: '-',
                note: '간격이 너무 짧습니다. (권장 80ms 이상)',
            });
            return;
        }
        stepRef.current = 0;
        runStartedAtRef.current = new Date().toISOString();
        setEventLogs([]);
        setLastSummary(null);
        setIsRunning(true);
    };

    useEffect(() => {
        if (!isRunning) return;
        timerRef.current = window.setTimeout(runStep, intervalMs);
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
        // Intentional: runStep reads latest state from refs/state setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning]);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    if (process.env.NODE_ENV !== 'development') {
        return (
            <main className="min-h-screen p-8">
                <div className="max-w-2xl mx-auto card p-6">
                    <h1 className="text-xl font-bold mb-2">Dev Only</h1>
                    <p className="text-slate-500">이 페이지는 development 환경에서만 사용합니다.</p>
                    <Link href="/" className="btn btn-secondary mt-4 inline-block">
                        홈으로
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-6">
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="card p-6">
                    <h1 className="text-2xl font-bold mb-2">Navigation Stress (Dev)</h1>
                    <p className="text-sm text-slate-400 mb-4">
                        페이지 왕복을 자동 실행해 ChunkLoadError/HMR 흔들림을 재현하는 도구입니다.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3 mb-3">
                        <label className="text-sm">
                            반복 횟수
                            <input
                                type="number"
                                min={1}
                                value={iterations}
                                onChange={(e) => setIterations(Math.max(1, Number(e.target.value) || 1))}
                                className="w-full mt-1"
                            />
                        </label>
                        <label className="text-sm">
                            간격(ms)
                            <input
                                type="number"
                                min={40}
                                value={intervalMs}
                                onChange={(e) => setIntervalMs(Math.max(40, Number(e.target.value) || 40))}
                                className="w-full mt-1"
                            />
                        </label>
                        <div className="text-sm">
                            실행 상태
                            <div className="mt-2">
                                <span className={`badge ${isRunning ? 'badge-warning' : 'badge-success'}`}>
                                    {isRunning ? 'running' : 'idle'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <label className="text-sm block">
                        왕복 라우트(줄바꿈 또는 콤마 구분)
                        <textarea
                            value={routesText}
                            onChange={(e) => setRoutesText(e.target.value)}
                            rows={6}
                            className="w-full mt-1 rounded border border-slate-600 bg-slate-900 text-slate-100 p-2 font-mono text-xs"
                        />
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary" onClick={startRun} disabled={isRunning}>
                            시작
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => stopRun('사용자 중지')} disabled={!isRunning}>
                            중지
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => window.__pcInsightDebugDumpErrors?.()}
                        >
                            에러 로그 덤프
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => window.__pcInsightDebugClearErrors?.()}
                        >
                            에러 로그 초기화
                        </button>
                        <Link href="/" className="btn btn-neutral">
                            홈으로
                        </Link>
                    </div>
                </div>

                <div className="card p-4">
                    <h2 className="font-semibold mb-2">최근 실행 요약</h2>
                    {lastSummary ? (
                        <div className="grid gap-2 sm:grid-cols-2 text-sm mb-4">
                            <div className="rounded border border-slate-700 p-3">
                                <div className="text-slate-400">실행 시간</div>
                                <div>{lastSummary.startedAt} ~ {lastSummary.finishedAt}</div>
                            </div>
                            <div className="rounded border border-slate-700 p-3">
                                <div className="text-slate-400">전체 에러</div>
                                <div className="font-semibold">{lastSummary.totalErrors}</div>
                            </div>
                            <div className="rounded border border-slate-700 p-3">
                                <div className="text-slate-400">ChunkLoadError 추정</div>
                                <div className="font-semibold text-amber-400">{lastSummary.chunkLoadErrors}</div>
                            </div>
                            <div className="rounded border border-slate-700 p-3">
                                <div className="text-slate-400">청크 리소스 로드 실패</div>
                                <div className="font-semibold text-amber-400">{lastSummary.resourceChunkErrors}</div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 mb-4">아직 완료된 실행 요약이 없습니다.</p>
                    )}

                    <h2 className="font-semibold mb-2">실행 로그 (최근 {MAX_EVENT_LOGS}개)</h2>
                    <div className="max-h-80 overflow-auto rounded border border-slate-700">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 text-slate-300 sticky top-0">
                                <tr>
                                    <th className="text-left p-2">시간</th>
                                    <th className="text-left p-2">step</th>
                                    <th className="text-left p-2">route</th>
                                    <th className="text-left p-2">note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventLogs.length === 0 ? (
                                    <tr>
                                        <td className="p-2 text-slate-500" colSpan={4}>기록 없음</td>
                                    </tr>
                                ) : (
                                    eventLogs.map((log) => (
                                        <tr key={`${log.ts}-${log.step}-${log.note}`} className="border-t border-slate-800">
                                            <td className="p-2">{log.ts}</td>
                                            <td className="p-2">{log.step}</td>
                                            <td className="p-2">{log.route}</td>
                                            <td className="p-2">{log.note}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
