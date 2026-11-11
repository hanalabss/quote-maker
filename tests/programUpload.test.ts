import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROGRAM_MAX_SIZE,
  PROGRAM_PART_SIZE,
  MATERIAL_FOLDERS,
  autoFolderNames,
  canDeleteMaterial,
  canUploadProgram,
  materialUploadOpen,
  parseUploadDir,
  fileExtension,
  formatBytes,
  isUploadId,
  partCount,
  rankFolders,
  sanitizeFileName,
  sanitizeFolderName,
  timestampedName,
  tmpDir,
  tmpPartPath,
  validateProgramFile,
} from "../src/lib/programUpload";

test("올리기 권한: 개발팀(dev·dev_staff)만", () => {
  assert.equal(canUploadProgram("dev"), true);
  assert.equal(canUploadProgram("dev_staff"), true);
  assert.equal(canUploadProgram("sales"), false);
  assert.equal(canUploadProgram(null), false);
});

test("조각 수: 크기에 맞게 올림, 최소 1", () => {
  assert.equal(partCount(1), 1);
  assert.equal(partCount(PROGRAM_PART_SIZE), 1);
  assert.equal(partCount(PROGRAM_PART_SIZE + 1), 2);
  assert.equal(partCount(88 * 1024 * 1024), 11);
});

test("파일명 정리: 경로 조각·금지 문자 제거, 한글 유지", () => {
  assert.equal(sanitizeFileName("C:\\fake\\카카오 설치 묶음.zip"), "카카오 설치 묶음.zip");
  assert.equal(sanitizeFileName("../../etc/passwd.zip"), "passwd.zip");
  assert.equal(sanitizeFileName('a<b>:"c"|?*.zip'), "a_b___c____.zip");
  assert.equal(sanitizeFileName("..hidden.zip "), "hidden.zip");
  assert.equal(sanitizeFileName("///"), "");
});

test("확장자", () => {
  assert.equal(fileExtension("Setup.EXE"), ".exe");
  assert.equal(fileExtension("noext"), "");
  assert.equal(fileExtension(".zip"), "");
});

test("올리기 전 검사", () => {
  assert.equal(validateProgramFile("kiosk-v1.zip", 88 * 1024 * 1024), null);
  assert.equal(validateProgramFile("setup.msi", 1), null);
  assert.match(validateProgramFile("시안.png", 100) ?? "", /형식/);
  assert.match(validateProgramFile("a.zip", 0) ?? "", /빈 파일/);
  assert.match(validateProgramFile("a.zip", 1.5) ?? "", /빈 파일/);
  assert.match(validateProgramFile("a.zip", PROGRAM_MAX_SIZE + 1) ?? "", /500MB/);
  assert.match(validateProgramFile("", 10) ?? "", /파일명/);
});

test("uploadId 형식 — 경로 조각이 끼어들 수 없다", () => {
  assert.equal(isUploadId("3f2b8c1e-9a4d-4e2b-8f6a-0123456789ab"), true);
  assert.equal(isUploadId("../other-quote/3f2b8c1e-9a4d-4e2b-8f6a-0123456789ab"), false);
  assert.equal(isUploadId(""), false);
  assert.equal(isUploadId(123), false);
});

test("임시 경로는 견적 id 아래에 놓이고 이름순 = 조각순", () => {
  const id = "3f2b8c1e-9a4d-4e2b-8f6a-0123456789ab";
  assert.equal(tmpDir("q1", id), `program-tmp/q1/${id}`);
  const paths = [10, 2, 0].map((i) => tmpPartPath("q1", id, i)).sort();
  assert.deepEqual(paths.map((p) => p.split("/").pop()), ["00000", "00002", "00010"]);
});

test("같은 이름이 있을 때 붙이는 시각은 한국 시각", () => {
  // 2026-11-11 05:32 UTC = 14:32 KST
  assert.equal(timestampedName("kiosk.zip", new Date("2026-11-11T05:32:00Z")), "261111-1432_kiosk.zip");
  // 2026-11-11 16:05 UTC = 11/12 01:05 KST
  assert.equal(timestampedName("kiosk.zip", new Date("2026-11-11T16:05:00Z")), "261112-0105_kiosk.zip");
});

