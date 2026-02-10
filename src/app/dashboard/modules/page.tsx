"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatKRW } from "@/lib/pricing";
import { GripVertical, Save, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function SortableRow({ mod, index }: { mod: Module; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "bg-blue-50 shadow-lg" : "hover:bg-gray-50"}`}
    >
      <td className="px-2 py-3 w-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 w-12">{index + 1}</td>
      <td className="px-4 py-3 text-sm font-mono text-gray-600">{mod.code}</td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium">{mod.name}</div>
        {mod.description && (
          <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
        {CATEGORY_LABELS[mod.category] || mod.category}
      </td>
      <td className="px-4 py-3 text-sm text-right font-medium">
        {mod.basePrice === 0 && mod.code === "AI_STYLE" ? (
          <span className="text-orange-600">협의</span>
        ) : (
          `${formatKRW(mod.basePrice)}원`
        )}
      </td>
      <td className="px-4 py-3 text-center">
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
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (!user || user.role !== "dev") {
          router.replace("/dashboard/quotes");
          return;
        }
        setAuthorized(true);
      });

    fetch("/api/modules")
      .then((r) => r.json())
      .then((data: Module[]) => {
        setModules(data);
        setOriginalOrder(data.map((m) => m.id));
      });
  }, [router]);

  const currentOrder = modules.map((m) => m.id);
  const hasChanges = JSON.stringify(currentOrder) !== JSON.stringify(originalOrder);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setModules((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

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

  if (!authorized) {
    return (
      <div className="p-12 text-center text-gray-400">로딩 중...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">모듈 가격 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            드래그하여 순서를 변경할 수 있습니다. 변경 후 저장을 눌러주세요.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "저장 중..." : "순서 저장"}
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10" />
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-12">#</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">코드</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">항목명</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 hidden md:table-cell">분류</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">기본 단가</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">자동 포함</th>
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={modules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y">
                {modules.map((mod, i) => (
                  <SortableRow key={mod.id} mod={mod} index={i} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}
