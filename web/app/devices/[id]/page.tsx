'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Command, ReportSummary } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
    const queryClient = useQueryClient();
    const [isCreatingCommand, setIsCreatingCommand] = useState(false);

    const { data: device, isLoading, error } = useQuery({
        queryKey: ['device', params.id],
        queryFn: () => api.getDevice(params.id),
        refetchInterval: 5000, // Poll for updates
    });

    const createCommand = useMutation({
        mutationFn: (type: string) => api.createCommand(params.id, type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device', params.id] });
            setIsCreatingCommand(false);
        },
    });

    const revokeDevice = useMutation({
        mutationFn: () => api.revokeDevice(params.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device', params.id] });
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-4xl mx-auto animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
                    <div className="card p-6 h-48 mb-6"></div>
                    <div className="card p-6 h-64"></div>
                </div>
            </div>
        );
    }

    if (error || !device) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-6 text-red-600 dark:text-red-400">
                        디바이스를 찾을 수 없습니다.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/devices" className="text-slate-500 hover:text-slate-700">
                        ← 돌아가기
                    </Link>
                </div>

                {/* Device Info */}
                <div className="card mb-6">
                    <div className="card-header flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">
                                {device.platform === 'darwin' ? '🍎' :
                                    device.platform === 'win32' ? '🪟' : '🐧'}
                            </span>
                            <div>
                                <h1 className="text-2xl font-bold">{device.name}</h1>
                                <p className="text-slate-600 dark:text-slate-400">
                                    {device.platform} / {device.arch}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                                <h3 className="font-semibold mb-3">최근 분석 결과</h3>
                                <ReportCard report={device.latest_report} />
                            </div>
                        )}

                        {/* Command Buttons */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={() => createCommand.mutate('RUN_FULL')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                {createCommand.isPending ? '실행 중...' : '🔍 전체 점검'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => createCommand.mutate('RUN_STORAGE_ONLY')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                💾 스토리지 점검
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => createCommand.mutate('PING')}
                                disabled={createCommand.isPending || device.is_revoked || !device.is_online}
                            >
                                📡 핑
                            </button>

                            {!device.is_revoked && (
                                <button
                                    className="btn btn-danger ml-auto"
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
        <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className={`text-3xl font-bold ${scoreColor}`}>
                    {report.health_score ?? '-'}
                </div>
                <div className="text-sm text-slate-500">건강 점수</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">
                    {report.disk_free_percent ? `${Math.round(report.disk_free_percent)}%` : '-'}
                </div>
                <div className="text-sm text-slate-500">디스크 여유</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold">
                    {report.startup_apps_count ?? '-'}
                </div>
                <div className="text-sm text-slate-500">시작 프로그램</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm font-medium mb-1">요약</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                    {report.one_liner || '정보 없음'}
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

function CommandRow({ command }: { command: Command }) {
    const statusConfig = {
        queued: { badge: 'badge-neutral', label: '대기 중' },
        running: { badge: 'badge-info', label: '실행 중' },
        succeeded: { badge: 'badge-success', label: '완료' },
        failed: { badge: 'badge-error', label: '실패' },
        expired: { badge: 'badge-warning', label: '만료' },
    }[command.status] || { badge: 'badge-neutral', label: command.status };

    return (
        <div className="px-6 py-4 flex items-center gap-4">
            <div className="flex-1">
                <div className="font-medium">{command.type}</div>
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
                <Link
                    href={`/reports/${command.report_id}`}
                    className="btn btn-secondary text-sm py-1"
                >
                    리포트 보기
                </Link>
            )}
        </div>
    );
}
