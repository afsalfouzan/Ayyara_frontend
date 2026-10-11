import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error occurred while loading this page.';
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description={message}
        action={<Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>}
      />
    </div>
  );
}
