'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function HomeDashboardLink() {
    // Keep initial render deterministic between server and client.
    const [href, setHref] = useState('/login');

    useEffect(() => {
        const syncAuthState = async () => {
            const valid = await api.hasValidSession();
            setHref(valid ? '/devices' : '/login');
        };
        syncAuthState();
        window.addEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
        window.addEventListener('focus', syncAuthState);
        return () => {
            window.removeEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
            window.removeEventListener('focus', syncAuthState);
        };
    }, []);

    return (
        <Link href={href} className="btn btn-secondary">
            대시보드
        </Link>
    );
}
