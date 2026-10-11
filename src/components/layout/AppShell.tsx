import { clsx } from 'clsx';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { navigation } from '@/app/navigation';
import { InstallButton, UpdatePrompt } from './AppUpdates';
import { BrandMark } from './BrandMark';
import { MobileDrawer } from './MobileDrawer';
import { SidebarNav } from './SidebarNav';
import { UserMenu } from './UserMenu';

const COLLAPSE_KEY = 'ayyara.admin.sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setDrawerOpen(false);
  }

  const pageTitle =
    location.pathname === '/account'
      ? 'Account & Security'
      : navigation.flatMap((g) => g.items).find((i) => (i.path === '/' ? location.pathname === '/' : location.pathname.startsWith(i.path)))?.label;

  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // ignore
      }
      return !value;
    });
  }

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#content" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out-soft lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <div className={clsx('flex h-16 items-center border-b border-border', collapsed ? 'justify-center' : 'px-5')}>
          <Link to="/" aria-label="Dashboard">
            <BrandMark collapsed={collapsed} />
          </Link>
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className={clsx('border-t border-border p-3', collapsed && 'flex justify-center')}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={clsx(
              'flex h-9 items-center gap-3 rounded-lg text-sm text-fg-muted hover:bg-surface-muted hover:text-fg',
              collapsed ? 'w-9 justify-center' : 'w-full px-3',
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1.5 grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <Link to="/" className="lg:hidden" aria-label="Dashboard">
            <BrandMark collapsed />
          </Link>
          {pageTitle && <p className="hidden text-base font-bold text-neutral-900 lg:block">{pageTitle}</p>}
          <div className="ml-auto flex items-center gap-2">
            <InstallButton />
            <UserMenu />
          </div>
        </header>

        <main id="content" className="mx-auto w-full max-w-8xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-6">
          <Outlet />
        </main>
        <UpdatePrompt />
      </div>
    </div>
  );
}
