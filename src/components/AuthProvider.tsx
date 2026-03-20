"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
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
  isDev: boolean;        // dev (관리자)만
  isDevTeam: boolean;    // dev + dev_staff (개발팀 전체)
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDev: false,
  isDevTeam: false,
  refresh: () => {},
});

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!initialUser);

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
    // 초기값이 있으면 API 호출 불필요
    if (initialUser) return;
    fetchUser();
  }, [initialUser]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isDev: user?.role === "dev",
      isDevTeam: user?.role === "dev" || user?.role === "dev_staff",
      refresh: fetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
