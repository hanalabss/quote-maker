import { cookies } from "next/headers";
import { DashboardShell } from "./DashboardShell";
import { AuthProvider } from "@/components/AuthProvider";
import type { AuthUser } from "@/components/AuthProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-user");
  let initialUser: AuthUser | null = null;
  if (authCookie) {
    try {
      initialUser = JSON.parse(authCookie.value);
    } catch {}
  }

  const isDev = initialUser?.role === "dev";

  return (
    <AuthProvider initialUser={initialUser}>
      <DashboardShell isDev={isDev ?? false}>{children}</DashboardShell>
    </AuthProvider>
  );
}
