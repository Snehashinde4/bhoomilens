import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { NAV_GROUPS, NAV_ITEMS } from '@/config/navigation';
import { hasPermission } from '@/auth/roles';
import { useAppStore } from '@/store/appStore';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const role = useAppStore((s) => s.role);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col bg-ink text-paper transition-[width] duration-200 no-print',
        collapsed ? 'w-[62px]' : 'w-[232px]',
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal text-sm font-bold text-white">
          BL
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-[15px] font-semibold leading-none text-white">BhoomiLens</p>
            <p className="truncate text-[10px] text-paper/60">Land Governance Intelligence</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-2 py-2" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter(
            (i) => i.group === group && hasPermission(role, i.permission),
          );
          if (!items.length) return null;
          return (
            <div key={group} className="mb-3">
              {!collapsed && (
                <p className="px-3 pb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-paper/40">
                  {group}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      title={collapsed ? item.label : item.description}
                      className={({ isActive }) =>
                        cn('nav-link', isActive && 'nav-link-active', collapsed && 'justify-center px-0')
                      }
                    >
                      <span aria-hidden className="text-[15px] leading-none">
                        {item.icon}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="border-t border-white/10 px-3 py-2 text-left text-[11px] text-paper/70 hover:bg-white/10 hover:text-white"
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? '»' : '« Collapse'}
      </button>
    </aside>
  );
}
