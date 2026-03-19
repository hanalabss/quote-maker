"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { formatKRW } from "@/lib/pricing";
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

function ReadOnlyRow({ mod, index }: { mod: Module; index: number }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-400 w-12">{index + 1}</td>
      <td className="px-3 sm:px-4 py-3 text-sm font-mono text-gray-600 hidden sm:table-cell">{mod.code}</td>
      <td className="px-3 sm:px-4 py-3">
        <div className="text-sm font-medium">{mod.name}</div>
        {mod.description && (
          <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
        {CATEGORY_LABELS[mod.category] || mod.category}
      </td>
      <td className="px-3 sm:px-4 py-3 text-sm text-right font-medium whitespace-nowrap">
        {mod.basePrice === 0 && mod.code === "AI_STYLE" ? (
          <span className="text-orange-600">협의</span>
        ) : (
          `${formatKRW(mod.basePrice)}원`
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 text-center">
        {mod.isAutoIncluded && (
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
            자동
          </span>
        )}
      </td>
    </tr>
  );
}

export default function ModulesPage() {
  const { isDev, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => r.json())
      .then((data: Module[]) => {
        setModules(data);
        setOriginalOrder(data.map((m) => m.id));
        setModulesLoaded(true);
      });
  }, []);

  const currentOrder = modules.map((m) => m.id);
  const hasChanges = JSON.stringify(currentOrder) !== JSON.stringify(originalOrder);

  async function handleSave() {
    setSaving(true);
    const orders = modules.map((mod, i) => ({ id: mod.id, sortOrder: i + 1 }));
    const res = await fetch("/api/modules/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
    if (res.ok) {
      setOriginalOrder(modules.map((m) => m.id));
    } else {
      alert("저장에 실패했습니다");
    }
    setSaving(false);
  }

  if (authLoading || !modulesLoaded) {
    return <div className="p-12 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isDev ? "모듈 가격 관리" : "모듈 단가표"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isDev
              ? "드래그하여 순서를 변경할 수 있습니다. 변경 후 저장을 눌러주세요."
              : "모듈별 기본 단가를 확인할 수 있습니다."}
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
            {saving ? "저장 중..." : "순서 저장"}
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          {isDev ? (
            <SortableModuleTable modules={modules} setModules={setModules} />
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 w-12">#</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">코드</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">항목명</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">분류</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">기본 단가</th>
                  <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">자동 포함</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {modules.map((mod, i) => (
                  <ReadOnlyRow key={mod.id} mod={mod} index={i} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
