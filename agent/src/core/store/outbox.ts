import * as fs from 'fs/promises';
import * as path from 'path';
import { configStore, Config } from './config.js';
import { apiClient } from '../api/client.js';

interface OutboxItem {
    id: string;
    commandId?: string;
    report: unknown;
    createdAt: string;
    retryCount: number;
}

const OUTBOX_DIR = path.join(configStore.getConfigDir(), 'outbox');

export const outboxStore = {
    async add(commandId: string | undefined, report: unknown): Promise<void> {
        await fs.mkdir(OUTBOX_DIR, { recursive: true });

        const item: OutboxItem = {
            id: crypto.randomUUID(),
            commandId,
            report,
            createdAt: new Date().toISOString(),
            retryCount: 0,
        };

        const filePath = path.join(OUTBOX_DIR, `${item.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(item, null, 2));
    },

    async flush(config: Config): Promise<void> {
        try {
            const files = await fs.readdir(OUTBOX_DIR);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(OUTBOX_DIR, file);
                const data = await fs.readFile(filePath, 'utf-8');
                const item: OutboxItem = JSON.parse(data);

                try {
                    await apiClient.uploadReport(config, item.commandId, item.report);
                    await fs.unlink(filePath);
                    console.log(`📤 Flushed outbox item: ${item.id}`);
                } catch (error) {
                    item.retryCount++;
                    if (item.retryCount >= 10) {
                        console.error(`❌ Outbox item failed permanently: ${item.id}`);
                        await fs.unlink(filePath);
                    } else {
                        await fs.writeFile(filePath, JSON.stringify(item, null, 2));
                    }
                }
            }
        } catch {
            // Outbox directory doesn't exist yet
        }
    },

    async list(): Promise<OutboxItem[]> {
        try {
            const files = await fs.readdir(OUTBOX_DIR);
            const items: OutboxItem[] = [];

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const data = await fs.readFile(path.join(OUTBOX_DIR, file), 'utf-8');
                items.push(JSON.parse(data));
            }

            return items.sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        } catch {
            return [];
        }
    },
};
