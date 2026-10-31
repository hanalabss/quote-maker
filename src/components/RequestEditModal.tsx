"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { formatKRW } from "@/lib/pricing";
import {
  buildRequestItems,
  deriveSelection,
  toggleModuleCode,
  SCREEN_FLOWS,
  type ModuleLike,
  type RequestSelection,
} from "@/lib/requestItems";
import { TYPE_PRICE_RATE } from "@/types";
import type { QuoteType } from "@/types";

interface ModuleRow extends ModuleLike {
  category: string;
}

// 대기중 견적의 기능 선택·화면 구성 수정 (사업팀 본인 / dev)
export function RequestEditModal({
  quoteId,
  quoteType,
  screenDevice,
  screenComposition,
  items,
  showPrice,
  onClose,
  onSaved,
}: {
  quoteId: string;
  quoteType: string;
  screenDevice: string | null;
  screenComposition: string | null;
  items: { moduleId: string | null; itemName: string }[];
  showPrice: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSaved: (quote: any) => void;
}) {
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [selection, setSelection] = useState<RequestSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => r.json())
      .then((data: ModuleRow[]) => {
        const usable = data.filter((m) => m.category !== "external");
        setModules(usable);
        setSelection(deriveSelection({ items, screenComposition, modules: usable }));
      })
      .catch(() => setError("기능 목록을 불러오지 못했습니다"));
    // 모달을 열 때 한 번만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceRate = TYPE_PRICE_RATE[quoteType as QuoteType] ?? 1;
  const preview = useMemo(
    () =>
      modules && selection
        ? buildRequestItems({ selection, modules, priceRate, screenDevice })
        : null,
    [modules, selection, priceRate, screenDevice]
  );

  async function save() {
    if (!selection) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestEdit: selection }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) onSaved(data);
    else setError(data.error || "기능 수정에 실패했습니다");
  }

  // 결제는 아래 토글로만 다룬다 (요청 폼의 KSNET 결제 연동과 동일)
  const cards = (modules || []).filter((m) => !m.isAutoIncluded && m.code !== "KSNET_PAY");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="request-edit-title" className="text-lg font-semibold mb-1">기능 수정</h3>
        <p className="text-xs text-gray-400 mb-4">
          개발팀 검토 전(대기중)에만 수정할 수 있습니다. 저장하면 견적 항목과 금액이 다시 계산되고, 변경 내용이 댓글로 남습니다.
        </p>

        {!modules || !selection ? (
          <div className="flex justify-center py-10">
            {error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
          </div>
        ) : (
          <>
            <h4 className="text-sm font-medium mb-2">기능</h4>
            <div className="grid sm:grid-cols-2 gap-2 mb-5">
              {cards.map((mod) => {
                const selected = selection.selectedModules.includes(mod.code);
                return (
                  <button
                    key={mod.code}
                    type="button"
                    onClick={() =>
                      setSelection((p) => p && { ...p, selectedModules: toggleModuleCode(p.selectedModules, mod.code) })
                    }
                    aria-pressed={selected}
                    className={`text-left p-3 rounded-xl border-2 transition-all flex items-start gap-2.5 ${
                      selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        selected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{mod.name}</div>
                      {showPrice && (
                        <div className="text-xs font-semibold mt-1 tabular-nums text-blue-700">
                          {mod.code === "AI_STYLE" && mod.basePrice === 0
                            ? "협의"
                            : `+${formatKRW(Math.round(mod.basePrice * priceRate))}원`}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selection.selectedModules.includes("UI_BASIC") && (
              <>
                <h4 className="text-sm font-medium mb-2">화면 구성</h4>
                <div className="flex flex-wrap gap-2 mb-5">
                  {SCREEN_FLOWS.map((s) => {
                    const selected = selection.screenComposition.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setSelection(
                            (p) =>
                              p && {
                                ...p,
                                screenComposition: selected
                                  ? p.screenComposition.filter((v) => v !== s.value)
                                  : [...p.screenComposition, s.value],
                              }
                          )
                        }
                        aria-pressed={selected}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="space-y-2 mb-5">
              {[
                { key: "useKsnetPayment" as const, label: "KSNET 결제 연동" },
                { key: "useDbLogging" as const, label: "DB 직접 연결 로그 (서비스)" },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection[opt.key]}
                    onChange={(e) => setSelection((p) => p && { ...p, [opt.key]: e.target.checked })}
                    className="w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {preview && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm mb-2">
                <div className="font-medium mb-2">수정 후 견적 항목</div>
                <ul className="space-y-1">
                  {preview.items.map((it) => (
                    <li key={it.sortOrder} className="flex justify-between gap-4">
                      <span>{it.itemName}</span>
                      {showPrice && <span className="tabular-nums text-gray-600">{formatKRW(it.amount)}</span>}
                    </li>
                  ))}
                </ul>
                {showPrice && (
                  <div className="flex justify-between border-t mt-2 pt-2 font-semibold">
                    <span>합계 (VAT 포함)</span>
                    <span className="tabular-nums">{formatKRW(preview.totalAmount)}원</span>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          </>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={save}
            disabled={saving || !selection || selection.selectedModules.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
