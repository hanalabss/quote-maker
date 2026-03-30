"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, AlertTriangle } from "lucide-react";
import { getMonthLabel, parseYMD, type CalendarEvent } from "@/lib/calendar";
import { CalendarGrid } from "./CalendarGrid";
import { TYPE_LABELS } from "@/types";
import type { QuoteType } from "@/types";

export function CalendarClient({
  events,
  userRole,
}: {
  events: CalendarEvent[];
  userRole: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6" />
          {userRole === "sales" ? "내 행사 달력" : "행사 달력"}
        </h1>
        <div className="text-sm text-gray-500">
          확정 {events.length}건
        </div>
      </div>

      {/* 개발 진행 현황 (마감 임박순) */}
      {(() => {
        const upcoming = events
          .filter((ev) => ev.devDeadline)
          .map((ev) => {
            const deadline = parseYMD(ev.devDeadline!);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const diff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return { ...ev, diff };
          })
          .sort((a, b) => a.diff - b.diff);

        if (upcoming.length === 0) return null;

        return (
          <div className="mb-6 bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-medium text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-500" />
                {userRole === "sales" ? "내 행사 진행 현황" : "개발 진행 현황"}
              </h3>
              <span className="text-xs text-gray-400">{upcoming.length}건</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto divide-y">
              {upcoming.map((ev) => (
                <a
                  key={ev.id}
                  href={`/dashboard/quotes/${ev.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <span className={`text-xs font-bold min-w-[52px] text-center px-2 py-1 rounded ${
                    ev.diff < 0 ? "bg-red-100 text-red-700" :
                    ev.diff <= 7 ? "bg-red-50 text-red-600" :
                    ev.diff <= 14 ? "bg-amber-50 text-amber-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {ev.diff < 0 ? `${Math.abs(ev.diff)}일 초과` : ev.diff === 0 ? "오늘" : `D-${ev.diff}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{ev.eventName}</div>
                    <div className="text-xs text-gray-400">
                      마감 {ev.devDeadline} · 행사 {ev.confirmedDate}
                      {ev.eventEndDate && ev.eventEndDate !== ev.confirmedDate ? ` ~ ${ev.eventEndDate}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                    ev.type === "rental" ? "bg-blue-100 text-blue-700" :
                    ev.type === "re_event" ? "bg-teal-100 text-teal-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {TYPE_LABELS[ev.type as QuoteType] || ev.type}
                  </span>
                </a>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[120px] text-center">
            {getMonthLabel(year, month)}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
        >
          오늘
        </button>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500" />
          렌탈
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-teal-500" />
          재행사
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          개발 마감
        </span>
      </div>

      {/* 달력 그리드 */}
      <CalendarGrid year={year} month={month} events={events} />

      {/* 이번 달 이벤트 목록 (모바일용) */}
      <div className="mt-6 sm:hidden">
        <h3 className="font-medium text-sm text-gray-600 mb-3">
          {getMonthLabel(year, month)} 행사 목록
        </h3>
        {events.filter((ev) => {
          const d = new Date(ev.confirmedDate + "T00:00:00");
          return d.getFullYear() === year && d.getMonth() === month;
        }).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">이번 달 확정 행사가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {events
              .filter((ev) => {
                const d = new Date(ev.confirmedDate + "T00:00:00");
                return d.getFullYear() === year && d.getMonth() === month;
              })
              .map((ev) => (
                <a
                  key={ev.id}
                  href={`/dashboard/quotes/${ev.id}`}
                  className="block p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{ev.eventName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ev.type === "rental" ? "bg-blue-100 text-blue-700" :
                      ev.type === "sale" ? "bg-orange-100 text-orange-700" :
                      "bg-teal-100 text-teal-700"
                    }`}>
                      {TYPE_LABELS[ev.type as QuoteType] || ev.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {ev.confirmedDate}{ev.eventEndDate ? ` ~ ${ev.eventEndDate}` : ""}
                    {ev.devDeadline && (
                      <span className="ml-2 text-red-600">마감: {ev.devDeadline}</span>
                    )}
                  </div>
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
