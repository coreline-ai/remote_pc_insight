'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useEffect, useState } from 'react';

type StorageFolder = {
    name: string;
    bytes: number;
    fileCount: number;
};

type RawReportData = {
    recommendations?: string[];
    storage?: {
        folders?: StorageFolder[];
    };
    transparency?: {
        collected?: string[];
        notCollected?: string[];
    };
};

export default function ReportDetailPage() {
    const { isAuthenticated, isChecking } = useRequireAuth();
    const pathname = usePathname();
    const reportId = decodeURIComponent((pathname?.split('/').filter(Boolean).at(-1) ?? '').trim());
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const { data: report, isLoading, error } = useQuery({
        queryKey: ['report', reportId],
        queryFn: () => api.getReport(reportId),
        enabled: isAuthenticated && Boolean(reportId),
    });
    const exportReport = useMutation({
        mutationFn: (format: 'markdown' | 'text' | 'pdf') => api.exportReport(reportId, format),
        onSuccess: (data, format) => {
            if (format === 'pdf') {
                const bytes = base64ToUint8Array(data.content);
                const filename = data.filename || `pc-insight-report-${reportId}.pdf`;
                downloadBinaryFile(bytes, filename, 'application/pdf');
                alert('PDF 다운로드가 시작되었습니다.');
                return;
            }
            navigator.clipboard.writeText(data.content);
            alert('리포트 내용이 클립보드에 복사되었습니다.');
        },
    });
    const shareReport = useMutation({
        mutationFn: () => api.shareReport(reportId, 72),
        onSuccess: (data) => {
            const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
            setShareLink(`${base}${data.share_url}`);
            void refetchShares();
        },
    });
    const {
        data: shareItems,
        refetch: refetchShares,
    } = useQuery({
        queryKey: ['report-shares', reportId],
        queryFn: async () => (await api.getReportShares(reportId)).items,
        enabled: isAuthenticated && Boolean(reportId),
    });
    const revokeShare = useMutation({
        mutationFn: (shareRef: string) => api.revokeReportShare(shareRef),
        onSuccess: () => {
            void refetchShares();
        },
    });

    if (isChecking || isLoading) {
        return (
            <div className="min-h-screen p-6">
                <div className="max-w-4xl mx-auto animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
                    <div className="card p-6 h-96"></div>
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

    if (error || !report) {
        return (
            <div className="min-h-screen p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-6 text-red-600 dark:text-red-400">
                        리포트를 찾을 수 없습니다.
                    </div>
                </div>
            </div>
        );
    }

    const scoreColor =
        (report.health_score ?? 0) >= 80 ? 'text-green-600' :
            (report.health_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600';

    const rawData = report.raw_report_json as RawReportData | null;
    const localizedOneLiner = localizeReportText(report.one_liner || '');

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href={`/devices/${report.device_id}`} className="text-slate-500 hover:text-slate-700">
                        ← 디바이스로 돌아가기
                    </Link>
                </div>

                <h1 className="text-2xl font-bold mb-6">분석 리포트</h1>
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        className="btn btn-secondary text-sm py-2"
                        onClick={() => exportReport.mutate('markdown')}
                        disabled={exportReport.isPending}
                    >
                        {exportReport.isPending ? '내보내는 중...' : 'Markdown 내보내기'}
                    </button>
                    <button
                        className="btn btn-secondary text-sm py-2"
                        onClick={() => exportReport.mutate('pdf')}
                        disabled={exportReport.isPending}
                    >
                        {exportReport.isPending ? '내보내는 중...' : 'PDF 다운로드'}
                    </button>
                    <button
                        className="btn btn-secondary text-sm py-2"
                        onClick={() => shareReport.mutate()}
                        disabled={shareReport.isPending}
                    >
                        {shareReport.isPending ? '생성 중...' : '공유 링크 생성'}
                    </button>
                </div>
                {shareLink && (
                    <div className="card mb-6">
                        <div className="card-body">
                            <p className="text-sm text-slate-300 mb-2">공유 링크</p>
                            <div className="font-mono text-xs break-all">{shareLink}</div>
                        </div>
                    </div>
                )}
                {shareItems && shareItems.length > 0 && (
                    <div className="card mb-6">
                        <div className="card-header">
                            <h3 className="font-semibold">공유 링크 관리</h3>
                        </div>
                        <div className="card-body space-y-2">
                            {shareItems.map((item) => (
                                <div key={item.share_id} className="rounded-lg border border-slate-700 px-3 py-2">
                                    <div className="font-mono text-xs break-all mb-2">
                                        {item.share_url ? `${origin}${item.share_url}` : '생성 직후에만 원본 공유 링크를 표시합니다.'}
                                    </div>
                                    <div className="text-xs text-slate-400 mb-2">
                                        생성: {new Date(item.created_at).toLocaleString('ko-KR')} · 만료: {new Date(item.expires_at).toLocaleString('ko-KR')}
                                        {item.revoked_at ? ` · 폐기: ${new Date(item.revoked_at).toLocaleString('ko-KR')}` : ''}
                                    </div>
                                    {!item.revoked_at && (
                                        <button
                                            className="btn btn-danger text-xs py-1 px-2"
                                            onClick={() => revokeShare.mutate(item.share_id)}
                                            disabled={revokeShare.isPending}
                                        >
                                            링크 폐기
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    <div className="card p-6 text-center">
                        <div className={`text-4xl font-bold ${scoreColor}`}>
                            {report.health_score ?? '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">건강 점수</div>
                    </div>
                    <div className="card p-6 text-center">
                        <div className="text-4xl font-bold">
                            {report.disk_free_percent != null ? `${Math.round(report.disk_free_percent)}%` : '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">디스크 여유</div>
                    </div>
                    <div className="card p-6 text-center">
                        <div className="text-4xl font-bold">
                            {report.startup_apps_count ?? '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">시작 프로그램</div>
                    </div>
                    <div className="card p-6 text-center">
                        <div className="text-sm text-slate-500 mb-2">생성 시간</div>
                        <div className="font-medium">
                            {new Date(report.created_at).toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>

                {/* One-liner */}
                {localizedOneLiner && (
                    <div className="card mb-6">
                        <div className="card-body">
                            <h3 className="text-xl font-bold mb-2">📋 요약</h3>
                            <p className="text-lg">{localizedOneLiner}</p>
                        </div>
                    </div>
                )}

                {/* Raw Report */}
                {rawData && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="font-semibold">📊 상세 데이터</h3>
                        </div>
                        <div className="card-body">
                            {/* Recommendations */}
                            {rawData.recommendations && Array.isArray(rawData.recommendations) && (
                                <div className="mb-6">
                                    <h4 className="text-lg font-semibold mb-3">💡 권장 사항</h4>
                                    <ul className="space-y-2">
                                        {rawData.recommendations.map((rec: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-primary-600">•</span>
                                                <span>{localizeReportText(rec)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Storage */}
                            {rawData.storage?.folders && Array.isArray(rawData.storage.folders) && (
                                <div className="mb-6">
                                    <h4 className="text-lg font-semibold mb-3">💾 스토리지 분석</h4>
                                    <p className="text-xs text-slate-400 mb-3">
                                        폴더 크기/파일 수는 저장 공간 진단을 위한 통계값이며 파일 내용이나 파일명은 수집하지 않습니다.
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b dark:border-slate-700">
                                                    <th className="text-left py-2">폴더</th>
                                                    <th className="text-right py-2">크기</th>
                                                    <th className="text-right py-2">파일 수</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rawData.storage.folders.map((folder: StorageFolder, i: number) => (
                                                    <tr key={i} className="border-b dark:border-slate-700">
                                                        <td className="py-2">{folder.name}</td>
                                                        <td className="text-right py-2">{formatBytes(folder.bytes)}</td>
                                                        <td className="text-right py-2">{folder.fileCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Transparency */}
                            {rawData.transparency && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold mb-3">🔒 프라이버시 정보</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="font-medium mb-2 text-green-600">✓ 수집된 정보</div>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                                                {Array.isArray(rawData.transparency.collected) && rawData.transparency.collected.map((item: string, i: number) => (
                                                    <li key={i}>• {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <div className="font-medium mb-2 text-slate-600">✗ 수집하지 않은 정보</div>
                                            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                                                {Array.isArray(rawData.transparency.notCollected) && rawData.transparency.notCollected.map((item: string, i: number) => (
                                                    <li key={i}>• {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function localizeReportText(text: string): string {
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
        if (matched) {
            return formatter(matched);
        }
    }

    return normalized;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function base64ToUint8Array(base64: string): Uint8Array {
    const normalized = base64.replace(/\s/g, '');
    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function downloadBinaryFile(data: Uint8Array, filename: string, mimeType: string): void {
    const binary = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const blob = new Blob([binary], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
