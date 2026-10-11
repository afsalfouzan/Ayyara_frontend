import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { FullScreenLoader, RequireAuth, RequirePermission } from '@/features/auth/guards';
import type { Permission } from '@/lib/permissions';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { navItems } from './navigation';

/** Modules with a real implementation; the rest show their roadmap page. */
const implemented: Record<string, () => Promise<{ default: ComponentType }>> = {
  '/': () => import('@/pages/DashboardPage'),
  '/users': () => import('@/pages/UsersPage'),
  '/audit-logs': () => import('@/pages/AuditLogsPage'),
  '/stock': () => import('@/pages/StockPage'),
  '/orders': () => import('@/pages/OrdersPage'),
  '/customers': () => import('@/pages/CustomersPage'),
  '/offline-orders': () => import('@/pages/OfflineOrdersPage'),
  '/payments': () => import('@/pages/PaymentsPage'),
  '/refunds': () => import('@/pages/RefundsPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/reports': () => import('@/pages/ReportsPage'),
  '/notifications': () => import('@/pages/NotificationsPage'),
};


function guarded(permission: Permission, load: () => Promise<{ default: ComponentType }>): RouteObject['lazy'] {
  return async () => {
    const { default: Page } = await load();
    return {
      Component: () => (
        <RequirePermission permission={permission}>
          <Page />
        </RequirePermission>
      ),
    };
  };
}

const moduleRoutes: RouteObject[] = navItems.map((item) => {
  const load = implemented[item.path] ?? (() => import('@/pages/ModulePage'));
  const lazy = guarded(item.permission, load);
  return item.path === '/' ? { index: true, lazy } : { path: item.path.slice(1), lazy };
});

export const router = createBrowserRouter([
  {
    path: '/login',
    hydrateFallbackElement: <FullScreenLoader />,
    lazy: async () => ({ Component: (await import('@/pages/LoginPage')).default }),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/set-password',
    hydrateFallbackElement: <FullScreenLoader />,
    lazy: async () => ({ Component: (await import('@/pages/SetPasswordPage')).default }),
    errorElement: <RouteErrorPage />,
  },
  {
    element: <RequireAuth />,
    hydrateFallbackElement: <FullScreenLoader />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          ...moduleRoutes,
          { path: 'account', lazy: async () => ({ Component: (await import('@/pages/AccountPage')).default }) },
          { path: '*', lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).default }) },
        ],
      },
    ],
  },
]);
