/**
 * Permission keys mirrored from the backend. The backend is the only authority:
 * these are used to shape the UI (hide nav items, disable actions), never to
 * grant access.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'products.view',
  'products.manage',
  'inventory.view',
  'inventory.adjust',
  'purchases.view',
  'purchases.create',
  'purchases.view_cost',
  'orders.view',
  'orders.update_fulfilment',
  'orders.create_offline',
  'customers.view',
  'customers.view_pii',
  'payments.view',
  'refunds.view',
  'refunds.create',
  'reports.view',
  'reports.view_financial',
  'reports.export',
  'notifications.manage',
  'users.manage',
  'audit.view',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
