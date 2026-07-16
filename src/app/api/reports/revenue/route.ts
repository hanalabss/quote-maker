import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDev } from "@/lib/auth";

// 매출 리포트 (dev 전용)
// 매출 인식 기준: confirmed/completed 견적, 행사 시작일(confirmedDate) 월 기준
// (확정일시 confirmedAt, 생성일 순으로 fallback). 금액은 VAT 포함.
export async function GET() {
  const authResult = await requireDev();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const quotes = await prisma.quote.findMany({
    where: { isHidden: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      type: true,
      eventName: true,
      requesterName: true,
      subtotal: true,
      totalAmount: true,
      createdAt: true,
      confirmedAt: true,
      confirmedDate: true,
      devDeadline: true,
    },
  });

  const revenueStatuses = new Set(["confirmed", "completed"]);
  const revenueQuotes = quotes.filter((q) => revenueStatuses.has(q.status));

  const monthKey = (q: (typeof quotes)[number]) =>
    (q.confirmedDate || q.confirmedAt?.toISOString() || q.createdAt.toISOString()).slice(0, 7);

  const monthlyMap = new Map<string, { month: string; total: number; subtotal: number; count: number }>();
  for (const q of revenueQuotes) {
    const key = monthKey(q);
    const entry = monthlyMap.get(key) ?? { month: key, total: 0, subtotal: 0, count: 0 };
    entry.total += q.totalAmount;
    entry.subtotal += q.subtotal;
    entry.count += 1;
    monthlyMap.set(key, entry);
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const statusSummary = new Map<string, { status: string; count: number; total: number }>();
  for (const q of quotes) {
    const entry = statusSummary.get(q.status) ?? { status: q.status, count: 0, total: 0 };
    entry.count += 1;
    entry.total += q.totalAmount;
    statusSummary.set(q.status, entry);
  }

  const pickList = (q: (typeof quotes)[number]) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    eventName: q.eventName,
    requesterName: q.requesterName,
    totalAmount: q.totalAmount,
    status: q.status,
    createdAt: q.createdAt,
    confirmedDate: q.confirmedDate,
    devDeadline: q.devDeadline,
  });

  return NextResponse.json({
    totals: {
      revenueTotal: revenueQuotes.reduce((s, q) => s + q.totalAmount, 0),
      revenueSubtotal: revenueQuotes.reduce((s, q) => s + q.subtotal, 0),
      revenueCount: revenueQuotes.length,
      awaitingTotal: quotes.filter((q) => q.status === "approved").reduce((s, q) => s + q.totalAmount, 0),
      awaitingCount: quotes.filter((q) => q.status === "approved").length,
    },
    monthly,
    statusSummary: [...statusSummary.values()],
    awaiting: quotes.filter((q) => q.status === "approved").map(pickList),
    inReview: quotes.filter((q) => q.status === "pending" || q.status === "reviewing").map(pickList),
    revenue: revenueQuotes.map((q) => ({ ...pickList(q), month: monthKey(q), subtotal: q.subtotal })),
  });
}
