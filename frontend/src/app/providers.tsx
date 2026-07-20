import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </HelmetProvider>
  );
}
