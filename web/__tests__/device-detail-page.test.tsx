import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeviceDetailPage from '../app/devices/[id]/page';

const mockUseRequireAuth = jest.fn();
const mockUseAbVariant = jest.fn();
const mockUsePathname = jest.fn();

const mockGetDevice = jest.fn();
const mockGetDeviceAiSummary = jest.fn();
const mockGetDeviceAiTrends = jest.fn();
const mockCreateCommand = jest.fn();
const mockRevokeDevice = jest.fn();

jest.mock('../hooks/use-require-auth', () => ({
    useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('../hooks/use-ab-variant', () => ({
    useAbVariant: () => mockUseAbVariant(),
}));

jest.mock('next/navigation', () => ({
    usePathname: () => mockUsePathname(),
}));

jest.mock('../lib/api', () => ({
    api: {
        getDevice: (...args: unknown[]) => mockGetDevice(...args),
        getDeviceAiSummary: (...args: unknown[]) => mockGetDeviceAiSummary(...args),
        getDeviceAiTrends: (...args: unknown[]) => mockGetDeviceAiTrends(...args),
        createCommand: (...args: unknown[]) => mockCreateCommand(...args),
        revokeDevice: (...args: unknown[]) => mockRevokeDevice(...args),
    },
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...props }: any) => (
        <a href={typeof href === 'string' ? href : ''} {...props}>
            {children}
        </a>
    ),
}));

function makeDevice(overrides: Record<string, unknown> = {}) {
    return {
        id: 'dev_test_1',
        name: 'QA Mac Mini',
        platform: 'darwin',
        arch: 'arm64',
        agent_version: '0.1.0',
        created_at: '2026-02-14T00:00:00Z',
        last_seen_at: '2026-02-14T01:00:00Z',
        is_online: true,
        is_revoked: false,
        recent_commands: [],
        latest_report: null,
        ...overrides,
    };
}

function makeSummary(overrides: Record<string, unknown> = {}) {
    return {
        enabled: true,
        source: 'model',
        summary: '현재 리스크가 높습니다. 즉시 점검이 필요합니다.',
        risk_level: 'high',
        reasons: ['디스크 여유 부족', '백그라운드 프로세스 과다'],
        recommended_actions: [
            {
                command_type: 'RUN_FULL',
                label: '전체 점검 실행',
                reason: '리스크 원인 정밀 진단',
            },
        ],
        based_on_report_id: 'rep_1',
        generated_at: '2026-02-14T02:00:00Z',
        ...overrides,
    };
}

function makeTrends(overrides: Record<string, unknown> = {}) {
    return {
        device_id: 'dev_test_1',
        period_days: 7,
        summary: '최근 7일 동안 디스크 상태가 악화되었습니다.',
        signals: [
            {
                metric: 'disk_free_percent',
                current: 12,
                baseline: 28,
                delta: -16,
                status: 'degraded',
                note: '임계치 이하로 감소',
            },
        ],
        ...overrides,
    };
}

function renderPage(deviceId = 'dev_test_1') {
    mockUsePathname.mockReturnValue(`/devices/${deviceId}`);
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
            },
            mutations: {
                retry: false,
            },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <DeviceDetailPage params={{ id: deviceId }} />
        </QueryClientProvider>
    );
}

