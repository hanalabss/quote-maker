"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Package, UserCircle } from "lucide-react";

export function DashboardShell({
  isDev,
  children,
}: {
  isDev: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navLinkClass = (href: string) => {
    const isActive = pathname.startsWith(href);
    return `flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
      isActive
        ? "bg-blue-50 text-blue-700 font-medium"
        : "hover:bg-gray-100 text-gray-700"
    }`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
      >
        본문으로 건너뛰기
      </a>
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Link href="/" className="font-bold text-base sm:text-lg shrink-0">
              QM
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1 flex-wrap" aria-label="주요 메뉴">
              <Link
                href="/dashboard/quotes"
                className={navLinkClass("/dashboard/quotes")}
                aria-current={pathname.startsWith("/dashboard/quotes") ? "page" : undefined}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                견적
              </Link>
              {isDev && (
                <Link
                  href="/dashboard/modules"
                  className={navLinkClass("/dashboard/modules")}
                  aria-current={pathname.startsWith("/dashboard/modules") ? "page" : undefined}
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
              aria-label="내 정보"
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
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
