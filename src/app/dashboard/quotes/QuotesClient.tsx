"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle, XCircle, Eye, Search, CalendarCheck, Ban } from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import type { QuoteStatus, QuoteType } from "@/types";
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS } from "@/types";

interface QuoteListItem {
  id: string;
  quoteNumber: string;
  status: string;
  type: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  createdAt: string;
  createdBy?: { name: string; team: string | null } | null;
  devDeadline?: string | null;
}

function getDday(deadline: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline + "T00:00:00");
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const FILTERS = [
  { value: "", label: "전체" },
  { value: "pending", label: "대기중" },
  { value: "reviewing", label: "검토중" },
  { value: "approved", label: "승인" },
  { value: "confirmed", label: "확정" },
  { value: "lost", label: "미진행" },
  { value: "rejected", label: "반려" },
];

export function QuotesClient({
  quotes,
  userRole,
  showPrice = true,
}: {
  quotes: QuoteListItem[];
  userRole: string;
  showPrice?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = quotes.filter((q) => {
    const matchFilter = !filter || q.status === filter;
    const matchSearch =
      !search ||
      q.eventName.toLowerCase().includes(search.toLowerCase()) ||
      q.requesterName.toLowerCase().includes(search.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const statusCounts = quotes.reduce(
    (acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {userRole === "dev" ? "견적 관리" : "내 견적 현황"}
        </h1>
      </div>

      {/* 상태 요약 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">대기중</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["pending"] || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-sm">검토중</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["reviewing"] || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">승인</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["approved"] || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CalendarCheck className="w-4 h-4" />
            <span className="text-sm">확정</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["confirmed"] || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Ban className="w-4 h-4" />
            <span className="text-sm">미진행</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["lost"] || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">반려</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{statusCounts["rejected"] || 0}</p>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-0.5 sm:gap-1 bg-white rounded-lg border p-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <label htmlFor="quote-search" className="sr-only">견적 검색</label>
          <input
            id="quote-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="행사명, 요청자, 견적번호 검색"
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-3">견적 요청이 없습니다</p>
            <a href="/request" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              + 새 견적 요청하기
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">견적번호</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">행사명</th>
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">유형</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">요청자</th>
                  {showPrice && <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">금액</th>}
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">상태</th>
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">요청일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => router.push(`/dashboard/quotes/${q.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/dashboard/quotes/${q.id}`); } }}
                    tabIndex={0}
                    role="link"
                    className="hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  >
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-mono">{q.quoteNumber}</td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium max-w-[120px] sm:max-w-none truncate">{q.eventName}</td>
                    <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        TYPE_COLORS[q.type as QuoteType] || "bg-gray-100 text-gray-700"
                      }`}>
                        {TYPE_LABELS[q.type as QuoteType] || q.type}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {q.requesterName}
                    </td>
                    {showPrice && (
                      <td className="px-3 sm:px-4 py-3 text-sm text-right font-medium hidden sm:table-cell">
                        {formatKRW(q.totalAmount)}원
                      </td>
                    )}
                    <td className="px-3 sm:px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[q.status as QuoteStatus]
                        }`}
                      >
                        {STATUS_LABELS[q.status as QuoteStatus]}
                      </span>
                      {q.status === "confirmed" && q.devDeadline && (() => {
                        const diff = getDday(q.devDeadline);
                        if (diff < 0) return <span className="ml-1 text-xs text-red-600 font-bold">{Math.abs(diff)}일 초과</span>;
                        if (diff === 0) return <span className="ml-1 text-xs text-red-600 font-bold">오늘</span>;
                        return <span className={`ml-1 text-xs font-bold ${diff <= 3 ? "text-red-600" : "text-amber-600"}`}>D-{diff}</span>;
                      })()}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 text-center hidden md:table-cell">
                      {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
