import { Command } from 'commander';
import { analyzer } from '../core/analyzer/index.js';

export const runCommand = new Command('run')
    .description('Run local analysis manually')
    .argument('[profile]', 'Analysis profile', 'full')
    .option('--no-upload', 'Skip uploading results')
    .action(async (profile: string, options: { upload: boolean }) => {
        console.log(`🔍 Running ${profile} analysis...`);

        try {
            const report = await analyzer.run(profile);
            console.log('');
            console.log('📊 Analysis Results:');
            console.log(`   Health Score: ${report.healthScore}/100`);
            console.log(`   Disk Free: ${report.diskFreePercent}%`);
            console.log(`   Startup Apps: ${report.startupAppsCount}`);
            console.log(`   Summary: ${report.oneLiner}`);

            if (options.upload) {
                console.log('');
                console.log('📤 Report saved locally (use "pc-insight agent" for upload)');
            }
        } catch (error) {
            console.error('❌ Analysis failed:', (error as Error).message);
            process.exit(1);
        }
    });
