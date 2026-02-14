const DEFAULT_API_PORT = '8001';

function normalizeBaseUrl(value: string): string {
    return value.replace(/\/$/, '');
}

function resolveApiBase(): string {
    const envBase = process.env.NEXT_PUBLIC_API_BASE;
    if (typeof window === 'undefined') {
        return normalizeBaseUrl(envBase || `http://localhost:${DEFAULT_API_PORT}`);
    }

    const browserHost = window.location.hostname;
    const browserProtocol = window.location.protocol;
    if (!envBase) {
        return `${browserProtocol}//${browserHost}:${DEFAULT_API_PORT}`;
    }

    try {
        const parsed = new URL(envBase);
        const localHosts = new Set(['localhost', '127.0.0.1']);
        if (
            localHosts.has(parsed.hostname)
            && localHosts.has(browserHost)
            && parsed.hostname !== browserHost
        ) {
            const port = parsed.port || DEFAULT_API_PORT;
            return `${parsed.protocol}//${browserHost}:${port}`;
        }
        return normalizeBaseUrl(envBase);
    } catch {
        return `${browserProtocol}//${browserHost}:${DEFAULT_API_PORT}`;
    }
}
export type AiProvider = 'openai' | 'glm45';

export interface ApiError {
    message: string;
    code?: string;
}

export interface CurrentUser {
    id: string;
    email: string;
}

class ApiClient {
    private token: string | null = null;

    private getApiBase(): string {
        return resolveApiBase();
    }