test("크기 표시", () => {
  assert.equal(formatBytes(512), "0.5KB");
  assert.equal(formatBytes(88 * 1024 * 1024), "88.0MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), "1.50GB");
});

test("행사 폴더명: 한 칸짜리 이름만 — 경로·NAS 내부 이름은 거부", () => {
  assert.equal(sanitizeFolderName("NHR 기아(2026)"), "NHR 기아(2026)");
  assert.equal(sanitizeFolderName("  카카오   판교 포토카드. "), "카카오 판교 포토카드");
  assert.equal(sanitizeFolderName('a<b>:"c"'), "a b c");
  assert.equal(sanitizeFolderName("../[SK]에디터"), "");
  assert.equal(sanitizeFolderName("a/b"), "");
  assert.equal(sanitizeFolderName("a" + String.fromCharCode(92) + "b"), "");
  assert.equal(sanitizeFolderName(".."), "");
  assert.equal(sanitizeFolderName("#recycle"), "");
  assert.equal(sanitizeFolderName("@eaDir"), "");
  assert.equal(sanitizeFolderName("   "), "");
});

test("폴더 추천: 행사명과 닮은 폴더가 앞에, 안 닮은 것은 추천 표시 없음", () => {
  const folders = ["AIA", "HMC(태안)", "NHR 기아(2026)", "모꼬지(고고다이노)", "삼성바이오에피스 패밀리데이(2026)", "새별프렌즈"];
  const r1 = rankFolders("NHR(기아) 포토카드 키오스크", folders);
  assert.equal(r1[0].name, "NHR 기아(2026)");
  assert.equal(r1[0].suggested, true);
  const r2 = rankFolders("HMC 카드발급 키오스크 (태안)", folders);
  assert.equal(r2[0].name, "HMC(태안)");
  const r3 = rankFolders("카카오 판교 포토카드", folders);
  assert.equal(r3.some((f) => f.suggested), false, "닮은 폴더가 없으면 아무것도 추천하지 않는다");
  assert.equal(r3.length, folders.length);
  assert.deepEqual(rankFolders("", ["b", "a"]).map((f) => f.name), ["a", "b"]);
});

test("자료 폴더: 정해진 이름만 — 빈 값은 행사 폴더 바로 아래, 그 밖은 거부", () => {
  assert.deepEqual([...MATERIAL_FOLDERS], ["디자인", "기타 자료"]);
  assert.equal(parseUploadDir(undefined), "");
  assert.equal(parseUploadDir(null), "");
  assert.equal(parseUploadDir(""), "");
  assert.equal(parseUploadDir("디자인"), "디자인");
  assert.equal(parseUploadDir("기타 자료"), "기타 자료");
  assert.equal(parseUploadDir("../[SK]에디터"), null);
  assert.equal(parseUploadDir("디자인/.."), null);
  assert.equal(parseUploadDir("다른 폴더"), null);
  assert.equal(parseUploadDir(["디자인"]), null);
});

test("자료 올리기 전 검사: 시안·문서는 되고 실행 파일은 안 된다", () => {
  assert.equal(validateProgramFile("시안_최종.ai", 120 * 1024 * 1024, "디자인"), null);
  assert.equal(validateProgramFile("배경.PNG", 100, "디자인"), null);
  assert.equal(validateProgramFile("문구.xlsx", 100, "기타 자료"), null);
  assert.equal(validateProgramFile("묶음.zip", 100, "기타 자료"), null);
  assert.match(validateProgramFile("setup.exe", 100, "디자인") ?? "", /올릴 수 없습니다/);
  assert.match(validateProgramFile("run.bat", 100, "기타 자료") ?? "", /올릴 수 없습니다/);
  assert.match(validateProgramFile("시안.png", PROGRAM_MAX_SIZE + 1, "디자인") ?? "", /500MB/);
  // 완료 프로그램 자리(dir 없음)의 규칙은 그대로
  assert.match(validateProgramFile("시안.png", 100, "") ?? "", /형식/);
});

test("자료 권한: 반려·미진행은 닫힘, 지우기는 올린 본인과 개발팀", () => {
  assert.equal(materialUploadOpen("pending"), true);
  assert.equal(materialUploadOpen("confirmed"), true);
  assert.equal(materialUploadOpen("completed"), true);
  assert.equal(materialUploadOpen("rejected"), false);
  assert.equal(materialUploadOpen("lost"), false);

  assert.equal(canDeleteMaterial({ id: "s1", role: "sales" }, "s1"), true);
  assert.equal(canDeleteMaterial({ id: "s1", role: "sales" }, "d1"), false, "사업팀은 남이 올린 것을 못 지운다");
  assert.equal(canDeleteMaterial({ id: "s1", role: "sales" }, null), false);
  assert.equal(canDeleteMaterial({ id: "d1", role: "dev" }, "s1"), true);
  assert.equal(canDeleteMaterial({ id: "d2", role: "dev_staff" }, "s1"), true);
});

test("자동으로 만드는 행사 폴더 이름: 행사명, 겹치면 견적번호를 붙인다", () => {
  assert.deepEqual(autoFolderNames("카카오 판교 포토카드", "QT-20261104-001"), [
    "카카오 판교 포토카드",
    "카카오 판교 포토카드 (QT-20261104-001)",
  ]);
  // 폴더명으로 쓸 수 없는 행사명이면 견적번호로
  assert.deepEqual(autoFolderNames("a/b", "QT-1"), ["QT-1", "QT-1 자료"]);
  const [, numbered] = autoFolderNames("가".repeat(100), "QT-20261104-001");
  assert.ok(numbered.length <= 80 && numbered.endsWith("(QT-20261104-001)"));
});
