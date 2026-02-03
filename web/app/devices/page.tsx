'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Device } from '@/lib/api';
import Link from 'next/link';

export default function DevicesPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['devices'],
        queryFn: () => api.getDevices(),
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [enrollToken, setEnrollToken] = useState<string | null>(null);

    const handleOpenModal = async () => {
        setIsModalOpen(true);
        try {
            const result = await api.createEnrollToken();
            setEnrollToken(result.token);
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-8"></div>
                        <div className="grid gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="card p-6 h-24"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="card p-6 text-red-600 dark:text-red-400">
                        오류: {error.message}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">내 디바이스</h1>
                    <button className="btn btn-primary" onClick={handleOpenModal}>
                        + 새 PC 연결
                    </button>
                </div>

                {data?.devices.length === 0 ? (
                    <div className="card p-12 text-center">
                        <div className="text-5xl mb-4">🖥️</div>
                        <h2 className="text-xl font-semibold mb-2">등록된 디바이스가 없습니다</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            PC에 Agent를 설치하고 연결해보세요.
                        </p>
                        <button className="btn btn-primary" onClick={handleOpenModal}>
                            새 PC 연결하기
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {data?.devices.map((device) => (
                            <DeviceCard key={device.id} device={device} />
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">새 PC 연결</h2>

                        <div className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-300">
                                관리할 PC에서 아래 명령어를 실행하세요:
                            </p>

                            {enrollToken ? (
                                <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-sm break-all relative group">
                                    pc-insight link {enrollToken}
                                    <button
                                        className="absolute top-2 right-2 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => navigator.clipboard.writeText(`pc-insight link ${enrollToken}`)}
                                    >
                                        복사
                                    </button>
                                </div>
                            ) : (
                                <div className="animate-pulse bg-slate-200 h-12 rounded"></div>
                            )}

                            <div>
                                <h3 className="font-semibold mb-2">설치 방법</h3>
                                <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
                                    <li>
                                        <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">npm install -g pc-insight-agent</span>
                                        <br />
                                        <span className="text-xs text-slate-500 ml-5">먼저 CLI 도구를 설치해야 합니다.</span>
                                    </li>
                                    <li>터미널을 열고 위 <b>연결 명령어</b>를 실행하세요.</li>
                                </ol>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                className="btn btn-neutral"
                                onClick={() => setIsModalOpen(false)}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DeviceCard({ device }: { device: Device }) {
    const platformIcon = {
        darwin: '🍎',
        win32: '🪟',
        linux: '🐧',
    }[device.platform] || '🖥️';

    const queryClient = useQueryClient();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent Link navigation
        if (!confirm('정말 이 디바이스를 영구 삭제하시겠습니까? 관련 활동 기록도 모두 삭제됩니다.')) return;

        try {
            await api.deleteDevice(device.id);
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        } catch (err) {
            alert('삭제 실패: ' + (err as Error).message);
        }
    };

    const handleRevoke = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm('디바이스 연결을 해제하시겠습니까? (기록은 유지됩니다)')) return;

        try {
            await api.revokeDevice(device.id);
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        } catch (err) {
            alert('해제 실패: ' + (err as Error).message);
        }
    };

    return (
        <Link href={`/devices/${device.id}`}>
            <div className={`card p-6 hover:shadow-md transition-shadow cursor-pointer relative group ${device.is_revoked ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="text-3xl">{platformIcon}</div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{device.name}</h3>
                            {device.is_online ? (
                                <span className="badge badge-success">온라인</span>
                            ) : (
                                <span className="badge badge-neutral">오프라인</span>
                            )}
                            {device.is_revoked && (
                                <span className="badge badge-error">연결 해제됨</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {device.platform} / {device.arch}
                            {device.agent_version && ` · v${device.agent_version}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right text-sm text-slate-500">
                            {device.last_seen_at ? (
                                <>마지막 접속: {formatDate(device.last_seen_at)}</>
                            ) : (
                                <>아직 접속 기록 없음</>
                            )}
                        </div>

                        {!device.is_revoked && (
                            <button
                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-full transition-all"
                                onClick={handleRevoke}
                                title="연결 해제 (Revoke)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                                    <line x1="12" y1="2" x2="12" y2="12"></line>
                                </svg>
                            </button>
                        )}

                        <button
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all"
                            onClick={handleDelete}
                            title="영구 삭제 (Delete)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;

    return date.toLocaleDateString('ko-KR');
}
