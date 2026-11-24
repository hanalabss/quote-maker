import { NextRequest, NextResponse, after } from "next/server";
import { ensureEventFolder, fail, nasFail, programContext } from "@/lib/programAccess";
import { noteUploadQuietly, storeProgramFile } from "@/lib/programStore";
import { eventFolderPath } from "@/lib/synology";
import { PROGRAM_DIRECT_MAX, materialUploadOpen, parseUploadDir, sanitizeFileName, validateProgramFile } from "@/lib/programUpload";

// NAS는 해외 IP를 막는다 — 이 라우트도 vercel.json 의 programs/** 설정으로 서울(icn1)에서 돈다.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 작은 파일(PROGRAM_DIRECT_MAX 이하) 한 번에 올리기 — 본문이 곧 파일이다. 임시 보관을 거치지 않고 바로 NAS 행사 폴더에 넣는다.
// 시안·문구 같은 자료는 대부분 이 크기 안이라, 조각 방식(init → 임시 보관 → complete)의 왕복을 건너뛴다.
// 권한은 조각 방식과 같다: 완료 프로그램(dir 없음) = 개발팀 / 자료 = 견적을 볼 수 있는 사람.
//   POST ?name=파일명&dir=디자인&version=&note=   (Content-Type: application/octet-stream)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const dir = parseUploadDir(sp.get("dir"));
  const ctx = await programContext(id, { manage: dir === "", nas: true });
  if (ctx instanceof NextResponse) return ctx;
  const { user, quote } = ctx;
  if (dir === null) return fail("잘못된 요청입니다", 400);
  if (dir && !materialUploadOpen(quote.status)) return fail("반려·미진행 견적에는 자료를 올릴 수 없습니다", 400);
  if (!dir && !quote.programFolder) return fail("먼저 NAS 행사 폴더를 연결해 주세요", 409);

  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (declared > PROGRAM_DIRECT_MAX) return fail("한 번에 보내기에는 파일이 큽니다", 413);
  const data = new Uint8Array(await request.arrayBuffer());
  if (data.length > PROGRAM_DIRECT_MAX) return fail("한 번에 보내기에는 파일이 큽니다", 413);

  const rawName = sp.get("name") ?? "";
  const invalid = validateProgramFile(rawName, data.length);
  if (invalid) return fail(invalid, 400);
  const version = (sp.get("version") ?? "").trim().slice(0, 40) || null;
  const note = (sp.get("note") ?? "").trim().slice(0, 300) || null;

  try {
    // 자료는 행사 폴더가 아직 없으면 행사명으로 만들어 연결한다
    const folderName = quote.programFolder ?? (await ensureEventFolder(quote, user.id));
    const program = await storeProgramFile({
      quoteId: id,
      userId: user.id,
      eventFolder: eventFolderPath(folderName),
      dir,
      fileName: sanitizeFileName(rawName),
      size: data.length,
      version,
      note,
      chunks: (async function* () {
        yield data;
      })(),
    });
    // 댓글 기록은 응답을 보낸 뒤에 한다
    after(() => noteUploadQuietly(id, user.id, dir, program.fileName));
    return NextResponse.json({ program: { ...program, uploadedBy: { name: user.name } }, folderCreated: !quote.programFolder });
  } catch (e) {
    return nasFail(e, "NAS에 올리지 못했습니다");
  }
}
