import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canUploadProgram } from "@/lib/programUpload";
import { FILE_ROWS, programContext } from "@/lib/programAccess";
import { SynologyError, eventFolderPath, listFolder, nasBaseDir, synologyConfigured, withSession } from "@/lib/synology";

// 완료 프로그램 목록 — 연결된 NAS 행사 폴더의 실제 내용을 그대로 보여 준다.
// 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)에게만. 공유 링크는 응답에 넣지 않는다.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id);
  if (ctx instanceof NextResponse) return ctx;
  const { user, quote } = ctx;

  const base = {
    canManage: canUploadProgram(user.role),
    configured: synologyConfigured(),
    baseDir: nasBaseDir(),
    eventName: quote.eventName,
    folder: quote.programFolder,
    folderMissing: false,
    nasError: null as string | null,
    files: [] as unknown[],
  };
  if (!base.configured || !quote.programFolder) return NextResponse.json(base);

  const folderPath = eventFolderPath(quote.programFolder);
  try {
    const entries = await withSession((sid) => listFolder(sid, folderPath));
    if (entries === null) return NextResponse.json({ ...base, folderMissing: true });

    // 웹에서 올린 파일의 버전·메모·올린 사람 (같은 폴더를 쓰는 다른 견적에서 올린 것도 포함)
    const rows = await prisma.quoteProgram.findMany({
      where: { nasPath: { in: entries.filter((e) => !e.isDir).map((e) => `${folderPath}/${e.name}`) }, ...FILE_ROWS, uploadedById: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { nasPath: true, version: true, note: true, uploadedBy: { select: { name: true } } },
    });
    const byPath = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!byPath.has(r.nasPath)) byPath.set(r.nasPath, r);

    const files = entries
      .map((e) => {
        const row = e.isDir ? undefined : byPath.get(`${folderPath}/${e.name}`);
        return {
          name: e.name,
          isDir: e.isDir,
          size: e.size,
          mtime: e.mtime,
          viaWeb: !!row,
          version: row?.version ?? null,
          note: row?.note ?? null,
          uploadedBy: row?.uploadedBy?.name ?? null,
        };
      })
      .sort((a, b) => Number(a.isDir) - Number(b.isDir) || b.mtime - a.mtime);

    return NextResponse.json({ ...base, files });
  } catch (e) {
    console.error("완료 프로그램 목록 실패:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ...base, nasError: e instanceof SynologyError ? e.message : "NAS 폴더를 읽지 못했습니다" });
  }
}
