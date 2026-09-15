import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface CanProps {
  permission?: string;
  roles?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** Gates rendering by permission and/or role. Backend authorization is still the source of truth. */
export function Can({ permission, roles, children, fallback = null }: CanProps) {
  const { hasPermission, hasRole } = useAuth();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (roles && roles.length > 0 && !hasRole(...roles)) return <>{fallback}</>;

  return <>{children}</>;
}
