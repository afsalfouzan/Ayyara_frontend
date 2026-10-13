import { clsx } from 'clsx';
import { NavLink } from 'react-router';
import { navigation } from '@/app/navigation';
import { useSession } from '@/features/auth/session';

/** Navigation list shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { can, user } = useSession();

  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
      {navigation.map((group) => {
        // Hiding items is a convenience only — every page and API call is permission-checked server-side.
        const items = group.items.filter((item) => (item.ownerOnly ? Boolean(user?.isOwner) : can(item.permission)));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mb-5 last:mb-0">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-[10px] font-bold tracking-wider text-gray-400 uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ path, label, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end={path === '/'}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'group flex h-10 items-center gap-3 rounded-xl text-[13px] font-semibold transition-colors',
                        collapsed ? 'justify-center px-0' : 'px-3',
                        isActive
                          ? 'bg-neutral-900 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-neutral-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={clsx('size-4 shrink-0', isActive ? 'text-white' : 'text-gray-500 group-hover:text-neutral-900')} strokeWidth={1.75} aria-hidden />
                        <span className={clsx('truncate', collapsed && 'sr-only')}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
