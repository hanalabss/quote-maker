import Link from "next/link";
import { cookies } from "next/headers";
import { FileText, ClipboardList, DollarSign, Settings } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

interface AuthUser {
  id: string;
  name: string;
  role: string;
  team: string | null;
  position: string | null;
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth-user");
  let user: AuthUser | null = null;
  if (authCookie) {
    try {
      user = JSON.parse(authCookie.value);
    } catch {}
  }

  const isDev = user?.role === "dev";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* 사용자 정보 + 로그아웃 */}
        {user && (
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{user.name}</span>
                {user.position && <span className="text-gray-400"> {user.position}</span>}
                {user.team && <span className="text-gray-400"> · {user.team}</span>}
              </span>
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Settings className="w-4 h-4" />
                정보 수정
              </Link>
              <LogoutButton />
            </div>
          </div>
        )}

        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3">QuoteMaker</h1>
          <p className="text-sm sm:text-lg text-gray-500">하나플랫폼 견적서 자동화 시스템</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <Link
            href="/request"
            className="group block p-5 sm:p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">견적 요청</h2>
            <p className="text-gray-500">
              행사/렌탈 정보를 입력하면 견적서가 자동 생성됩니다
            </p>
          </Link>

          <Link
            href="/dashboard/quotes"
            className="group block p-5 sm:p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {isDev ? "견적 관리" : "내 견적 현황"}
            </h2>
            <p className="text-gray-500">
              {isDev
                ? "견적 요청을 검토하고 승인/수정합니다"
                : "내가 신청한 견적서의 상태를 확인합니다"}
            </p>
          </Link>

          <Link
            href="/dashboard/modules"
            className="group block p-5 sm:p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {isDev ? "단가표 관리" : "단가표 보기"}
            </h2>
            <p className="text-gray-500">
              {isDev
                ? "모듈 단가를 확인하고 순서를 관리합니다"
                : "모듈별 기본 단가를 확인합니다"}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
