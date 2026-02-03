import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-2xl">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 pb-2 leading-tight bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                    pc-insight Cloud
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
                    여러 대의 PC를 웹에서 통합 관리하고, 원격으로 건강검진을 실행하세요.
                </p>

                <div className="flex gap-4 justify-center mb-12">
                    <Link href="/login" className="btn btn-primary">
                        시작하기
                    </Link>
                    <Link href="/devices" className="btn btn-secondary">
                        대시보드
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <div className="card p-6">
                        <div className="text-3xl mb-3">🖥️</div>
                        <h3 className="font-semibold text-lg mb-2">멀티 디바이스</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            여러 대의 PC를 한 곳에서 관리하세요.
                        </p>
                    </div>

                    <div className="card p-6">
                        <div className="text-3xl mb-3">📡</div>
                        <h3 className="font-semibold text-lg mb-2">원격 점검</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            웹에서 클릭 한 번으로 PC 건강검진을 실행하세요.
                        </p>
                    </div>

                    <div className="card p-6">
                        <div className="text-3xl mb-3">🔒</div>
                        <h3 className="font-semibold text-lg mb-2">프라이버시</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            파일 내용은 절대 수집하지 않습니다.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
