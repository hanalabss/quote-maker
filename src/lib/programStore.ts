// 파일 하나를 NAS 행사 폴더에 넣고 받기 링크·DB 기록까지 남긴다 — 서버 전용.
// 조각으로 올린 큰 파일(complete)과 한 번에 보낸 작은 파일(direct)이 같이 쓴다.
import { prisma } from "@/lib/db";
import { noteMaterialUpload } from "@/lib/programAccess";
import { timestampedName, type UploadDir } from "@/lib/programUpload";
import {
  SynologyError,
  createShareLink,
  deleteFile,
  deleteShareLink,
  fileSize,
  listFolder,
  uploadFile,
  withSession,
} from "@/lib/synology";

export type StoreStage = { stage: "login" } | { stage: "nas"; sent: number; total: number } | { stage: "verify" } | { stage: "share" };

export async function storeProgramFile(opts: {
  quoteId: string;
  userId: string;
  eventFolder: string; // 행사 폴더 전체 경로
  dir: UploadDir;
  fileName: string; // sanitizeFileName 을 거친 이름
  size: number;
  version: string | null;
  note: string | null;
  chunks: AsyncIterable<Uint8Array>;
  onStage?: (s: StoreStage) => void;
}) {
  const { quoteId, userId, eventFolder, dir, fileName, size, version, note } = opts;
  // 자료 폴더는 없으면 올릴 때 NAS가 만든다 (create_parents)
  const folder = dir ? `${eventFolder}/${dir}` : eventFolder;

  opts.onStage?.({ stage: "login" });
  // 올리기 전 확인 — 다시 해도 되는 호출이라 세션이 끊겼으면 여기서 새로 로그인된다. 올리기는 그 세션으로 한다.
  const { sid, storedName } = await withSession(async (sid) => {
    const [eventEntries, existingSize] = await Promise.all([listFolder(sid, eventFolder), fileSize(sid, `${folder}/${fileName}`)]);
    // 연결된 폴더가 NAS에서 없어졌으면 새로 만들지 않고 멈춘다 (이름이 바뀐 것일 수 있다)
    if (eventEntries === null) throw new SynologyError("NAS에서 행사 폴더를 찾을 수 없습니다. 폴더를 다시 연결해 주세요");
    // 같은 이름이 있으면 덮어쓰지 않고 시각을 붙인 이름으로 올린다
    return { sid, storedName: existingSize !== null ? timestampedName(fileName) : fileName };
  });
  const target = `${folder}/${storedName}`;

  let uploaded = false;
  let shareId: string | null = null;
  try {
    opts.onStage?.({ stage: "nas", sent: 0, total: size });
    let lastSent = 0;
    await uploadFile(sid, {
      folder,
      fileName: storedName,
      size,
      chunks: opts.chunks,
      onProgress: (sent) => {
        if (sent - lastSent >= 1024 * 1024 || sent === size) {
          lastSent = sent;
          opts.onStage?.({ stage: "nas", sent, total: size });
        }
      },
    });
    uploaded = true;

    opts.onStage?.({ stage: "verify" });
    if ((await fileSize(sid, target)) !== size) throw new SynologyError("NAS에 저장된 파일 크기가 원본과 다릅니다");

    opts.onStage?.({ stage: "share" });
    const link = await createShareLink(sid, target);
    shareId = link.id;

    const program = await prisma.quoteProgram.create({
      data: { quoteId, fileName: storedName, size, version, note, nasPath: target, shareId: link.id, shareUrl: link.url, uploadedById: userId },
      select: { id: true, fileName: true, size: true, version: true, note: true, createdAt: true },
    });
    return program;
  } catch (e) {
    // 기록을 남기지 못했으면 NAS에 올라간 것도 되돌린다 (목록에 없는 파일이 남지 않게)
    if (shareId) await deleteShareLink(sid, shareId).catch(() => {});
    if (uploaded) await deleteFile(sid, target).catch(() => {});
    throw e;
  }
}

/** 자료를 올렸다는 댓글 — 상대(사업팀 ↔ 개발팀)가 알 수 있게 개발 채널에 남긴다. 실패해도 올리기는 성공으로 둔다. */
export async function noteUploadQuietly(quoteId: string, userId: string, dir: UploadDir, fileName: string) {
  if (!dir) return;
  await noteMaterialUpload(quoteId, userId, dir, fileName).catch((e) =>
    console.error("자료 올림 댓글 기록 실패:", e instanceof Error ? e.message : e),
  );
}
