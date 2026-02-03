const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export interface ApiError {
    message: string;
    code?: string;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('access_token', token);
        } else {
            localStorage.removeItem('access_token');
        }
    }

    getToken(): string | null {
        if (this.token) return this.token;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('access_token');
        }
        return null;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || error.detail || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Auth
    async login(email: string, password: string) {
        const result = await this.request<{ access_token: string; expires_in: number }>(
            'POST',
            '/v1/auth/login',
            { email, password }
        );
        this.setToken(result.access_token);
        return result;
    }

    async register(email: string, password: string) {
        return this.request<{ id: string; email: string }>(
            'POST',
            '/v1/auth/register',
            { email, password }
        );
    }

    logout() {
        this.setToken(null);
    }

    // Tokens
    async createEnrollToken(expiresInMinutes = 60) {
        return this.request<{ token: string; expires_at: string }>(
            'POST',
            '/v1/tokens/enroll',
            { expires_in_minutes: expiresInMinutes }
        );
    }

    // Devices
    async getDevices() {
        return this.request<{ devices: Device[]; total: number }>('GET', '/v1/devices');
    }

    async getDevice(deviceId: string) {
        return this.request<DeviceDetail>('GET', `/v1/devices/${deviceId}`);
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
