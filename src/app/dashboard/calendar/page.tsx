import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarClient } from "./CalendarClient";
import type { CalendarEvent } from "@/lib/calendar";

export default async function CalendarPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const where: Record<string, unknown> = {
    status: "confirmed",
    type: { not: "sale" }, // 판매 유형 제외 (행사 아님)
  };

  if (user.role === "sales") {
    where.createdById = user.id;
  }

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
      createdByName: q.createdBy?.name || null,
    }));

  return <CalendarClient events={events} userRole={user.role} />;
}
