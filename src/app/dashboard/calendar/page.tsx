import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarClient } from "./CalendarClient";
import { quoteScopeWhere } from "@/lib/quoteAccess";
import type { CalendarEvent } from "@/lib/calendar";

export default async function CalendarPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const where: Record<string, unknown> = {
    ...quoteScopeWhere(user),
    // 확정 + 완료(지난 행사도 달력에 남김)
    status: { in: ["confirmed", "completed"] },
    type: { not: "sale" }, // 판매 유형 제외 (행사 아님)
  };
  // sales = 본인, dev_staff = 담당, 외주는 dev만 (dev 달력에는 행사형 외주가 있으면 표시)

  const quotes = await prisma.quote.findMany({
    where,
    select: {
      id: true,
      quoteNumber: true,
      eventName: true,
      type: true,
      confirmedDate: true,
      confirmedEndDate: true,
      eventDate: true,
      eventEndDate: true,
      devDeadline: true,
      devCompletedAt: true,
      calendarColor: true,
      status: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { confirmedDate: "asc" },
  });

  const events: CalendarEvent[] = quotes
    .filter((q) => q.confirmedDate || q.eventDate)
    .map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      eventName: q.eventName,
      type: q.type,
      confirmedDate: q.confirmedDate || q.eventDate!,
      eventEndDate: q.confirmedEndDate || q.eventEndDate,
      devDeadline: q.devDeadline,
      devCompletedAt: q.devCompletedAt?.toISOString() ?? null,
      status: q.status,
      customColor: q.calendarColor,
      createdByName: q.createdBy?.name || null,
    }));

  return <CalendarClient events={events} userRole={user.role} />;
}
