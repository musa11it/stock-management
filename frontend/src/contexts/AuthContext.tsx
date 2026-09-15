import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tokenStorage } from '@/lib/apiClient';
import * as authService from '@/services/auth.service';
import type { AuthUser } from '@/types';

const AUTH_STORAGE_KEY = 'rsm_auth_snapshot';

interface AuthSnapshot {
  user: AuthUser;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string[]>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
  /**
   * True right after an intentional logout() call, until ProtectedRoute acknowledges it via
   * acknowledgeLoggedOut(). Lets ProtectedRoute skip capturing "from" for a logout-triggered
   * redirect - without this, a <Navigate> effect can race a manual post-logout navigate() and
   * win, sending the next person who logs in (possibly a lower-privileged user) back to the
   * page you were just on. Read-only during render (safe under StrictMode's double-render);
   * only acknowledgeLoggedOut() mutates it, and that must be called from an effect, not render.
   */
  wasJustLoggedOut: () => boolean;
  acknowledgeLoggedOut: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSnapshot(): AuthSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSnapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: AuthSnapshot | null) {
  if (snapshot) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(snapshot));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSnapshot()?.user ?? null);
  const [permissions, setPermissions] = useState<string[]>(() => readSnapshot()?.permissions ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const justLoggedOutRef = useRef(false);

  useEffect(() => {
    async function hydrate() {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authService.fetchMe();
        setUser(me);
        setIsLoading(false);
      } catch {
        tokenStorage.clear();
        writeSnapshot(null);
        setUser(null);
        setPermissions([]);
        setIsLoading(false);
      }
    }
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    setPermissions(result.permissions);
    writeSnapshot({ user: result.user, permissions: result.permissions });
    return result.permissions;
  }, []);

  const logout = useCallback(() => {
    justLoggedOutRef.current = true;
    // Fire the server-side logout call while the access token is still attached,
    // then clear local state - otherwise it goes out unauthenticated and 401s.
    void authService.logout().catch(() => undefined);
    tokenStorage.clear();
    writeSnapshot(null);
    setUser(null);
    setPermissions([]);
  }, []);

  const wasJustLoggedOut = useCallback(() => justLoggedOutRef.current, []);
  const acknowledgeLoggedOut = useCallback(() => {
    justLoggedOutRef.current = false;
  }, []);

  const hasPermission = useCallback(
    (permission: string) => permissions.includes('*') || permissions.includes(permission),
    [permissions],
  );

  const hasRole = useCallback((...roles: string[]) => !!user && (user.role.name === 'SUPER_ADMIN' || roles.includes(user.role.name)), [user]);

  const value = useMemo(
    () => ({ user, permissions, isAuthenticated: !!user, isLoading, login, logout, hasPermission, hasRole, wasJustLoggedOut, acknowledgeLoggedOut }),
    [user, permissions, isLoading, login, logout, hasPermission, hasRole, wasJustLoggedOut, acknowledgeLoggedOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
