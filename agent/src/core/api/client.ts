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

export const apiClient = {
    async enroll(serverUrl: string, enrollToken: string, request: EnrollRequest): Promise<EnrollResponse> {
        const response = await fetch(`${serverUrl}/v1/agent/enroll`, {
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
        });

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
        const response = await fetch(`${config.serverUrl}/v1/agent/commands/next`, {
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
        const response = await fetch(`${config.serverUrl}/v1/agent/commands/${commandId}/status`, {
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
        const response = await fetch(`${config.serverUrl}/v1/agent/reports`, {
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
