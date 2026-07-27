import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { fileName } = await params;

  // 경로 탈출 방지
  const safeName = path.basename(fileName);

  // 외주 견적의 첨부파일은 dev만 접근 가능
  const owner = await prisma.quote.findFirst({
    where: { attachments: { array_contains: [{ fileName: safeName }] } },
    select: { isExternal: true },
  });
  if (owner?.isExternal && user.role !== "dev") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  // private 버킷이므로 단기 서명 URL로 전달 (공개 URL 직접 접근 차단)
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(safeName, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
