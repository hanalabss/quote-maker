import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { canAccessQuote } from "@/lib/quoteAccess";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { synologyConfigured } from "@/lib/synology";
import {
  PROGRAM_PART_SIZE,
  PROGRAM_TMP_PREFIX,
  canUploadProgram,
  partCount,
  tmpPartPath,
  validateProgramFile,
} from "@/lib/programUpload";

const STALE_MS = 6 * 60 * 60 * 1000; // 6시간 넘은 임시 조각은 중단된 업로드로 보고 지운다

// 이 견적에 남아 있는 오래된 임시 조각 정리 (실패해도 올리기는 막지 않는다)
async function cleanupStale(quoteId: string) {
  try {
    const bucket = supabase.storage.from(STORAGE_BUCKET);
    const { data: dirs } = await bucket.list(`${PROGRAM_TMP_PREFIX}/${quoteId}`, { limit: 100 });
    for (const dir of dirs ?? []) {
      const prefix = `${PROGRAM_TMP_PREFIX}/${quoteId}/${dir.name}`;
      const { data: files } = await bucket.list(prefix, { limit: 1000 });
      if (!files?.length) continue;
      const newest = Math.max(...files.map((f) => new Date(f.updated_at ?? f.created_at ?? 0).getTime()));
      if (Date.now() - newest > STALE_MS) {
        await bucket.remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }
  } catch (e) {
    console.error("임시 조각 정리 실패:", e instanceof Error ? e.message : e);
  }
}

// 올리기 시작 — 조각별 임시 업로드 주소를 내준다. 개발팀만.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!canUploadProgram(user.role)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { isExternal: true, createdById: true, devAssigneeId: true },
  });
  if (!quote) return NextResponse.json({ error: "견적을 찾을 수 없습니다" }, { status: 404 });
  if (!canAccessQuote(user, quote)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  if (!synologyConfigured()) {
    return NextResponse.json(
      { error: "NAS 연동이 아직 설정되지 않았습니다 (서버 환경변수 SYNOLOGY_URL·USER·PASSWORD)" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { fileName?: unknown; size?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const invalid = validateProgramFile(fileName, size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  await cleanupStale(id);

  const uploadId = randomUUID();
  const count = partCount(size);
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const parts: { index: number; url: string }[] = [];
  for (let i = 0; i < count; i++) {
    const { data, error } = await bucket.createSignedUploadUrl(tmpPartPath(id, uploadId, i));
    if (error || !data?.signedUrl) {
      console.error("임시 업로드 주소 생성 실패:", error?.message);
      return NextResponse.json({ error: "올리기를 시작하지 못했습니다" }, { status: 500 });
    }
    parts.push({ index: i, url: data.signedUrl });
  }

  return NextResponse.json({ uploadId, partSize: PROGRAM_PART_SIZE, parts });
}
