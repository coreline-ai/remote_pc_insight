import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(exec);

export interface Report {
    healthScore: number;
    diskFreePercent: number;
    startupAppsCount: number;
    oneLiner: string;
    storage: StorageSummary;
    slowdown: SlowdownSummary;
    privacy: PrivacySummary;
    recommendations: string[];
    transparency: TransparencyInfo;
    createdAt: string;
}

export interface StorageSummary {
    folders: FolderInfo[];
    totalBytes: number;
    freeBytes: number;
    freePercent: number;
}

export interface FolderInfo {
    name: string;
    bytes: number;
    fileCount: number;
}

export interface SlowdownSummary {
    startupAppsCount: number;
    heavyProcessCount: number;
    reasons: string[];
}

export interface PrivacySummary {
    browserCacheSizeBytes: number;
    downloadsFolderBytes: number;
    tempFilesBytes: number;
}

export interface TransparencyInfo {
    collected: string[];
    notCollected: string[];
}

export const analyzer = {
    async run(profile: string): Promise<Report> {
        console.log(`   Profile: ${profile}`);

        const storage = await analyzeStorage();
        const slowdown = await analyzeSlowdown();
        const privacy = await analyzePrivacy();

        const healthScore = calculateHealthScore(storage, slowdown, privacy);
        const oneLiner = generateOneLiner(healthScore, storage, slowdown);
        const recommendations = generateRecommendations(storage, slowdown, privacy);

        return {
            healthScore,
            diskFreePercent: storage.freePercent,
            startupAppsCount: slowdown.startupAppsCount,
            oneLiner,
            storage,
            slowdown,
            privacy,
            recommendations,
            transparency: {
                collected: [
                    'Folder sizes (Downloads, Documents, Desktop, Pictures)',
                    'Disk usage statistics',
                    'Startup apps count',
                    'Process CPU usage count',
                    'Browser cache size estimates',
                    'System log sizes'
                ],
                notCollected: [
                    'File contents',
                    'File names (default)',
                    'File paths (default)',
                    'Browser history',
                    'Personal documents content',
                ],
            },
            createdAt: new Date().toISOString(),
        };
    },
};

async function getFolderSize(folderPath: string): Promise<number> {
    try {
        // Use du -k to get size in kilobytes for recursive sizing
        const { stdout } = await execAsync(`du -sk "${folderPath}"`);
        const parts = stdout.trim().split(/\s+/);
        if (parts.length > 0 && !isNaN(parseInt(parts[0]))) {
            return parseInt(parts[0], 10) * 1024; // Convert KB to bytes
        }
    } catch {
        // Fallback or ignore
    }
    return 0;
}

async function getFileCount(folderPath: string): Promise<number> {
    try {
        // Use find to count files
        const { stdout } = await execAsync(`find "${folderPath}" -type f | wc -l`);
        return parseInt(stdout.trim(), 10);
    } catch {
        return 0;
    }
}

async function getFolderInfo(folderPath: string, name: string): Promise<FolderInfo | null> {
    try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) return null;

        const bytes = await getFolderSize(folderPath);
        const fileCount = await getFileCount(folderPath);

        return { name, bytes, fileCount };
    } catch {
        return null;
    }
}

async function analyzeStorage(): Promise<StorageSummary> {
    const homeDir = os.homedir();
    const folders: FolderInfo[] = [];

    const foldersToScan = ['Downloads', 'Documents', 'Desktop', 'Pictures'];

    for (const folderName of foldersToScan) {
        const folderPath = path.join(homeDir, folderName);
        const info = await getFolderInfo(folderPath, folderName);
        if (info) {
            folders.push(info);
        }
    }

    // Get disk usage using df command
    let totalBytes = 0;
    let freeBytes = 0;

    try {
        // Run df -k on the home directory
        const { stdout } = await execAsync(`df -k "${homeDir}"`);

        // Output format check
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].trim().split(/\s+/);
            if (parts.length >= 4) {
                totalBytes = parseInt(parts[1], 10) * 1024;
                freeBytes = parseInt(parts[3], 10) * 1024;
            }
        }
    } catch (error) {
        console.error('Failed to get disk usage:', error);
        // Fallback for failed df command
        totalBytes = 1000 * 1024 * 1024 * 1024;
        freeBytes = 500 * 1024 * 1024 * 1024;
    }

    const freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : 0;

    return {
        folders,
        totalBytes,
        freeBytes,
        freePercent,
    };
}

async function analyzeSlowdown(): Promise<SlowdownSummary> {
    const homeDir = os.homedir();
    let startupAppsCount = 0;
    let heavyProcessCount = 0;
    const reasons: string[] = [];

    // Startup apps
    if (os.platform() === 'darwin') {
        const launchAgentsPath = path.join(homeDir, 'Library/LaunchAgents');
        try {
            const files = await fs.readdir(launchAgentsPath);
            startupAppsCount = files.filter(f => f.endsWith('.plist')).length;
        } catch {
            startupAppsCount = 0;
        }
    }

    // Heavy Processes (CPU > 50%)
    try {
        const { stdout } = await execAsync('ps -A -o %cpu');
        const processes = stdout.trim().split('\n').slice(1); // Skip header
        heavyProcessCount = processes.filter(p => parseFloat(p.trim()) > 50.0).length;

        if (heavyProcessCount > 0) {
            reasons.push(`${heavyProcessCount} heavy processes detected (>50% CPU)`);
        }
    } catch {
        // Ignore ps errors
    }

    return {
        startupAppsCount,
        heavyProcessCount,
        reasons,
    };
}

