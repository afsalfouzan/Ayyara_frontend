import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** Shown to the owner only; no permission can open it for anyone else. */
  ownerOnly?: boolean;
  description: string;
  /** What the module will do, shown on its page until it is implemented. */
  capabilities: string[];
  phase: number;
};

export type NavGroup = { label: string; items: NavItem[] };

export const navigation: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        description: 'Sales, orders, stock and payment activity at a glance.',
        capabilities: [],
        phase: 6,
      },
    ],
  },
  {
    label: 'Catalog & stock',
    items: [
      {
        path: '/stock',
        label: 'Stock',
        icon: Boxes,
        permission: 'inventory.view',
        description: 'Perfumes, sizes, prices and quantity in the godown.',
        capabilities: [],
        phase: 3,
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        path: '/orders',
        label: 'Online Orders',
        icon: ReceiptText,
        permission: 'orders.view',
        description: 'Every online order with separate payment and fulfilment status.',
        capabilities: [
          'Search and filter by date, order number, customer and status',
          'Processing → packed → dispatched → delivered workflow',
          'Linked payments, refunds and stock movements',
          'Customer communication history',
        ],
        phase: 4,
      },
      {
        path: '/offline-orders',
        label: 'Offline Orders',
        icon: Store,
        permission: 'orders.view',
        description: 'Sales made in person or over the phone.',
        capabilities: [],
        phase: 4,
      },
      {
        path: '/customers',
        label: 'Customers',
        icon: Users,
        permission: 'customers.view',
        description: 'Customers and their order history.',
        capabilities: [
          'Searchable customer list',
          'Order history and totals',
          'Contact details shown only with the “view personal data” permission',
        ],
        phase: 4,
      },
      {
        path: '/payments',
        label: 'Payments & Transactions',
        icon: CreditCard,
        permission: 'payments.view',
        description: 'Razorpay transactions verified by signature and webhook.',
        capabilities: [
          'Transaction reference, order number, amount and method',
          'Pending, successful and failed payments',
          'Date-range filtering and authorised export',
        ],
        phase: 5,
      },
      {
        path: '/refunds',
        label: 'Refunds',
        icon: RotateCcw,
        permission: 'refunds.view',
        description: 'Refunds initiated through Razorpay and their verified status.',
        capabilities: [
          'Full or partial refunds with a reason',
          'Status confirmed from Razorpay, never assumed',
          'Retry-safe: duplicate requests are blocked',
        ],
        phase: 5,
      },
    ],
  },
  {
    label: 'Money',
    items: [
      {
        path: '/accounts',
        label: 'Accounts',
        icon: Landmark,
        permission: 'accounts.view',
        description: 'Bank and cash balances, with every rupee in and out.',
        capabilities: [],
        phase: 8,
      },
      {
        path: '/salaries',
        label: 'Salaries',
        icon: Wallet,
        permission: 'salaries.view',
        description: 'Staff salaries, advances and bonuses.',
        capabilities: [],
        phase: 8,
      },
      {
        path: '/profit',
        label: 'Profit & Investment',
        icon: TrendingUp,
        permission: 'accounts.view',
        ownerOnly: true,
        description: 'Daily profit, and how much of your investment it has earned back.',
        capabilities: [],
        phase: 9,
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        path: '/reports',
        label: 'Reports & Analytics',
        icon: BarChart3,
        permission: 'reports.view',
        description: 'Daily, weekly and monthly performance.',
        capabilities: [
          'Sales revenue and units by product',
          'Best sellers and order status breakdown',
          'Stock received vs. sold',
          'Cost and margin reports — owner / authorised users only',
        ],
        phase: 6,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        path: '/notifications',
        label: 'Notifications',
        icon: Bell,
        permission: 'notifications.manage',
        description: 'Customer emails and, later, WhatsApp messages.',
        capabilities: [
          'Order, payment, dispatch and refund email templates',
          'Delivery log for every message sent',
          'WhatsApp Business ready once a provider is configured',
        ],
        phase: 6,
      },
      {
        path: '/users',
        label: 'Users & Permissions',
        icon: ShieldCheck,
        permission: 'users.manage',
        description: 'Staff accounts, roles and page / action permissions.',
        capabilities: [
          'Create and deactivate staff accounts',
          'Roles with page-level and action-level permissions',
          'Restrict sensitive fields such as purchase cost and margins',
        ],
        phase: 2,
      },
      {
        path: '/audit-logs',
        label: 'Audit Logs',
        icon: ScrollText,
        permission: 'audit.view',
        description: 'Who did what, and when.',
        capabilities: [
          'Stock adjustments, refunds, permission changes and logins',
          'Before / after values for sensitive changes',
        ],
        phase: 2,
      },
      {
        path: '/settings',
        label: 'Settings',
        icon: Settings,
        permission: 'settings.manage',
        description: 'Store, payment and notification configuration.',
        capabilities: ['Store details and policies', 'Low-stock defaults', 'Notification senders'],
        phase: 6,
      },
    ],
  },
];

export const navItems = navigation.flatMap((group) => group.items);

export function findNavItem(path: string) {
  return navItems.find((item) => item.path === path);
}
