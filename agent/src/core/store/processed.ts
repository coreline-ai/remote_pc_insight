import * as fs from 'fs/promises';
import * as path from 'path';
import { configStore } from './config.js';

const PROCESSED_FILE = path.join(configStore.getConfigDir(), 'processed.json');
const MAX_ENTRIES = 1000;

interface ProcessedStore {
    commands: string[];
    lastUpdated: string;
}

export const processedStore = {
    async has(commandId: string): Promise<boolean> {
        const store = await this.load();
        return store.commands.includes(commandId);
    },

    async add(commandId: string): Promise<void> {
        const store = await this.load();

        if (!store.commands.includes(commandId)) {
            store.commands.push(commandId);

            // Keep only last MAX_ENTRIES
            if (store.commands.length > MAX_ENTRIES) {
                store.commands = store.commands.slice(-MAX_ENTRIES);
            }

            store.lastUpdated = new Date().toISOString();
            await this.save(store);
        }
    },

    async load(): Promise<ProcessedStore> {
        try {
            const data = await fs.readFile(PROCESSED_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return { commands: [], lastUpdated: new Date().toISOString() };
        }
    },

    async save(store: ProcessedStore): Promise<void> {
        const dir = path.dirname(PROCESSED_FILE);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(PROCESSED_FILE, JSON.stringify(store, null, 2));
    },
};
