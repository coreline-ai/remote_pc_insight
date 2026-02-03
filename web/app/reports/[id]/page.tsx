'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawReportData = Record<string, any>;

export default function ReportDetailPage({ params }: { params: { id: string } }) {
    const { data: report, isLoading, error } = useQuery({
        queryKey: ['report', params.id],
        queryFn: () => api.getReport(params.id),
    });

    if (isLoading) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-4xl mx-auto animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
                    <div className="card p-6 h-96"></div>
                </div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen p-8">
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

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href={`/devices/${report.device_id}`} className="text-slate-500 hover:text-slate-700">
                        ← 디바이스로 돌아가기
                    </Link>
                </div>

                <h1 className="text-2xl font-bold mb-6">분석 리포트</h1>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="card p-6 text-center">
                        <div className={`text-4xl font-bold ${scoreColor}`}>
                            {report.health_score ?? '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">건강 점수</div>
                    </div>
                    <div className="card p-6 text-center">
                        <div className="text-4xl font-bold">
                            {report.disk_free_percent ? `${Math.round(report.disk_free_percent)}%` : '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">디스크 여유</div>
                    </div>
                    <div className="card p-6 text-center">
                        <div className="text-4xl font-bold">
                            {report.startup_apps_count ?? '-'}
                        </div>
                        <div className="text-sm text-slate-500 mt-2">시작 프로그램</div>
                    </div>
                    <div className="card p-6">
                        <div className="text-sm text-slate-500 mb-2">생성 시간</div>
                        <div className="font-medium">
                            {new Date(report.created_at).toLocaleString('ko-KR')}
                        </div>
                    </div>
                </div>

                {/* One-liner */}
                {report.one_liner && (
                    <div className="card mb-6">
                        <div className="card-body">
                            <h3 className="font-semibold mb-2">📋 요약</h3>
                            <p className="text-lg">{report.one_liner}</p>
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
                                    <h4 className="font-medium mb-3">💡 권장 사항</h4>
                                    <ul className="space-y-2">
                                        {rawData.recommendations.map((rec: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-primary-600">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Storage */}
                            {rawData.storage?.folders && Array.isArray(rawData.storage.folders) && (
                                <div className="mb-6">
                                    <h4 className="font-medium mb-3">💾 스토리지 분석</h4>
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
                                                {rawData.storage.folders.map((folder: { name: string; bytes: number; fileCount: number }, i: number) => (
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
                                    <h4 className="font-medium mb-3">🔒 프라이버시 정보</h4>
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

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
