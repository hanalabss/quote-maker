// 완료 프로그램 API 공통 — 로그인·견적 접근 범위·올리기 권한 확인, 그리고 견적 ↔ NAS 행사 폴더 연결 기록.
//
// QuoteProgram 테이블에 두 종류의 행이 들어간다:
//   파일 행    size >= 0. 파일별 받기 링크. uploadedById 가 있으면 웹에서 올린 파일(버전·메모 포함, 웹에서 삭제 가능),
//              없으면 NAS에 직접 넣은 파일(첫 받기 때 링크만 기록, 웹에서 삭제 불가).
//   폴더 연결 행  size = FOLDER_LINK(-1). 견적마다 하나. fileName = 행사 폴더명, nasPath = 폴더 전체 경로,
//              shareId/shareUrl = 폴더 공유 링크(아직 없으면 빈 문자열).
//
// 행사 자료(디자인·기타 자료)는 행사 폴더 아래 고정 이름의 하위 폴더에 놓인다. 파일 행의 nasPath 에 하위 폴더가
// 그대로 들어가므로 행 종류는 늘지 않는다. 자료는 견적을 볼 수 있는 사람이면 올릴 수 있고(개발팀 + 요청한 사업팀),
// 폴더가 아직 연결되지 않은 견적에서는 행사명으로 행사 폴더를 만들어 연결한다 (ensureEventFolder).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { canAccessQuote } from "@/lib/quoteAccess";
import { autoFolderNames, canUploadProgram } from "@/lib/programUpload";
import { SynologyError, ensureFolder, eventFolderPath, listFolder, nasBaseDir, synologyConfigured, withSession } from "@/lib/synology";

export const FOLDER_LINK = -1;
/** 파일 행만 고르는 조건 */
export const FILE_ROWS = { size: { gte: 0 } } as const;

export type ProgramQuote = {
  id: string;
  quoteNumber: string;
  eventName: string;
  status: string;
  isExternal: boolean;
  createdById: string | null;
  devAssigneeId: string | null;
  programFolder: string | null;
  programFolderShareId: string | null;
  programFolderShareUrl: string | null;
};

export const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * manage = 폴더 연결·올리기·지우기 (개발팀, dev_staff는 담당 견적만)
 * nas    = NAS 연동 설정이 있어야 하는 호출
 */
export async function programContext(
  id: string,
  opts: { manage?: boolean; nas?: boolean } = {},
): Promise<{ user: AuthUser; quote: ProgramQuote } | NextResponse> {
  const user = await getAuthUser();
  if (!user) return fail("로그인이 필요합니다", 401);
  if (opts.manage && !canUploadProgram(user.role)) return fail("권한이 없습니다", 403);

  const q = await prisma.quote.findUnique({
    where: { id },
    select: { id: true, quoteNumber: true, eventName: true, status: true, isExternal: true, createdById: true, devAssigneeId: true },
  });
  if (!q) return fail("견적을 찾을 수 없습니다", 404);
  if (!canAccessQuote(user, q)) return fail("권한이 없습니다", 403);

  if (opts.nas && !synologyConfigured()) {
    return fail("NAS 연동이 아직 설정되지 않았습니다 (서버 환경변수 SYNOLOGY_URL·USER·PASSWORD)", 503);
  }

  const link = await prisma.quoteProgram.findFirst({
    where: { quoteId: id, size: FOLDER_LINK },
    orderBy: { createdAt: "desc" },
    select: { fileName: true, shareId: true, shareUrl: true },
  });
  return {
    user,
    quote: {
      ...q,
      programFolder: link?.fileName ?? null,
      programFolderShareId: link?.shareId || null,
      programFolderShareUrl: link?.shareUrl || null,
    },
  };
}

/** 견적에 행사 폴더를 연결한다 (이전 연결은 대체). NAS는 건드리지 않는다. */
export async function setFolderLink(quoteId: string, folderName: string, userId: string) {
  await prisma.$transaction([
    prisma.quoteProgram.deleteMany({ where: { quoteId, size: FOLDER_LINK } }),
    prisma.quoteProgram.create({
      data: {
        quoteId,
        fileName: folderName,
        size: FOLDER_LINK,
        nasPath: eventFolderPath(folderName),
        shareId: "",
        shareUrl: "",
        uploadedById: userId,
      },
    }),
  ]);
}

/**
 * 행사 폴더가 아직 연결되지 않은 견적에 자료를 올릴 때 — 행사명으로 폴더를 만들어 연결하고 폴더명을 돌려준다.
 * 같은 이름의 폴더가 이미 있으면 남의 행사 폴더일 수 있으므로 쓰지 않고 견적번호를 붙인 이름으로 만든다.
 */
export async function ensureEventFolder(quote: ProgramQuote, userId: string): Promise<string> {
  if (quote.programFolder) return quote.programFolder;
  const [plain, numbered] = autoFolderNames(quote.eventName, quote.quoteNumber);
  const name = await withSession(async (sid) => {
    const existing = await listFolder(sid, nasBaseDir());
    if (existing === null) throw new SynologyError("NAS에 [행사 자료] 폴더가 없습니다");
    const has = (n: string) => existing.some((e) => e.name === n);
    const pick = has(plain) ? numbered : plain;
    // 견적번호가 붙은 이름이 이미 있으면 이 견적이 전에 만든 폴더다 — 그대로 다시 연결한다
    if (!has(pick)) await ensureFolder(sid, eventFolderPath(pick));
    return pick;
  });
  await setFolderLink(quote.id, name, userId);
  return name;
}

/**
 * 자료를 올렸다는 것을 개발 채널 댓글로 남긴다 (상대가 알 수 있게).
 * 여러 파일을 이어서 올리면 댓글이 줄줄이 생기지 않게, 같은 사람이 10분 안에 같은 폴더에 올린 것은 한 댓글에 모은다.
 */
export async function noteMaterialUpload(quoteId: string, userId: string, dir: string, fileName: string) {
  const head = `[자료 올림] ${dir}`;
  const last = await prisma.quoteComment.findFirst({
    where: { quoteId, visibility: "dev" },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, content: true, createdAt: true },
  });
  if (last && last.userId === userId && last.content.startsWith(head + "\n") && Date.now() - last.createdAt.getTime() < 10 * 60 * 1000) {
    await prisma.quoteComment.update({ where: { id: last.id }, data: { content: `${last.content}\n- ${fileName}` } });
  } else {
    await prisma.quoteComment.create({ data: { quoteId, userId, visibility: "dev", content: `${head}\n- ${fileName}` } });
  }
}

export async function clearFolderLink(quoteId: string) {
  await prisma.quoteProgram.deleteMany({ where: { quoteId, size: FOLDER_LINK } });
}

export async function setFolderShare(quoteId: string, shareId: string, shareUrl: string) {
  await prisma.quoteProgram.updateMany({ where: { quoteId, size: FOLDER_LINK }, data: { shareId, shareUrl } });
}

/** NAS 오류를 응답으로 — 원인 문구는 SynologyError 것만 내보낸다 */
export function nasFail(e: unknown, fallback: string) {
  console.error(`${fallback}:`, e instanceof Error ? e.message : e);
  return fail(e instanceof SynologyError ? e.message : fallback, 502);
}
