import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, LogOut, UserCircle, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  RETAIL_USER: 'Customer',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    // Navigate explicitly (with no "from" state) so a stale, permission-gated
    // location isn't captured for the next login redirect.
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button onClick={onMenuClick} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-slate-800">
              {user?.firstName} {user?.lastName}
            </p>
            <Badge tone="blue" className="mt-0.5">
              {roleLabel[user?.role.name ?? ''] ?? user?.role.name}
            </Badge>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserCircle className="h-4 w-4" /> Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
