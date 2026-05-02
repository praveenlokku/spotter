import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getUser, setUser, setTokens, clearToken, isLoggedIn } from '../lib/auth';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: UserInfo | null;
  loggedIn: boolean;
  login: (user: UserInfo, access: string, refresh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loggedIn: false,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserInfo | null>(getUser());

  const login = useCallback((userData: UserInfo, access: string, refresh: string) => {
    setTokens(access, refresh);
    setUser(userData);
    setUserState(userData);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loggedIn: !!user && isLoggedIn(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
