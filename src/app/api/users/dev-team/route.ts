import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDev } from "@/lib/auth";

// 개발 담당자 지정용 개발팀 목록 (dev 전용)
export async function GET() {
  const authResult = await requireDev();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ["dev", "dev_staff"] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(users);
}
