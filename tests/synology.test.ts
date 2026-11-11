// Synology 연동 모듈 — 가짜 NAS(로컬 http 서버)를 띄워 요청 모양을 확인한다.
// 실제 NAS 동작(권한·공유 링크)은 여기서 검증하지 못한다.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";

type Seen = { url: string; contentType: string; contentLength: number; body: Buffer };
const seen: Seen[] = [];
let uploadReply: unknown = { success: true };
let server: http.Server;

before(async () => {
  server = http.createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on("data", (d) => parts.push(d));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      seen.push({
        url: req.url ?? "",
        contentType: String(req.headers["content-type"] ?? ""),
        contentLength: Number(req.headers["content-length"] ?? -1),
        body,
      });
      const isUpload = (req.url ?? "").includes("SYNO.FileStation.Upload");
      const form = isUpload ? null : new URLSearchParams(body.toString("utf8"));
      let reply: unknown = { success: true, data: {} };
      if (isUpload) reply = uploadReply;
      else if (form?.get("api") === "SYNO.API.Auth" && form.get("method") === "login") {
        reply = form.get("passwd") === "right" ? { success: true, data: { sid: "SID123" } } : { success: false, error: { code: 400 } };
      } else if (form?.get("api") === "SYNO.FileStation.List") {
        const path = JSON.parse(form.get("path") ?? "[]")[0] as string;
        reply = path.endsWith("없음.zip")
          ? { success: true, data: { files: [{ code: 408, path }] } }
          : { success: true, data: { files: [{ path, additional: { size: 4321 } }] } };
      } else if (form?.get("api") === "SYNO.FileStation.Sharing" && form.get("method") === "create") {
        reply = { success: true, data: { links: [{ id: "abc", url: "https://nas.example/sharing/abc" }] } };
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.SYNOLOGY_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  process.env.SYNOLOGY_USER = "tester";
  process.env.SYNOLOGY_PASSWORD = "right";
  delete process.env.SYNOLOGY_BASE_DIR;
});

after(() => new Promise<void>((r) => server.close(() => r())));

const lib = () => import("../src/lib/synology");

test("로그인: 성공하면 sid, 실패 코드는 한글 문구로", async () => {
  const s = await lib();
  assert.equal(await s.login(), "SID123");
  const loginReq = seen[seen.length - 1];
  assert.ok(!loginReq.url.includes("right"), "비밀번호가 주소에 실리면 안 된다");

  process.env.SYNOLOGY_PASSWORD = "wrong";
  await assert.rejects(s.login(), (e: Error & { code?: number }) => e.code === 400 && /비밀번호/.test(e.message));
  process.env.SYNOLOGY_PASSWORD = "right";
});

test("설정이 없으면 configured=false", async () => {
  const s = await lib();
  assert.equal(s.synologyConfigured(), true);
  const keep = process.env.SYNOLOGY_PASSWORD;
  delete process.env.SYNOLOGY_PASSWORD;
  assert.equal(s.synologyConfigured(), false);
  process.env.SYNOLOGY_PASSWORD = keep;
});

test("올리기: 조각을 이어 붙인 본문이 원본과 같고 Content-Length가 정확하다", async () => {
  const s = await lib();
  const original = randomBytes(3 * 1024 * 1024 + 123);
  const pieces = [original.subarray(0, 1024 * 1024), original.subarray(1024 * 1024, 2_500_000), original.subarray(2_500_000)];
  const progress: number[] = [];
  uploadReply = { success: true };

  await s.uploadFile("SID123", {
    folder: "/개발팀/완료 프로그램/QT-20261104-001",
    fileName: "카카오 설치 묶음.zip",
    size: original.length,
    chunks: (async function* () {
      for (const p of pieces) yield new Uint8Array(p);
    })(),
    onProgress: (n) => progress.push(n),
  });

  const req = seen[seen.length - 1];
  assert.match(req.url, /api=SYNO\.FileStation\.Upload/);
  assert.match(req.url, /_sid=SID123/);
  assert.equal(req.contentLength, req.body.length, "미리 계산한 Content-Length = 실제 본문 길이");

  const boundary = req.contentType.split("boundary=")[1];
  const text = req.body.toString("latin1");
  const headEnd = text.indexOf("\r\n\r\n", text.indexOf('name="file"')) + 4;
  const tailStart = text.lastIndexOf(`\r\n--${boundary}--`);
  const fileBytes = req.body.subarray(headEnd, tailStart);
  assert.equal(fileBytes.length, original.length);
  assert.equal(createHash("sha256").update(fileBytes).digest("hex"), createHash("sha256").update(original).digest("hex"));

  const head = req.body.subarray(0, headEnd).toString("utf8");
  assert.match(head, /name="path"\r\n\r\n\/개발팀\/완료 프로그램\/QT-20261104-001\r\n/);
  assert.match(head, /name="overwrite"\r\n\r\nfalse\r\n/);
  assert.match(head, /filename="카카오 설치 묶음\.zip"/);
  assert.ok(head.indexOf('name="path"') < head.indexOf('name="file"'), "file 필드는 맨 마지막");
  assert.deepEqual(progress, [1024 * 1024, 2_500_000, original.length]);
});

test("올리기: 조각 합계가 size와 다르면 실패한다", async () => {
  const s = await lib();
  await assert.rejects(
    s.uploadFile("SID123", {
      folder: "/개발팀/완료 프로그램/Q",
      fileName: "a.zip",
      size: 100,
      chunks: (async function* () {
        yield new Uint8Array(40);
      })(),
    }),
    /크기 합계/,
  );
});

test("올리기: NAS 오류 코드는 한글 문구로 (같은 이름 존재 = 1805)", async () => {
  const s = await lib();
  uploadReply = { success: false, error: { code: 1805 } };
  await assert.rejects(
    s.uploadFile("SID123", {
      folder: "/개발팀/완료 프로그램/Q",
      fileName: "a.zip",
      size: 3,
      chunks: (async function* () {
        yield new Uint8Array(3);
      })(),
    }),
    (e: Error & { code?: number }) => e.code === 1805 && /같은 이름/.test(e.message),
  );
  uploadReply = { success: true };
});

test("파일 크기 조회: 없으면 null", async () => {
  const s = await lib();
  assert.equal(await s.fileSize("SID123", "/개발팀/완료 프로그램/Q/있음.zip"), 4321);
  assert.equal(await s.fileSize("SID123", "/개발팀/완료 프로그램/Q/없음.zip"), null);
});

test("공유 링크 만들기", async () => {
  const s = await lib();
  assert.deepEqual(await s.createShareLink("SID123", "/개발팀/완료 프로그램/Q/a.zip"), {
    id: "abc",
    url: "https://nas.example/sharing/abc",
  });
});

test("삭제는 보관 폴더 아래만 — 밖은 NAS에 요청조차 보내지 않는다", async () => {
  const s = await lib();
  assert.equal(s.isUnderBaseDir("/개발팀/완료 프로그램/QT-1/a.zip"), true);
  assert.equal(s.isUnderBaseDir("/개발팀/프린터 드라이버/a.zip"), false);
  assert.equal(s.isUnderBaseDir("/개발팀/완료 프로그램/../프린터 드라이버/a.zip"), false);
  assert.equal(s.isUnderBaseDir("/개발팀/완료 프로그램"), false);

  const before = seen.length;
  await assert.rejects(s.deleteFile("SID123", "/개발팀/인하대 식수관리 프로젝트/x.zip"), /보관 폴더 밖/);
  assert.equal(seen.length, before);

  await s.deleteFile("SID123", "/개발팀/완료 프로그램/QT-1/a.zip");
  assert.equal(seen.length, before + 1);
});
