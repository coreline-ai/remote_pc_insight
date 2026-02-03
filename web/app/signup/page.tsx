'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            setLoading(false);
            return;
        }

        try {
            await api.register(email, password);
            router.push('/login?registered=true');
        } catch (err: any) {
            setError(err.message || '회원가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="card max-w-md w-full">
                <div className="card-header text-center">
                    <h1 className="text-2xl font-bold">회원가입</h1>
                    <p className="text-slate-500 mt-1">pc-insight Cloud 계정을 생성하세요</p>
                </div>

                <form className="card-body" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">이메일</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">비밀번호</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">비밀번호 확인</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn btn-primary mt-6"
                    >
                        {loading ? '가입 중...' : '회원가입'}
                    </button>

                    <p className="text-center text-sm text-slate-500 mt-4">
                        이미 계정이 있으신가요?{' '}
                        <Link href="/login" className="text-primary-600 hover:underline">
                            로그인
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
