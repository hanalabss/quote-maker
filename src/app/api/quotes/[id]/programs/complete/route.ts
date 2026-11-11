import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { fail, programContext } from "@/lib/programAccess";
import {
  SynologyError,
  createShareLink,
  deleteFile,
  deleteShareLink,
  eventFolderPath,
  fileSize,
  listFolder,
  login,
  logout,
  uploadFile,
} from "@/lib/synology";
import {
  isUploadId,
  sanitizeFileName,
  timestampedName,
  tmpDir,
  validateProgramFile,
} from "@/lib/programUpload";

// 회사 NAS는 해외 IP를 막는다 (Vercel sin1 에서 연결 시간 초과, icn1 에서 정상 — 2026-11-11 실측).
// 프로젝트 전체를 icn1 로 옮기면 DB(싱가포르)와 멀어져 모든 화면이 느려진다(상세 API 170ms → 1.5초 실측).
// 그래서 programs 아래 API만 vercel.json functions.regions 로 서울에서 돌린다. 라우트의 preferredRegion export 는 적용되지 않았다.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// 임시 조각을 이어 붙여 연결된 NAS 행사 폴더로 옮기고, 받기 링크를 만들어 기록한다.
// 오래 걸리므로 진행 상황을 한 줄에 JSON 하나씩(NDJSON) 흘려보낸다:
//   {stage:"nas", sent, total} … {stage:"verify"} {stage:"share"} {done:true, program} | {error}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true, nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { user, quote } = ctx;
  if (!quote.programFolder) return fail("먼저 NAS 행사 폴더를 연결해 주세요", 409);
  const folder = eventFolderPath(quote.programFolder);

  const body = (await request.json().catch(() => null)) as {
    uploadId?: unknown;
    fileName?: unknown;
    size?: unknown;
    version?: unknown;
    note?: unknown;
  } | null;
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
  const dir = tmpDir(id, uploadId);
  const { data: listed, error: listError } = await bucket.list(dir, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  const partNames = (listed ?? []).map((f) => f.name).sort();
  const removeTmp = async () => {
    if (partNames.length) await bucket.remove(partNames.map((n) => `${dir}/${n}`)).catch(() => {});
  };
  if (listError || partNames.length === 0) {
    return NextResponse.json({ error: "올린 조각을 찾지 못했습니다. 다시 올려 주세요" }, { status: 400 });
  }
  const listedSize = (listed ?? []).reduce((sum, f) => sum + Number(f.metadata?.size ?? 0), 0);
  if (listedSize !== size) {
    await removeTmp();
    return NextResponse.json({ error: "올린 조각의 크기가 파일과 다릅니다. 다시 올려 주세요" }, { status: 400 });
  }

  async function* chunks(): AsyncGenerator<Uint8Array> {
    for (const name of partNames) {
      const { data, error } = await bucket.download(`${dir}/${name}`);
      if (error || !data) throw new SynologyError("임시 보관한 조각을 읽지 못했습니다");
      yield new Uint8Array(await data.arrayBuffer());
    }
  }

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

      let sid: string | null = null;
      let nasPath: string | null = null;
      let shareId: string | null = null;
      try {
        send({ stage: "login" });
        sid = await login();

        // 연결된 폴더가 NAS에서 없어졌으면 새로 만들지 않고 멈춘다 (이름이 바뀐 것일 수 있다)
        if ((await listFolder(sid, folder)) === null) {
          throw new SynologyError("NAS에서 행사 폴더를 찾을 수 없습니다. 폴더를 다시 연결해 주세요");
        }

        // 같은 이름이 있으면 덮어쓰지 않고 시각을 붙인 이름으로 올린다
        let storedName = fileName;
        if ((await fileSize(sid, `${folder}/${storedName}`)) !== null) {
          storedName = timestampedName(fileName);
        }
        const target = `${folder}/${storedName}`;

        send({ stage: "nas", sent: 0, total: size });
        let lastSent = 0;
        await uploadFile(sid, {
          folder,
          fileName: storedName,
          size,
          chunks: chunks(),
          onProgress: (sent) => {
            if (sent - lastSent >= 1024 * 1024 || sent === size) {
              lastSent = sent;
              send({ stage: "nas", sent, total: size });
            }
          },
        });
        nasPath = target;

        send({ stage: "verify" });
        const stored = await fileSize(sid, target);
        if (stored !== size) {
          throw new SynologyError("NAS에 저장된 파일 크기가 원본과 다릅니다");
        }

        send({ stage: "share" });
        const link = await createShareLink(sid, target);
        shareId = link.id;

        const program = await prisma.quoteProgram.create({
          data: {
            quoteId: id,
            fileName: storedName,
            size,
            version,
            note,
            nasPath: target,
            shareId: link.id,
            shareUrl: link.url,
            uploadedById: user.id,
          },
          select: { id: true, fileName: true, size: true, version: true, note: true, createdAt: true },
        });

        send({ done: true, program: { ...program, uploadedBy: { name: user.name } } });
      } catch (e) {
        // 기록을 남기지 못했으면 NAS에 올라간 것도 되돌린다 (목록에 없는 파일이 남지 않게)
        if (sid) {
          if (shareId) await deleteShareLink(sid, shareId).catch(() => {});
          if (nasPath) await deleteFile(sid, nasPath).catch(() => {});
        }
        const message = e instanceof SynologyError ? e.message : "NAS로 옮기는 중 오류가 발생했습니다";
        console.error("완료 프로그램 올리기 실패:", e instanceof Error ? e.message : e);
        send({ error: message });
      } finally {
        if (sid) await logout(sid);
        await removeTmp();
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
