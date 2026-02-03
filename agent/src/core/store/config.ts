import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface Config {
    serverUrl: string;
    deviceId: string;
    deviceToken: string;
    linkedAt: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.pc-insight');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const configStore = {
    async load(): Promise<Config | null> {
        try {
            const data = await fs.readFile(CONFIG_FILE, 'utf-8');
            return JSON.parse(data) as Config;
        } catch {
            return null;
        }
    },

    async save(config: Config): Promise<void> {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    },

    async clear(): Promise<void> {
        try {
            await fs.unlink(CONFIG_FILE);
        } catch {
            // Ignore if file doesn't exist
        }
    },

    getConfigDir(): string {
        return CONFIG_DIR;
    },
};
