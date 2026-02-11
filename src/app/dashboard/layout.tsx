import Link from "next/link";
import { FileText, Package, UserCircle } from "lucide-react";
import { cookies } from "next/headers";

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Link href="/" className="font-bold text-base sm:text-lg shrink-0">
              QM
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
              <Link
                href="/dashboard/quotes"
                className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                견적
              </Link>
              {isDev && (
                <Link
                  href="/dashboard/modules"
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  모듈
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href="/dashboard/profile"
              className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="내 정보"
            >
              <UserCircle className="w-5 h-5" />
            </Link>
            <Link
              href="/request"
              className="text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + <span className="hidden sm:inline">새 </span>견적 요청
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
