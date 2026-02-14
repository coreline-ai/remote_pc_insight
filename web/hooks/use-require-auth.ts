'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function useRequireAuth() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const syncAuthState = async () => {
            try {
                const valid = await api.hasValidSession();
                if (cancelled) return;
                setIsAuthenticated(valid);
                setIsChecking(false);
                if (!valid) {
                    router.replace('/login');
                }
            } catch {
                if (cancelled) return;
                setIsAuthenticated(false);
                setIsChecking(false);
                router.replace('/login');
            }
        };
        syncAuthState();
        window.addEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
        window.addEventListener('focus', syncAuthState);
        return () => {
            cancelled = true;
            window.removeEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
            window.removeEventListener('focus', syncAuthState);
        };
    }, [router]);

    return { isAuthenticated, isChecking };
}
