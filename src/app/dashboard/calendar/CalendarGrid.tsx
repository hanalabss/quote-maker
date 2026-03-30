"use client";

import { useRouter } from "next/navigation";
import {
  getMonthGrid,
  getEventsForDate,
  getDeadlinesForDate,
  isToday,
  DAY_NAMES,
  type CalendarEvent,
} from "@/lib/calendar";
import { EventBar, DeadlineDot } from "./CalendarEvent";

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

      {/* 날짜 그리드 */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((date, di) => {
            const isCurrentMonth = date.getMonth() === month;
            const today = isToday(date);
            const dayEvents = getEventsForDate(date, events);
            const dayDeadlines = getDeadlinesForDate(date, events);
            // 마감 이벤트에서 이미 이벤트 바로 표시된 건 제외
            const deadlineOnly = dayDeadlines.filter(
              (dl) => !dayEvents.some((ev) => ev.id === dl.id)
            );

            return (
              <div
                key={di}
                className={`min-h-[60px] sm:min-h-[90px] p-1 border-r last:border-r-0 ${
                  !isCurrentMonth ? "bg-gray-50" : ""
                }`}
              >
                {/* 날짜 숫자 */}
                <div className="flex items-center justify-center sm:justify-start mb-0.5">
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

                {/* 이벤트 */}
                <div className="space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const isDeadline = dayDeadlines.some((dl) => dl.id === ev.id);
                    return isDeadline ? (
                      <DeadlineDot
                        key={`dl-${ev.id}`}
                        event={ev}
                        onClick={() => goToQuote(ev.id)}
                      />
                    ) : (
                      <EventBar
                        key={ev.id}
                        event={ev}
                        onClick={() => goToQuote(ev.id)}
                      />
                    );
                  })}
                  {deadlineOnly.slice(0, 2).map((ev) => (
                    <DeadlineDot
                      key={`dl-${ev.id}`}
                      event={ev}
                      onClick={() => goToQuote(ev.id)}
                    />
                  ))}
                  {dayEvents.length + deadlineOnly.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center">
                      +{dayEvents.length + deadlineOnly.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
