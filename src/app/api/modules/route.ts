import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // ?all=1 (dev 전용): 미사용 모듈 포함 — 모듈 관리 화면용
  const wantAll = request.nextUrl.searchParams.get("all") === "1";
  let includeInactive = false;
  if (wantAll) {
    const user = await getAuthUser();
    includeInactive = user?.role === "dev";
  }

  const modules = await prisma.module.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(modules, {
    headers: includeInactive
      ? { "Cache-Control": "no-store" }
      : { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
