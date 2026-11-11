import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROGRAM_MAX_SIZE,
  PROGRAM_PART_SIZE,
  canUploadProgram,
  fileExtension,
  formatBytes,
  isUploadId,
  partCount,
  sanitizeFileName,
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
