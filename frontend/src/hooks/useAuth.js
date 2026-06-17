import { useState, useEffect, useCallback } from 'react';
import api, { tokenStore } from '../services/api';

/**
 * Authentication hook — manages the current user session.
 * On mount, if tokens exist it loads the profile via /auth/me.
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (!tokenStore.getAccess()) {
        setInitializing(false);
        return;
      }
      try {
        const profile = await api.me();
        if (active) setUser(profile);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setInitializing(false);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password) => {
    const data = await api.signup({ email, password });
    tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // ignore network errors on logout
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  return { user, initializing, login, signup, logout };
};

export default useAuth;
