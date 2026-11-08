import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuotesClient } from "./QuotesClient";
import { commentWhere, quoteScopeWhere } from "@/lib/quoteAccess";

export default async function QuotesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  // sales = 본인 견적, dev_staff = 담당 견적, 외주 = dev만 (dev 목록에서는 외주 탭으로 분리)
  const where: Record<string, unknown> = quoteScopeWhere(user);
  if (user.role === "sales") where.isHidden = false;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, team: true, role: true } },
      reviewedBy: { select: { name: true } },
      devAssignee: { select: { name: true } },
      comments: { where: commentWhere(user.role), orderBy: { createdAt: "desc" }, take: 1, select: { user: { select: { role: true } } } },
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
    createdBy: q.createdBy ? { name: q.createdBy.name, team: q.createdBy.team } : null,
    createdByRole: q.createdBy?.role ?? null,
    devDeadline: q.devDeadline,
    devCompletedAt: q.devCompletedAt?.toISOString() ?? null,
    confirmedDate: q.confirmedDate,
    confirmedEndDate: q.confirmedEndDate,
    eventDate: q.eventDate,
    eventEndDate: q.eventEndDate,
    isExternal: q.isExternal,
    depositPaidAt: q.depositPaidAt,
    balancePaidAt: q.balancePaidAt,
    lastCommentRole: q.comments[0]?.user.role ?? null,
    devAssigneeName: q.devAssignee?.name ?? null,
  }));

  return <QuotesClient quotes={serialized} userRole={user.role} showPrice={showPrice} />;
}