async function analyzePrivacy(): Promise<PrivacySummary> {
    const homeDir = os.homedir();

    // Real Browser cache locations for macOS
    const cachePaths = [
        path.join(homeDir, 'Library/Caches/Google/Chrome'),
        path.join(homeDir, 'Library/Caches/Firefox'),
        path.join(homeDir, 'Library/Caches/com.apple.Safari'),
        path.join(homeDir, 'Library/Caches/com.microsoft.Edge'),
    ];

    let browserCacheSizeBytes = 0;
    for (const cachePath of cachePaths) {
        // Use recursive folder size check
        browserCacheSizeBytes += await getFolderSize(cachePath);
    }

    // Downloads
    const downloadsPath = path.join(homeDir, 'Downloads');
    const downloadsFolderBytes = await getFolderSize(downloadsPath);

    // Temp Files (Logs)
    // macOS Logs path
    const logPath = path.join(homeDir, 'Library/Logs');
    const tempFilesBytes = await getFolderSize(logPath);

    return {
        browserCacheSizeBytes,
        downloadsFolderBytes,
        tempFilesBytes,
    };
}

function calculateHealthScore(
    storage: StorageSummary,
    slowdown: SlowdownSummary,
    privacy: PrivacySummary
): number {
    let score = 100;

    // Disk space penalty
    if (storage.freePercent < 10) score -= 30;
    else if (storage.freePercent < 20) score -= 15;
    else if (storage.freePercent < 30) score -= 5;

    // Startup apps penalty
    if (slowdown.startupAppsCount > 20) score -= 20;
    else if (slowdown.startupAppsCount > 10) score -= 10;
    else if (slowdown.startupAppsCount > 5) score -= 5;

    // Heavy process penalty
    if (slowdown.heavyProcessCount > 5) score -= 20;
    else if (slowdown.heavyProcessCount > 2) score -= 10;
    else if (slowdown.heavyProcessCount > 0) score -= 5;

    // Large downloads penalty
    const downloadsGB = privacy.downloadsFolderBytes / (1024 * 1024 * 1024);
    if (downloadsGB > 50) score -= 20; // Increased threshold
    else if (downloadsGB > 20) score -= 10;
    else if (downloadsGB > 5) score -= 5;

    // Cache junk penalty
    const cacheGB = privacy.browserCacheSizeBytes / (1024 * 1024 * 1024);
    if (cacheGB > 5) score -= 10;

    // Logs junk penalty
    const logsGB = privacy.tempFilesBytes / (1024 * 1024 * 1024);
    if (logsGB > 2) score -= 5;

    return Math.max(0, Math.min(100, score));
}

function generateOneLiner(score: number, storage: StorageSummary, slowdown: SlowdownSummary): string {
    if (score >= 90) {
        return 'PC is in excellent condition! 🎉';
    } else if (score >= 70) {
        return 'PC is doing well with minor cleanup opportunities.';
    } else if (score >= 50) {
        if (storage.freePercent < 20) {
            return 'Disk space is running low. Consider cleaning up.';
        }
        if (slowdown.heavyProcessCount > 0) {
            return 'High CPU usage detected. Check running apps.';
        }
        return 'Some optimization recommended for better performance.';
    } else {
        return 'PC needs attention. Multiple issues detected.';
    }
}

function generateRecommendations(
    storage: StorageSummary,
    slowdown: SlowdownSummary,
    privacy: PrivacySummary
): string[] {
    const recommendations: string[] = [];

    if (storage.freePercent < 20) {
        recommendations.push('Free up disk space by removing unused files');
    }

    const downloadsGB = privacy.downloadsFolderBytes / (1024 * 1024 * 1024);
    if (downloadsGB > 5) {
        recommendations.push(`Clean up Downloads folder (${(downloadsGB).toFixed(1)} GB)`);
    }

    if (slowdown.startupAppsCount > 10) {
        recommendations.push('Reduce startup apps for faster boot time');
    }

    if (slowdown.heavyProcessCount > 0) {
        recommendations.push(`Close ${slowdown.heavyProcessCount} resource-heavy processes`);
    }

    const cacheGB = privacy.browserCacheSizeBytes / (1024 * 1024 * 1024);
    if (cacheGB > 1) {
        recommendations.push(`Clear browser cache (${cacheGB.toFixed(1)} GB)`);
    }

    const logsMB = privacy.tempFilesBytes / (1024 * 1024);
    if (logsMB > 500) {
        recommendations.push(`Clear system logs (${logsMB.toFixed(0)} MB)`);
    }

    if (recommendations.length === 0) {
        recommendations.push('Your PC is well maintained! Keep it up.');
    }

    return recommendations;
}
