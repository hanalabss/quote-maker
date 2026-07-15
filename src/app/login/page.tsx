"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("saved-login-id");
    if (saved) {
      setLoginId(saved);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "로그인에 실패했습니다");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("saved-login-id", loginId);
      } else {
        localStorage.removeItem("saved-login-id");
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-7">
          <span className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[14px] bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-600/25 mb-3">
            QM
          </span>
          <h1 className="text-2xl font-bold tracking-tight">QuoteMaker</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">하나플랫폼 견적서 자동화 시스템</p>
          {/* 파이프라인 도트: 견적 생애주기 5단계 모티프 */}
          <span className="inline-flex gap-[5px] mt-3" aria-hidden="true">
            <i className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <i className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <i className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <i className="w-1.5 h-1.5 rounded-full bg-blue-100" />
            <i className="w-1.5 h-1.5 rounded-full bg-blue-100" />
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-6 sm:p-7 space-y-4"
        >
          <div>
            <label htmlFor="loginId" className="block text-sm font-medium text-gray-700 mb-1.5">
              아이디
            </label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-[10px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                className="w-full pl-4 pr-11 py-3 border border-gray-300 rounded-[10px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg" role="alert">
              {error}
            </p>
          )}

          <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">아이디 저장</span>
          </label>

          <button
            type="submit"
            disabled={loading || !loginId || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-[10px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; 2026 (주)하나플랫폼 · 계정 문의는 개발팀으로
        </p>
      </div>
    </div>
  );
}
