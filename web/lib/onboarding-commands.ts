export type OnboardingOS = 'macos' | 'windows' | 'linux';

export function buildLinkCommand(token: string, serverUrl: string): string {
    // Keep generated commands compatible with old CLI versions that don't support
    // '--allow-insecure-http'. localhost HTTP works without the flag.
    return `pc-insight link ${token} --server ${serverUrl}`;
}

export function buildOneLiner(os: OnboardingOS, token: string, serverUrl: string): string {
    const link = buildLinkCommand(token, serverUrl);
    if (os === 'windows') {
        return `$cmd = Get-Command pc-insight -ErrorAction SilentlyContinue; if (-not $cmd) { npm install -g pc-insight-agent }; ${link}; pc-insight agent --daemon`;
    }
    return `(command -v pc-insight >/dev/null 2>&1 || npm install -g pc-insight-agent) && ${link} && pc-insight agent --daemon`;
}

export function buildInstallScript(os: OnboardingOS, token: string, serverUrl: string): string {
    const link = buildLinkCommand(token, serverUrl);

    if (os === 'windows') {
        return [
            '$ErrorActionPreference = "Stop"',
            '',
            'Write-Host "[0/3] Checking Node.js/npm..."',
            'node -v',
            'npm -v',
            '',
            'Write-Host "[1/3] Ensuring pc-insight command is available..."',
            '$cmd = Get-Command pc-insight -ErrorAction SilentlyContinue',
            'if (-not $cmd) {',
            '  try {',
            '    npm install -g pc-insight-agent',
            '  } catch {',
            '    Write-Host "[ERROR] npm global install failed. fallback guide:" -ForegroundColor Yellow',
            '    Write-Host "  cd <remote_pc_insight>/agent"',
            '    Write-Host "  npm install"',
            '    Write-Host "  npm run build"',
            '    Write-Host "  npm link"',
            '    throw',
            '  }',
            '}',
            '',
            'Write-Host "[2/3] Linking device..."',
            link,
            '',
            'Write-Host "[3/3] Starting agent..."',
            'pc-insight agent --daemon',
            '',
            'Write-Host "Done. Agent is running in background."',
        ].join('\n');
    }

    return [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '',
        'echo "[0/3] Checking Node.js/npm..."',
        'if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then',
        '  echo "[ERROR] Node.js/npm not found. Install Node.js LTS first."',
        '  exit 1',
        'fi',
        'node -v',
        'npm -v',
        '',
        'echo "[1/3] Ensuring pc-insight command is available..."',
        'if ! command -v pc-insight >/dev/null 2>&1; then',
        '  if ! npm install -g pc-insight-agent; then',
        '    echo "[ERROR] npm global install failed. fallback guide:"',
        '    echo "  cd <remote_pc_insight>/agent"',
        '    echo "  npm install"',
        '    echo "  npm run build"',
        '    echo "  npm link"',
        '    exit 1',
        '  fi',
        'fi',
        '',
        'echo "[2/3] Linking device..."',
        link,
        '',
        'echo "[3/3] Starting agent..."',
        'pc-insight agent --daemon',
        '',
        'echo "Done. Agent is running in background."',
    ].join('\n');
}

export function scriptFileName(os: OnboardingOS): string {
    if (os === 'windows') return 'pc-insight-onboarding.ps1';
    return 'pc-insight-onboarding.sh';
}
