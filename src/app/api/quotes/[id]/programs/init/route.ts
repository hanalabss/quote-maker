import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { fail, programContext } from "@/lib/programAccess";
import { PROGRAM_PART_SIZE, PROGRAM_TMP_PREFIX, partCount, tmpPartPath, validateProgramFile } from "@/lib/programUpload";

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

// 올리기 시작 — 조각별 임시 업로드 주소를 내준다. 개발팀만, 행사 폴더가 연결된 견적만.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true, nas: true });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.quote.programFolder) return fail("먼저 NAS 행사 폴더를 연결해 주세요", 409);

  const body = (await request.json().catch(() => null)) as { fileName?: unknown; size?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const invalid = validateProgramFile(fileName, size);
  if (invalid) return fail(invalid, 400);

  await cleanupStale(id);

  const uploadId = randomUUID();
  const count = partCount(size);
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const parts: { index: number; url: string }[] = [];
  for (let i = 0; i < count; i++) {
    const { data, error } = await bucket.createSignedUploadUrl(tmpPartPath(id, uploadId, i));
    if (error || !data?.signedUrl) {
      console.error("임시 업로드 주소 생성 실패:", error?.message);
      return fail("올리기를 시작하지 못했습니다", 500);
    }
    parts.push({ index: i, url: data.signedUrl });
  }

  return NextResponse.json({ uploadId, partSize: PROGRAM_PART_SIZE, parts });
}
