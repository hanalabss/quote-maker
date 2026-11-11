// 완료 프로그램 올리기 — 화면·API·테스트가 같이 쓰는 규칙 (순수 함수만)
//
// 흐름: 브라우저가 파일을 조각내 Supabase 임시 폴더에 올린다 → 서버가 조각을 이어 붙여 Synology NAS로 옮긴다
//       → NAS 공유 링크를 만들어 DB에 남긴다 → 임시 조각을 지운다.
// 서버를 거쳐 한 번에 못 올리는 이유: Vercel 요청 본문 4.5MB 제한. 브라우저가 NAS로 직접 못 올리는 이유: NAS에 CORS 허용이 없다.

export const PROGRAM_PART_SIZE = 8 * 1024 * 1024; // 조각 크기 8MB
export const PROGRAM_MAX_SIZE = 500 * 1024 * 1024; // 파일 하나 500MB
export const PROGRAM_EXTENSIONS = [".zip", ".7z", ".rar", ".exe", ".msi", ".apk"];
export const PROGRAM_TMP_PREFIX = "program-tmp";
export const DEFAULT_NAS_BASE_DIR = "/개발팀/완료 프로그램";

/** 올릴 수 있는 사람: 개발팀 전체. 담당자(dev_staff)는 견적 접근 범위(담당 견적)가 따로 걸린다. */
export function canUploadProgram(role: string | null | undefined): boolean {
  return role === "dev" || role === "dev_staff";
}

export function partCount(size: number, partSize: number = PROGRAM_PART_SIZE): number {
  return Math.max(1, Math.ceil(size / partSize));
}

/** NAS·윈도우에서 못 쓰는 문자를 걸러낸 파일명. 경로 조각은 버린다. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");
  return cleaned.slice(0, 150);
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i).toLowerCase();
}

/** 올리기 전 검사. 문제가 없으면 null, 있으면 사용자에게 보여 줄 문구. */
export function validateProgramFile(name: string, size: number): string | null {
  const safe = sanitizeFileName(name);
  if (!safe) return "파일명이 올바르지 않습니다";
  if (!PROGRAM_EXTENSIONS.includes(fileExtension(safe))) {
    return `올릴 수 있는 형식: ${PROGRAM_EXTENSIONS.join(", ")}`;
  }
  if (!Number.isInteger(size) || size <= 0) return "빈 파일은 올릴 수 없습니다";
  if (size > PROGRAM_MAX_SIZE) {
    return `파일 크기가 ${Math.round(PROGRAM_MAX_SIZE / 1024 / 1024)}MB를 넘습니다`;
  }
  return null;
}

export function isUploadId(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
}

/** 임시 조각이 놓이는 폴더 — 견적 id를 넣어 다른 견적의 조각을 끌어다 쓸 수 없게 한다. */
export function tmpDir(quoteId: string, uploadId: string): string {
  return `${PROGRAM_TMP_PREFIX}/${quoteId}/${uploadId}`;
}

export function tmpPartPath(quoteId: string, uploadId: string, index: number): string {
  return `${tmpDir(quoteId, uploadId)}/${String(index).padStart(5, "0")}`;
}

/** 같은 이름이 NAS에 이미 있을 때 쓸 이름: 260111-1432_파일명.zip (한국 시각) */
export function timestampedName(name: string, now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}-${g("hour")}${g("minute")}_${name}`;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
