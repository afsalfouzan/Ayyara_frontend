import { Construction } from 'lucide-react';
import { useLocation } from 'react-router';
import { findNavItem } from '@/app/navigation';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import NotFoundPage from './NotFoundPage';

/**
 * Placeholder for modules not yet implemented. Shows what the module will do and
 * in which phase — no fake data or non-functional controls.
 */
export default function ModulePage() {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  if (!item) return <NotFoundPage />;
  const Icon = item.icon;

  return (
    <div className="space-y-6">
      <PageHeader title={item.label} description={item.description} />
      <Panel>
        <PanelHeader title="Coming in this module" actions={<Badge tone="info">Phase {item.phase}</Badge>} />
        <div className="grid gap-8 p-5 md:grid-cols-[1fr_16rem] md:p-6">
          <ul className="space-y-3">
            {item.capabilities.map((capability) => (
              <li key={capability} className="flex gap-3 text-sm text-fg">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {capability}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-muted p-6 text-center">
            <Icon className="size-6 text-fg-subtle" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm font-medium text-fg">Not yet connected</p>
            <p className="mt-1 text-xs text-fg-muted">This page will show live data once the module is built.</p>
          </div>
        </div>
      </Panel>
      <span className="sr-only">
        <Construction aria-hidden /> Module under construction
      </span>
    </div>
  );
}
