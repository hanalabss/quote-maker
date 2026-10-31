// 확정 이후 생애주기 배지 판정 (목록/상세 공용)
// 원칙: "초과"류 경고는 아직 해야 할 일이 늦었을 때만 표시한다.
//  - 미배포 + 마감 경과 → 초과 (개발이 실제로 늦음)
//  - 미배포 + 행사 시작일 도래 → 배포 미확인 (초과보다 심각)
//  - 행사 종료 경과 → 완료 처리 대기 (남은 일이 "완료 처리"로 바뀜)
//  - 배포 완료 후에는 마감 개념이 소멸하므로 초과를 표시하지 않는다.
//  - 승인/보류인데 행사일 경과 → 행사일 지남 (거래처 회신 없음 → 미진행 정리 대상)

export interface LifecycleInput {
  status: string;
  devDeadline?: string | null; // yyyy-mm-dd
  devCompletedAt?: string | null; // ISO datetime (배포 완료 시각)
  confirmedDate?: string | null; // 행사 시작일 yyyy-mm-dd
  confirmedEndDate?: string | null; // 행사 종료일 yyyy-mm-dd
  eventDate?: string | null; // 요청서상 행사 시작일 yyyy-mm-dd
  eventEndDate?: string | null; // 요청서상 행사 종료일 yyyy-mm-dd
}

export type LifecycleBadge =
  | { kind: "dday"; days: number } // 미배포, 마감 전 (0 = 오늘 마감)
  | { kind: "overdue"; days: number } // 미배포, 마감 경과 (days ≥ 1)
  | { kind: "deploy-missing" } // 미배포인데 행사 시작일 도래/경과
  | { kind: "deployed" } // 배포 완료, 행사 종료 전
  | { kind: "awaiting-complete" } // 행사 종료 경과, 완료 처리 대기
  | { kind: "event-passed" } // 승인/보류인데 행사일 경과 — 미진행 정리 대상
  | null;

export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// 서버 컴포넌트용 — 서버 TZ(Vercel=UTC)와 무관하게 한국 날짜 yyyy-mm-dd
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

// to - from (일 단위, yyyy-mm-dd 문자열)
export function diffDays(from: string, to: string): number {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function getLifecycleBadge(q: LifecycleInput, today: string): LifecycleBadge {
  // 승인/보류 상태로 행사일이 지남 = 확정 회신 없이 끝난 행사. 상태는 바꾸지 않고 표시만 한다.
  if (q.status === "approved" || q.status === "on_hold") {
    const end = q.eventEndDate || q.eventDate;
    return end && end < today ? { kind: "event-passed" } : null;
  }

  if (q.status !== "confirmed") return null;

  // 행사 종료가 지났으면 배포 여부와 무관하게 남은 일은 "완료 처리"
  if (q.confirmedEndDate && q.confirmedEndDate < today) {
    return { kind: "awaiting-complete" };
  }

  if (!q.devCompletedAt) {
    // 행사 시작일이 도래했는데 배포 기록이 없음 — 마감 초과보다 심각한 신호.
    // 단, 납기가 아직 미래면 일정상 배포 시점이 안 온 것(판매 건 등 행사일≠실제 행사)이므로 D-day 우선.
    const deadlineFuture = !!q.devDeadline && q.devDeadline > today;
    if (q.confirmedDate && q.confirmedDate <= today && !deadlineFuture) {
      return { kind: "deploy-missing" };
    }
    if (q.devDeadline) {
      const d = diffDays(today, q.devDeadline);
      return d < 0 ? { kind: "overdue", days: -d } : { kind: "dday", days: d };
    }
    return null;
  }

  return { kind: "deployed" };
}
