import { NavLink } from 'react-router-dom';
import { UtensilsCrossed, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { navGroups } from './navConfig';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { hasPermission, hasRole } = useAuth();

  const content = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold text-white">Restaurant Stock</span>
        <button onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = group.items.filter(
            (item) => (!item.permission || hasPermission(item.permission)) && (!item.roles || hasRole(...item.roles)),
          );
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.title}</p>
              <div className="mt-2 space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">{content}</aside>
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-64">{content}</div>
        </div>
      )}
    </>
  );
}
