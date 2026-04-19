import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as apiSvc from '../services/api';
import type { User } from '../types';
import { connectSocket, disconnectSocket } from '../services/socket';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem('chat_token');
    if (!t) {
      setUser(null);
      return;
    }
    apiSvc.setAuthToken(t);
    const me = await apiSvc.fetchMe();
    setUser(me);
    connectSocket(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = localStorage.getItem('chat_token');
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        apiSvc.setAuthToken(t);
        const me = await apiSvc.fetchMe();
        if (!cancelled) {
          setUser(me);
          connectSocket(t);
        }
      } catch {
        apiSvc.setAuthToken(null);
        disconnectSocket();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiSvc.login({ email, password });
    apiSvc.setAuthToken(res.token);
    setUser(res.user);
    connectSocket(res.token);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await apiSvc.register({ email, name, password });
    apiSvc.setAuthToken(res.token);
    setUser(res.user);
    connectSocket(res.token);
  }, []);

  const logout = useCallback(() => {
    apiSvc.setAuthToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth outside provider');
  }
  return ctx;
}
