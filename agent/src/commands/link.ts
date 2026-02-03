import { Command } from 'commander';
import * as os from 'os';
import * as crypto from 'crypto';
import { configStore } from '../core/store/config.js';
import { apiClient } from '../core/api/client.js';

export const linkCommand = new Command('link')
    .description('Link this device to pc-insight Cloud')
    .argument('<token>', 'Enrollment token from web dashboard')
    .option('-s, --server <url>', 'API server URL', 'http://localhost:8000')
    .action(async (token: string, options: { server: string }) => {
        console.log('🔗 Linking device to pc-insight Cloud...');
        console.log(`   Server: ${options.server}`);

        try {
            const result = await apiClient.enroll(options.server, token, {
                deviceName: os.hostname(),
                platform: process.platform,
                arch: process.arch,
                agentVersion: '0.1.0',
                deviceFingerprint: generateFingerprint(),
            });

            await configStore.save({
                serverUrl: options.server,
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
