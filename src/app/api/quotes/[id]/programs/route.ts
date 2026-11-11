import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { canAccessQuote } from "@/lib/quoteAccess";
import { canUploadProgram } from "@/lib/programUpload";
import { synologyConfigured } from "@/lib/synology";

// 완료 프로그램 목록 — 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)에게만.
// 공유 링크·NAS 경로는 응답에 넣지 않는다. 받기는 /programs/[programId] 가 권한 확인 후 넘긴다.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { isExternal: true, createdById: true, devAssigneeId: true },
  });
  if (!quote) return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  if (!canAccessQuote(user, quote)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  const programs = await prisma.quoteProgram.findMany({
    where: { quoteId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      size: true,
      version: true,
      note: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    programs,
    canUpload: canUploadProgram(user.role),
    configured: synologyConfigured(),
  });
}
