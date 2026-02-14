'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function HomeStartButton() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    useEffect(() => {
        const syncAuthState = async () => {
            const valid = await api.hasValidSession();
            setIsAuthenticated(valid);
        };
        syncAuthState();
        window.addEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
        window.addEventListener('focus', syncAuthState);
        return () => {
            window.removeEventListener('pcinsight-auth-changed', syncAuthState as EventListener);
            window.removeEventListener('focus', syncAuthState);
        };
    }, []);

    const handleClick = async () => {
        if (!isAuthenticated) {
            router.push('/signup');
            return;
        }
        setIsLogoutModalOpen(true);
    };

    const handleLogout = async () => {
        await api.logout();
        setIsLogoutModalOpen(false);
        router.push('/signup');
    };

    return (
        <>
            <button type="button" className="btn btn-primary" onClick={handleClick}>
                시작하기
            </button>

            {isLogoutModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all scale-100">
                        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                            로그아웃 확인
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                            현재 로그인된 세션을 종료하시겠습니까?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                onClick={() => setIsLogoutModalOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                                onClick={handleLogout}
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
