import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { toast } from '@/components/ui/Toast';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { useSession } from '@/features/auth/session';
import { DeviceAlerts } from '@/features/push/DeviceAlerts';

export default function AccountPage() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Account & security" description="Your profile and sign-in settings." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Profile" />
          <dl className="space-y-4 p-5 text-sm">
            <div>
              <dt className="text-fg-subtle">Name</dt>
              <dd className="mt-0.5 text-fg">{user.name}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Email</dt>
              <dd className="mt-0.5 text-fg">{user.email}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Role</dt>
              <dd className="mt-1">
                <Badge tone={user.isOwner ? 'info' : 'neutral'}>{user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Access</dt>
              <dd className="mt-0.5 text-fg">{user.isOwner ? 'Full access to every module' : `${user.permissions.length} permissions`}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Change password" />
          <div className="p-5">
            <ChangePasswordForm onSuccess={() => toast('Password updated. Other devices have been signed out.')} />
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Alerts" />
          <DeviceAlerts />
        </Panel>
      </div>
    </div>
  );
}
