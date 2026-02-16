const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

function toOrigin(url) {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

module.exports = (phase) => {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;
    const connectSrcSet = new Set([
        "'self'",
        'https://api.openai.com',
        'https://api.z.ai',
    ]);
    const envApiOrigin = toOrigin(process.env.NEXT_PUBLIC_API_BASE || '');
    if (envApiOrigin) {
        connectSrcSet.add(envApiOrigin);
    }
    if (isDev) {
        connectSrcSet.add('http://localhost:8000');
        connectSrcSet.add('http://127.0.0.1:8000');
        connectSrcSet.add('http://localhost:8001');
        connectSrcSet.add('http://127.0.0.1:8001');
    }
    const csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        `connect-src ${Array.from(connectSrcSet).join(' ')}`,
    ].join('; ');

    /** @type {import('next').NextConfig} */
    const nextConfig = {
        // Keep dev/build outputs separate so `next build` cannot corrupt a running dev server.
        distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
        // Keep more route chunks hot in dev to reduce intermittent ChunkLoadError during rapid navigation.
        onDemandEntries: isDev
            ? {
                maxInactiveAge: 10 * 60 * 1000,
                pagesBufferLength: 12,
            }
            : undefined,
        // Avoid dev chunk/HMR instability when switching between localhost and 127.0.0.1.
        allowedDevOrigins: ['localhost', '127.0.0.1'],
        env: {
            NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001',
            NEXT_PUBLIC_ENABLE_AI_COPILOT: process.env.NEXT_PUBLIC_ENABLE_AI_COPILOT || 'false',
            NEXT_PUBLIC_AI_PROVIDER: process.env.NEXT_PUBLIC_AI_PROVIDER || 'glm45',
        },
        async headers() {
            return [
                {
                    source: '/(.*)',
                    headers: [
                        { key: 'X-Frame-Options', value: 'DENY' },
                        { key: 'X-Content-Type-Options', value: 'nosniff' },
                        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                        { key: 'Content-Security-Policy', value: csp },
                    ],
                },
            ];
        },
    };

    return nextConfig;
};
