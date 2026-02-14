import {
    buildInstallScript,
    buildLinkCommand,
    buildOneLiner,
    scriptFileName,
} from '../lib/onboarding-commands';

describe('onboarding commands', () => {
    const token = 'enroll_test_token';

    it('keeps localhost http links backward-compatible (no extra flag)', () => {
        const command = buildLinkCommand(token, 'http://localhost:8001');
        expect(command).not.toContain('--allow-insecure-http');
    });

    it('does not add insecure flag for https links', () => {
        const command = buildLinkCommand(token, 'https://pcinsight.example.com');
        expect(command).not.toContain('--allow-insecure-http');
    });

    it('builds one-liner and script per os', () => {
        const linuxOneLiner = buildOneLiner('linux', token, 'http://127.0.0.1:8001');
        const windowsOneLiner = buildOneLiner('windows', token, 'http://127.0.0.1:8001');
        expect(linuxOneLiner).toContain('&&');
        expect(windowsOneLiner).toContain(';');

        const linuxScript = buildInstallScript('linux', token, 'http://127.0.0.1:8001');
        const windowsScript = buildInstallScript('windows', token, 'http://127.0.0.1:8001');
        expect(linuxScript).toContain('#!/usr/bin/env bash');
        expect(windowsScript).toContain('$ErrorActionPreference');
        expect(scriptFileName('linux')).toBe('pc-insight-onboarding.sh');
        expect(scriptFileName('windows')).toBe('pc-insight-onboarding.ps1');
    });
});
