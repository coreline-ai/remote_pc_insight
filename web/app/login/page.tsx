'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="card max-w-md w-full">
                <div className="card-header text-center">
                    <h1 className="text-2xl font-bold">로그인</h1>
                    <p className="text-slate-500 mt-1">pc-insight Cloud에 로그인하세요</p>
                </div>

                <form onSubmit={handleSubmit} className="card-body">
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
                </form>
            </div>
        </div>
    );
}
