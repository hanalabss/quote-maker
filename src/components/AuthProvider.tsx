"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthUser {
  id: string;
  loginId: string;
  name: string;
  role: string;
  team: string | null;
  position: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isDev: boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDev: false,
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function fetchUser() {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDev: user?.role === "dev", refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
