"use client";

import type { CalendarEvent } from "@/lib/calendar";
import type { QuoteType } from "@/types";

const EVENT_COLORS: Record<string, string> = {
  rental: "bg-blue-500 text-white",
  sale: "bg-orange-500 text-white",
  re_event: "bg-teal-500 text-white",
};

export function EventBar({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const color = EVENT_COLORS[event.type] || "bg-gray-500 text-white";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs truncate ${color} hover:opacity-80 transition-opacity cursor-pointer`}
      title={`${event.eventName} (${event.quoteNumber})`}
    >
      <span className="hidden sm:inline">{event.eventName}</span>
      <span className="sm:hidden">&nbsp;</span>
    </button>
  );
}

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
      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs truncate bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer"
      title={`마감: ${event.eventName} (${event.quoteNumber})`}
    >
      <span className="hidden sm:inline">🔴 {event.eventName}</span>
      <span className="sm:hidden">🔴</span>
    </button>
  );
}
