import { Command } from 'commander';
import * as os from 'os';
import * as crypto from 'crypto';
import { configStore } from '../core/store/config.js';
import { apiClient } from '../core/api/client.js';

export const linkCommand = new Command('link')
    .description('Link this device to pc-insight Cloud')
    .argument('<token>', 'Enrollment token from web dashboard')
    .option('-s, --server <url>', 'API server URL', 'https://localhost:8000')
    .option('--allow-insecure-http', 'Allow plain HTTP for localhost or trusted dev environments')
    .action(async (token: string, options: { server: string; allowInsecureHttp?: boolean }) => {
        console.log('🔗 Linking device to pc-insight Cloud...');
        console.log(`   Server: ${options.server}`);

        try {
            const serverUrl = validateServerUrl(options.server, Boolean(options.allowInsecureHttp));
            const result = await apiClient.enroll(serverUrl, token, {
                deviceName: os.hostname(),
                platform: process.platform,
                arch: process.arch,
                agentVersion: '0.1.0',
                deviceFingerprint: generateFingerprint(),
            });

            await configStore.save({
                serverUrl,
                deviceId: result.deviceId,
                deviceToken: result.deviceToken,
                linkedAt: new Date().toISOString(),
            });

            console.log('✅ Device linked successfully!');
            console.log(`   Device ID: ${result.deviceId}`);
            console.log('');
            console.log('Next: Run "pc-insight agent" to start receiving commands.');
        } catch (error) {
            console.error('❌ Failed to link device:', (error as Error).message);
            process.exit(1);
        }
    });

function generateFingerprint(): string {
    const data = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
}

function validateServerUrl(rawUrl: string, allowInsecureHttp: boolean): string {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid server URL');
    }

    const protocol = parsed.protocol.toLowerCase();
    if (!['http:', 'https:'].includes(protocol)) {
        throw new Error('Server URL must use http or https');
    }

    if (protocol === 'http:') {
        const host = parsed.hostname.toLowerCase();
        const isLocalhost = host === 'localhost' || host === '127.0.0.1';
        if (!isLocalhost && !allowInsecureHttp) {
            throw new Error('HTTP is blocked for non-localhost servers. Use HTTPS or pass --allow-insecure-http explicitly.');
        }
        if (!allowInsecureHttp) {
            console.warn('⚠️  Using HTTP. For production, always use HTTPS.');
        }
    }

    return parsed.toString().replace(/\/$/, '');
}
