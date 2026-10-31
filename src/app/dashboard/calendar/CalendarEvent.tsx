"use client";

import type { CalendarEvent } from "@/lib/calendar";

const EVENT_COLORS: Record<string, string> = {
  rental: "bg-blue-500 text-white",
  sale: "bg-orange-500 text-white",
  re_event: "bg-teal-500 text-white",
};

// 행사 기간 막대 — 여러 날에 걸치면 한 막대로 이어지고, 주가 바뀌는 쪽은 모서리를 펴서 이어짐을 표시
export function EventBar({
  event,
  continuesBefore = false,
  continuesAfter = false,
  onClick,
}: {
  event: CalendarEvent;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  onClick: () => void;
}) {
  // 완료된 행사는 흐리게 — 지금 챙길 행사와 구분
  const color =
    event.status === "completed"
      ? "bg-gray-200 text-gray-600"
      : EVENT_COLORS[event.type] || "bg-gray-500 text-white";
  const period = event.eventEndDate && event.eventEndDate !== event.confirmedDate
    ? `${event.confirmedDate} ~ ${event.eventEndDate}`
    : event.confirmedDate;
  return (
    <button
      onClick={onClick}
      className={`w-full h-full text-left px-1.5 text-[10px] sm:text-xs leading-[20px] truncate ${color} hover:opacity-85 transition-opacity cursor-pointer ${
        continuesBefore ? "rounded-l-none" : "rounded-l"
      } ${continuesAfter ? "rounded-r-none" : "rounded-r"}`}
      title={`${event.eventName} (${event.quoteNumber}) · ${period}`}
    >
      {continuesBefore && <span aria-hidden="true">◂ </span>}
      {event.eventName}
    </button>
  );
}

// 개발 마감 — 행사 막대와 구분되는 1일 표시
export function DeadlineDot({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full text-left px-1.5 rounded text-[10px] sm:text-xs leading-[20px] truncate bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
      title={`개발 마감: ${event.eventName} (${event.quoteNumber})`}
    >
      <span className="font-semibold">마감</span> {event.eventName}
    </button>
  );
}
