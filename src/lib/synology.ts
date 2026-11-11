// 회사 Synology NAS(File Station) 연동 — 서버 전용.
// 계정 정보는 환경변수로만 받는다. 값·세션 id는 로그에 남기지 않는다.
//
//   SYNOLOGY_URL       예) https://hanapf.synology.me:5500
//   SYNOLOGY_USER      File Station 쓰기 권한이 있는 계정 (2단계 인증이 꺼져 있어야 한다)
//   SYNOLOGY_PASSWORD
//   SYNOLOGY_BASE_DIR  (선택) 기본 /개발팀/완료 프로그램

import http from "http";
import https from "https";
import { randomBytes } from "crypto";
import { DEFAULT_NAS_BASE_DIR } from "@/lib/programUpload";

const API_TIMEOUT_MS = 30_000;
const UPLOAD_IDLE_TIMEOUT_MS = 120_000;

export class SynologyError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
    this.name = "SynologyError";
  }
}

function config() {
  const url = process.env.SYNOLOGY_URL?.replace(/\/+$/, "");
  const user = process.env.SYNOLOGY_USER;
  const password = process.env.SYNOLOGY_PASSWORD;
  if (!url || !user || !password) return null;
  return { url, user, password };
}

export function synologyConfigured(): boolean {
  return config() !== null;
}

export function nasBaseDir(): string {
  return (process.env.SYNOLOGY_BASE_DIR || DEFAULT_NAS_BASE_DIR).replace(/\/+$/, "");
}

/** 행사 폴더의 전체 경로. 폴더명은 sanitizeFolderName 을 거친 한 칸짜리 이름이어야 한다. */
export function eventFolderPath(folderName: string): string {
  return `${nasBaseDir()}/${folderName}`;
}

/** 삭제 같은 위험한 호출 전에 — 경로가 보관 폴더 아래인지 확인한다. */
export function isUnderBaseDir(path: string): boolean {
  const base = nasBaseDir();
  return path.startsWith(base + "/") && !path.split("/").includes("..");
}

const AUTH_ERRORS: Record<number, string> = {
  400: "NAS 계정 또는 비밀번호가 맞지 않습니다",
  401: "NAS 계정이 비활성 상태입니다",
  402: "NAS 계정에 권한이 없습니다",
  403: "NAS 계정에 2단계 인증이 켜져 있어 서버가 로그인할 수 없습니다",
  404: "NAS 2단계 인증에 실패했습니다",
  406: "NAS 계정에 2단계 인증 설정이 강제되어 있습니다",
  407: "NAS가 서버 IP를 차단했습니다 (로그인 실패 누적)",
  408: "NAS 계정 비밀번호가 만료되었습니다",
  409: "NAS 계정 비밀번호가 만료되었습니다",
  410: "NAS 계정 비밀번호를 바꿔야 합니다",
};

const FILE_ERRORS: Record<number, string> = {
  105: "NAS 계정에 이 작업 권한이 없습니다",
  106: "NAS 세션이 만료되었습니다",
  119: "NAS 세션을 찾을 수 없습니다",
  407: "NAS 폴더에 쓰기 권한이 없습니다",
  408: "NAS에 해당 파일이나 폴더가 없습니다",
  414: "NAS에 같은 이름의 파일이 이미 있습니다",
  415: "NAS 저장 공간 할당량을 넘었습니다",
  416: "NAS 저장 공간이 부족합니다",
  418: "NAS에서 쓸 수 없는 파일명입니다",
  419: "NAS에서 쓸 수 없는 파일명입니다",
  1100: "NAS 폴더를 만들지 못했습니다",
  1800: "NAS로 보낸 파일 크기 정보가 맞지 않습니다",
  1801: "NAS 전송이 시간 초과되었습니다",
  1802: "NAS가 파일 정보를 받지 못했습니다",
  1803: "NAS 전송이 취소되었습니다",
  1804: "NAS에 올리기에는 파일이 너무 큽니다",
  1805: "NAS에 같은 이름의 파일이 있어 덮어쓸 수 없습니다",
  2000: "NAS 공유 링크를 찾을 수 없습니다",
  2001: "NAS 공유 링크 개수가 한도를 넘었습니다",
  2002: "NAS 공유 링크를 만들지 못했습니다",
};

