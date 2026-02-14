import { Config } from '../store/config.js';

export interface EnrollRequest {
    deviceName: string;
    platform: string;
    arch: string;
    agentVersion: string;
    deviceFingerprint: string;
}

export interface EnrollResponse {
    deviceId: string;
    deviceToken: string;
    expiresIn: number;
}

export interface RemoteCommand {
    id: string;
    type: string;
    params: Record<string, unknown>;
    issuedAt: string;
}

export interface CommandStatusUpdate {
    status: 'running' | 'succeeded' | 'failed';
    progress: number;
    message: string;
}

interface ErrorResponse {
    message?: string;
    detail?: string;
}

interface EnrollApiResponse {
    device_id: string;
    device_token: string;
    expires_in: number;
}

interface CommandApiResponse {
    command: {
        id: string;
        type: string;
        params: Record<string, unknown>;
        issued_at: string;
    } | null;
}

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeServerUrl(rawUrl: string): string {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid server URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
        throw new Error('Server URL must use http or https');
    }
    if (parsed.protocol.toLowerCase() === 'http:') {
        const host = parsed.hostname.toLowerCase();
        const isLocalhost = host === 'localhost' || host === '127.0.0.1';
        if (!isLocalhost) {
            throw new Error('Insecure HTTP is blocked for non-localhost servers');
        }
    }
    return parsed.toString().replace(/\/$/, '');
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            clearTimeout(timeout);
            if (response.status >= 500 || response.status === 429) {
                if (attempt < maxRetries) {
                    await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
                    continue;
                }
            }
            return response;
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;
            if (attempt < maxRetries) {
                await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
                continue;
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

export const apiClient = {
    async enroll(serverUrl: string, enrollToken: string, request: EnrollRequest): Promise<EnrollResponse> {
        const baseUrl = normalizeServerUrl(serverUrl);
        const response = await fetchWithRetry(`${baseUrl}/v1/agent/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${enrollToken}`,
            },
            body: JSON.stringify({
                device_name: request.deviceName,
                platform: request.platform,
                arch: request.arch,
                agent_version: request.agentVersion,
                device_fingerprint: request.deviceFingerprint,
            }),
        }, 0);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as ErrorResponse;
            throw new Error(errorData.message || errorData.detail || `HTTP ${response.status}`);
        }

        const data = await response.json() as EnrollApiResponse;
        return {
            deviceId: data.device_id,
            deviceToken: data.device_token,
            expiresIn: data.expires_in,
        };
    },

    async getNextCommand(config: Config): Promise<RemoteCommand | null> {
        const baseUrl = normalizeServerUrl(config.serverUrl);
        const response = await fetchWithRetry(`${baseUrl}/v1/agent/commands/next`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.deviceToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as CommandApiResponse;
        if (!data.command) {
            return null;
        }

        return {
            id: data.command.id,
            type: data.command.type,
            params: data.command.params || {},
            issuedAt: data.command.issued_at,
        };
    },

    async updateCommandStatus(config: Config, commandId: string, update: CommandStatusUpdate): Promise<void> {
        const baseUrl = normalizeServerUrl(config.serverUrl);
        const response = await fetchWithRetry(`${baseUrl}/v1/agent/commands/${commandId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.deviceToken}`,
            },
            body: JSON.stringify(update),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    },

    async uploadReport(config: Config, commandId: string | undefined, report: unknown): Promise<void> {
        const baseUrl = normalizeServerUrl(config.serverUrl);
        const response = await fetchWithRetry(`${baseUrl}/v1/agent/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.deviceToken}`,
            },
            body: JSON.stringify({
                command_id: commandId,
                report,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    },
};
