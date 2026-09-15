import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface PermissionRouteProps {
  permission?: string;
  roles?: string[];
}

export function PermissionRoute({ permission, roles }: PermissionRouteProps) {
  const { hasPermission, hasRole } = useAuth();

  const allowed = (!permission || hasPermission(permission)) && (!roles || roles.length === 0 || hasRole(...roles));

  if (!allowed) return <Navigate to="/403" replace />;

  return <Outlet />;
}