function describe(code: number | undefined, table: Record<number, string>, fallback: string): string {
  const known = code !== undefined ? table[code] : undefined;
  return known ?? `${fallback}${code !== undefined ? ` (코드 ${code})` : ""}`;
}

type ApiResult<T> = { success: boolean; data?: T; error?: { code?: number } };

async function call<T>(sid: string | null, params: Record<string, string>): Promise<ApiResult<T>> {
  const cfg = config();
  if (!cfg) throw new SynologyError("NAS 연동이 설정되지 않았습니다");
  const body = new URLSearchParams(params);
  if (sid) body.set("_sid", sid);
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/webapi/entry.cgi`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    // 원인 코드와 실행 리전만 남긴다 (주소·계정·세션은 남기지 않는다).
    // 회사 NAS는 해외 IP를 막는다 — 서울(icn1)이 아닌 리전에서 돌면 여기서 연결 시간 초과가 난다.
    const cause = (e as { cause?: { code?: string } })?.cause?.code ?? (e as Error)?.name ?? "unknown";
    console.error(`NAS 접속 실패: ${cause} (region=${process.env.VERCEL_REGION ?? "local"})`);
    throw new SynologyError("NAS에 접속하지 못했습니다");
  }
  if (!res.ok) throw new SynologyError(`NAS가 오류를 돌려줬습니다 (HTTP ${res.status})`);
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    throw new SynologyError("NAS 응답을 읽지 못했습니다");
  }
}

async function fileCall<T>(sid: string, params: Record<string, string>, fallback: string): Promise<T> {
  const r = await call<T>(sid, params);
  if (!r.success) throw new SynologyError(describe(r.error?.code, FILE_ERRORS, fallback), r.error?.code);
  return r.data as T;
}

export async function login(): Promise<string> {
  const cfg = config();
  if (!cfg) throw new SynologyError("NAS 연동이 설정되지 않았습니다");
  const r = await call<{ sid: string }>(null, {
    api: "SYNO.API.Auth",
    version: "6",
    method: "login",
    account: cfg.user,
    passwd: cfg.password,
    session: "FileStation",
    format: "sid",
  });
  if (!r.success || !r.data?.sid) {
    throw new SynologyError(describe(r.error?.code, AUTH_ERRORS, "NAS 로그인에 실패했습니다"), r.error?.code);
  }
  return r.data.sid;
}

export async function logout(sid: string): Promise<void> {
  try {
    await call(sid, { api: "SYNO.API.Auth", version: "6", method: "logout", session: "FileStation" });
  } catch {
    // 로그아웃 실패는 무시 (세션은 NAS에서 알아서 만료된다)
  }
}

/** 로그인 → 작업 → 로그아웃 */
export async function withSession<T>(fn: (sid: string) => Promise<T>): Promise<T> {
  const sid = await login();
  try {
    return await fn(sid);
  } finally {
    await logout(sid);
  }
}

/** 폴더가 없으면 상위 폴더까지 만든다. 이미 있으면 그대로 둔다. */
export async function ensureFolder(sid: string, fullPath: string): Promise<void> {
  const i = fullPath.lastIndexOf("/");
  if (i <= 0) throw new SynologyError("NAS 폴더 경로가 올바르지 않습니다");
  await fileCall(
    sid,
    {
      api: "SYNO.FileStation.CreateFolder",
      version: "2",
      method: "create",
      folder_path: JSON.stringify([fullPath.slice(0, i)]),
      name: JSON.stringify([fullPath.slice(i + 1)]),
      force_parent: "true",
    },
    "NAS 폴더를 만들지 못했습니다",
  );
}

/** 파일 크기(bytes). 없으면 null. */
export async function fileSize(sid: string, fullPath: string): Promise<number | null> {
  const data = await fileCall<{ files?: { code?: number; isdir?: boolean; additional?: { size?: number } }[] }>(
    sid,
    {
      api: "SYNO.FileStation.List",
      version: "2",
      method: "getinfo",
      path: JSON.stringify([fullPath]),
      additional: JSON.stringify(["size"]),
    },
    "NAS 파일 정보를 읽지 못했습니다",
  );
  const f = data.files?.[0];
  if (!f || f.code) return null;
  return f.additional?.size ?? 0;
}

export type NasEntry = { name: string; isDir: boolean; size: number; mtime: number };

/** 폴더 안 목록 (휴지통·썸네일 같은 NAS 내부 폴더는 뺀다). 폴더가 없으면 null. */
export async function listFolder(sid: string, fullPath: string): Promise<NasEntry[] | null> {
  const r = await call<{
    files?: { name: string; isdir?: boolean; additional?: { size?: number; time?: { mtime?: number } } }[];
  }>(sid, {
    api: "SYNO.FileStation.List",
    version: "2",
    method: "list",
    folder_path: fullPath,
    limit: "1000",
    sort_by: "name",
    additional: JSON.stringify(["size", "time"]),
  });
  if (!r.success) {
    if (r.error?.code === 408) return null;
    throw new SynologyError(describe(r.error?.code, FILE_ERRORS, "NAS 폴더를 읽지 못했습니다"), r.error?.code);
  }
  return (r.data?.files ?? [])
    .filter((f) => !f.name.startsWith("#") && !f.name.startsWith("@"))
    .map((f) => ({
      name: f.name,
      isDir: !!f.isdir,
      size: f.isdir ? 0 : (f.additional?.size ?? 0),
      mtime: (f.additional?.time?.mtime ?? 0) * 1000,
    }));
}

/** 공유 링크가 아직 살아 있는지 (파일이 지워지거나 바뀌면 링크도 죽는다) */
export async function shareLinkAlive(sid: string, id: string, expectedPath: string): Promise<boolean> {
  // 실측(2026-11-11): 없는 id 도 success:true 로 오고 data 가 비어 있다. 대상이 지워진 링크는 status:"broken".
  // 그래서 성공 여부가 아니라 data 의 상태와 경로를 본다.
  const r = await call<{ id?: string; status?: string; path?: string }>(sid, {
    api: "SYNO.FileStation.Sharing",
    version: "3",
    method: "getinfo",
    id,
  });
  return r.success && r.data?.id === id && r.data.status === "valid" && r.data.path === expectedPath;
}

function multipartField(boundary: string, name: string, value: string): string {
  return `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
}

