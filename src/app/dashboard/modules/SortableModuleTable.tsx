"use client";

import { formatKRW, applyPriceRate } from "@/lib/pricing";
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

function isNegotiable(mod: Module) {
  return mod.code === "AI_STYLE" && mod.basePrice === 0;
}

function SortableRow({
  mod,
  onChangePrice,
  onToggleActive,
}: {
  mod: Module;
  onChangePrice: (id: string, price: number) => void;
  onToggleActive: (id: string) => void;
}) {
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
      className={`${isDragging ? "bg-blue-50 shadow-lg" : "hover:bg-gray-50"} ${
        !mod.isActive ? "opacity-50" : ""
      }`}
    >
      <td className="px-2 py-3 w-10">
        <button
          {...attributes}
          {...listeners}
          aria-label={`${mod.name} 순서 변경`}
          className="p-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          {mod.name}
          <span className="hidden sm:inline text-[11px] font-mono font-normal text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
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
      <td className="px-2 py-3 text-right whitespace-nowrap">
        <label className="sr-only" htmlFor={`price-${mod.id}`}>{mod.name} 기본 단가</label>
        <input
          id={`price-${mod.id}`}
          type="text"
          inputMode="numeric"
          value={formatKRW(mod.basePrice)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChangePrice(mod.id, digits ? parseInt(digits, 10) : 0);
          }}
          className="w-[104px] text-right text-sm font-semibold tabular-nums px-2 py-1.5 rounded-md border border-transparent hover:border-gray-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none bg-transparent"
        />
        {mod.code === "AI_STYLE" && (
          <div className="text-[10px] text-orange-500 pr-2">0 = 협의</div>
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
      <td className="px-3 sm:px-4 py-3 text-center">
        <button
          role="switch"
          aria-checked={mod.isActive}
          aria-label={`${mod.name} 사용 여부`}
          onClick={() => onToggleActive(mod.id)}
          className={`relative inline-flex w-9 h-5 rounded-full transition-colors align-middle ${
            mod.isActive ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              mod.isActive ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
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

  function handleChangePrice(id: string, price: number) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, basePrice: price } : m)));
  }

  function handleToggleActive(id: string) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, isActive: !m.isActive } : m)));
  }

  return (
    // DndContext는 table 밖에 두어야 접근성 live region(div)이 table 안에 렌더링되지 않는다
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="w-10" />
            <th className="text-left px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">모듈</th>
            <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 hidden md:table-cell">분류</th>
            <th className="text-right px-2 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">기본 단가</th>
            <th className="text-right px-3 sm:px-4 py-3 text-xs font-normal text-gray-400 whitespace-nowrap hidden lg:table-cell">재행사 30%</th>
            <th className="text-right px-3 sm:px-4 py-3 text-xs font-normal text-gray-400 whitespace-nowrap hidden lg:table-cell">판매 130%</th>
            <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">자동 포함</th>
            <th className="text-center px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-500">사용</th>
          </tr>
        </thead>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <tbody className="divide-y">
            {modules.map((mod) => (
              <SortableRow
                key={mod.id}
                mod={mod}
                onChangePrice={handleChangePrice}
                onToggleActive={handleToggleActive}
              />
            ))}
          </tbody>
        </SortableContext>
      </table>
    </DndContext>
  );
}
