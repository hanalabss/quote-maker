"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderSearch,
  Loader2,
  Package,
  RefreshCw,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { PROGRAM_EXTENSIONS, formatBytes, sanitizeFolderName, validateProgramFile } from "@/lib/programUpload";

// 완료 프로그램 — 견적에 연결된 NAS 행사 폴더의 내용을 그대로 보여 준다.
// 개발팀: 폴더 연결·올리기·(웹에서 올린 파일) 지우기 / 개발팀 + 해당 견적 사업팀: 보기·받기·폴더 열기

interface NasFile {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
  viaWeb: boolean;
  version: string | null;
  note: string | null;
  uploadedBy: string | null;
}

interface ProgramState {
  canManage: boolean;
  configured: boolean;
  baseDir: string;
  eventName: string;
  folder: string | null;
  folderMissing: boolean;
  nasError: string | null;
  files: NasFile[];
}

type FolderOption = { name: string; suggested: boolean };

type Progress =
  | { stage: "upload"; percent: number } // 내 PC → 서버 임시 보관
  | { stage: "nas"; percent: number } // 서버 → NAS 행사 폴더
  | { stage: "login" | "verify" | "share" };

const STAGE_LABEL: Record<Progress["stage"], string> = {
  upload: "서버로 보내는 중",
  login: "NAS 연결 중",
  nas: "NAS 행사 폴더로 옮기는 중",
  verify: "NAS에 저장된 파일 확인 중",
  share: "받기 링크 만드는 중",
};

function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

async function putPartWithRetry(url: string, blob: Blob, onProgress: (loaded: number) => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await putPart(url, blob, onProgress);
      return;
    } catch (e) {
      lastError = e;
      onProgress(0);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }) : "";

