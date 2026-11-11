// 완료 프로그램 올리기 — 화면·API·테스트가 같이 쓰는 규칙 (순수 함수만)
//
// 흐름: 브라우저가 파일을 조각내 Supabase 임시 폴더에 올린다 → 서버가 조각을 이어 붙여 Synology NAS로 옮긴다
//       → NAS 공유 링크를 만들어 DB에 남긴다 → 임시 조각을 지운다.
// 서버를 거쳐 한 번에 못 올리는 이유: Vercel 요청 본문 4.5MB 제한. 브라우저가 NAS로 직접 못 올리는 이유: NAS에 CORS 허용이 없다.

export const PROGRAM_PART_SIZE = 8 * 1024 * 1024; // 조각 크기 8MB
export const PROGRAM_MAX_SIZE = 500 * 1024 * 1024; // 파일 하나 500MB
export const PROGRAM_EXTENSIONS = [".zip", ".7z", ".rar", ".exe", ".msi", ".apk"];
export const PROGRAM_TMP_PREFIX = "program-tmp";
// 보관 위치: NAS [행사 자료] 아래 행사 폴더 — 견적마다 행사 폴더 하나를 연결한다.
// 목록의 기준은 NAS 폴더의 실제 내용이다 (NAS에 직접 넣은 파일도 웹에 보인다).
export const DEFAULT_NAS_BASE_DIR = "/공유폴더/①프로그램 개발/개발팀/[행사 자료]";

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

/** 행사 폴더명 정리 — 경로 한 칸짜리 이름만 허용한다. 쓸 수 없으면 빈 문자열. */
export function sanitizeFolderName(name: string): string {
  if (name.includes("/") || name.includes("\\")) return "";
  const cleaned = name
    .replace(/[<>:"|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned.startsWith("#") || cleaned.startsWith("@")) return "";
  return cleaned.slice(0, 80);
}

// 비교용: 괄호 안·기호와 흔한 꼬리말을 뺀다
function folderKey(v: string): string {
  return v
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/행사|키오스크|프로그램|포토카드|카드발급|팝업스토어|팝업|20\d\d/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function longestCommon(a: string, b: string): number {
  let best = 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const keep = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = keep;
    }
  }
  return best;
}

/**
 * 견적 행사명과 닮은 기존 폴더를 앞에 놓는다. 닮은 것(겹치는 글자 2자 이상)에는 suggested 표시.
 * 자동으로 연결하지는 않는다 — 고르는 것은 사람이다.
 */
export function rankFolders(eventName: string, folders: string[]): { name: string; suggested: boolean }[] {
  const key = folderKey(eventName);
  return folders
    .map((name) => {
      const score = key ? longestCommon(key, folderKey(name)) : 0;
      return { name, score: score >= 2 ? score : 0 }; // 한 글자 겹침은 닮은 것으로 치지 않는다
    })
    // 닮은 폴더만 앞으로, 나머지는 이름순 그대로 (찾기 쉽게)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ko"))
    .map(({ name, score }) => ({ name, suggested: score > 0 }));
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
