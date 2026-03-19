"use client";

import { formatKRW } from "@/lib/pricing";
import { GripVertical } from "lucide-react";
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
    position: isDragging ? ("relative" as const) : undefined,
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
          className="p-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 sm:px-4 py-3 text-sm text-gray-400 w-12">{index + 1}</td>
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

export default function SortableModuleTable({
  modules,
  setModules,
}: {
  modules: Module[];
  setModules: React.Dispatch<React.SetStateAction<Module[]>>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModules((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <table className="w-full">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="w-10" />
          <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 w-12">#</th>
          <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden sm:table-cell">코드</th>
          <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">항목명</th>
          <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">분류</th>
          <th className="text-right px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">기본 단가</th>
          <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">자동 포함</th>
        </tr>
      </thead>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <tbody className="divide-y">
            {modules.map((mod, i) => (
              <SortableRow key={mod.id} mod={mod} index={i} />
            ))}
          </tbody>
        </SortableContext>
      </DndContext>
    </table>
  );
}
