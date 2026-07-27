"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, Clock3, FileSearch, Wallet } from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import { useAuth } from "@/components/AuthProvider";

interface QuoteRow {
  id: string;
  quoteNumber: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  confirmedDate: string | null;
  devDeadline: string | null;
  month?: string;
  subtotal?: number;
  isExternal?: boolean;
  depositPaidAt?: string | null;
  balancePaidAt?: string | null;
}

interface ReportData {
  totals: {
    revenueTotal: number;
    revenueSubtotal: number;
    revenueCount: number;
    externalTotal: number;
    externalSubtotal: number;
    externalCount: number;
    collectedTotal: number;
    outstandingTotal: number;
    outstandingCount: number;
    awaitingTotal: number;
    awaitingCount: number;
    holdTotal: number;
    holdCount: number;
  };
  monthly: { month: string; total: number; subtotal: number; count: number; external: number }[];
  statusSummary: { status: string; count: number; total: number; externalCount: number }[];
  awaiting: QuoteRow[];
  inReview: QuoteRow[];
  revenue: QuoteRow[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  pending: "검토 대기",
  reviewing: "검토중",
  approved: "승인 (확정 대기)",
  on_hold: "보류",
  confirmed: "행사 확정",
  completed: "행사 완료",
  rejected: "반려",
  lost: "미진행",
};

function formatMonth(month: string) {
  const [y, m] = month.split("-");
  const nowYear = String(new Date().getFullYear());
  return y === nowYear ? `${Number(m)}월` : `'${y.slice(2)}.${m}`;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const { user, isDev } = useAuth();

  useEffect(() => {
    fetch("/api/reports/revenue")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "조회 실패");
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (user && !isDev) {
    return <div className="text-center py-20 text-gray-500">개발팀(admin) 전용 페이지입니다.</div>;
  }
  if (error) {
    return <div className="text-center py-20 text-gray-500">{error}</div>;
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEntry = data.monthly.find((m) => m.month === thisMonth);
  const years = [...new Set(data.monthly.map((m) => m.month.slice(0, 4)))].sort();
  const chartMonths =
    yearFilter === "all" ? data.monthly : data.monthly.filter((m) => m.month.startsWith(yearFilter));
  const maxMonthly = Math.max(...chartMonths.map((m) => m.total), 1);
  const inReviewTotal = data.inReview.reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">매출 리포트</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          행사 확정·완료 견적 기준(수주액), 금액은 VAT 포함 · 월 구분은 행사 시작일 기준 · 실제 수금은 입금
          기록(계약금 40/잔금 60) 기준
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> 누적 확정 매출
          </div>
          <div className="text-lg sm:text-xl font-bold tabular-nums mt-1">
            {formatKRW(data.totals.revenueTotal)}원
          </div>
          <div className="text-[11px] text-gray-400 tabular-nums">
            공급가 {formatKRW(data.totals.revenueSubtotal)}원 · {data.totals.revenueCount}건
          </div>
          {data.totals.externalCount > 0 && (
            <div className="text-[11px] text-gray-400 tabular-nums">
              자체 {formatKRW(data.totals.revenueTotal - data.totals.externalTotal)}원 · 외주{" "}
              {formatKRW(data.totals.externalTotal)}원 ({data.totals.externalCount}건)
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500">이번 달 매출</div>
          <div className="text-lg sm:text-xl font-bold tabular-nums mt-1">
            {formatKRW(thisMonthEntry?.total ?? 0)}원
          </div>
          <div className="text-[11px] text-gray-400">{thisMonthEntry?.count ?? 0}건</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> 미수금
          </div>
          <div
            className={`text-lg sm:text-xl font-bold tabular-nums mt-1 ${
              data.totals.outstandingTotal > 0 ? "text-red-600" : ""
            }`}
          >
            {formatKRW(data.totals.outstandingTotal)}원
          </div>
          <div className="text-[11px] text-gray-400 tabular-nums">
            입금 기록 기준 · 수금 {formatKRW(data.totals.collectedTotal)}원 · {data.totals.outstandingCount}건
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5" /> 승인 후 확정 대기
          </div>
          <div className="text-lg sm:text-xl font-bold tabular-nums mt-1">
            {formatKRW(data.totals.awaitingTotal)}원
          </div>
          <div className="text-[11px] text-gray-400 tabular-nums">
            {data.totals.awaitingCount}건
            {data.totals.holdCount > 0 &&
              ` · 보류 ${data.totals.holdCount}건 (${formatKRW(data.totals.holdTotal)}원)`}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <FileSearch className="w-3.5 h-3.5" /> 검토 파이프라인
          </div>
          <div className="text-lg sm:text-xl font-bold tabular-nums mt-1">
            {formatKRW(inReviewTotal)}원
          </div>
          <div className="text-[11px] text-gray-400">{data.inReview.length}건 (대기+검토중)</div>
        </div>
      </div>

      {/* 월별 매출 차트 (자체/외주 스택) */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">월별 확정 매출</h3>
          <div className="flex items-center gap-3">
            {data.totals.externalCount > 0 && (
              <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> 자체
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> 외주
                </span>
              </div>
            )}
            {years.length > 1 && (
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-white text-gray-600 outline-none"
                aria-label="연도 필터"
              >
                <option value="all">전체</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {chartMonths.length === 0 ? (
          <p className="text-sm text-gray-400">확정된 매출이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 sm:gap-3 h-44 min-w-[420px] pt-6">
              {chartMonths.map((m) => (
                <div key={m.month} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                  <div className="text-[10px] text-gray-500 tabular-nums mb-1 whitespace-nowrap">
                    {(m.total / 10000).toLocaleString()}만
                  </div>
                  <div
                    className="w-full max-w-[44px] flex flex-col rounded-t overflow-hidden"
                    style={{ height: `${Math.max((m.total / maxMonthly) * 100, 2)}%` }}
                  >
                    {m.external > 0 && (
                      <div
                        className="w-full bg-purple-500 group-hover:bg-purple-600 transition-colors"
                        style={{ height: `${(m.external / m.total) * 100}%` }}
                      />
                    )}
                    <div className="w-full flex-1 bg-blue-600 group-hover:bg-blue-700 transition-colors" />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1.5 whitespace-nowrap">{formatMonth(m.month)}</div>
                  <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 text-left">
                    <div>
                      {m.month} · {formatKRW(m.total)}원 · {m.count}건
                    </div>
                    {m.external > 0 && (
                      <div className="text-gray-300">
                        자체 {formatKRW(m.total - m.external)}원 · 외주 {formatKRW(m.external)}원
                      </div>
                    )}
                    <div className="text-gray-300">공급가 {formatKRW(m.subtotal)}원</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 승인 후 확정 대기 */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium mb-3">승인 후 확정 대기 ({data.awaiting.length}건)</h3>
          {data.awaiting.length === 0 ? (
            <p className="text-sm text-gray-400">확정 대기 중인 견적이 없습니다.</p>
          ) : (
            <ul className="divide-y">
              {data.awaiting.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/dashboard/quotes/${q.id}`}
                    className="flex justify-between gap-3 py-2 text-sm hover:bg-gray-50 rounded px-1 -mx-1"
                  >
                    <span className="min-w-0">
                      <span className="text-gray-400 text-xs font-mono mr-2">{q.quoteNumber}</span>
                      <span className="break-words">{q.eventName}</span>
                    </span>
                    <span className="tabular-nums shrink-0">{formatKRW(q.totalAmount)}원</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 상태별 요약 */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium mb-3">상태별 현황</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b">
                <th className="text-left font-medium py-1.5">상태</th>
                <th className="text-right font-medium py-1.5">건수</th>
                <th className="text-right font-medium py-1.5">금액(VAT포함)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.statusSummary
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((s) => (
                  <tr key={s.status}>
                    <td className="py-1.5">{STATUS_LABELS[s.status] || s.status}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {s.count}
                      {s.externalCount > 0 && (
                        <span className="text-[10px] text-purple-600 ml-1">(외주 {s.externalCount})</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatKRW(s.total)}원</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 매출 내역 테이블 */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-medium mb-3">확정 매출 내역 ({data.revenue.length}건)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b">
                <th className="text-left font-medium py-1.5">월</th>
                <th className="text-left font-medium py-1.5">견적번호</th>
                <th className="text-left font-medium py-1.5">행사명</th>
                <th className="text-left font-medium py-1.5">상태</th>
                <th className="text-center font-medium py-1.5">입금</th>
                <th className="text-right font-medium py-1.5">공급가</th>
                <th className="text-right font-medium py-1.5">VAT포함</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.revenue
                .slice()
                .sort((a, b) => (b.month || "").localeCompare(a.month || ""))
                .map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="py-1.5 tabular-nums text-gray-500">{q.month}</td>
                    <td className="py-1.5 font-mono text-xs text-gray-500">
                      <Link href={`/dashboard/quotes/${q.id}`} className="hover:text-blue-600">
                        {q.quoteNumber}
                      </Link>
                    </td>
                    <td className="py-1.5 break-words">
                      {q.eventName}
                      {q.isExternal && (
                        <span className="ml-1.5 inline-block align-middle text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded px-1 py-px">
                          외주
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-gray-500">{STATUS_LABELS[q.status] || q.status}</td>
                    <td className="py-1.5 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] px-1 py-px rounded border mr-0.5 ${
                          q.depositPaidAt
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-gray-400 bg-gray-50 border-gray-200"
                        }`}
                        title={q.depositPaidAt ? `계약금 입금 ${q.depositPaidAt}` : "계약금 미기록"}
                      >
                        계40
                      </span>
                      <span
                        className={`text-[10px] px-1 py-px rounded border ${
                          q.balancePaidAt
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-gray-400 bg-gray-50 border-gray-200"
                        }`}
                        title={q.balancePaidAt ? `잔금 입금 ${q.balancePaidAt}` : "잔금 미기록"}
                      >
                        잔60
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">
                      {formatKRW(q.subtotal ?? 0)}원
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{formatKRW(q.totalAmount)}원</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
