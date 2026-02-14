'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AiProvider, api, Command, DeviceAiSummary, DeviceTrendResponse, ReportSummary } from '@/lib/api';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useAbVariant } from '@/hooks/use-ab-variant';
import { useEffect, useState } from 'react';
import {
    AI_PROVIDER_CHANGED_EVENT,
    getEnvDefaultAiProvider,
    loadAiProviderPreference,
} from '@/lib/ai-provider';

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
    const { isAuthenticated, isChecking } = useRequireAuth();
    const queryClient = useQueryClient();
    const aiCopilotEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT === 'true';
    const defaultProvider: AiProvider = getEnvDefaultAiProvider();
    const [audience, setAudience] = useState<'operator' | 'manager'>('operator');
    const [provider, setProvider] = useState<AiProvider>(defaultProvider);
    const [commandError, setCommandError] = useState('');
    const aiCardVariant = useAbVariant('ai-card-layout', ['A', 'B']) as 'A' | 'B';

    useEffect(() => {
        setProvider(loadAiProviderPreference());

        const onProviderChanged = (event: Event) => {
            const next = (event as CustomEvent<{ provider?: AiProvider }>).detail?.provider;
            if (next === 'glm45' || next === 'openai') setProvider(next);
        };

        window.addEventListener(AI_PROVIDER_CHANGED_EVENT, onProviderChanged);
        return () => {
            window.removeEventListener(AI_PROVIDER_CHANGED_EVENT, onProviderChanged);
        };
    }, []);

    const { data: device, isLoading, error } = useQuery({
        queryKey: ['device', params.id],
        queryFn: () => api.getDevice(params.id),
        enabled: isAuthenticated,
        refetchInterval: 5000, // Poll for updates
    });

    const {
        data: aiSummary,
        isLoading: isAiSummaryLoading,
        isError: isAiSummaryError,
    } = useQuery({
        queryKey: ['device-ai-summary', params.id, audience, provider],
        queryFn: async () => {
            try {
                return await api.getDeviceAiSummary(params.id, audience, provider);
            } catch (error) {
                console.error('Failed to load AI summary:', error);
                return null;
            }
        },
        enabled: isAuthenticated && aiCopilotEnabled,
        retry: false,
        refetchInterval: 30000,
    });
    const { data: aiTrends } = useQuery({
        queryKey: ['device-ai-trends', params.id],
        queryFn: () => api.getDeviceAiTrends(params.id),
        enabled: isAuthenticated && aiCopilotEnabled,
        refetchInterval: 60000,
    });

    const createCommand = useMutation({
        mutationFn: (type: string) => api.createCommand(params.id, type),
        onSuccess: () => {
            setCommandError('');
            queryClient.invalidateQueries({ queryKey: ['device', params.id] });
        },
    });

    const revokeDevice = useMutation({
        mutationFn: () => api.revokeDevice(params.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device', params.id] });
        },
    });

    const handleRunCommand = (commandType: string) => {
        setCommandError('');
        createCommand.mutate(commandType, {
            onError: (error) => {
                const message = error instanceof Error ? error.message : '명령 실행에 실패했습니다.';
                setCommandError(message);
            },
        });
    };

    if (isChecking || isLoading) {
        return (
            <div className="min-h-screen p-6">
                <div className="max-w-4xl mx-auto animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
                    <div className="card p-6 h-48 mb-6"></div>
                    <div className="card p-6 h-64"></div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-6 text-center text-slate-400">
                        로그인 페이지로 이동 중입니다...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !device) {
        return (
            <div className="min-h-screen p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-6 text-red-600 dark:text-red-400">
                        디바이스를 찾을 수 없습니다.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/devices" className="text-slate-400 hover:text-slate-200 transition-colors">
                        ← 돌아가기
                    </Link>
                </div>

                <AiSummaryCard
                    summary={aiSummary}
                    isLoading={isAiSummaryLoading}
                    isError={isAiSummaryError}
                    isFeatureEnabled={aiCopilotEnabled}
                    audience={audience}
                    onAudienceChange={setAudience}
                    provider={provider}
                    variant={aiCardVariant}
                    onRunAction={handleRunCommand}
                    isActionDisabled={createCommand.isPending || device.is_revoked || !device.is_online}
                />
                {aiCopilotEnabled && aiTrends && <AiTrendCard trends={aiTrends} />}

                {/* Device Info */}
                <div className="card mb-6">
                    <div className="card-header flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-3xl">
                                {device.platform === 'darwin' ? '🍎' :
                                    device.platform === 'win32' ? '🪟' : '🐧'}
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold truncate">{device.name}</h1>
                                <p className="text-slate-400 break-all">
                                    {device.platform} / {device.arch}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            {device.is_online ? (
                                <span className="badge badge-success">온라인</span>
                            ) : (
                                <span className="badge badge-neutral">오프라인</span>
                            )}
                        </div>
                    </div>

                    <div className="card-body">
                        {/* Latest Report */}
                        {device.latest_report && (
                            <div className="mb-6">
                                <h3 className="text-lg font-bold mb-3">최근 분석 결과</h3>
                                <ReportCard report={device.latest_report} />
                            </div>
                        )}

                        {/* Command Buttons */}
                        {commandError && (
                            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
                                {commandError}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={() => handleRunCommand('RUN_FULL')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                {createCommand.isPending ? '실행 중...' : '🔍 전체 점검'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleRunCommand('RUN_STORAGE_ONLY')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                💾 스토리지 점검
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleRunCommand('PING')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                📡 핑
                            </button>

                            {!device.is_revoked && (
                                <button
                                    className="btn btn-danger w-full sm:w-auto sm:ml-auto"
                                    onClick={() => {
                                        if (confirm('정말 이 디바이스 연결을 해제하시겠습니까?')) {
                                            revokeDevice.mutate();
                                        }
                                    }}
                                    disabled={revokeDevice.isPending}
                                >
                                    연결 해제
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Command History */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="font-semibold">명령 히스토리</h2>
                    </div>
                    <div className="card-body p-0">
                        {device.recent_commands.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">
                                아직 실행된 명령이 없습니다.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {device.recent_commands.map((command) => (
                                    <CommandRow key={command.id} command={command} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReportCard({ report }: { report: ReportSummary }) {
    const scoreColor =
        (report.health_score ?? 0) >= 80 ? 'text-green-600' :
            (report.health_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className={`text-3xl font-bold ${scoreColor}`}>
                    {report.health_score ?? '-'}
                </div>
                <div className="text-sm text-slate-500">건강 점수</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">
                    {report.disk_free_percent != null ? `${Math.round(report.disk_free_percent)}%` : '-'}
                </div>
                <div className="text-sm text-slate-500">디스크 여유</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">
                    {report.startup_apps_count ?? '-'}
                </div>
                <div className="text-sm text-slate-500">시작 프로그램</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-sm font-medium mb-1">요약</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                    {report.one_liner ? localizeText(report.one_liner) : '정보 없음'}
                </div>
                {report.id && (
                    <Link
                        href={`/reports/${report.id}`}
                        className="text-sm text-primary-600 hover:underline mt-2 inline-block"
                    >
                        상세 보기 →
                    </Link>
                )}
            </div>
        </div>
    );
}

function AiSummaryCard({
    summary,
    isLoading,
    isError,
    isFeatureEnabled,
    audience,
    onAudienceChange,
    provider,
    variant,
    onRunAction,
    isActionDisabled,
}: {
    summary: DeviceAiSummary | null | undefined;
    isLoading: boolean;
    isError: boolean;
    isFeatureEnabled: boolean;
    audience: 'operator' | 'manager';
    onAudienceChange: (next: 'operator' | 'manager') => void;
    provider: AiProvider;
    variant: 'A' | 'B';
    onRunAction: (commandType: string) => void;
    isActionDisabled: boolean;
}) {
    const riskBadgeClass = {
        high: 'badge-error',
        medium: 'badge-warning',
        low: 'badge-success',
        unknown: 'badge-neutral',
    }[summary?.risk_level || 'unknown'];

    return (
        <div className={`card mb-6 ${variant === 'B' ? 'border-yellow-400/50' : ''}`}>
            <div className="card-header flex items-center justify-between gap-3">
                <h2 className="font-semibold">AI 운영 코파일럿</h2>
                <div className="flex items-center gap-2">
                    <select
                        value={audience}
                        onChange={(e) => onAudienceChange(e.target.value as 'operator' | 'manager')}
                        className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-300"
                    >
                        <option value="operator">운영자 뷰</option>
                        <option value="manager">관리자 뷰</option>
                    </select>
                    <span className="text-xs text-slate-400">
                        엔진: {formatProviderLabel(provider)} (전역)
                    </span>
                    <Link href="/devices" className="text-xs text-primary-400 hover:underline">
                        변경
                    </Link>
                    {summary && <span className={`badge ${riskBadgeClass}`}>{summary.risk_level.toUpperCase()}</span>}
                </div>
            </div>
            <div className="card-body">
                {isLoading && (
                    <div className="animate-pulse">
                        <div className="h-4 w-2/3 bg-slate-700 rounded mb-3"></div>
                        <div className="h-3 w-1/2 bg-slate-700 rounded"></div>
                    </div>
                )}
                {!isLoading && !isFeatureEnabled && (
                    <p className="text-sm text-slate-400">
                        AI 코파일럿이 비활성화되어 있습니다. `NEXT_PUBLIC_ENABLE_AI_COPILOT=true`로 활성화하세요.
                    </p>
                )}
                {!isLoading && isFeatureEnabled && (isError || !summary) && (
                    <>
                        <p className="text-sm text-slate-300 mb-4">
                            AI 요약을 불러오지 못했습니다. 기본 액션으로 점검을 시작하세요.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="btn btn-secondary text-sm py-2"
                                onClick={() => onRunAction('RUN_FULL')}
                                disabled={isActionDisabled}
                            >
                                전체 점검 실행
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary text-sm py-2"
                                onClick={() => onRunAction('PING')}
                                disabled={isActionDisabled}
                            >
                                연결 확인(PING)
                            </button>
                        </div>
                    </>
                )}
                {!isLoading && summary && (
                    <>
                        <p className="text-base mb-4">{localizeText(summary.summary)}</p>
                        {summary.reasons.length > 0 && (
                            <ul className="space-y-1 text-sm text-slate-400 mb-4">
                                {summary.reasons.map((reason, idx) => (
                                    <li key={idx}>• {localizeText(reason)}</li>
                                ))}
                            </ul>
                        )}
                        {summary.recommended_actions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {summary.recommended_actions.map((action) => (
                                    <button
                                        key={`${action.command_type}-${action.label}`}
                                        type="button"
                                        className="btn btn-secondary text-sm py-2"
                                        onClick={() => onRunAction(action.command_type)}
                                        disabled={isActionDisabled}
                                        title={localizeText(action.reason)}
                                    >
                                        {localizeActionLabel(action.command_type, action.label)}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400">권장 액션이 없습니다. 필요 시 수동으로 점검을 실행하세요.</div>
                        )}
                        <div className="text-xs text-slate-500 mt-3">
                            모델: {formatProviderLabel(provider)} · 출처: {summary.source} · 생성 시각: {new Date(summary.generated_at).toLocaleString('ko-KR')}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function AiTrendCard({ trends }: { trends: DeviceTrendResponse }) {
    return (
        <div className="card mb-6">
            <div className="card-header">
                <h2 className="font-semibold">최근 7일 추세</h2>
            </div>
            <div className="card-body">
                <p className="text-sm text-slate-300 mb-3">{trends.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trends.signals.map((signal) => (
                        <div key={signal.metric} className="rounded-lg border border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-sm">{localizeTrendMetric(signal.metric)}</div>
                                <span
                                    className={`badge ${signal.status === 'degraded'
                                            ? 'badge-error'
                                            : signal.status === 'improved'
                                                ? 'badge-success'
                                                : 'badge-neutral'
                                        }`}
                                >
                                    {localizeTrendStatus(signal.status)}
                                </span>
                            </div>
                            <div className="text-xs text-slate-400">
                                현재 {signal.current ?? '-'} / 기준 {signal.baseline ?? '-'} / 변화 {signal.delta ?? '-'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{signal.note}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CommandRow({ command }: { command: Command }) {
    const statusConfig = {
        queued: { badge: 'badge-neutral', label: '대기 중' },
        running: { badge: 'badge-info', label: '실행 중' },
        succeeded: { badge: 'badge-success', label: '완료' },
        failed: { badge: 'badge-error', label: '실패' },
        expired: { badge: 'badge-warning', label: '만료' },
    }[command.status] || { badge: 'badge-neutral', label: localizeTrendStatus(command.status) };

    return (
        <div className="px-6 py-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1 min-w-0">
                <div className="font-medium">{localizeCommandType(command.type)}</div>
                <div className="text-sm text-slate-500">
                    {new Date(command.created_at).toLocaleString('ko-KR')}
                </div>
            </div>

            {command.status === 'running' && (
                <div className="w-32">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${command.progress}%` }}
                        />
                    </div>
                    <div className="text-xs text-center mt-1">{command.progress}%</div>
                </div>
            )}

            <span className={`badge ${statusConfig.badge}`}>
                {statusConfig.label}
            </span>

            {command.report_id && (
                <Link href={`/reports/${command.report_id}`} className="btn btn-secondary text-sm py-1">
                    리포트 보기
                </Link>
            )}
        </div>
    );
}

function localizeActionLabel(commandType: string, originalLabel: string): string {
    const trimmed = (originalLabel || '').trim();
    if (trimmed) {
        const localized = localizeText(trimmed);
        if (localized !== trimmed) return localized;
    }
    const fallbackByCommand: Record<string, string> = {
        RUN_FULL: '전체 점검 실행',
        RUN_STORAGE_ONLY: '스토리지 점검 실행',
        PING: '연결 확인(PING)',
    };
    return fallbackByCommand[commandType] || (trimmed || commandType);
}

function formatProviderLabel(provider: AiProvider): string {
    return provider === 'glm45' ? 'GLM4.5' : 'OPENAI';
}

function localizeCommandType(commandType: string): string {
    const map: Record<string, string> = {
        RUN_FULL: '전체 점검',
        RUN_STORAGE_ONLY: '스토리지 점검',
        PING: '핑',
    };
    return map[commandType] || commandType;
}

function localizeTrendMetric(metric: string): string {
    const map: Record<string, string> = {
        ping_latency_ms: '핑 지연 시간',
        disk_free_percent: '디스크 여유 비율',
        startup_apps_count: '시작 프로그램 수',
    };
    return map[metric] || metric;
}

function localizeTrendStatus(status: string): string {
    const map: Record<string, string> = {
        stable: '안정',
        improved: '개선',
        degraded: '악화',
        unknown: '알 수 없음',
        queued: '대기 중',
        running: '실행 중',
        succeeded: '완료',
        failed: '실패',
        expired: '만료',
    };
    return map[status] || status;
}

function localizeText(text: string): string {
    const normalized = text.trim();
    if (!normalized) return '';

    const exactMap: Record<string, string> = {
        'Ping check completed.': '핑 점검이 완료되었습니다.',
        'Connection is healthy.': '연결 상태가 정상입니다.',
        'PC is in excellent condition! 🎉': 'PC 상태가 매우 좋습니다! 🎉',
        'PC is doing well with minor cleanup opportunities.': 'PC 상태는 양호하며 가벼운 정리가 권장됩니다.',
        'Disk space is running low. Consider cleaning up.': '디스크 여유 공간이 부족합니다. 정리가 필요합니다.',
        'High CPU usage detected. Check running apps.': 'CPU 사용률이 높습니다. 실행 중인 앱을 점검하세요.',
        'Some optimization recommended for better performance.': '성능 향상을 위해 일부 최적화가 권장됩니다.',
        'PC needs attention. Multiple issues detected.': 'PC 점검이 필요합니다. 여러 이슈가 감지되었습니다.',
        'Free up disk space by removing unused files': '사용하지 않는 파일을 정리해 디스크 여유 공간을 확보하세요.',
        'Reduce startup apps for faster boot time': '시작 프로그램을 줄여 부팅 속도를 개선하세요.',
        'Your PC is well maintained! Keep it up.': 'PC가 잘 관리되고 있습니다. 현재 상태를 유지하세요.',
    };
    if (exactMap[normalized]) {
        return exactMap[normalized];
    }

    const dynamicRules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
        [/^Clean up Downloads folder \(([\d.]+) GB\)$/i, (m) => `다운로드 폴더를 정리하세요 (${m[1]} GB)`],
        [/^Close (\d+) resource-heavy processes$/i, (m) => `리소스 사용량이 높은 프로세스 ${m[1]}개를 종료하세요.`],
        [/^Clear browser cache \(([\d.]+) GB\)$/i, (m) => `브라우저 캐시를 정리하세요 (${m[1]} GB)`],
        [/^Clear system logs \(([\d.]+) MB\)$/i, (m) => `시스템 로그를 정리하세요 (${m[1]} MB)`],
    ];
    for (const [pattern, formatter] of dynamicRules) {
        const matched = normalized.match(pattern);
        if (matched) return formatter(matched);
    }

    return normalized;
}
