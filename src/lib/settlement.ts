// 입금(정산) 기록 기준일
// 행사 대금은 월 단위 정산 — 행사 종료 달 말일 또는 그다음 달 말일 입금으로 기록한다.

/** yyyy-mm-dd가 속한 달에서 offset개월 뒤 달의 말일 (offset 0 = 같은 달) */
export function monthEnd(date: string, offset = 0): string {
  const [y, m] = date.split("-").map(Number);
  // Date.UTC(y, m + offset, 0) = (m + offset)월의 0일 = 그 전달(목표 달) 말일
  const d = new Date(Date.UTC(y, m - 1 + offset + 1, 0));
  return d.toISOString().slice(0, 10);
}

/** 정산 기준일: 행사 종료 달 말일 / 다음 달 말일 */
export function settlementDates(eventEnd: string): { thisMonthEnd: string; nextMonthEnd: string } {
  return { thisMonthEnd: monthEnd(eventEnd, 0), nextMonthEnd: monthEnd(eventEnd, 1) };
}

/** 정산 대상 행사 종료일 (확정 종료일 → 요청서 종료일 → 시작일 순) */
export function settlementBaseDate(q: {
  confirmedEndDate?: string | null;
  eventEndDate?: string | null;
  confirmedDate?: string | null;
  eventDate?: string | null;
}): string | null {
  return q.confirmedEndDate || q.eventEndDate || q.confirmedDate || q.eventDate || null;
}
