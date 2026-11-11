import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MATERIAL_FOLDERS, canDeleteMaterial, canUploadProgram, materialUploadOpen } from "@/lib/programUpload";
import { FILE_ROWS, programContext } from "@/lib/programAccess";
import { SynologyError, eventFolderPath, listFolder, nasBaseDir, synologyConfigured, withSession, type NasEntry } from "@/lib/synology";

// 행사 자료·완료 프로그램 목록 — 연결된 NAS 행사 폴더와 그 아래 자료 폴더(디자인·기타 자료)의 실제 내용을 그대로 보여 준다.
// 견적을 볼 수 있는 사람(개발팀 + 해당 견적 사업팀)에게만. 공유 링크는 응답에 넣지 않는다.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await programContext(id);
  if (ctx instanceof NextResponse) return ctx;
  const { user, quote } = ctx;
  const canManage = canUploadProgram(user.role);

  const base = {
    canManage,
    // 자료(디자인·기타 자료)는 견적을 볼 수 있으면 올릴 수 있다. 반려·미진행 견적은 닫는다.
    canUploadMaterial: materialUploadOpen(quote.status),
    configured: synologyConfigured(),
    baseDir: nasBaseDir(),
    // 이 API가 실제로 돈 리전 — NAS는 해외 IP를 막으므로 icn1 이어야 한다 (배포 후 확인용)
    region: process.env.VERCEL_REGION ?? "local",
    eventName: quote.eventName,
    folder: quote.programFolder,
    folderMissing: false,
    nasError: null as string | null,
    files: [] as unknown[],
    materials: MATERIAL_FOLDERS.map((dir) => ({ dir, files: [] as unknown[] })),
  };
  if (!base.configured || !quote.programFolder) return NextResponse.json(base);

  const folderPath = eventFolderPath(quote.programFolder);
  try {
    const listed = await withSession(async (sid) => {
      const root = await listFolder(sid, folderPath);
      if (root === null) return null;
      const subs: Record<string, NasEntry[]> = {};
      for (const dir of MATERIAL_FOLDERS) {
        // 자료 폴더는 처음 올릴 때 생긴다 — 아직 없으면 빈 목록
        subs[dir] = root.some((e) => e.isDir && e.name === dir) ? ((await listFolder(sid, `${folderPath}/${dir}`)) ?? []) : [];
      }
      return { root, subs };
    });
    if (listed === null) return NextResponse.json({ ...base, folderMissing: true });

    const pathOf = (dir: string, name: string) => (dir ? `${folderPath}/${dir}/${name}` : `${folderPath}/${name}`);
    const allPaths = [
      ...listed.root.filter((e) => !e.isDir).map((e) => pathOf("", e.name)),
      ...MATERIAL_FOLDERS.flatMap((dir) => listed.subs[dir].filter((e) => !e.isDir).map((e) => pathOf(dir, e.name))),
    ];

    // 웹에서 올린 파일의 버전·메모·올린 사람 (같은 폴더를 쓰는 다른 견적에서 올린 것도 포함)
    const rows = await prisma.quoteProgram.findMany({
      where: { nasPath: { in: allPaths }, ...FILE_ROWS, uploadedById: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { nasPath: true, version: true, note: true, uploadedById: true, uploadedBy: { select: { name: true } } },
    });
    const byPath = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!byPath.has(r.nasPath)) byPath.set(r.nasPath, r);

    const view = (dir: string, entries: NasEntry[]) =>
      entries
        .map((e) => {
          const row = e.isDir ? undefined : byPath.get(pathOf(dir, e.name));
          return {
            name: e.name,
            isDir: e.isDir,
            size: e.size,
            mtime: e.mtime,
            viaWeb: !!row,
            // 웹에서 올린 파일만 웹에서 지운다. 완료 프로그램 = 개발팀 / 자료 = 올린 본인 + 개발팀
            canDelete: !!row && (dir ? canDeleteMaterial(user, row.uploadedById) : canManage),
            version: row?.version ?? null,
            note: row?.note ?? null,
            uploadedBy: row?.uploadedBy?.name ?? null,
          };
        })
        .sort((a, b) => Number(a.isDir) - Number(b.isDir) || b.mtime - a.mtime);

    const materialNames = MATERIAL_FOLDERS as readonly string[];
    return NextResponse.json({
      ...base,
      // 자료 폴더는 따로 보여 주므로 행사 폴더 목록에서는 뺀다
      files: view("", listed.root.filter((e) => !(e.isDir && materialNames.includes(e.name)))),
      materials: MATERIAL_FOLDERS.map((dir) => ({ dir, files: view(dir, listed.subs[dir]) })),
    });
  } catch (e) {
    console.error("행사 자료 목록 실패:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ...base, nasError: e instanceof SynologyError ? e.message : "NAS 폴더를 읽지 못했습니다" });
  }
}
