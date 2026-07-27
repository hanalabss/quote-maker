"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, AlertCircle, Clock, CheckCheck } from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import type { QuoteStatus, QuoteType } from "@/types";
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS } from "@/types";
import { getLifecycleBadge, todayStr, type LifecycleBadge } from "@/lib/lifecycle";

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
  devCompletedAt?: string | null;
  confirmedDate?: string | null;
  confirmedEndDate?: string | null;
  eventEndDate?: string | null;
  isExternal?: boolean;
}

// 생애주기 배지 — "초과"류 경고는 아직 해야 할 일이 늦었을 때만 (판정: lib/lifecycle)
function LifecycleBadgeView({ badge }: { badge: LifecycleBadge }) {
  if (!badge) return null;
  switch (badge.kind) {
    case "overdue":
      return <span className="ml-1.5 text-xs text-red-600 font-bold">{badge.days}일 초과</span>;
    case "dday":
      if (badge.days === 0) return <span className="ml-1.5 text-xs text-red-600 font-bold">오늘</span>;
      return (
        <span className={`ml-1.5 text-xs font-bold ${badge.days <= 3 ? "text-red-600" : "text-amber-600"}`}>
          D-{badge.days}
        </span>
      );
    case "deploy-missing":
      return <span className="ml-1.5 text-xs text-red-600 font-bold">배포 미확인</span>;
    case "deployed":
      return <span className="ml-1.5 text-xs text-emerald-600 font-medium">배포 완료</span>;
    case "awaiting-complete":
      return <span className="ml-1.5 text-xs text-amber-600 font-medium">완료 처리 대기</span>;
  }
}

// 파이프라인 진행 단계 (반려/미진행/임시저장은 파이프라인 밖)
const STAGES: { key: QuoteStatus; label: string; accent: string }[] = [
  { key: "pending", label: "대기중", accent: "bg-yellow-500" },
  { key: "reviewing", label: "검토중", accent: "bg-blue-500" },
  { key: "approved", label: "승인", accent: "bg-green-500" },
  { key: "confirmed", label: "확정", accent: "bg-emerald-500" },
  { key: "completed", label: "완료", accent: "bg-slate-500" },
];

function DateCell({ q }: { q: QuoteListItem }) {
  const isFinished = q.status === "confirmed" || q.status === "completed";
  const endDate = q.confirmedEndDate || q.eventEndDate;
  if (isFinished && endDate) {
    return (
      <>
        <div className="text-[10px] text-gray-400">행사 종료</div>
        <div>{new Date(endDate + "T00:00:00").toLocaleDateString("ko-KR")}</div>
      </>
    );
  }
  return (
    <>
      <div className="text-[10px] text-gray-400">요청</div>
      <div>{new Date(q.createdAt).toLocaleDateString("ko-KR")}</div>
    </>
  );
}

type SortKey = "latest" | "deadline" | "amount";

