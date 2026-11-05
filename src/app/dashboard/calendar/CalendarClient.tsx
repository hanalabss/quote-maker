"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, AlertTriangle, Palette, X } from "lucide-react";
import { assignEventColors, getMonthLabel, paletteOf, parseYMD, type CalendarEvent } from "@/lib/calendar";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarColorPicker } from "@/components/quote/CalendarColorPicker";
import { TYPE_LABELS } from "@/types";
import type { QuoteType } from "@/types";

export function CalendarClient({
  events: rawEvents,
  userRole,
}: {
  events: CalendarEvent[];
  userRole: string;
}) {
  const isDev = userRole === "dev";
  // 이 화면에서 바꾼 색 (저장 성공분) — 새로고침 없이 바로 반영
  const [colorOverrides, setColorOverrides] = useState<Record<string, number | null>>({});
  const [colorMode, setColorMode] = useState(false);
  const [picker, setPicker] = useState<{ event: CalendarEvent; top: number; left: number } | null>(null);
  const [savingColor, setSavingColor] = useState(false);
  const [colorError, setColorError] = useState("");

  // 행사마다 구분 색 배정 — 막대·마감 색띠·진행 현황 점이 같은 색
  const events = useMemo(
    () =>
      assignEventColors(
        rawEvents.map((ev) => (ev.id in colorOverrides ? { ...ev, customColor: colorOverrides[ev.id] } : ev))
      ),
    [rawEvents, colorOverrides]
  );
  // 이 행사를 "자동"으로 되돌리면 어떤 색이 되는지 (다른 행사의 지정 색은 유지한 채 계산)
  function autoColorOf(id: string) {
    return assignEventColors(events.map((ev) => (ev.id === id ? { ...ev, customColor: null } : ev))).find(
      (ev) => ev.id === id
    )?.colorIndex;
  }

  function openPicker(event: CalendarEvent, anchor: DOMRect) {
    setColorError("");
    const width = 300;
    setPicker({
      event,
      top: anchor.bottom + 6,
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
    });
  }

  async function saveColor(color: number | null) {
    if (!picker) return;
    setSavingColor(true);
    setColorError("");
    try {
      const res = await fetch(`/api/quotes/${picker.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarColor: color }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setColorError(data.error || "색 저장에 실패했습니다");
        return;
      }
      setColorOverrides((prev) => ({ ...prev, [picker.event.id]: color }));
      setPicker(null);
    } catch {
      setColorError("색 저장에 실패했습니다");
    } finally {
      setSavingColor(false);
    }
  }
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
          진행 {events.filter((ev) => ev.status !== "completed").length}건 · 완료{" "}
          {events.filter((ev) => ev.status === "completed").length}건
        </div>
      </div>

      {/* 개발 진행 현황 (마감 임박순) */}
      {(() => {
        // 아직 배포 전인 확정 행사만 — 배포·완료된 건은 마감 관리 대상이 아님
        const upcoming = events
          .filter((ev) => ev.devDeadline && !ev.devCompletedAt && ev.status !== "completed")
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
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${paletteOf(ev)?.dot || "bg-gray-300"}`} />
                      {ev.eventName}
                    </div>
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
        <div className="flex items-center gap-2">
          {isDev && (
            <button
              onClick={() => {
                setColorMode((m) => !m);
                setPicker(null);
              }}
              aria-pressed={colorMode}
              className={`px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1.5 transition-colors ${
                colorMode ? "bg-gray-900 text-white border-gray-900" : "hover:bg-gray-50"
              }`}
            >
              <Palette className="w-4 h-4" />
              {colorMode ? "색 지정 끝내기" : "색 지정"}
            </button>
          )}
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            오늘
          </button>
        </div>
      </div>

      {colorMode && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs">
          색을 바꿀 행사 막대를 누르세요. 지정한 색은 모든 사람의 달력에 똑같이 보입니다.
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="flex">
            <span className="w-3 h-3 rounded-l bg-blue-500" />
            <span className="w-3 h-3 bg-emerald-600" />
            <span className="w-3 h-3 rounded-r bg-orange-500" />
          </span>
          행사별 색 구분
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200" />
          완료된 행사
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200 border-l-4 border-l-blue-500" />
          개발 마감 (배포 전, 왼쪽 색 = 해당 행사)
        </span>
      </div>

      {/* 달력 그리드 */}
      <CalendarGrid
        year={year}
        month={month}
        events={events}
        onEventClick={colorMode ? openPicker : undefined}
      />

      {/* 색 선택 팝오버 (관리자 색 지정 모드) */}
      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={`${picker.event.eventName} 달력 색`}
            className="fixed z-50 w-[300px] bg-white rounded-xl border shadow-lg p-3"
            style={{ top: picker.top, left: picker.left }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{picker.event.eventName}</div>
                <div className="text-xs text-gray-400">{picker.event.quoteNumber}</div>
              </div>
              <button onClick={() => setPicker(null)} className="p-1 rounded hover:bg-gray-100" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CalendarColorPicker
              value={events.find((e) => e.id === picker.event.id)?.customColor ?? null}
              autoIndex={autoColorOf(picker.event.id)}
              disabled={savingColor}
              onChange={saveColor}
            />
            {picker.event.status === "completed" && (
              <p className="mt-2 text-xs text-gray-400">완료된 행사는 회색으로 표시됩니다.</p>
            )}
            {colorError && <p className="mt-2 text-xs text-red-600">{colorError}</p>}
          </div>
        </>
      )}

      {/* 이번 달 이벤트 목록 (모바일용) */}
      <div className="mt-6 sm:hidden">
        <h3 className="font-medium text-sm text-gray-600 mb-3">
          {getMonthLabel(year, month)} 행사 목록
        </h3>
        {events.filter((ev) => {
          const d = new Date(ev.confirmedDate + "T00:00:00");
          return d.getFullYear() === year && d.getMonth() === month;
        }).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">이번 달 행사가 없습니다</p>
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
                    {ev.devDeadline && !ev.devCompletedAt && ev.status !== "completed" && (
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
