import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageSpinner } from '@/components/ui/Spinner';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, wasJustLoggedOut, acknowledgeLoggedOut } = useAuth();
  const location = useLocation();

  // Acknowledging (not just reading) must happen in an effect, not during render - StrictMode
  // invokes the render body twice, and a read-then-clear inside render would only see the flag
  // on the first pass, letting the second (the one that actually commits) fall through.
  useEffect(() => {
    if (!isAuthenticated) acknowledgeLoggedOut();
  }, [isAuthenticated, acknowledgeLoggedOut]);

  if (isLoading) return <PageSpinner />;

  if (!isAuthenticated) {
    // An intentional logout shouldn't remember the page you logged out from -
    // only a genuine deep-link-while-signed-out should send you back after login.
    const state = wasJustLoggedOut() ? undefined : { from: location };
    return <Navigate to="/login" state={state} replace />;
  }

  return <Outlet />;
}
