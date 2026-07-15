"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { formatKRW, applyPriceRate } from "@/lib/pricing";
import { Save, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface Module {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  basePrice: number;
  isAutoIncluded: boolean;
  sortOrder: number;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  common: "공통",
  camera: "카메라",
  qr: "QR",
  text: "텍스트",
  server: "서버",
  ai: "AI",
  payment: "결제",
  etc: "기타",
};

// dnd-kit을 사용하는 테이블은 dev만 로드
const SortableModuleTable = dynamic(() => import("./SortableModuleTable"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-gray-400">로딩 중...</div>,
});

function isNegotiable(mod: Module) {
  return mod.code === "AI_STYLE" && mod.basePrice === 0;
}

function ReadOnlyRow({ mod }: { mod: Module }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 sm:px-4 py-3">
        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
          {mod.name}
          <span className="hidden sm:inline text-[11px] font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            {mod.code}
          </span>
        </div>
        {mod.description && (
          <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
        <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-0.5 whitespace-nowrap">
          {CATEGORY_LABELS[mod.category] || mod.category}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-3 text-sm text-right font-semibold whitespace-nowrap tabular-nums">
        {isNegotiable(mod) ? (
          <span className="text-orange-600">협의</span>
        ) : (
          `${formatKRW(mod.basePrice)}원`
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 text-[13px] text-right text-gray-400 whitespace-nowrap tabular-nums hidden lg:table-cell">
        {isNegotiable(mod) ? "—" : formatKRW(applyPriceRate(mod.basePrice, 0.3))}
      </td>
      <td className="px-3 sm:px-4 py-3 text-[13px] text-right text-gray-400 whitespace-nowrap tabular-nums hidden lg:table-cell">
        {isNegotiable(mod) ? "—" : formatKRW(applyPriceRate(mod.basePrice, 1.3))}
      </td>
      <td className="px-3 sm:px-4 py-3 text-center">
        {mod.isAutoIncluded ? (
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
            자동
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

export default function ModulesPage() {
  const { isDev, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [originalValues, setOriginalValues] = useState<Record<string, { basePrice: number; isActive: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    // dev는 미사용 모듈 포함 전체 조회
    fetch(`/api/modules${isDev ? "?all=1" : ""}`)
      .then((r) => r.json())
      .then((data: Module[]) => {
        setModules(data);
        setOriginalOrder(data.map((m) => m.id));
        setOriginalValues(
          Object.fromEntries(data.map((m) => [m.id, { basePrice: m.basePrice, isActive: m.isActive }]))
        );
        setModulesLoaded(true);
      });
  }, [authLoading, isDev]);

  const currentOrder = modules.map((m) => m.id);
  const orderChanged = JSON.stringify(currentOrder) !== JSON.stringify(originalOrder);
  const dirtyModules = modules.filter((m) => {
    const orig = originalValues[m.id];
    return orig && (orig.basePrice !== m.basePrice || orig.isActive !== m.isActive);
  });
  const changeCount = dirtyModules.length + (orderChanged ? 1 : 0);
  const hasChanges = changeCount > 0;

  async function handleSave() {
    setSaving(true);
    try {
      if (orderChanged) {
        const orders = modules.map((mod, i) => ({ id: mod.id, sortOrder: i + 1 }));
        const res = await fetch("/api/modules/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders }),
        });
        if (!res.ok) throw new Error("순서 저장 실패");
      }
      for (const mod of dirtyModules) {
        const res = await fetch(`/api/modules/${mod.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ basePrice: mod.basePrice, isActive: mod.isActive }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `${mod.name} 저장 실패`);
        }
      }
      setOriginalOrder(modules.map((m) => m.id));
      setOriginalValues(
        Object.fromEntries(modules.map((m) => [m.id, { basePrice: m.basePrice, isActive: m.isActive }]))
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !modulesLoaded) {
    return <div className="p-12 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isDev ? "모듈 가격 관리" : "모듈 단가표"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isDev
              ? "단가를 클릭해 바로 수정하고, 좌측 핸들로 순서를 바꿀 수 있습니다. 유형별 환산가가 자동 계산됩니다."
              : "모듈별 기본 단가와 유형별 환산가를 확인할 수 있습니다."}
          </p>
        </div>
        {isDev && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors shrink-0 ${
              hasChanges
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "저장 중..." : "변경사항 저장"}
            {hasChanges && !saving && (
              <span className="bg-white/25 rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                {changeCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500 flex-wrap">
        환산 배율:
        <span className="px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">렌탈 100%</span>
        <span className="px-2.5 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">재행사 30%</span>
        <span className="px-2.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">판매 130%</span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          {isDev ? (
            <SortableModuleTable modules={modules} setModules={setModules} />
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">모듈</th>
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">분류</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">기본 단가</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-normal text-gray-400 whitespace-nowrap hidden lg:table-cell">재행사 30%</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-normal text-gray-400 whitespace-nowrap hidden lg:table-cell">판매 130%</th>
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">자동 포함</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {modules.map((mod) => (
                  <ReadOnlyRow key={mod.id} mod={mod} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {isDev && (
        <p className="text-xs text-gray-400 mt-2.5">
          사용을 끄면 신규 견적 요청 폼에 노출되지 않습니다. 사업팀에게는 사용 중인 모듈만 읽기 전용으로 표시됩니다.
        </p>
      )}
    </div>
  );
}
