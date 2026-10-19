import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearCookie, loadCookie } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await loadCookie();
      try {
        const me = await api('/api/me');
        setUser(me.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback((nextUser) => setUser(nextUser), []);

  const refresh = useCallback(async () => {
    try {
      const me = await api('/api/me');
      setUser(me.user);
      return me.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch {
      // ignore logout errors
    }
    await clearCookie();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
