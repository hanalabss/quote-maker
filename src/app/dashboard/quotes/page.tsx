import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuotesClient } from "./QuotesClient";

export default async function QuotesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const where: Record<string, unknown> = {};
  if (user.role === "sales") {
    where.createdById = user.id;
    where.isHidden = false; // sales는 숨긴 견적 제외
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

  // 직렬화 (Date → string)
  const serialized = quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    type: q.type,
    eventName: q.eventName,
    requesterName: q.requesterName,
    totalAmount: q.totalAmount,
    createdAt: q.createdAt.toISOString(),
    createdBy: q.createdBy,
  }));

  return <QuotesClient quotes={serialized} userRole={user.role} />;
}
