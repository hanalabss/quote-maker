import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { canAccessQuote } from "@/lib/quoteAccess";
import { canUploadProgram } from "@/lib/programUpload";
import { SynologyError, deleteFile, deleteShareLink, synologyConfigured, withSession } from "@/lib/synology";

async function load(id: string, programId: string) {
  return prisma.quoteProgram.findFirst({
    where: { id: programId, quoteId: id },
    include: { quote: { select: { isExternal: true, createdById: true, devAssigneeId: true } } },
  });
}

// 받기 — 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)만 NAS 공유 링크로 넘긴다.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; programId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id, programId } = await params;
  const program = await load(id, programId);
  if (!program) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (!canAccessQuote(user, program.quote)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  return NextResponse.redirect(program.shareUrl);
}

// 삭제 — 개발팀만. NAS 공유 링크와 파일을 지우고(휴지통으로 이동) 기록을 지운다.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; programId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!canUploadProgram(user.role)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  const { id, programId } = await params;
  const program = await load(id, programId);
  if (!program) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (!canAccessQuote(user, program.quote)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  if (!synologyConfigured()) {
    return NextResponse.json({ error: "NAS 연동이 아직 설정되지 않았습니다" }, { status: 503 });
  }

  try {
    await withSession(async (sid) => {
      // 이미 NAS에서 없어진 링크는 지워진 것으로 본다 (실측: 없는 링크 삭제 = 코드 401, 문서상 2000).
      // 없는 파일 삭제는 NAS가 오류 없이 넘어간다 (실측).
      const linkGone = (e: unknown) => e instanceof SynologyError && [401, 408, 2000].includes(e.code ?? -1);
      await deleteShareLink(sid, program.shareId).catch((e) => {
        if (!linkGone(e)) throw e;
      });
      await deleteFile(sid, program.nasPath);
    });
  } catch (e) {
    console.error("완료 프로그램 삭제 실패:", e instanceof Error ? e.message : e);
    const message = e instanceof SynologyError ? e.message : "NAS에서 지우지 못했습니다";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await prisma.quoteProgram.delete({ where: { id: program.id } });
  return NextResponse.json({ ok: true });
}
