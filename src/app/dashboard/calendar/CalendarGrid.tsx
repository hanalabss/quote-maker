"use client";

import { useRouter } from "next/navigation";
import { getMonthGrid, isToday, layoutWeek, DAY_NAMES, type CalendarEvent } from "@/lib/calendar";
import { EventBar, DeadlineDot } from "./CalendarEvent";

// 한 주에 보여줄 최대 줄 수 — 넘치면 날짜별 "+N"
const MAX_LANES = 4;
const LANE_PX = 22;
const HEADER_PX = 28;

export function CalendarGrid({
  year,
  month,
  events,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const weeks = getMonthGrid(year, month);

  function goToQuote(id: string) {
    router.push(`/dashboard/quotes/${id}`);
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {DAY_NAMES.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-medium ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 주 단위: 날짜 칸(배경) 위에 행사 막대를 여러 칸에 걸쳐 그린다 */}
      {weeks.map((week, wi) => {
        const segments = layoutWeek(week, events);
        const usedLanes = Math.min(MAX_LANES, segments.reduce((m, s) => Math.max(m, s.lane + 1), 0));
        const visible = segments.filter((s) => s.lane < MAX_LANES);
        // 날짜별로 가려진 막대 수
        const hiddenByCol = Array(7).fill(0);
        for (const s of segments) {
          if (s.lane < MAX_LANES) continue;
          for (let c = s.startCol; c < s.startCol + s.span; c++) hiddenByCol[c]++;
        }
        const hasHidden = hiddenByCol.some((n) => n > 0);
        const minHeight = HEADER_PX + Math.max(2, usedLanes) * LANE_PX + (hasHidden ? 16 : 6);

        return (
          <div key={wi} className="relative border-b last:border-b-0" style={{ minHeight }}>
            {/* 배경: 날짜 칸 */}
            <div className="absolute inset-0 grid grid-cols-7">
              {week.map((date, di) => {
                const isCurrentMonth = date.getMonth() === month;
                const today = isToday(date);
                return (
                  <div
                    key={di}
                    className={`border-r last:border-r-0 p-1 flex flex-col ${!isCurrentMonth ? "bg-gray-50" : ""} ${
                      today ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-center sm:justify-start">
                      <span
                        className={`text-xs sm:text-sm w-6 h-6 flex items-center justify-center rounded-full ${
                          today
                            ? "bg-blue-600 text-white font-bold"
                            : !isCurrentMonth
                            ? "text-gray-300"
                            : di === 0
                            ? "text-red-500"
                            : di === 6
                            ? "text-blue-500"
                            : "text-gray-700"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                    {hiddenByCol[di] > 0 && (
                      <div className="mt-auto text-[10px] text-gray-500 text-center">+{hiddenByCol[di]}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 막대: 같은 7칸 그리드에서 시작 칸 + 걸치는 일수만큼 차지 */}
            <div
              className="relative grid grid-cols-7 gap-y-0.5 px-0.5"
              style={{ paddingTop: HEADER_PX, gridAutoRows: `${LANE_PX - 2}px` }}
            >
              {visible.map((s) => (
                <div
                  key={`${s.kind}-${s.event.id}`}
                  className="min-w-0 px-0.5"
                  style={{ gridColumn: `${s.startCol + 1} / span ${s.span}`, gridRow: s.lane + 1 }}
                >
                  {s.kind === "event" ? (
                    <EventBar
                      event={s.event}
                      continuesBefore={s.continuesBefore}
                      continuesAfter={s.continuesAfter}
                      onClick={() => goToQuote(s.event.id)}
                    />
                  ) : (
                    <DeadlineDot event={s.event} onClick={() => goToQuote(s.event.id)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
