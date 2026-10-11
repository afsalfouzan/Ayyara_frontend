import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';

export function ForbiddenPage() {
  return (
    <Panel>
      <EmptyState
        icon={ShieldAlert}
        title="You don’t have access to this page"
        description="Ask the owner or an administrator to grant you permission if you need it."
        action={
          <Link to="/" className={buttonClasses({ variant: 'secondary' })}>
            Back to dashboard
          </Link>
        }
      />
    </Panel>
  );
}
