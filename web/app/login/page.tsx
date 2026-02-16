'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const devTestEmail = 'test@test.com';
    const devTestPassword = 'Test@PcInsight2026!';
    const isDev = process.env.NODE_ENV === 'development';
    const [email, setEmail] = useState(isDev ? devTestEmail : '');
    const [password, setPassword] = useState(isDev ? devTestPassword : '');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [registeredNotice, setRegisteredNotice] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('registered') === 'true') {
            setRegisteredNotice('회원가입이 완료되었습니다. 로그인해 주세요.');
        } else {
            setRegisteredNotice('');
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const checkSession = async () => {
            const valid = await api.hasValidSession();
            if (!cancelled && valid) {
                router.replace('/devices');
            }
        };
        checkSession();
        return () => {
            cancelled = true;
        };
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await api.login(email, password);
            router.push('/devices');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDevQuickLogin = async () => {
        if (!isDev) return;
        setError('');
        setIsLoading(true);
        try {
            await api.login(devTestEmail, devTestPassword);
            router.push('/devices');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="card max-w-md w-full overflow-hidden">
                <div className="px-8 pt-8 pb-5 text-center border-b border-yellow-500/20">
                    <h1 className="text-2xl font-bold">로그인</h1>
                    <p className="text-slate-500 mt-1">pc-insight AI Cloud에 로그인하세요</p>
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-6">
                    {isDev && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-3 rounded-lg mb-4 text-sm">
                            <p className="font-semibold mb-1">개발용 테스트 계정</p>
                            <p>ID: {devTestEmail}</p>
                            <p>PW: {devTestPassword}</p>
                            <button
                                type="button"
                                onClick={handleDevQuickLogin}
                                disabled={isLoading}
                                className="btn btn-secondary mt-2 text-xs px-3 py-1"
                            >
                                테스트 계정으로 바로 로그인
                            </button>
                        </div>
                    )}
                    {registeredNotice && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg mb-4">
                            {registeredNotice}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full btn btn-primary"
                        disabled={isLoading}
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </button>

                    <p className="text-center text-sm text-slate-500 mt-4">
                        계정이 없으신가요?{' '}
                        <Link href="/signup" className="text-primary-600 hover:underline">
                            회원가입
                        </Link>
                    </p>

                    <Link href="/" className="w-full btn btn-secondary mt-4 text-center block">
                        홈으로 가기
                    </Link>
                </form>
            </div>
        </div>
    );
}
