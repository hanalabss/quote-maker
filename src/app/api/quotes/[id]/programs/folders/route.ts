import { NextRequest, NextResponse } from "next/server";
import { rankFolders, sanitizeFolderName } from "@/lib/programUpload";
import { nasFail, programContext } from "@/lib/programAccess";
import { listFolder, nasBaseDir, withSession } from "@/lib/synology";

// 연결할 수 있는 기존 행사 폴더 목록 — 견적 행사명과 닮은 것을 앞에. 개발팀만.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true, nas: true });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const entries = await withSession((sid) => listFolder(sid, nasBaseDir()));
    if (entries === null) return NextResponse.json({ error: "NAS에 [행사 자료] 폴더가 없습니다" }, { status: 502 });
    const names = entries.filter((e) => e.isDir).map((e) => e.name);
    return NextResponse.json({
      folders: rankFolders(ctx.quote.eventName, names),
      newName: sanitizeFolderName(ctx.quote.eventName),
    });
  } catch (e) {
    return nasFail(e, "NAS 폴더 목록을 읽지 못했습니다");
  }
}
