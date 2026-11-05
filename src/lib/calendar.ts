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
  customColor?: number | null; // 관리자가 지정한 색 (Quote.calendarColor, null=자동)
  colorIndex?: number; // 실제 그릴 색 (assignEventColors 결과)
}

/**
 * 행사별 구분 색 — 빨강(마감)·회색(완료)은 쓰지 않음.
 * Tailwind가 클래스를 찾을 수 있게 전체 문자열로 적는다. 인덱스가 DB(Quote.calendarColor)에 저장되므로 순서를 바꾸지 말 것(추가는 뒤에만).
 */
export const EVENT_PALETTE: { name: string; bar: string; stripe: string; dot: string }[] = [
  { name: "파랑", bar: "bg-blue-500 text-white", stripe: "border-l-blue-500", dot: "bg-blue-500" },
  { name: "초록", bar: "bg-emerald-600 text-white", stripe: "border-l-emerald-600", dot: "bg-emerald-600" },
  { name: "주황", bar: "bg-orange-500 text-white", stripe: "border-l-orange-500", dot: "bg-orange-500" },
  { name: "보라", bar: "bg-violet-500 text-white", stripe: "border-l-violet-500", dot: "bg-violet-500" },
  { name: "분홍", bar: "bg-pink-500 text-white", stripe: "border-l-pink-500", dot: "bg-pink-500" },
  { name: "청록", bar: "bg-cyan-600 text-white", stripe: "border-l-cyan-600", dot: "bg-cyan-600" },
  { name: "황토", bar: "bg-amber-600 text-white", stripe: "border-l-amber-600", dot: "bg-amber-600" },
  { name: "남색", bar: "bg-indigo-600 text-white", stripe: "border-l-indigo-600", dot: "bg-indigo-600" },
  { name: "연두", bar: "bg-lime-600 text-white", stripe: "border-l-lime-600", dot: "bg-lime-600" },
  { name: "자주", bar: "bg-fuchsia-600 text-white", stripe: "border-l-fuchsia-600", dot: "bg-fuchsia-600" },
];

export function isValidCalendarColor(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < EVENT_PALETTE.length;
}

/**
 * 행사마다 다른 색을 배정한다. 관리자가 지정한 색이 있으면 그대로 쓰고,
 * 나머지 진행 중 행사는 시작일 순으로 돌아가며 칠해 인접·겹치는 행사가 같은 색이 되지 않게 한다
 * (완료 행사는 회색이라 제외).
 */
export function assignEventColors(events: CalendarEvent[]): CalendarEvent[] {
  const auto = events
    .filter((ev) => ev.status !== "completed" && !isValidCalendarColor(ev.customColor))
    .sort((a, b) => a.confirmedDate.localeCompare(b.confirmedDate) || a.id.localeCompare(b.id));
  const idx = new Map(auto.map((ev, i) => [ev.id, i % EVENT_PALETTE.length]));
  return events.map((ev) => ({
    ...ev,
    colorIndex: isValidCalendarColor(ev.customColor) ? ev.customColor : idx.get(ev.id),
  }));
}

export function paletteOf(event: { colorIndex?: number }) {
  return event.colorIndex === undefined ? null : EVENT_PALETTE[event.colorIndex % EVENT_PALETTE.length];
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