    private emitAuthChanged(isAuthenticated: boolean) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('pcinsight-auth-changed', {
                    detail: { isAuthenticated },
                })
            );
        }
    }

    setToken(token: string | null) {
        this.token = token;
        this.emitAuthChanged(Boolean(token));
    }

    getToken(): string | null {
        return this.token;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        allowRefresh = true
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (typeof window !== 'undefined' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
            headers['X-PCInsight-CSRF'] = '1';
        }

        let response: Response;
        const apiBase = this.getApiBase();
        try {
            response = await fetch(`${apiBase}${path}`, {
                method,
                headers,
                credentials: 'include',
                cache: 'no-store',
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch {
            throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');
        }

        if (!response.ok) {
            if (
                response.status === 401
                && allowRefresh
                && path !== '/v1/auth/login'
                && path !== '/v1/auth/register'
                && path !== '/v1/auth/refresh'
                && path !== '/v1/auth/logout'
            ) {
                const refreshed = await this.refreshSession();
                if (refreshed) {
                    return this.request<T>(method, path, body, false);
                }
            }
            if (response.status === 401) {
                this.emitAuthChanged(false);
            }
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(this.toErrorMessage(error, response.status));
        }

        return response.json();
    }

    private toErrorMessage(error: any, status: number): string {
        if (!error) return `HTTP ${status}`;
        if (typeof error === 'string') return error;
        if (typeof error.message === 'string' && error.message.trim()) return error.message;
        if (typeof error.detail === 'string' && error.detail.trim()) return error.detail;
        if (Array.isArray(error.detail)) {
            const msgs = error.detail
                .map((item: any) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item.msg === 'string') return item.msg;
                    return '';
                })
                .filter(Boolean);
            if (msgs.length > 0) return msgs.join(', ');
        }
        return `요청 처리 중 오류가 발생했습니다. (HTTP ${status})`;
    }

    // Auth
    async login(email: string, password: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const result = await this.request<{ access_token: string; expires_in: number }>(
            'POST',
            '/v1/auth/login',
            { email: normalizedEmail, password }
        );
        this.emitAuthChanged(true);
        return result;
    }

    async register(email: string, password: string) {
        const normalizedEmail = email.trim().toLowerCase();
        return this.request<{ id: string; email: string }>(
            'POST',
            '/v1/auth/register',
            { email: normalizedEmail, password }
        );
    }

    async getMe() {
        return this.request<CurrentUser>('GET', '/v1/auth/me');
    }

    async hasValidSession() {
        try {
            await this.getMe();
            return true;
        } catch {
            return false;
        }
    }

    private async refreshSession(): Promise<boolean> {
        const apiBase = this.getApiBase();
        try {
            const response = await fetch(`${apiBase}/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-PCInsight-CSRF': '1',
                },
                credentials: 'include',
                cache: 'no-store',
            });
            if (!response.ok) {
                return false;
            }
            const data = (await response.json()) as { access_token: string };
            if (data?.access_token) this.emitAuthChanged(true);
            return true;
        } catch {
            return false;
        }
    }

    async logout() {
        try {
            await this.request<{ message: string }>('POST', '/v1/auth/logout');
        } finally {
            this.emitAuthChanged(false);
        }
    }

    // Tokens
    async createEnrollToken(expiresInMinutes = 30) {
        return this.request<{ token: string; expires_at: string }>(
            'POST',
            '/v1/tokens/enroll',
            { expires_in_minutes: expiresInMinutes }
        );
    }

    async getEnrollTokenStatus(token: string) {
        return this.request<{
            status: 'pending' | 'used' | 'expired' | 'not_found';
            expires_at?: string;
            used_at?: string;
            used_device_id?: string;
        }>(
            'POST',
            '/v1/tokens/enroll/status',
            { token }
        );
    }

    // Devices
    async getDevices() {
        return this.request<{ devices: Device[]; total: number }>('GET', '/v1/devices');
    }

    async getRiskTopDevices(limit = 5) {
        return this.request<{ items: DeviceRiskItem[]; total: number }>(
            'GET',
            `/v1/devices/risk-top?limit=${limit}`
        );
    }

    async getDevice(deviceId: string) {
        return this.request<DeviceDetail>('GET', `/v1/devices/${deviceId}`);
    }

    async getDeviceAiSummary(
        deviceId: string,
        audience: 'operator' | 'manager' = 'operator',
        provider: AiProvider = 'glm45'
    ) {
        return this.request<DeviceAiSummary>(
            'GET',
            `/v1/devices/${deviceId}/ai-summary?audience=${audience}&provider=${provider}`
        );
    }

    async getDeviceAiTrends(deviceId: string) {
        return this.request<DeviceTrendResponse>('GET', `/v1/devices/${deviceId}/ai-trends`);
    }

    async revokeDevice(deviceId: string) {
        return this.request<{ message: string }>('POST', `/v1/devices/${deviceId}/revoke`);
    }

    async deleteDevice(deviceId: string) {
        return this.request<{ message: string }>('DELETE', `/v1/devices/${deviceId}`);
    }

    // Commands
    async createCommand(deviceId: string, type: string, params?: Record<string, unknown>) {
        return this.request<Command>(
            'POST',
            `/v1/devices/${deviceId}/commands`,
            { type, params: params || {} }
        );
    }

    async getCommands(deviceId: string) {
        return this.request<{ commands: Command[]; total: number }>(
            'GET',
            `/v1/devices/${deviceId}/commands`
        );
    }

    async getCommand(commandId: string) {
        return this.request<Command>('GET', `/v1/commands/${commandId}`);
    }

    // Reports
    async getReport(reportId: string) {
        return this.request<ReportDetail>('GET', `/v1/reports/${reportId}`);
    }

    async exportReport(reportId: string, format: 'markdown' | 'text' | 'pdf' = 'markdown') {
        return this.request<ReportExport>('GET', `/v1/reports/${reportId}/export?format=${format}`);
    }

    async shareReport(reportId: string, expiresInHours = 72) {
        return this.request<ReportShare>(
            'POST',
            `/v1/reports/${reportId}/share?expires_in_hours=${expiresInHours}`
        );
    }

    async getReportShares(reportId: string) {
        return this.request<{ items: ReportShareItem[] }>('GET', `/v1/reports/${reportId}/shares`);
    }

    async revokeReportShare(shareToken: string) {
        return this.request<{ message: string }>('POST', `/v1/reports/share/${shareToken}/revoke`);
    }

    async queryAi(query: string, limit = 5) {
        return this.request<AiQueryResponse>('POST', '/v1/ai/query', { query, limit });
    }

    async getAiMetrics() {
        return this.request<AiMetrics>('GET', '/v1/ai/metrics');
    }

    async getAiVersions() {
        return this.request<AiVersionInfo>('GET', '/v1/ai/versions');
    }
}

export const api = new ApiClient();

// Types
export interface Device {
    id: string;
    name: string;
    platform: string;
    arch: string;
    agent_version: string | null;
    created_at: string;
    last_seen_at: string | null;
    is_online: boolean;
    is_revoked: boolean;
}

export interface DeviceDetail extends Device {
    recent_commands: Command[];
    latest_report: ReportSummary | null;
}

export interface DeviceRiskItem {
    device_id: string;
    device_name: string;
    platform: string;
    is_online: boolean;
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    top_reasons: string[];
    latest_report_id: string | null;
    latest_report_at: string | null;
}

export interface DeviceAiRecommendedAction {
    command_type: string;
    label: string;
    reason: string;
}

export interface DeviceAiSummary {
    enabled: boolean;
    source: string;
    summary: string;
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
    reasons: string[];
    recommended_actions: DeviceAiRecommendedAction[];
    based_on_report_id: string | null;
    generated_at: string;
}

export interface DeviceTrendSignal {
    metric: string;
    current: number | null;
    baseline: number | null;
    delta: number | null;
    status: 'stable' | 'improved' | 'degraded' | 'unknown';
    note: string;
}

export interface DeviceTrendResponse {
    device_id: string;
    period_days: number;
    signals: DeviceTrendSignal[];
    summary: string;
}

export interface Command {
    id: string;
    type: string;
    status: string;
    progress: number;
    message: string;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    report_id: string | null;
}

export interface ReportSummary {
    id: string;
    health_score: number | null;
    disk_free_percent: number | null;
    startup_apps_count: number | null;
    one_liner: string | null;
    created_at: string;
}

export interface ReportDetail extends ReportSummary {
    device_id: string;
    command_id: string | null;
    raw_report_json: Record<string, unknown> | null;
}

export interface ReportExport {
    report_id: string;
    format: 'markdown' | 'text' | 'pdf';
    content: string;
    encoding?: 'utf-8' | 'base64';
    filename?: string;
}

export interface ReportShare {
    report_id: string;
    share_token: string;
    share_url: string;
    expires_at: string;
}

export interface ReportShareItem {
    share_id: string;
    share_token: string;
    share_url: string;
    expires_at: string;
    created_at: string;
    revoked_at: string | null;
}

export interface AiQueryItem {
    device_id: string;
    device_name: string;
    score: number;
    reason: string;
}

export interface AiQueryResponse {
    query: string;
    intent: string;
    answer: string;
    items: AiQueryItem[];
}

export interface AiMetrics {
    requests_total: number;
    requests_success: number;
    requests_failed: number;
    requests_rate_limited: number;
    fallback_total: number;
}

export interface AiVersionUsageItem {
    prompt_version: string;
    model_version: string;
    count: number;
}

export interface AiVersionInfo {
    active_prompt_version: string;
    active_model_version: string;
    usages: AiVersionUsageItem[];
}