export function QuotesClient({
  quotes: allQuotes,
  userRole,
  showPrice = true,
}: {
  quotes: QuoteListItem[];
  userRole: string;
  showPrice?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [showExternal, setShowExternal] = useState(false);
  const router = useRouter();

  // 외주 프로젝트(dev 전용 데이터)는 별도 탭으로 분리 — 기본 목록/카운트에서 제외
  const externalQuotes = useMemo(() => allQuotes.filter((q) => q.isExternal), [allQuotes]);
  const quotes = useMemo(
    () => (showExternal ? externalQuotes : allQuotes.filter((q) => !q.isExternal)),
    [allQuotes, externalQuotes, showExternal]
  );

  const statusCounts = quotes.reduce(
    (acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // 오늘 할 일: 개발 마감 임박(미배포 & D-3 이내/초과/배포 미확인) + 완료 처리 대기 + 검토 대기
  // — 외주 포함 전체(allQuotes) 기준. 납기 관제는 탭과 무관하게 항상 떠야 함.
  const today = todayStr();
  const badges = useMemo(
    () => new Map(allQuotes.map((q) => [q.id, getLifecycleBadge(q, today)])),
    [allQuotes, today]
  );
  const urgent = useMemo(() => {
    // 정렬 우선순위: 배포 미확인 → 초과 큰 순 → D-day 작은 순
    const rank = (b: LifecycleBadge) =>
      b?.kind === "deploy-missing" ? -1000 : b?.kind === "overdue" ? -b.days : b?.kind === "dday" ? b.days : 9999;
    return allQuotes
      .map((q) => ({ q, badge: badges.get(q.id) ?? null }))
      .filter(
        ({ badge }) =>
          badge?.kind === "deploy-missing" ||
          badge?.kind === "overdue" ||
          (badge?.kind === "dday" && badge.days <= 3)
      )
      .sort((a, b) => rank(a.badge) - rank(b.badge));
  }, [allQuotes, badges]);
  const awaitingComplete = useMemo(
    () => allQuotes.filter((q) => badges.get(q.id)?.kind === "awaiting-complete"),
    [allQuotes, badges]
  );
  const pendingCount = useMemo(() => allQuotes.filter((q) => q.status === "pending").length, [allQuotes]);

  const oldestPendingDays = useMemo(() => {
    const pendings = allQuotes.filter((q) => q.status === "pending");
    if (pendings.length === 0) return null;
    const oldest = pendings.reduce((a, b) =>
      new Date(a.createdAt) < new Date(b.createdAt) ? a : b
    );
    const days = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }, [allQuotes]);

  const filtered = useMemo(() => {
    // 검색 중에는 외주/자체 탭을 가로질러 전체에서 찾는다 (행의 외주 배지로 구분)
    const searchBase = search ? allQuotes : quotes;
    const base = searchBase.filter((q) => {
      const matchFilter = !filter || q.status === filter;
      const matchSearch =
        !search ||
        q.eventName.toLowerCase().includes(search.toLowerCase()) ||
        q.requesterName.toLowerCase().includes(search.toLowerCase()) ||
        q.quoteNumber.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
    const sorted = [...base];
    if (sort === "deadline") {
      sorted.sort((a, b) => {
        if (a.devDeadline && b.devDeadline) return a.devDeadline.localeCompare(b.devDeadline);
        if (a.devDeadline) return -1;
        if (b.devDeadline) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sort === "amount") {
      sorted.sort((a, b) => b.totalAmount - a.totalAmount);
    }
    // latest: 서버에서 이미 createdAt desc
    return sorted;
  }, [quotes, allQuotes, filter, search, sort]);

  const goTo = (id: string) => router.push(`/dashboard/quotes/${id}`);

  const segClass = (active: boolean) =>
    `relative flex-1 min-w-0 bg-white border rounded-xl px-3 py-2.5 text-left transition-shadow hover:shadow-sm cursor-pointer ${
      active ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200"
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          {userRole === "dev" ? "견적 관리" : "내 견적 현황"}
        </h1>
      </div>

      {/* 오늘 할 일 스트립 */}
      {(urgent.length > 0 || awaitingComplete.length > 0 || pendingCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {urgent.length > 0 && (
            <button
              onClick={() => setFilter("confirmed")}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              개발 마감 임박 {urgent.length}건
              <span className="hidden sm:inline text-red-600">
                — {urgent[0].q.eventName}
                {urgent[0].badge?.kind === "deploy-missing"
                  ? " 배포 미확인"
                  : urgent[0].badge?.kind === "overdue"
                  ? ` ${urgent[0].badge.days}일 초과`
                  : urgent[0].badge?.kind === "dday" && urgent[0].badge.days === 0
                  ? " 오늘"
                  : urgent[0].badge?.kind === "dday"
                  ? ` D-${urgent[0].badge.days}`
                  : ""}
              </span>
            </button>
          )}
          {awaitingComplete.length > 0 && (
            <button
              onClick={() => setFilter("confirmed")}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              완료 처리 대기 {awaitingComplete.length}건
              <span className="hidden sm:inline">— {awaitingComplete[0].eventName}</span>
            </button>
          )}
          {pendingCount > 0 && (
            <button
              onClick={() => setFilter("pending")}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              검토 대기 {pendingCount}건
              {oldestPendingDays !== null && oldestPendingDays > 0 && (
                <span className="hidden sm:inline">· 가장 오래된 요청 {oldestPendingDays}일 전</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* 파이프라인 바: 클릭 = 상태 필터 */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1" role="group" aria-label="상태별 필터">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? "" : s.key)}
            aria-pressed={filter === s.key}
            className={segClass(filter === s.key)}
          >
            <span className={`absolute top-0 left-3 right-3 h-[3px] rounded-b ${s.accent}`} aria-hidden="true" />
            <span className="block text-xs text-gray-500 mb-0.5">{s.label}</span>
            <span className="block text-lg sm:text-xl font-bold tabular-nums">{statusCounts[s.key] || 0}</span>
            {i < STAGES.length - 1 && (
              <ChevronRight className="hidden lg:block w-3.5 h-3.5 text-gray-300 absolute -right-[15px] top-1/2 -translate-y-1/2 z-10" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter(filter === "on_hold" ? "" : "on_hold")}
          aria-pressed={filter === "on_hold"}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filter === "on_hold"
              ? "border-sky-400 bg-sky-50 text-sky-700"
              : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          보류 <b className="font-semibold text-gray-700 tabular-nums">{statusCounts["on_hold"] || 0}</b>
        </button>
        <button
          onClick={() => setFilter(filter === "rejected" ? "" : "rejected")}
          aria-pressed={filter === "rejected"}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filter === "rejected"
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          반려 <b className="font-semibold text-gray-700 tabular-nums">{statusCounts["rejected"] || 0}</b>
        </button>
        <button
          onClick={() => setFilter(filter === "lost" ? "" : "lost")}
          aria-pressed={filter === "lost"}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filter === "lost"
              ? "border-gray-400 bg-gray-100 text-gray-700"
              : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          미진행 <b className="font-semibold text-gray-700 tabular-nums">{statusCounts["lost"] || 0}</b>
        </button>
        <button
          onClick={() => setFilter("")}
          aria-pressed={filter === ""}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filter === ""
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          전체 보기 <b className="font-semibold tabular-nums">{quotes.length}</b>
        </button>
        {userRole === "dev" && (
          <button
            onClick={() => {
              setShowExternal(!showExternal);
              setFilter("");
            }}
            aria-pressed={showExternal}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showExternal
                ? "border-purple-400 bg-purple-50 text-purple-700"
                : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            외주 <b className="font-semibold text-gray-700 tabular-nums">{externalQuotes.length}</b>
          </button>
        )}
      </div>

      {/* 검색 + 정렬 */}
      <div className="flex gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <label htmlFor="quote-search" className="sr-only">견적 검색</label>
          <input
            id="quote-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="행사명, 요청자, 견적번호 검색"
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <label htmlFor="quote-sort" className="sr-only">정렬</label>
        <select
          id="quote-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-3 border rounded-lg text-sm bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="latest">최신 요청순</option>
          <option value="deadline">마감 임박순</option>
          <option value="amount">금액 높은순</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-gray-400 mb-3">
            {quotes.length === 0 ? "견적 요청이 없습니다" : "조건에 맞는 견적이 없습니다"}
          </p>
          <a href="/request" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            + 새 견적 요청하기
          </a>
        </div>
      ) : (
        <>
          {/* 데스크톱: 테이블 */}
          <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">행사</th>
                    <th className="text-center px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">유형</th>
                    <th className="text-left px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">요청자</th>
                    {showPrice && <th className="text-right px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">금액</th>}
                    <th className="text-center px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">상태</th>
                    <th className="text-center px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">날짜</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => goTo(q.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(q.id); } }}
                      tabIndex={0}
                      role="link"
                      className="hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium max-w-[280px] truncate">
                          {q.isExternal && (
                            <span className="mr-1.5 inline-block align-middle text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded px-1 py-px">
                              외주
                            </span>
                          )}
                          {q.eventName}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{q.quoteNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          TYPE_COLORS[q.type as QuoteType] || "bg-gray-100 text-gray-700"
                        }`}>
                          {TYPE_LABELS[q.type as QuoteType] || q.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{q.requesterName}</td>
                      {showPrice && (
                        <td className="px-4 py-3 text-sm text-right font-medium tabular-nums whitespace-nowrap">
                          {formatKRW(q.totalAmount)}원
                        </td>
                      )}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[q.status as QuoteStatus]
                        }`}>
                          {STATUS_LABELS[q.status as QuoteStatus]}
                        </span>
                        <LifecycleBadgeView badge={badges.get(q.id) ?? null} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-center hidden md:table-cell">
                        <DateCell q={q} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일: 카드 리스트 */}
          <div className="sm:hidden space-y-2.5">
            {filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => goTo(q.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(q.id); } }}
                tabIndex={0}
                role="link"
                className="bg-white border rounded-xl px-4 py-3.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400 font-mono">{q.quoteNumber}</span>
                  <span className="whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[q.status as QuoteStatus]
                    }`}>
                      {STATUS_LABELS[q.status as QuoteStatus]}
                    </span>
                    <LifecycleBadgeView badge={badges.get(q.id) ?? null} />
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold mb-1 truncate">
                  {q.isExternal && (
                    <span className="mr-1.5 inline-block align-middle text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded px-1 py-px">
                      외주
                    </span>
                  )}
                  {q.eventName}
                </h3>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-400 truncate">
                    {q.requesterName} · {TYPE_LABELS[q.type as QuoteType] || q.type} ·{" "}
                    {(q.status === "confirmed" || q.status === "completed") && (q.confirmedEndDate || q.eventEndDate)
                      ? `행사 종료 ${new Date((q.confirmedEndDate || q.eventEndDate) + "T00:00:00").toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}`
                      : `요청 ${new Date(q.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}`}
                  </span>
                  {showPrice && (
                    <span className="text-[15px] font-bold tabular-nums whitespace-nowrap">
                      {formatKRW(q.totalAmount)}원
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