/**
 * 파일 하나를 NAS 폴더에 올린다. 본문을 메모리에 다 올리지 않고 조각 단위로 흘려보낸다.
 * size는 조각 합계와 정확히 같아야 한다 (Content-Length를 미리 계산해 보낸다).
 */
export async function uploadFile(
  sid: string,
  opts: {
    folder: string;
    fileName: string;
    size: number;
    chunks: AsyncIterable<Uint8Array>;
    onProgress?: (sent: number) => void;
  },
): Promise<void> {
  const cfg = config();
  if (!cfg) throw new SynologyError("NAS 연동이 설정되지 않았습니다");

  const boundary = `----quotemaker${randomBytes(12).toString("hex")}`;
  const safeName = opts.fileName.replace(/["\r\n]/g, "_");
  const head = Buffer.from(
    multipartField(boundary, "path", opts.folder) +
      multipartField(boundary, "create_parents", "true") +
      multipartField(boundary, "overwrite", "false") +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");

  const target = new URL(`${cfg.url}/webapi/entry.cgi`);
  target.searchParams.set("api", "SYNO.FileStation.Upload");
  target.searchParams.set("version", "3");
  target.searchParams.set("method", "upload");
  target.searchParams.set("_sid", sid);

  const lib = target.protocol === "http:" ? http : https;

  const result = await new Promise<ApiResult<unknown>>((resolve, reject) => {
    let settled = false;
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(e);
    };

    const req = lib.request(
      target,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(head.length + opts.size + tail.length),
        },
      },
      (res) => {
        const parts: Buffer[] = [];
        res.on("data", (d: Buffer) => parts.push(d));
        res.on("error", () => fail(new SynologyError("NAS 응답을 읽지 못했습니다")));
        res.on("end", () => {
          if (settled) return;
          settled = true;
          if ((res.statusCode ?? 0) >= 400) {
            reject(new SynologyError(`NAS가 오류를 돌려줬습니다 (HTTP ${res.statusCode})`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(parts).toString("utf8")) as ApiResult<unknown>);
          } catch {
            reject(new SynologyError("NAS 응답을 읽지 못했습니다"));
          }
        });
      },
    );
    req.setTimeout(UPLOAD_IDLE_TIMEOUT_MS, () => fail(new SynologyError("NAS 전송이 멈춰 시간 초과되었습니다")));
    req.on("error", () => fail(new SynologyError("NAS로 보내는 중 연결이 끊겼습니다")));

    const write = (buf: Uint8Array) =>
      new Promise<void>((res, rej) => {
        if (settled) return rej(new Error("closed"));
        if (req.write(buf)) return res();
        const onDrain = () => {
          req.off("close", onClose);
          res();
        };
        const onClose = () => {
          req.off("drain", onDrain);
          rej(new Error("closed"));
        };
        req.once("drain", onDrain);
        req.once("close", onClose);
      });

    (async () => {
      let sent = 0;
      await write(head);
      for await (const chunk of opts.chunks) {
        sent += chunk.length;
        if (sent > opts.size) throw new SynologyError("올린 조각의 크기 합계가 맞지 않습니다");
        await write(chunk);
        opts.onProgress?.(sent);
      }
      if (sent !== opts.size) throw new SynologyError("올린 조각의 크기 합계가 맞지 않습니다");
      await write(tail);
      req.end();
    })().catch((e) => fail(e instanceof SynologyError ? e : new SynologyError("NAS로 보내는 중 연결이 끊겼습니다")));
  });

  if (!result.success) {
    throw new SynologyError(describe(result.error?.code, FILE_ERRORS, "NAS에 올리지 못했습니다"), result.error?.code);
  }
}

