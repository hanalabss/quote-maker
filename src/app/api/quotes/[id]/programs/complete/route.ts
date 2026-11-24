import { NextRequest, NextResponse, after } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { fail, programContext } from "@/lib/programAccess";
import { noteUploadQuietly, storeProgramFile } from "@/lib/programStore";
import { SynologyError, eventFolderPath } from "@/lib/synology";
import { isUploadId, materialUploadOpen, parseUploadDir, sanitizeFileName, tmpDir, validateProgramFile } from "@/lib/programUpload";

// 임시 조각을 미리 내려받아 두는 개수 — NAS로 보내는 동안 다음 조각을 기다리지 않게 한다 (조각 8MB × 3 = 메모리 24MB 안쪽)
const PREFETCH = 3;

// 회사 NAS는 해외 IP를 막는다 (Vercel sin1 에서 연결 시간 초과, icn1 에서 정상 — 2026-11-11 실측).
// 프로젝트 전체를 icn1 로 옮기면 DB(싱가포르)와 멀어져 모든 화면이 느려진다(상세 API 170ms → 1.5초 실측).
// 그래서 programs 아래 API만 vercel.json functions.regions 로 서울에서 돌린다. 라우트의 preferredRegion export 는 적용되지 않았다.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// 임시 조각을 이어 붙여 연결된 NAS 행사 폴더(dir 이 있으면 그 아래 자료 폴더)로 옮기고, 받기 링크를 만들어 기록한다.
// 권한은 init 과 같다: 완료 프로그램 = 개발팀 / 자료 = 견적을 볼 수 있는 사람.
// 오래 걸리므로 진행 상황을 한 줄에 JSON 하나씩(NDJSON) 흘려보낸다:
//   {stage:"nas", sent, total} … {stage:"verify"} {stage:"share"} {done:true, program} | {error}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    dir?: unknown;
    uploadId?: unknown;
    fileName?: unknown;
    size?: unknown;
    version?: unknown;
    note?: unknown;
  } | null;
  const dir = parseUploadDir(body?.dir);
  const ctx = await programContext(id, { manage: dir === "", nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { user, quote } = ctx;
  if (dir === null) return fail("잘못된 요청입니다", 400);
  if (dir && !materialUploadOpen(quote.status)) return fail("반려·미진행 견적에는 자료를 올릴 수 없습니다", 400);
  if (!quote.programFolder) return fail("먼저 NAS 행사 폴더를 연결해 주세요", 409);
  const eventFolder = eventFolderPath(quote.programFolder);
  const uploadId = body?.uploadId;
  const rawName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const version = typeof body?.version === "string" ? body.version.trim().slice(0, 40) || null : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) || null : null;

  if (!isUploadId(uploadId)) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  const invalid = validateProgramFile(rawName, size);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const fileName = sanitizeFileName(rawName);

  // 조각 확인 — 브라우저가 보낸 값이 아니라 임시 폴더에 실제로 있는 것을 기준으로 한다
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const tmp = tmpDir(id, uploadId);
  const { data: listed, error: listError } = await bucket.list(tmp, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  const partNames = (listed ?? []).map((f) => f.name).sort();
  const removeTmp = async () => {
    if (partNames.length) await bucket.remove(partNames.map((n) => `${tmp}/${n}`)).catch(() => {});
  };
  if (listError || partNames.length === 0) {
    return NextResponse.json({ error: "올린 조각을 찾지 못했습니다. 다시 올려 주세요" }, { status: 400 });
  }
  const listedSize = (listed ?? []).reduce((sum, f) => sum + Number(f.metadata?.size ?? 0), 0);
  if (listedSize !== size) {
    await removeTmp();
    return NextResponse.json({ error: "올린 조각의 크기가 파일과 다릅니다. 다시 올려 주세요" }, { status: 400 });
  }

  // 조각은 싱가포르(Supabase)에 있다 — 하나씩 받으면 느리므로 PREFETCH 개씩 앞서 받아 두고 순서대로 흘려보낸다
  async function* chunks(): AsyncGenerator<Uint8Array> {
    const fetchPart = async (name: string) => {
      const { data, error } = await bucket.download(`${tmp}/${name}`);
      if (error || !data) throw new SynologyError("임시 보관한 조각을 읽지 못했습니다");
      return new Uint8Array(await data.arrayBuffer());
    };
    const ahead: Promise<Uint8Array>[] = [];
    let next = 0;
    const fill = () => {
      while (ahead.length < PREFETCH && next < partNames.length) {
        const p = fetchPart(partNames[next++]);
        p.catch(() => {}); // 차례가 오기 전에 실패해도 처리되지 않은 오류로 남지 않게 (차례가 오면 await 에서 던져진다)
        ahead.push(p);
      }
    };
    fill();
    while (ahead.length) {
      const chunk = await ahead.shift()!;
      fill();
      yield chunk;
    }
  }

  // 댓글 기록과 임시 조각 삭제는 응답을 다 보낸 뒤에 한다 (올린 사람을 기다리게 하지 않는다).
  // after 는 요청을 받은 자리에서 걸어 두고, 스트림이 끝나면 무엇을 할지 알려 준다.
  let stored: string | null = null;
  let streamEnded!: () => void;
  const ended = new Promise<void>((resolve) => (streamEnded = resolve));
  after(async () => {
    await ended;
    if (stored) await noteUploadQuietly(id, user.id, dir, stored);
    await removeTmp();
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // 브라우저가 연결을 끊어도 NAS 작업은 끝까지 한다
        }
      };

      try {
        const program = await storeProgramFile({
          quoteId: id,
          userId: user.id,
          eventFolder,
          dir,
          fileName,
          size,
          version,
          note,
          chunks: chunks(),
          onStage: send,
        });
        stored = program.fileName;
        send({ done: true, program: { ...program, uploadedBy: { name: user.name } } });
      } catch (e) {
        const message = e instanceof SynologyError ? e.message : "NAS로 옮기는 중 오류가 발생했습니다";
        console.error("완료 프로그램 올리기 실패:", e instanceof Error ? e.message : e);
        send({ error: message });
      } finally {
        streamEnded();
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
