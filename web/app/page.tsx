import HomeAuthNav from '@/components/home-auth-nav';
import HomeDashboardLink from '@/components/home-dashboard-link';
import HomeStartButton from '@/components/home-start-button';

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 grid-pattern pointer-events-none z-0"></div>
            <div className="absolute inset-0 vignette pointer-events-none z-0"></div>

            {/* Header */}
            <header className="w-full p-6 flex justify-center items-center z-20">
                <div className="w-full max-w-screen-lg flex justify-between items-center">
                    <div className="text-xl font-bold tracking-tighter flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center text-black font-black text-lg">
                            P
                        </div>
                        <span className="text-white">pc-insight</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <HomeAuthNav />
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="flex-grow flex flex-col items-center justify-center relative px-4 py-20 z-10">
                <div className="max-w-5xl mx-auto text-center">
                    {/* Title */}
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
                        <span className="text-white">pc-insight </span>
                        <span className="text-yellow-500">AI Cloud</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        여러 대의 PC를 웹에서 통합 관리하고,<br className="hidden sm:block" />
                        원격으로 건강검진을 실행하세요.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
                        <HomeStartButton />
                        <HomeDashboardLink />
                    </div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
                        {/* Card 1: Multi Device */}
                        <div className="group relative p-8 rounded-2xl bg-gray-900/40 backdrop-blur-md border border-yellow-500/30 card-hover overflow-hidden">
                            <div className="icon-container mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-yellow-500 transition-colors">
                                멀티 디바이스
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                여러 대의 PC를 한 곳에서<br />관리하세요.
                            </p>
                        </div>

                        {/* Card 2: Remote Check */}
                        <div className="group relative p-8 rounded-2xl bg-gray-900/40 backdrop-blur-md border border-yellow-500/30 card-hover overflow-hidden">
                            <div className="icon-container mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-yellow-500 transition-colors">
                                원격 점검
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                웹에서 클릭 한 번으로 PC<br />건강검진을 실행하세요.
                            </p>
                        </div>

                        {/* Card 3: Privacy */}
                        <div className="group relative p-8 rounded-2xl bg-gray-900/40 backdrop-blur-md border border-yellow-500/30 card-hover overflow-hidden">
                            <div className="icon-container mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-yellow-500 transition-colors">
                                프라이버시
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                파일 내용은 절대 수집하지<br />않습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="w-full py-6 text-center text-gray-600 text-sm z-10">
                © 2026 pc-insight. All rights reserved.
            </footer>
        </main>
    );
}
