import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'pc-insight AI Cloud',
    description: 'Multi-device PC health management dashboard',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <body className={`${inter.className} app-body`}>
                <div className="app-shell">
                    <Providers>{children}</Providers>
                </div>
            </body>
        </html>
    );
}
