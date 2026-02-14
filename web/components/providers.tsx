'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    useEffect(() => {
        const handleAuthChanged = () => {
            // Prevent cross-account stale data (e.g., previous user's profile/device cache).
            queryClient.clear();
        };

        window.addEventListener('pcinsight-auth-changed', handleAuthChanged as EventListener);
        return () => {
            window.removeEventListener('pcinsight-auth-changed', handleAuthChanged as EventListener);
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
