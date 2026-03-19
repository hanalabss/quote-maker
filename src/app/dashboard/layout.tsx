import { cookies } from "next/headers";
import { DashboardShell } from "./DashboardShell";
import { AuthProvider } from "@/components/AuthProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-user");
  let isDev = false;
  if (authCookie) {
    try {
      const user = JSON.parse(authCookie.value);
      isDev = user.role === "dev";
    } catch {}
  }

  return (
    <AuthProvider>
      <DashboardShell isDev={isDev}>{children}</DashboardShell>
    </AuthProvider>
  );
}
