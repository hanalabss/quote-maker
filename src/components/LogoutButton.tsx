"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition-colors"
    >
      <LogOut className="w-4 h-4" />
      로그아웃
    </button>
  );
}
