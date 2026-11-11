import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FILE_ROWS, fail, nasFail, programContext } from "@/lib/programAccess";
import {
  SynologyError,
  createShareLink,
  deleteFile,
  deleteShareLink,
  eventFolderPath,
  listFolder,
  shareLinkAlive,
  withSession,
} from "@/lib/synology";

// 파일명은 주소로 들어오므로 믿지 않는다 — 폴더의 실제 목록에 있는 파일일 때만 다룬다.
function requestedName(request: NextRequest): string | null {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!name || name.includes("/") || name.includes("\\") || name === "." || name === "..") return null;
  return name;
}

// 받기 — 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)만 NAS 공유 링크로 넘긴다.
// NAS에 직접 넣은 파일도 받을 수 있다 (첫 받기 때 링크를 만들어 기록).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { quote } = ctx;
  const name = requestedName(request);
  if (!name) return fail("잘못된 요청입니다", 400);
  if (!quote.programFolder) return fail("연결된 행사 폴더가 없습니다", 404);

  const folderPath = eventFolderPath(quote.programFolder);
  const nasPath = `${folderPath}/${name}`;
  try {
    const url = await withSession(async (sid) => {
      const entry = (await listFolder(sid, folderPath))?.find((e) => !e.isDir && e.name === name);
      if (!entry) return null;

      const row = await prisma.quoteProgram.findFirst({ where: { nasPath, ...FILE_ROWS }, orderBy: { createdAt: "desc" } });
      if (row && (await shareLinkAlive(sid, row.shareId, nasPath))) return row.shareUrl;

      const link = await createShareLink(sid, nasPath);
      if (row) {
        await prisma.quoteProgram.update({ where: { id: row.id }, data: { shareId: link.id, shareUrl: link.url, size: entry.size } });
      } else {
        await prisma.quoteProgram.create({
          // uploadedById 없음 = NAS에 직접 넣은 파일
          data: { quoteId: id, fileName: name, size: entry.size, nasPath, shareId: link.id, shareUrl: link.url },
        });
      }
      return link.url;
    });
    if (!url) return fail("NAS 폴더에 그 파일이 없습니다", 404);
    return NextResponse.redirect(url);
  } catch (e) {
    return nasFail(e, "받기 링크를 만들지 못했습니다");
  }
}

// 지우기 — 개발팀만, 웹에서 올린 파일만. NAS에 직접 넣은 파일은 NAS에서 지운다.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { manage: true, nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { quote } = ctx;
  const name = requestedName(request);
  if (!name) return fail("잘못된 요청입니다", 400);
  if (!quote.programFolder) return fail("연결된 행사 폴더가 없습니다", 404);

  const nasPath = `${eventFolderPath(quote.programFolder)}/${name}`;
  const rows = await prisma.quoteProgram.findMany({ where: { nasPath, ...FILE_ROWS } });
  if (!rows.some((r) => r.uploadedById)) {
    return fail("웹에서 올린 파일만 여기서 지울 수 있습니다. NAS에 직접 넣은 파일은 NAS에서 지워 주세요", 403);
  }

  try {
    await withSession(async (sid) => {
      // 이미 없어진 링크는 지워진 것으로 본다 (실측: 없는 링크 삭제 = 코드 401, 문서상 2000). 없는 파일 삭제는 NAS가 오류 없이 넘어간다.
      const linkGone = (e: unknown) => e instanceof SynologyError && [401, 408, 2000].includes(e.code ?? -1);
      for (const r of rows) {
        await deleteShareLink(sid, r.shareId).catch((e) => {
          if (!linkGone(e)) throw e;
        });
      }
      await deleteFile(sid, nasPath);
    });
  } catch (e) {
    return nasFail(e, "NAS에서 지우지 못했습니다");
  }

  await prisma.quoteProgram.deleteMany({ where: { nasPath, ...FILE_ROWS } });
  return NextResponse.json({ ok: true });
}
