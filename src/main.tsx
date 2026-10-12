import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { z } from 'zod';
import { router } from './app/router';
import { Toaster } from './components/ui/Toast';
import { sessionQueryKey } from './features/auth/session';
import './index.css';
import { ApiError } from './lib/api';

// Zod speeds itself up by generating code at runtime, which the security policy
// (script-src 'self', see vercel.json) forbids and reports. Forms here are small.
z.config({ jitless: true });

// Any 401 means the session ended (expired, revoked or user deactivated):
// clear cached data and let the auth guard send the user to the login screen.
function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.clear();
    queryClient.setQueryData(sessionQueryKey, null);
  }
  if (error instanceof ApiError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
    void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== sessionQueryKey[0]) handleAuthError(error);
    },
  }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Never retry auth / permission / validation failures.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
