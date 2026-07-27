import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuotesClient } from "./QuotesClient";

export default async function QuotesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  // 외주 프로젝트는 dev만 조회 가능 (목록에서는 외주 탭으로 분리)
  const where: Record<string, unknown> = {};
  if (user.role !== "dev") {
    where.isExternal = false;
  }
  if (user.role === "sales") {
    where.createdById = user.id;
    where.isHidden = false;
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, team: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const showPrice = user.role === "dev" || user.role === "sales";

  const serialized = quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    type: q.type,
    eventName: q.eventName,
    requesterName: q.requesterName,
    totalAmount: showPrice ? q.totalAmount : 0,
    createdAt: q.createdAt.toISOString(),
    createdBy: q.createdBy,
    devDeadline: q.devDeadline,
    devCompletedAt: q.devCompletedAt?.toISOString() ?? null,
    confirmedDate: q.confirmedDate,
    confirmedEndDate: q.confirmedEndDate,
    eventEndDate: q.eventEndDate,
    isExternal: q.isExternal,
  }));

  return <QuotesClient quotes={serialized} userRole={user.role} showPrice={showPrice} />;
}
