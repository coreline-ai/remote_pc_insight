'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AiProvider, api, Device, DeviceRiskItem } from '@/lib/api';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/use-require-auth';
import {
    getEnvDefaultAiProvider,
    loadAiProviderPreference,
    saveAiProviderPreference,
} from '@/lib/ai-provider';
import {
    buildInstallScript,
    buildLinkCommand,
    buildOneLiner,
    OnboardingOS,
    scriptFileName,
} from '@/lib/onboarding-commands';

export default function DevicesPage() {
    const { isAuthenticated, isChecking } = useRequireAuth();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['devices'],
        queryFn: () => api.getDevices(),
        enabled: isAuthenticated,
        refetchInterval: 10000,
    });
    const { data: riskTop } = useQuery({
        queryKey: ['risk-top-devices'],
        queryFn: () => api.getRiskTopDevices(5),
        enabled: isAuthenticated,
        refetchInterval: 10000,
    });
    const { data: aiMetrics } = useQuery({
        queryKey: ['ai-metrics'],
        queryFn: () => api.getAiMetrics(),
        enabled: isAuthenticated,
        refetchInterval: 30000,
    });
    const { data: currentUser } = useQuery({
        queryKey: ['current-user'],
        queryFn: () => api.getMe(),
        enabled: isAuthenticated,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [enrollToken, setEnrollToken] = useState<string | null>(null);
    const [selectedOs, setSelectedOs] = useState<OnboardingOS>('macos');
    const [tokenExpiresMinutes, setTokenExpiresMinutes] = useState(30);
    const [tokenStatusMessage, setTokenStatusMessage] = useState('');
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isCheckingTokenStatus, setIsCheckingTokenStatus] = useState(false);
    const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
    const [queryText, setQueryText] = useState('가장 위험한 PC 5대 보여줘');
    const [globalProvider, setGlobalProvider] = useState<AiProvider>(getEnvDefaultAiProvider());
    const aiQuery = useMutation({
        mutationFn: (query: string) => api.queryAi(query, 5),
    });

    const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

    useEffect(() => {
        setGlobalProvider(loadAiProviderPreference());
    }, []);

    const handleChangeGlobalProvider = (provider: AiProvider) => {
        setGlobalProvider(provider);
        saveAiProviderPreference(provider);
    };

    const issueEnrollToken = async (expiresMinutes: number) => {
        setIsGeneratingToken(true);
        setTokenStatusMessage('');
        try {
            const result = await api.createEnrollToken(expiresMinutes);
            setEnrollToken(result.token);
        } catch (e) {
            console.error(e);
            setTokenStatusMessage('토큰 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsGeneratingToken(false);
        }
    };

    const handleOpenModal = async () => {
        setIsModalOpen(true);
        await issueEnrollToken(tokenExpiresMinutes);
    };

    const handleDownloadScript = () => {
        if (!enrollToken) return;
        const content = buildInstallScript(selectedOs, enrollToken, apiBase);
        const filename = scriptFileName(selectedOs);
        const blob = new Blob([content], {
            type: selectedOs === 'windows' ? 'text/plain;charset=utf-8' : 'text/x-shellscript;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleCheckTokenStatus = async () => {
        if (!enrollToken) return;
        setIsCheckingTokenStatus(true);
        setTokenStatusMessage('');
        try {
            const status = await api.getEnrollTokenStatus(enrollToken);
            if (status.status === 'used') {
                setTokenStatusMessage(`연결 완료: 새 디바이스(${status.used_device_id || '확인됨'})가 등록되었습니다.`);
                await queryClient.invalidateQueries({ queryKey: ['devices'] });
                await queryClient.invalidateQueries({ queryKey: ['risk-top-devices'] });
                return;
            }
            if (status.status === 'pending') {
                setTokenStatusMessage('아직 연결 대기 중입니다. 대상 PC에서 명령 실행 후 다시 확인하세요.');
                return;
            }
            if (status.status === 'expired') {
                setTokenStatusMessage('토큰이 만료되었습니다. 새 토큰 발급 후 다시 진행하세요.');
                return;
            }
            setTokenStatusMessage('토큰 상태를 찾을 수 없습니다. 새 토큰으로 다시 시도하세요.');
        } catch {
            setTokenStatusMessage('상태 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsCheckingTokenStatus(false);
        }
    };

    if (isChecking || isLoading) {
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

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="card p-6 text-center text-slate-400">
                        로그인 페이지로 이동 중입니다...
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
        <div className="min-h-screen p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">내 디바이스</h1>
                        {currentUser?.email && (
                            <p className="text-sm text-slate-400 mt-1">로그인: {currentUser.email}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/" className="btn btn-secondary">
                            홈
                        </Link>
                        <button className="btn btn-primary" onClick={handleOpenModal}>
                            + 새 PC 연결
                        </button>
                    </div>
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

                {riskTop && riskTop.items.length > 0 && (
                    <RiskTopPanel items={riskTop.items} />
                )}
                <AiQueryPanel
                    queryText={queryText}
                    setQueryText={setQueryText}
                    runQuery={() => aiQuery.mutate(queryText)}
                    result={aiQuery.data}
                    isLoading={aiQuery.isPending}
                />
                <AiProviderPanel provider={globalProvider} onChange={handleChangeGlobalProvider} />

                {aiMetrics && <AiMetricsPanel metrics={aiMetrics} />}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
                        <h2 className="text-xl font-bold mb-4">새 PC 연결</h2>

                        <div className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-300">
                                대상 PC에서 아래 명령을 1회 실행하면 설치 + 링크 + 에이전트 실행이 진행됩니다.
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-slate-400">OS 선택:</span>
                                {(['macos', 'windows', 'linux'] as OnboardingOS[]).map((os) => (
                                    <button
                                        key={os}
                                        type="button"
                                        className={`btn text-xs py-1 px-2 ${selectedOs === os ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSelectedOs(os)}
                                    >
                                        {os === 'macos' ? 'macOS' : os === 'windows' ? 'Windows' : 'Linux'}
                                    </button>
                                ))}
                                <span className="text-sm text-slate-400 ml-2">토큰 만료:</span>
                                <select
                                    value={tokenExpiresMinutes}
                                    onChange={(e) => setTokenExpiresMinutes(parseInt(e.target.value, 10))}
                                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                                >
                                    <option value={15}>15분</option>
                                    <option value={30}>30분</option>
                                    <option value={60}>60분</option>
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-secondary text-xs py-1 px-2"
                                    onClick={() => issueEnrollToken(tokenExpiresMinutes)}
                                    disabled={isGeneratingToken}
                                >
                                    {isGeneratingToken ? '발급 중...' : '새 토큰 발급'}
                                </button>
                            </div>

                            {enrollToken ? (
                                <>
                                    <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs break-all relative group">
                                        {buildOneLiner(selectedOs, enrollToken, apiBase)}
                                        <button
                                            className="absolute top-2 right-2 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => navigator.clipboard.writeText(buildOneLiner(selectedOs, enrollToken, apiBase))}
                                        >
                                            복사
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary text-sm py-2"
                                            onClick={handleDownloadScript}
                                        >
                                            스크립트 다운로드
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary text-sm py-2"
                                            onClick={handleCheckTokenStatus}
                                            disabled={isCheckingTokenStatus}
                                        >
                                            {isCheckingTokenStatus ? '확인 중...' : '연결 확인'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary text-sm py-2"
                                            onClick={() => navigator.clipboard.writeText(buildLinkCommand(enrollToken, apiBase))}
                                        >
                                            링크 명령만 복사
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="animate-pulse bg-slate-200 h-12 rounded"></div>
                            )}

                            <div className="rounded-lg border border-slate-300/80 dark:border-slate-700">
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-colors"
                                    onClick={() => setIsInstallGuideOpen((prev) => !prev)}
                                    aria-expanded={isInstallGuideOpen}
                                >
                                    <h3 className="text-base font-bold">설치 방법</h3>
                                    <span className="text-sm text-slate-500 dark:text-slate-300">
                                        {isInstallGuideOpen ? '접기 ▲' : '펼치기 ▼'}
                                    </span>
                                </button>
                                {isInstallGuideOpen && (
                                    <div className="px-4 pb-4">
                                        <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
                                            <li>
                                                먼저 대상 PC에 Node.js/npm이 설치되어 있는지 확인하세요.
                                                <br />
                                                <span className="text-xs text-slate-500 ml-5">없다면 Node.js LTS 설치 후 터미널을 다시 열어 주세요.</span>
                                                <div className="mt-2 ml-5">
                                                    <pre className="rounded-lg bg-slate-950 text-slate-100 text-xs p-3 overflow-x-auto">
                                                        <code>{buildNodeInstallGuide(selectedOs)}</code>
                                                    </pre>
                                                </div>
                                            </li>
                                            <li>위 원커맨드를 실행하거나 스크립트를 다운로드 후 실행하세요.</li>
                                            <li>실행 후 에이전트를 켠 상태로 두고, 여기서 연결 확인을 눌러 등록 상태를 확인하세요.</li>
                                        </ol>
                                        <div className="mt-3 ml-5">
                                            <p className="text-xs text-slate-400 mb-1">스크립트 실행 예시</p>
                                            <pre className="rounded-lg bg-slate-950 text-slate-100 text-xs p-3 overflow-x-auto">
                                                <code>{buildScriptRunGuide(selectedOs)}</code>
                                            </pre>
                                        </div>
                                        <p className="text-xs text-amber-500 mt-2">
                                            토큰은 1회성입니다. 타인에게 공유하지 마세요.
                                        </p>
                                    </div>
                                )}
                            </div>
                            {tokenStatusMessage && (
                                <p className="text-sm mt-1 text-sky-400">{tokenStatusMessage}</p>
                            )}
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

function AiProviderPanel({
    provider,
    onChange,
}: {
    provider: AiProvider;
    onChange: (provider: AiProvider) => void;
}) {
    return (
        <div className="card mb-6">
            <div className="card-header">
                <h2 className="font-semibold">AI 엔진 설정 (MVP)</h2>
            </div>
            <div className="card-body">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <p className="text-sm text-slate-400">
                        디바이스 상세의 AI 코파일럿/권장 액션은 여기서 선택한 엔진을 전역으로 사용합니다.
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">현재 엔진</span>
                        <select
                            value={provider}
                            onChange={(e) => onChange(e.target.value as AiProvider)}
                            className="text-sm px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-300"
                            aria-label="AI 엔진 선택"
                        >
                            <option value="glm45">GLM4.5</option>
                            <option value="openai">OPENAI</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AiMetricsPanel({
    metrics,
}: {
    metrics: {
        requests_total: number;
        requests_success: number;
        requests_failed: number;
        requests_rate_limited: number;
        fallback_total: number;
    };
}) {
    const metricCards = [
        {
            label: '요청',
            value: metrics.requests_total,
            description: 'AI 요약/질의 기능을 호출한 전체 횟수',
        },
        {
            label: '성공',
            value: metrics.requests_success,
            description: 'AI 응답 생성에 성공한 횟수',
        },
        {
            label: '실패',
            value: metrics.requests_failed,
            description: 'AI 호출 실패(시간 초과/응답 오류 등) 횟수',
        },
        {
            label: '제한',
            value: metrics.requests_rate_limited,
            description: '요청 한도(429)로 차단된 횟수',
        },
        {
            label: 'Fallback',
            value: metrics.fallback_total,
            description: 'AI 대신 기본 규칙 기반 결과로 대체한 횟수',
        },
    ];

    return (
        <div className="card mb-6">
            <div className="card-header">
                <h2 className="font-semibold">AI 운영 지표</h2>
            </div>
            <div className="card-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
                    {metricCards.map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-700 p-3">
                            <div className="text-base font-semibold">
                                {item.label}: {item.value}
                            </div>
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                    기준: 서버 시작 이후 누적 카운트
                </p>
            </div>
        </div>
    );
}

function AiQueryPanel({
    queryText,
    setQueryText,
    runQuery,
    result,
    isLoading,
}: {
    queryText: string;
    setQueryText: (value: string) => void;
    runQuery: () => void;
    result?: {
        answer: string;
        items: Array<{ device_id: string; device_name: string; score: number; reason: string }>;
    };
    isLoading: boolean;
}) {
    return (
        <div className="card mb-6">
            <div className="card-header">
                <h2 className="font-semibold">자연어 질의 (MVP)</h2>
            </div>
            <div className="card-body">
                <div className="flex flex-col md:flex-row gap-3 mb-3">
                    <input
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        className="flex-1"
                        placeholder="예: 지난 7일간 위험한 PC 5대 보여줘"
                    />
                    <button className="btn btn-secondary" onClick={runQuery} disabled={isLoading}>
                        {isLoading ? '조회 중...' : '질의 실행'}
                    </button>
                </div>
                {result && (
                    <>
                        <p className="text-sm text-slate-400 mb-3">{result.answer}</p>
                        <div className="space-y-2">
                            {result.items.map((item) => (
                                <Link key={item.device_id} href={`/devices/${item.device_id}`}>
                                    <div className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-white/5 transition-colors">
                                        <div className="font-medium text-sm">{item.device_name} · {item.score}</div>
                                        <div className="text-xs text-slate-400">{item.reason}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function RiskTopPanel({ items }: { items: DeviceRiskItem[] }) {
    return (
        <div className="card mb-6">
            <div className="card-header">
                <h2 className="font-semibold">우선 조치 디바이스 Top {items.length}</h2>
            </div>
            <div className="card-body p-0">
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((item) => (
                        <Link href={`/devices/${item.device_id}`} key={item.device_id}>
                            <div className="px-6 py-4 hover:bg-white/5 transition-colors">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <div className="font-semibold">{item.device_name}</div>
                                        <div className="text-sm text-slate-400">
                                            {item.top_reasons.join(' · ') || '기본 점검 필요'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="badge badge-warning">RISK {item.risk_score}</span>
                                        <span className={`badge ${item.is_online ? 'badge-success' : 'badge-neutral'}`}>
                                            {item.is_online ? '온라인' : '오프라인'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
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

function buildNodeInstallGuide(os: OnboardingOS): string {
    if (os === 'windows') {
        return [
            '# Windows (PowerShell, 관리자 권한 권장)',
            'winget install OpenJS.NodeJS.LTS',
            'node -v',
            'npm -v',
        ].join('\n');
    }
    if (os === 'linux') {
        return [
            '# Linux (Ubuntu/Debian 예시: nvm 방식)',
            'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash',
            'source ~/.nvm/nvm.sh',
            'nvm install --lts',
            'node -v',
            'npm -v',
        ].join('\n');
    }
    return [
        '# macOS (Homebrew)',
        'brew install node@20',
        'echo \'export PATH=\"/opt/homebrew/opt/node@20/bin:$PATH\"\' >> ~/.zshrc',
        'source ~/.zshrc',
        'node -v',
        'npm -v',
    ].join('\n');
}

function buildScriptRunGuide(os: OnboardingOS): string {
    if (os === 'windows') {
        return [
            '# Windows PowerShell',
            'cd $HOME\\Downloads',
            'Set-ExecutionPolicy -Scope Process Bypass',
            '.\\pc-insight-onboarding.ps1',
        ].join('\n');
    }
    return [
        '# macOS/Linux',
        'cd ~/Downloads',
        'chmod +x ./pc-insight-onboarding.sh',
        './pc-insight-onboarding.sh',
        '# 권한 오류 시',
        'bash ./pc-insight-onboarding.sh',
    ].join('\n');
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
