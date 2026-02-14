const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;
    const csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 http://localhost:8001 http://127.0.0.1:8001 https://api.openai.com https://api.z.ai",
    ].join('; ');

    /** @type {import('next').NextConfig} */
    const nextConfig = {
        // Keep dev/build outputs separate so `next build` cannot corrupt a running dev server.
        distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
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
