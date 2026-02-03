
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, EnrollRequest } from './client';

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('ApiClient', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    describe('enroll', () => {
        const mockRequest: EnrollRequest = {
            deviceName: 'test-device',
            platform: 'darwin',
            arch: 'arm64',
            agentVersion: '0.1.0',
            deviceFingerprint: 'fingerprint123',
        };
        const serverUrl = 'http://localhost:8000';
        const enrollToken = 'test-token';

        it('should enroll successfully', async () => {
            const mockResponse = {
                device_id: 'dev_123',
                device_token: 'tok_123',
                expires_in: 3600,
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await apiClient.enroll(serverUrl, enrollToken, mockRequest);

            expect(result).toEqual({
                deviceId: 'dev_123',
                deviceToken: 'tok_123',
                expiresIn: 3600,
            });

            expect(fetchMock).toHaveBeenCalledWith(
                'http://localhost:8000/v1/agent/enroll',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        device_name: 'test-device',
                        platform: 'darwin',
                        arch: 'arm64',
                        agent_version: '0.1.0',
                        device_fingerprint: 'fingerprint123',
                    }),
                })
            );
        });

        it('should handle error response', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ message: 'Invalid token' }),
            });

            await expect(apiClient.enroll(serverUrl, enrollToken, mockRequest))
                .rejects.toThrow('Invalid token');
        });
    });
});
