import { Command } from 'commander';
import { configStore } from '../core/store/config.js';
import { apiClient } from '../core/api/client.js';
import { commandExecutor } from '../core/analyzer/executor.js';
import { outboxStore } from '../core/store/outbox.js';

export const agentCommand = new Command('agent')
    .description('Start the agent in polling mode')
    .option('-i, --interval <ms>', 'Polling interval in milliseconds', '8000')
    .action(async (options: { interval: string }) => {
        const interval = parseInt(options.interval, 10);
        console.log('🚀 Starting pc-insight agent...');
        console.log(`   Polling interval: ${interval}ms`);

        const config = await configStore.load();
        if (!config) {
            console.error('❌ Device not linked. Run "pc-insight link <token>" first.');
            process.exit(1);
        }

        console.log(`   Device ID: ${config.deviceId}`);
        console.log(`   Server: ${config.serverUrl}`);
        console.log('');

        // Flush outbox on startup
        await outboxStore.flush(config);

        // Start polling loop
        console.log('📡 Listening for commands...');
        while (true) {
            try {
                const command = await apiClient.getNextCommand(config);

                if (command) {
                    console.log(`\n📥 Received command: ${command.type} (${command.id})`);

                    try {
                        await commandExecutor.execute(command, config);
                        console.log(`✅ Command completed: ${command.id}`);
                    } catch (error) {
                        console.error(`❌ Command failed: ${(error as Error).message}`);
                        await apiClient.updateCommandStatus(config, command.id, {
                            status: 'failed',
                            progress: 0,
                            message: (error as Error).message,
                        });
                    }
                }

                // Flush outbox periodically
                await outboxStore.flush(config);
            } catch (error) {
                console.error(`⚠️  Polling error: ${(error as Error).message}`);
            }

            await sleep(interval);
        }
    });

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