export function QuotePrograms({ quoteId }: { quoteId: string }) {
  const api = `/api/quotes/${quoteId}/programs`;
  const [state, setState] = useState<ProgramState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 폴더 연결
  const [picking, setPicking] = useState(false);
  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [linking, setLinking] = useState<string | null>(null);

  // 올리기
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(api, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // 올리는 도중 창을 닫으면 처음부터 다시 해야 하므로 한 번 물어본다
  useEffect(() => {
    if (!progress) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  const openPicker = async () => {
    setPicking(true);
    setError(null);
    setFilter("");
    setFolders(null);
    try {
      const res = await fetch(`${api}/folders`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "NAS 폴더 목록을 읽지 못했습니다");
      setFolders(data.folders ?? []);
      setNewName(data.newName ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "NAS 폴더 목록을 읽지 못했습니다");
      setPicking(false);
    }
  };

  const link = async (name: string, create: boolean) => {
    setLinking(name);
    setError(null);
    try {
      const res = await fetch(`${api}/folder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, create }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "폴더를 연결하지 못했습니다");
      setPicking(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "폴더를 연결하지 못했습니다");
    } finally {
      setLinking(null);
    }
  };

  const unlink = async () => {
    if (!confirm("이 견적과 NAS 행사 폴더의 연결을 끊을까요?\nNAS의 폴더와 파일은 그대로 남습니다.")) return;
    setError(null);
    const res = await fetch(`${api}/folder`, { method: "DELETE" });
    if (!res.ok) setError("연결을 끊지 못했습니다");
    await load();
  };

  const resetForm = () => {
    setFile(null);
    setVersion("");
    setNote("");
    setFormOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    const invalid = validateProgramFile(f.name, f.size);
    if (invalid) {
      setError(invalid);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file || progress) return;
    setError(null);
    setProgress({ stage: "upload", percent: 0 });
    try {
      // 1) 조각별 임시 주소 받기
      const initRes = await fetch(`${api}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(init.error || "올리기를 시작하지 못했습니다");

      // 2) 조각 올리기
      const partSize: number = init.partSize;
      let done = 0;
      for (const part of init.parts as { index: number; url: string }[]) {
        const blob = file.slice(part.index * partSize, (part.index + 1) * partSize);
        await putPartWithRetry(part.url, blob, (loadedBytes) => {
          setProgress({ stage: "upload", percent: Math.floor(((done + loadedBytes) / file.size) * 100) });
        }).catch(() => {
          throw new Error("보내는 중 연결이 끊겼습니다. 다시 시도해 주세요");
        });
        done += blob.size;
      }

      // 3) 서버가 NAS로 옮기는 동안 진행 상황을 줄 단위로 받는다
      setProgress({ stage: "login" });
      const res = await fetch(`${api}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: init.uploadId, fileName: file.name, size: file.size, version, note }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "NAS로 옮기지 못했습니다");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const msg = JSON.parse(line);
        if (msg.error) throw new Error(msg.error);
        if (msg.done) finished = true;
        else if (msg.stage === "nas") setProgress({ stage: "nas", percent: Math.floor((msg.sent / msg.total) * 100) });
        else if (msg.stage === "login" || msg.stage === "verify" || msg.stage === "share") setProgress({ stage: msg.stage });
      };
      for (;;) {
        const { value, done: end } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
        if (end) break;
      }
      handle(buffer);
      // 목록은 항상 NAS에서 다시 읽는다 — 화면이 실제 폴더 상태와 어긋나지 않게
      await load();
      if (!finished) {
        throw new Error("서버 응답이 중간에 끊겼습니다. 목록에 파일이 보이지 않으면 다시 올려 주세요");
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했습니다");
    } finally {
      setProgress(null);
    }
  };

  const remove = async (f: NasFile) => {
    if (!confirm(`"${f.name}" 을(를) 지울까요?\nNAS 행사 폴더에서도 지워집니다 (NAS 휴지통으로 이동).`)) return;
    setDeleting(f.name);
    setError(null);
    try {
      const res = await fetch(`${api}/file?name=${encodeURIComponent(f.name)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "지우지 못했습니다");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "지우지 못했습니다");
    } finally {
      setDeleting(null);
    }
  };

  const shownFolders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (folders ?? []).filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [folders, filter]);

  if (!state) return null;
  const { canManage, configured, folder, files } = state;
  const downloadable = files.filter((f) => !f.isDir);

  // 사업팀은 받을 파일이 있을 때만 이 칸을 본다
  if (!canManage && (!folder || downloadable.length === 0)) return null;

  const crumbs = state.baseDir.split("/").filter(Boolean);
  const fullPath = folder ? `${state.baseDir}/${folder}` : state.baseDir;
  const cleanNewName = sanitizeFolderName(newName);
  const newNameTaken = !!folders?.some((f) => f.name === cleanNewName);
  const percent = progress && "percent" in progress ? progress.percent : null;
  const uploadFill = !progress ? 0 : progress.stage === "upload" ? progress.percent : 100;
  const nasFill = !progress ? 0 : progress.stage === "nas" ? progress.percent : progress.stage === "verify" || progress.stage === "share" ? 100 : 0;

  return (
    <section className="bg-white rounded-xl border p-5" aria-label="완료 프로그램">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-1.5">
          <Package className="w-4 h-4" />
          완료 프로그램{folder ? ` (${downloadable.length})` : ""}
        </h3>
        {folder && (
          <button
            onClick={load}
            disabled={loading}
            title="NAS 폴더 다시 읽기"
            className="p-1 -m-1 text-gray-400 hover:text-gray-700 disabled:opacity-50 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
          </button>
        )}
      </div>

      {canManage && !configured && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5">
          NAS 연동이 아직 설정되지 않아 쓸 수 없습니다. (서버 환경변수 미설정)
        </p>
      )}

      {/* 연결 전 — 폴더를 고르는 것이 첫 단계 */}
      {configured && !folder && !picking && (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm text-gray-700">연결된 NAS 행사 폴더가 없습니다</p>
          <p className="text-xs text-gray-500 mt-1">[행사 자료] 아래 폴더를 연결하면 그 안의 파일이 여기에 보입니다.</p>
          <button
            onClick={openPicker}
            className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <FolderSearch className="w-3.5 h-3.5" />
            행사 폴더 연결
          </button>
        </div>
      )}

      {/* 폴더 고르기 */}
      {picking && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-gray-200 text-xs text-gray-600">
            <span className="text-gray-400">{crumbs.slice(-1)[0]} 아래에서</span> 이 견적의 행사 폴더 고르기
          </div>
          {folders === null ? (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 p-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
              NAS 폴더 목록 읽는 중
            </p>
          ) : (
            <>
              <div className="p-2 border-b border-gray-100">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="폴더 이름으로 찾기"
                  aria-label="폴더 이름으로 찾기"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                {shownFolders.map((f) => (
                  <li key={f.name}>
                    <button
                      onClick={() => link(f.name, false)}
                      disabled={!!linking}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
                    >
                      <Folder className={`w-4 h-4 shrink-0 ${f.suggested ? "text-blue-600" : "text-gray-400"}`} />
                      <span className="flex-1 min-w-0 truncate">{f.name}</span>
                      {f.suggested && <span className="text-[11px] text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 shrink-0">행사명과 비슷</span>}
                      {linking === f.name && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none shrink-0" />}
                    </button>
                  </li>
                ))}
                {shownFolders.length === 0 && <li className="px-3 py-3 text-xs text-gray-400">맞는 폴더가 없습니다.</li>}
              </ul>
              <div className="p-2 border-t border-gray-200 bg-slate-50 space-y-1.5">
                <label className="block text-xs text-gray-600" htmlFor={`new-folder-${quoteId}`}>
                  없으면 새 폴더 만들기
                </label>
                <div className="space-y-1.5">
                  <input
                    id={`new-folder-${quoteId}`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={80}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => link(cleanNewName, true)}
                    disabled={!cleanNewName || newNameTaken || !!linking}
                    className="w-full inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded bg-white border border-gray-300 text-gray-800 hover:border-blue-500 hover:text-blue-700 disabled:opacity-40"
                  >
                    {linking === cleanNewName ? <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> : <FolderPlus className="w-3.5 h-3.5" />}
                    만들고 연결
                  </button>
                </div>
                {newNameTaken && <p className="text-[11px] text-amber-700">같은 이름의 폴더가 이미 있습니다. 위 목록에서 골라 주세요.</p>}
                {!cleanNewName && newName && <p className="text-[11px] text-amber-700">폴더 이름에 쓸 수 없는 글자가 있습니다.</p>}
              </div>
            </>
          )}
          <div className="px-2 py-1.5 border-t border-gray-200 text-right">
            <button onClick={() => setPicking(false)} className="text-xs text-gray-500 hover:text-gray-800 px-1.5 py-0.5">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 연결 후 — NAS 주소 표시줄 + 폴더 내용 */}
      {folder && !picking && (
        <>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-stretch bg-slate-50 border-b border-gray-200">
              <div className="flex-1 min-w-0 px-3 py-2" title={fullPath}>
                <div className="text-[11px] text-gray-500 truncate">
                  NAS › {crumbs.slice(-2).join(" › ")}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Folder className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{folder}</span>
                </div>
              </div>
              {!state.folderMissing && (
                <a
                  href={`${api}/open`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 text-xs text-blue-700 border-l border-gray-200 hover:bg-blue-50 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
                >
                  폴더 열기
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {state.folderMissing ? (
              <p className="p-3 text-xs text-red-700 bg-red-50">
                NAS에서 이 폴더를 찾을 수 없습니다. 이름이 바뀌었거나 지워졌을 수 있습니다.
                {canManage && " 아래에서 폴더를 다시 연결해 주세요."}
              </p>
            ) : state.nasError ? (
              <p className="p-3 text-xs text-red-700 bg-red-50">{state.nasError}. 오른쪽 위 새로 고침으로 다시 시도해 주세요.</p>
            ) : files.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">폴더가 비어 있습니다.{canManage && " 아래에서 설치 파일을 올려 주세요."}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {files.map((f) => (
                  <li key={(f.isDir ? "d:" : "f:") + f.name} className="flex items-center gap-2 px-3 py-2.5">
                    {f.isDir ? <Folder className="w-4 h-4 text-gray-400 shrink-0" /> : <Package className="w-4 h-4 text-gray-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 break-all leading-snug">
                        {f.name}
                        {f.version && <span className="ml-1.5 text-xs text-blue-700 whitespace-nowrap">{f.version}</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {f.isDir ? "하위 폴더 (폴더 열기에서 확인)" : `${fmtDate(f.mtime)} ${f.uploadedBy ? `${f.uploadedBy} 올림` : "NAS에 직접 넣음"}`}
                      </div>
                      {f.note && <div className="text-xs text-gray-600 break-words mt-0.5">{f.note}</div>}
                    </div>
                    {!f.isDir && (
                      <>
                        <span className="text-xs text-gray-500 tabular-nums shrink-0">{formatBytes(f.size)}</span>
                        <a
                          href={`${api}/file?name=${encodeURIComponent(f.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${f.name} 받기`}
                          aria-label={`${f.name} 받기`}
                          className="p-1.5 -my-1 rounded text-blue-700 hover:bg-blue-50 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {canManage && f.viaWeb && (
                          <button
                            onClick={() => remove(f)}
                            disabled={deleting === f.name}
                            title={`${f.name} 지우기`}
                            aria-label={`${f.name} 지우기`}
                            className="p-1.5 -my-1 -ml-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                          >
                            {deleting === f.name ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 올리기 */}
          {canManage && !state.folderMissing && !state.nasError && (
            <div className="mt-3">
              {!formOpen ? (
                <button
                  onClick={() => setFormOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-dashed border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <Upload className="w-3.5 h-3.5" />
                  이 폴더에 파일 올리기
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROGRAM_EXTENSIONS.join(",")}
                    disabled={!!progress}
                    aria-label="올릴 파일"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:text-gray-700"
                  />
                  {file && <div className="text-xs text-gray-500 tabular-nums">{formatBytes(file.size)}</div>}
                  <div className="grid grid-cols-5 gap-1.5">
                    <input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      disabled={!!progress}
                      maxLength={40}
                      placeholder="버전 (예: v1.0.2)"
                      aria-label="버전"
                      className="col-span-2 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={!!progress}
                      maxLength={300}
                      placeholder="메모 (선택)"
                      aria-label="메모"
                      className="col-span-3 min-w-0 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {progress ? (
                    <div className="space-y-1.5" role="status" aria-live="polite">
                      <div className="flex items-center justify-between text-xs text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                          {STAGE_LABEL[progress.stage]}
                        </span>
                        {percent !== null && <span className="tabular-nums">{percent}%</span>}
                      </div>
                      {/* 두 구간: 내 PC → 서버, 서버 → NAS */}
                      <div className="grid grid-cols-2 gap-1" aria-hidden="true">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-[width] motion-reduce:transition-none" style={{ width: `${uploadFill}%` }} />
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-[width] motion-reduce:transition-none" style={{ width: `${nasFill}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-500" aria-hidden="true">
                        <span className="flex items-center gap-1">{uploadFill === 100 && <Check className="w-3 h-3 text-blue-600" />}내 PC → 서버</span>
                        <span className="flex items-center gap-1">{nasFill === 100 && <Check className="w-3 h-3 text-blue-600" />}서버 → NAS 폴더</span>
                      </div>
                      <p className="text-[11px] text-gray-500">끝날 때까지 이 창을 닫지 마세요.</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-800 px-1.5 py-1">
                        취소
                      </button>
                      <button
                        onClick={upload}
                        disabled={!file}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        NAS 폴더에 올리기
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {canManage && !progress && (
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <button onClick={openPicker} className="inline-flex items-center gap-1 hover:text-blue-700">
                <FolderSearch className="w-3.5 h-3.5" />
                다른 폴더로 바꾸기
              </button>
              <button onClick={unlink} className="inline-flex items-center gap-1 hover:text-red-600">
                <Unlink className="w-3.5 h-3.5" />
                연결 끊기
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg p-2.5 break-words">{error}</p>}
    </section>
  );
}