/** 로그인 없이 열리는 공유 링크를 만든다. */
export async function createShareLink(sid: string, fullPath: string): Promise<{ id: string; url: string }> {
  const data = await fileCall<{ links?: { id: string; url: string }[] }>(
    sid,
    { api: "SYNO.FileStation.Sharing", version: "3", method: "create", path: JSON.stringify([fullPath]) },
    "NAS 공유 링크를 만들지 못했습니다",
  );
  const link = data.links?.[0];
  if (!link?.id || !link.url) throw new SynologyError("NAS 공유 링크를 만들지 못했습니다");
  return { id: link.id, url: link.url };
}

export async function deleteShareLink(sid: string, id: string): Promise<void> {
  await fileCall(
    sid,
    { api: "SYNO.FileStation.Sharing", version: "3", method: "delete", id: JSON.stringify([id]) },
    "NAS 공유 링크를 지우지 못했습니다",
  );
}

/** 파일 하나를 지운다 (NAS 휴지통이 켜져 있으면 #recycle 로 간다). 보관 폴더 밖은 거부한다. */
export async function deleteFile(sid: string, fullPath: string): Promise<void> {
  if (!isUnderBaseDir(fullPath)) throw new SynologyError("보관 폴더 밖의 파일은 지울 수 없습니다");
  // 행사 폴더 자체(바로 아래 한 칸)는 지우지 않는다 — 폴더 안의 파일 하나만 지울 수 있다
  if (fullPath.slice(nasBaseDir().length + 1).split("/").filter(Boolean).length !== 2) {
    throw new SynologyError("행사 폴더 안의 파일만 지울 수 있습니다");
  }
  await fileCall(
    sid,
    { api: "SYNO.FileStation.Delete", version: "2", method: "delete", path: JSON.stringify([fullPath]) },
    "NAS 파일을 지우지 못했습니다",
  );
}
