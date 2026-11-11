"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, HardDrive, Loader2, Package, Trash2, Upload, X } from "lucide-react";
import { PROGRAM_EXTENSIONS, formatBytes, validateProgramFile } from "@/lib/programUpload";

interface Program {
  id: string;
  fileName: string;
  size: number;
  version: string | null;
  note: string | null;
  createdAt: string;
  uploadedBy: { name: string } | null;
}

type Progress =
  | { stage: "upload"; percent: number } // 브라우저 → 임시 보관
  | { stage: "nas"; percent: number } // 서버 → NAS
  | { stage: "login" | "verify" | "share" };

const STAGE_LABEL: Record<Progress["stage"], string> = {
  upload: "올리는 중",
  login: "NAS 연결 중",
  nas: "NAS로 옮기는 중",
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

export function QuotePrograms({ quoteId }: { quoteId: string }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/programs`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPrograms(data.programs ?? []);
      setCanUpload(!!data.canUpload);
      setConfigured(!!data.configured);
    } finally {
      setLoaded(true);
    }
  }, [quoteId]);

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
      const initRes = await fetch(`/api/quotes/${quoteId}/programs/init`, {
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
          throw new Error("올리는 중 연결이 끊겼습니다. 다시 시도해 주세요");
        });
        done += blob.size;
      }

      // 3) 서버가 NAS로 옮기는 동안 진행 상황을 줄 단위로 받는다
      setProgress({ stage: "login" });
      const res = await fetch(`/api/quotes/${quoteId}/programs/complete`, {
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
        if (msg.done) {
          finished = true;
          setPrograms((prev) => [msg.program, ...prev]);
        } else if (msg.stage === "nas") {
          setProgress({ stage: "nas", percent: Math.floor((msg.sent / msg.total) * 100) });
        } else if (msg.stage === "login" || msg.stage === "verify" || msg.stage === "share") {
          setProgress({ stage: msg.stage });
        }
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
      if (!finished) {
        // 응답이 중간에 끊김 — 서버 쪽 결과를 알 수 없으므로 목록을 다시 읽어 실제 상태를 보여 준다
        await load();
        throw new Error("서버 응답이 중간에 끊겼습니다. 목록에 파일이 보이지 않으면 다시 올려 주세요");
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했습니다");
    } finally {
      setProgress(null);
    }
  };

  const remove = async (p: Program) => {
    if (!confirm(`"${p.fileName}" 을(를) 지울까요?\nNAS의 파일과 받기 링크도 함께 지워집니다.`)) return;
    setDeletingId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/programs/${p.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "지우지 못했습니다");
      setPrograms((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "지우지 못했습니다");
    } finally {
      setDeletingId(null);
    }
  };

  // 사업팀은 올라온 파일이 있을 때만 이 칸을 본다
  if (!loaded || (!canUpload && programs.length === 0)) return null;

  const percent = progress && "percent" in progress ? progress.percent : null;

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-1.5">
          <Package className="w-4 h-4" />
          완료 프로그램 ({programs.length})
        </h3>
        {canUpload && configured && !formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Upload className="w-3.5 h-3.5" />
            올리기
          </button>
        )}
      </div>

      {canUpload && !configured && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mb-3">
          NAS 연동이 아직 설정되지 않아 올릴 수 없습니다. (서버 환경변수 미설정)
        </p>
      )}

      {formOpen && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={PROGRAM_EXTENSIONS.join(",")}
            disabled={!!progress}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-white file:text-xs file:text-gray-700"
          />
          {file && <div className="text-xs text-gray-500">{formatBytes(file.size)}</div>}
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            disabled={!!progress}
            maxLength={40}
            placeholder="버전 (예: v1.0.2)"
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!!progress}
            maxLength={300}
            placeholder="메모 (선택)"
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          />

          {progress && (
            <div className="space-y-1" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {STAGE_LABEL[progress.stage]}
                </span>
                {percent !== null && <span className="tabular-nums">{percent}%</span>}
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-blue-500 transition-all ${percent === null ? "animate-pulse" : ""}`}
                  style={{ width: `${percent ?? 100}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400">끝날 때까지 이 창을 닫지 마세요.</p>
            </div>
          )}

          {!progress && (
            <div className="flex items-center justify-end gap-2">
              <button onClick={resetForm} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <X className="w-3.5 h-3.5" />
                취소
              </button>
              <button
                onClick={upload}
                disabled={!file}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <HardDrive className="w-3.5 h-3.5" />
                NAS에 올리기
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5 mb-3 break-words">{error}</p>}

      {programs.length === 0 && <p className="text-xs text-gray-400">올라온 프로그램이 없습니다.</p>}

      <div className="space-y-2">
        {programs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            <Package className="w-4 h-4 text-gray-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" title={p.fileName}>
                {p.fileName}
                {p.version && <span className="ml-1.5 text-xs text-blue-600">{p.version}</span>}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {formatBytes(p.size)} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                {p.uploadedBy?.name ? ` · ${p.uploadedBy.name}` : ""}
              </div>
              {p.note && <div className="text-xs text-gray-500 break-words">{p.note}</div>}
            </div>
            <a
              href={`/api/quotes/${quoteId}/programs/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="받기 (NAS 공유 페이지가 열립니다)"
              className="p-1 text-gray-400 hover:text-blue-600 shrink-0"
            >
              <Download className="w-4 h-4" />
            </a>
            {canUpload && (
              <button
                onClick={() => remove(p)}
                disabled={deletingId === p.id}
                title="지우기"
                className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
              >
                {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
