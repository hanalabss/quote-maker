import { NextRequest, NextResponse } from "next/server";
import { sanitizeFolderName } from "@/lib/programUpload";
import { clearFolderLink, fail, nasFail, programContext, setFolderLink } from "@/lib/programAccess";
import { ensureFolder, eventFolderPath, listFolder, nasBaseDir, withSession } from "@/lib/synology";

// 행사 폴더 연결 — 기존 폴더를 고르거나(create=false) 새로 만든다(create=true). 개발팀만.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true, nas: true });
  if (ctx instanceof NextResponse) return ctx;

  const body = (await request.json().catch(() => null)) as { name?: unknown; create?: unknown } | null;
  const raw = typeof body?.name === "string" ? body.name : "";
  const name = sanitizeFolderName(raw);
  if (!name) return fail("폴더 이름이 올바르지 않습니다", 400);
  const create = body?.create === true;

  try {
    const result = await withSession(async (sid) => {
      // 이름 비교는 NAS가 돌려준 실제 폴더 목록으로 한다 (대소문자·공백 차이로 엉뚱한 폴더를 가리키지 않게)
      const existing = (await listFolder(sid, nasBaseDir())) ?? [];
      const found = existing.find((e) => e.isDir && e.name === name);
      if (found) return create ? ("exists" as const) : ("ok" as const);
      if (!create) return "missing" as const;
      await ensureFolder(sid, eventFolderPath(name));
      return "created" as const;
    });
    if (result === "missing") return fail("NAS에 그 폴더가 없습니다", 404);
    if (result === "exists") return fail("같은 이름의 폴더가 이미 있습니다. 기존 폴더에서 골라 주세요", 409);

    await setFolderLink(id, name, ctx.user.id);
    return NextResponse.json({ folder: name, created: result === "created" });
  } catch (e) {
    return nasFail(e, "폴더를 연결하지 못했습니다");
  }
}

// 연결 해제 — 견적과의 연결만 끊는다. NAS의 폴더와 파일은 건드리지 않는다.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true });
  if (ctx instanceof NextResponse) return ctx;

  await clearFolderLink(id);
  return NextResponse.json({ ok: true });
}
