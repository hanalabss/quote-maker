import Link from "next/link";
import { FileText, Package } from "lucide-react";
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-lg">
              QuoteMaker
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard/quotes"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                견적 관리
              </Link>
              {isDev && (
                <Link
                  href="/dashboard/modules"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  모듈 관리
                </Link>
              )}
            </nav>
          </div>
          <Link
            href="/request"
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 새 견적 요청
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
