import { Config } from '../store/config.js';
import { processedStore } from '../store/processed.js';
import { outboxStore } from '../store/outbox.js';
import { apiClient, RemoteCommand } from '../api/client.js';
import { analyzer } from './index.js';

export const commandExecutor = {
    async execute(command: RemoteCommand, config: Config): Promise<void> {
        // Check if already processed
        if (await processedStore.has(command.id)) {
            console.log(`⏭️  Command already processed: ${command.id}`);
            return;
        }

        // Update status to running
        await apiClient.updateCommandStatus(config, command.id, {
            status: 'running',
            progress: 0,
            message: 'Starting analysis...',
        });

        try {
            const profile = mapCommandTypeToProfile(command.type);

            // Update progress
            await apiClient.updateCommandStatus(config, command.id, {
                status: 'running',
                progress: 30,
                message: 'Analyzing system...',
            });

            const report = await analyzer.run(profile);

            // Update progress
            await apiClient.updateCommandStatus(config, command.id, {
                status: 'running',
                progress: 80,
                message: 'Uploading report...',
            });

            // Sanitize report for upload
            const sanitizedReport = sanitizeForUpload(report, command.params);

            // Try to upload
            try {
                await apiClient.uploadReport(config, command.id, sanitizedReport);
            } catch (error) {
                // Save to outbox for retry
                await outboxStore.add(command.id, sanitizedReport);
                throw error;
            }

            // Mark as processed
            await processedStore.add(command.id);

        } catch (error) {
            await apiClient.updateCommandStatus(config, command.id, {
                status: 'failed',
                progress: 0,
                message: (error as Error).message,
            });
            throw error;
        }
    },
};

function mapCommandTypeToProfile(type: string): string {
    switch (type) {
        case 'RUN_FULL':
            return 'full';
        case 'RUN_DEEP':
            return 'deep';
        case 'RUN_STORAGE_ONLY':
            return 'storage';
        case 'RUN_PRIVACY_ONLY':
            return 'privacy';
        case 'RUN_DOWNLOADS_TOP':
            return 'downloads';
        case 'PING':
            return 'ping';
        default:
            return 'full';
    }
}

function sanitizeForUpload(report: unknown, params: Record<string, unknown>): unknown {
    // Default: Level 0 (no paths, no file names)
    // This is a simplified implementation
    // In production, would properly remove sensitive data based on policy
    return {
        ...(report as Record<string, unknown>),
        // Remove detailed path information by default
        storage: {
            ...((report as Record<string, unknown>).storage as Record<string, unknown>),
            folders: (((report as Record<string, unknown>).storage as Record<string, unknown>).folders as unknown[]).map((f: unknown) => ({
                name: (f as Record<string, unknown>).name,
                bytes: (f as Record<string, unknown>).bytes,
                fileCount: (f as Record<string, unknown>).fileCount,
                // path is hidden by default
            })),
        },
    };
}
