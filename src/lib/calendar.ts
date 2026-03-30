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

/** 이벤트가 해당 날짜에 걸치는지 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = date.getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

export interface CalendarEvent {
  id: string;
  quoteNumber: string;
  eventName: string;
  type: string;
  confirmedDate: string;
  eventEndDate: string | null;
  devDeadline: string | null;
  createdByName: string | null;
}

/** 특정 날짜에 해당하는 이벤트 필터 */
export function getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((ev) => {
    const start = parseYMD(ev.confirmedDate);
    const end = ev.eventEndDate ? parseYMD(ev.eventEndDate) : start;
    return isDateInRange(date, start, end);
  });
}

/** 특정 날짜에 마감인 이벤트 */
export function getDeadlinesForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((ev) => {
    if (!ev.devDeadline) return false;
    return isSameDay(date, parseYMD(ev.devDeadline));
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