describe('DeviceDetailPage', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT = 'false';
        process.env.NEXT_PUBLIC_AI_PROVIDER = 'glm45';

        mockUseRequireAuth.mockReturnValue({ isAuthenticated: true, isChecking: false });
        mockUseAbVariant.mockReturnValue('A');
        mockUsePathname.mockReturnValue('/devices/dev_test_1');

        mockGetDevice.mockResolvedValue(makeDevice());
        mockGetDeviceAiSummary.mockResolvedValue(null);
        mockGetDeviceAiTrends.mockResolvedValue(null);
        mockCreateCommand.mockResolvedValue({ id: 'cmd_created' });
        mockRevokeDevice.mockResolvedValue({ message: 'ok' });

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('shows loading skeleton while auth check is in progress', () => {
        mockUseRequireAuth.mockReturnValue({ isAuthenticated: false, isChecking: true });
        const { container } = renderPage();

        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows redirecting message when user is not authenticated', () => {
        mockUseRequireAuth.mockReturnValue({ isAuthenticated: false, isChecking: false });
        renderPage();

        expect(screen.getByText('로그인 페이지로 이동 중입니다...')).toBeInTheDocument();
    });

    it('renders not found message when device query fails', async () => {
        mockGetDevice.mockRejectedValueOnce(new Error('boom'));
        renderPage();

        expect(await screen.findByText('디바이스를 찾을 수 없습니다.')).toBeInTheDocument();
    });

    it('renders device info and command history status mapping', async () => {
        mockGetDevice.mockResolvedValueOnce(
            makeDevice({
                latest_report: {
                    id: 'rep_123',
                    health_score: 77,
                    disk_free_percent: 45,
                    startup_apps_count: 8,
                    one_liner: '점검 필요 항목이 있습니다.',
                    created_at: '2026-02-14T03:00:00Z',
                },
                recent_commands: [
                    {
                        id: 'cmd_q',
                        type: 'RUN_FULL',
                        status: 'queued',
                        progress: 0,
                        message: '',
                        created_at: '2026-02-14T12:36:21Z',
                        started_at: null,
                        finished_at: null,
                        report_id: null,
                    },
                    {
                        id: 'cmd_r',
                        type: 'PING',
                        status: 'running',
                        progress: 30,
                        message: '',
                        created_at: '2026-02-14T12:36:18Z',
                        started_at: '2026-02-14T12:36:20Z',
                        finished_at: null,
                        report_id: null,
                    },
                    {
                        id: 'cmd_s',
                        type: 'RUN_STORAGE_ONLY',
                        status: 'succeeded',
                        progress: 100,
                        message: '',
                        created_at: '2026-02-14T11:00:00Z',
                        started_at: '2026-02-14T11:00:05Z',
                        finished_at: '2026-02-14T11:01:00Z',
                        report_id: 'rep_321',
                    },
                    {
                        id: 'cmd_f',
                        type: 'RUN_FULL',
                        status: 'failed',
                        progress: 40,
                        message: 'error',
                        created_at: '2026-02-14T10:00:00Z',
                        started_at: '2026-02-14T10:00:10Z',
                        finished_at: '2026-02-14T10:00:40Z',
                        report_id: null,
                    },
                    {
                        id: 'cmd_e',
                        type: 'PING',
                        status: 'expired',
                        progress: 0,
                        message: '',
                        created_at: '2026-02-14T09:00:00Z',
                        started_at: null,
                        finished_at: null,
                        report_id: null,
                    },
                ],
            })
        );

        renderPage();

        expect(await screen.findByText('QA Mac Mini')).toBeInTheDocument();
        expect(screen.getByText('최근 분석 결과')).toBeInTheDocument();
        expect(screen.getByText('명령 히스토리')).toBeInTheDocument();
        expect(screen.getByText('대기 중')).toBeInTheDocument();
        expect(screen.getByText('실행 중')).toBeInTheDocument();
        expect(screen.getByText('완료')).toBeInTheDocument();
        expect(screen.getByText('실패')).toBeInTheDocument();
        expect(screen.getByText('만료')).toBeInTheDocument();
        expect(screen.getByText('30%')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '리포트 보기' })).toBeInTheDocument();
    });

    it('renders empty command history state', async () => {
        mockGetDevice.mockResolvedValueOnce(makeDevice({ recent_commands: [] }));
        renderPage();

        expect(await screen.findByText('아직 실행된 명령이 없습니다.')).toBeInTheDocument();
    });

    it('disables run buttons when device is offline', async () => {
        mockGetDevice.mockResolvedValueOnce(makeDevice({ is_online: false }));
        renderPage();

        const runFull = await screen.findByRole('button', { name: /전체 점검/ });
        const runStorage = screen.getByRole('button', { name: /스토리지 점검/ });
        const ping = screen.getByRole('button', { name: /핑/ });

        expect(runFull).toBeDisabled();
        expect(runStorage).toBeDisabled();
        expect(ping).toBeDisabled();
    });

    it('executes command actions from primary buttons', async () => {
        renderPage('dev_test_2');

        fireEvent.click(await screen.findByRole('button', { name: /전체 점검/ }));
        await waitFor(() => {
            expect(mockCreateCommand).toHaveBeenCalledWith('dev_test_2', 'RUN_FULL');
        });

        fireEvent.click(await screen.findByRole('button', { name: /스토리지 점검/ }));
        await waitFor(() => {
            expect(mockCreateCommand).toHaveBeenCalledWith('dev_test_2', 'RUN_STORAGE_ONLY');
        });

        fireEvent.click(await screen.findByRole('button', { name: /핑/ }));
        await waitFor(() => {
            expect(mockCreateCommand).toHaveBeenCalledWith('dev_test_2', 'PING');
        });
    });

    it('shows AI disabled notice when feature flag is off', async () => {
        process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT = 'false';
        renderPage();

        expect(
            await screen.findByText(/AI 코파일럿이 비활성화되어 있습니다/)
        ).toBeInTheDocument();
    });

    it('shows AI fallback actions when summary fails to load', async () => {
        process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT = 'true';
        mockGetDeviceAiSummary.mockRejectedValueOnce(new Error('ai failed'));
        renderPage('dev_test_3');

        expect(
            await screen.findByText('AI 요약을 불러오지 못했습니다. 기본 액션으로 점검을 시작하세요.')
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '전체 점검 실행' }));
        await waitFor(() => {
            expect(mockCreateCommand).toHaveBeenCalledWith('dev_test_3', 'RUN_FULL');
        });
    });

    it('supports AI audience selection and executes recommended action with global provider', async () => {
        process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT = 'true';
        process.env.NEXT_PUBLIC_AI_PROVIDER = 'glm45';
        mockGetDeviceAiSummary.mockResolvedValue(makeSummary());
        renderPage('dev_test_4');

        expect(await screen.findByText('현재 리스크가 높습니다. 즉시 점검이 필요합니다.')).toBeInTheDocument();
        expect(mockGetDeviceAiSummary).toHaveBeenCalledWith('dev_test_4', 'operator', 'glm45');
        expect(screen.getByText('엔진: GLM4.5 (전역)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '전체 점검 실행' }));
        await waitFor(() => {
            expect(mockCreateCommand).toHaveBeenCalledWith('dev_test_4', 'RUN_FULL');
        });

        const [audienceSelect] = screen.getAllByRole('combobox');
        fireEvent.change(audienceSelect, { target: { value: 'manager' } });

        await waitFor(() => {
            expect(mockGetDeviceAiSummary).toHaveBeenCalledWith('dev_test_4', 'manager', 'glm45');
        });
    });

    it('renders AI trend card when trends are available', async () => {
        process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT = 'true';
        mockGetDeviceAiSummary.mockResolvedValue(makeSummary({ risk_level: 'medium' }));
        mockGetDeviceAiTrends.mockResolvedValue(makeTrends());
        renderPage();

        expect(await screen.findByText('최근 7일 추세')).toBeInTheDocument();
        expect(screen.getByText('디스크 여유 비율')).toBeInTheDocument();
        expect(screen.getByText('악화')).toBeInTheDocument();
    });

    it('revokes device after user confirmation', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        renderPage('dev_test_5');

        fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }));
        await waitFor(() => {
            expect(mockRevokeDevice).toHaveBeenCalledWith('dev_test_5');
        });

        confirmSpy.mockRestore();
    });
});
