import { NextRequest, NextResponse } from "next/server";
import { fail, nasFail, programContext, setFolderShare } from "@/lib/programAccess";
import { createShareLink, eventFolderPath, listFolder, shareLinkAlive, withSession } from "@/lib/synology";

// 폴더 열기 — 연결된 행사 폴더의 NAS 공유 페이지로 넘긴다 (안의 파일을 모두 보고 받을 수 있다).
// 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)만.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id, { nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { quote } = ctx;
  if (!quote.programFolder) return fail("연결된 행사 폴더가 없습니다", 404);

  const folderPath = eventFolderPath(quote.programFolder);
  try {
    const url = await withSession(async (sid) => {
      if (quote.programFolderShareId && quote.programFolderShareUrl && (await shareLinkAlive(sid, quote.programFolderShareId, folderPath))) {
        return quote.programFolderShareUrl;
      }
      if ((await listFolder(sid, folderPath)) === null) return null;
      const link = await createShareLink(sid, folderPath);
      await setFolderShare(id, link.id, link.url);
      return link.url;
    });
    if (!url) return fail("NAS에서 행사 폴더를 찾을 수 없습니다", 404);
    return NextResponse.redirect(url);
  } catch (e) {
    return nasFail(e, "폴더를 열지 못했습니다");
  }
}
