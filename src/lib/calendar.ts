/**
 * 달력 유틸리티 함수
 */

/** "YYYY-MM-DD" 문자열을 로컬 Date로 파싱 (timezone 이슈 방지) */
export function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 월간 그리드 생성: 6주 x 7일 = 42칸 */
export function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay(); // 0=일 ~ 6=토
  const gridStart = new Date(year, month, 1 - startDay);

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      week.push(date);
    }
    weeks.push(week);
  }
  return weeks;
}

/** 두 날짜가 같은 날인지 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** 오늘인지 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export interface CalendarEvent {
  id: string;
  quoteNumber: string;
  eventName: string;
  type: string;
  confirmedDate: string;
  eventEndDate: string | null;
  devDeadline: string | null;
  devCompletedAt?: string | null; // 배포 완료 시각 — 있으면 마감 표시 안 함
  status?: string; // confirmed | completed
  createdByName: string | null;
}

/**
 * 주 단위 막대 배치 — 여러 날 행사를 날짜마다 반복하지 않고 한 막대로 이어 그린다.
 * 행사 기간과 개발 마감(1일)을 한 주 안에서 겹치지 않는 줄(lane)에 배치한다.
 */
export interface WeekSegment {
  event: CalendarEvent;
  kind: "event" | "deadline";
  startCol: number; // 0~6
  span: number; // 1~7
  lane: number; // 0부터
  continuesBefore: boolean; // 지난주에서 이어짐
  continuesAfter: boolean; // 다음 주로 이어짐
}

const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function layoutWeek(week: Date[], events: CalendarEvent[]): WeekSegment[] {
  const weekStart = dayKey(week[0]);
  const weekEnd = dayKey(week[6]);
  const DAY = 24 * 60 * 60 * 1000;
  const col = (t: number) => Math.round((t - weekStart) / DAY);

  const raw: Omit<WeekSegment, "lane">[] = [];
  for (const ev of events) {
    const s = dayKey(parseYMD(ev.confirmedDate));
    const e = ev.eventEndDate ? Math.max(s, dayKey(parseYMD(ev.eventEndDate))) : s;
    if (e >= weekStart && s <= weekEnd) {
      const from = Math.max(s, weekStart);
      const to = Math.min(e, weekEnd);
      raw.push({
        event: ev,
        kind: "event",
        startCol: col(from),
        span: col(to) - col(from) + 1,
        continuesBefore: s < weekStart,
        continuesAfter: e > weekEnd,
      });
    }
    // 마감은 아직 해야 할 일일 때만 (배포 완료·행사 완료 후에는 표시 안 함)
    if (ev.devDeadline && !ev.devCompletedAt && ev.status !== "completed") {
      const d = dayKey(parseYMD(ev.devDeadline));
      if (d >= weekStart && d <= weekEnd) {
        raw.push({ event: ev, kind: "deadline", startCol: col(d), span: 1, continuesBefore: false, continuesAfter: false });
      }
    }
  }

  // 긴 막대·이른 시작 우선, 행사 막대가 마감 표시보다 위
  raw.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "event" ? -1 : 1) ||
      a.startCol - b.startCol ||
      b.span - a.span ||
      a.event.confirmedDate.localeCompare(b.event.confirmedDate)
  );

  const lanes: boolean[][] = [];
  return raw.map((seg) => {
    let lane = 0;
    for (;; lane++) {
      lanes[lane] ??= Array(7).fill(false);
      const free = lanes[lane].slice(seg.startCol, seg.startCol + seg.span).every((used) => !used);
      if (free) break;
    }
    for (let c = seg.startCol; c < seg.startCol + seg.span; c++) lanes[lane][c] = true;
    return { ...seg, lane };
  });
}

/** 월 라벨 */
const MONTH_NAMES = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

export function getMonthLabel(year: number, month: number): string {
  return `${year}년 ${MONTH_NAMES[month]}`;
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
