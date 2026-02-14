'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function HomeAuthNav() {
    const router = useRouter();
    // Keep initial render deterministic between server and client.
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        const syncAuthState = async () => {
            try {
                const me = await api.getMe();
                setIsAuthenticated(true);
                setEmail(me.email);
            } catch {
                setIsAuthenticated(false);
                setEmail(null);
            }
        };
        syncAuthState();
        window.addEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
        window.addEventListener('focus', syncAuthState);
        return () => {
            window.removeEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
            window.removeEventListener('focus', syncAuthState);
        };
    }, []);

    const handleLogout = async () => {
        await api.logout();
        setIsAuthenticated(false);
        setEmail(null);
        router.push('/login');
    };

    if (!isAuthenticated) {
        return (
            <Link href="/login" className="text-gray-400 hover:text-yellow-500 transition-colors">
                로그인
            </Link>
        );
    }

    return (
        <>
            {email && (
                <span className="text-sm text-gray-400">{email}</span>
            )}
            <Link href="/devices" className="text-gray-300 hover:text-yellow-500 transition-colors">
                대시보드
            </Link>
            <button
                type="button"
                onClick={handleLogout}
                className="text-gray-400 hover:text-yellow-500 transition-colors"
            >
                로그아웃
            </button>
        </>
    );
}
