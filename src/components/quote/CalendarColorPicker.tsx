"use client";

import { Check } from "lucide-react";
import { EVENT_PALETTE } from "@/lib/calendar";

/**
 * 달력 막대 색 선택 — 관리자(dev) 전용 UI.
 * value: 지정된 색 인덱스(null=자동), autoIndex: 자동 배정 시 실제로 칠해지는 색(표시용)
 */
export function CalendarColorPicker({
  value,
  autoIndex,
  disabled = false,
  onChange,
}: {
  value: number | null;
  autoIndex?: number;
  disabled?: boolean;
  onChange: (color: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {EVENT_PALETTE.map((c, i) => {
        const selected = value === i;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(i)}
            title={c.name}
            aria-label={`${c.name}${selected ? " (선택됨)" : ""}`}
            aria-pressed={selected}
            className={`w-6 h-6 rounded-full ${c.dot} flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 ${
              selected ? "ring-2 ring-offset-1 ring-gray-800" : ""
            }`}
          >
            {selected && <Check className="w-3.5 h-3.5 text-white" />}
          </button>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={`ml-1 px-2 h-6 rounded-full text-xs border flex items-center gap-1 disabled:opacity-50 ${
          value === null ? "border-gray-800 font-medium text-gray-800" : "border-gray-300 text-gray-500 hover:bg-gray-50"
        }`}
        title="다른 행사와 겹치지 않게 자동으로 배정"
      >
        {autoIndex !== undefined && <span className={`w-2.5 h-2.5 rounded-full ${EVENT_PALETTE[autoIndex].dot}`} />}
        자동
      </button>
    </div>
  );
}
