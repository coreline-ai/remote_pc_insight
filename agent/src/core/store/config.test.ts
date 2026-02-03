
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { configStore, Config } from './config';
import * as path from 'path';
import * as os from 'os';

// Mock fs/promises
vi.mock('fs/promises');

// Mock os.homedir to return a predictable path
vi.mock('os', () => ({
    homedir: () => '/mock/home',
    platform: () => 'darwin', // Optional, if platform check is needed
    tmpdir: () => '/tmp',
}));

describe('ConfigStore', () => {
    const mockConfig: Config = {
        serverUrl: 'http://localhost:8000',
        deviceId: 'test-device-id',
        deviceToken: 'test-token',
        linkedAt: '2024-01-01T00:00:00Z',
    };

    const configDir = path.join('/mock/home', '.pc-insight');
    const configFile = path.join(configDir, 'config.json');

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should save config correctly', async () => {
        await configStore.save(mockConfig);

        expect(fs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledWith(
            configFile,
            JSON.stringify(mockConfig, null, 2)
        );
    });

    it('should load config correctly when file exists', async () => {
        (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));

        const loaded = await configStore.load();
        expect(loaded).toEqual(mockConfig);
        expect(fs.readFile).toHaveBeenCalledWith(configFile, 'utf-8');
    });

    it('should return null when config file does not exist', async () => {
        (fs.readFile as any).mockRejectedValue(new Error('File not found'));

        const loaded = await configStore.load();
        expect(loaded).toBeNull();
    });

    it('should clear config', async () => {
        await configStore.clear();
        expect(fs.unlink).toHaveBeenCalledWith(configFile);
    });

    it('should handle clear when file does not exist', async () => {
        (fs.unlink as any).mockRejectedValue(new Error('File not found'));
        await expect(configStore.clear()).resolves.not.toThrow();
    });
});
